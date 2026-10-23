import { StoredDocument } from '../db/postgres/queries/documents.js';

/** Anything that can load/save a room document (Postgres in prod, a fake in tests). */
export interface DocumentStore {
  init?(): Promise<void>;
  load(roomId: string): Promise<StoredDocument | null>;
  save(roomId: string, content: string, language: string): Promise<void>;
}

type Snapshot = () => StoredDocument;

interface Entry {
  dirty: boolean;
  firstDirtyAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  saving: Promise<void> | null;
  failures: number;
  snapshot: Snapshot;
}

export interface PersistenceOptions {
  /** Save this long after the last edit… */
  debounceMs?: number;
  /** …but never wait longer than this while people keep typing. */
  maxWaitMs?: number;
}

/**
 * Debounced write-behind persistence for room documents.
 * Edits stay in memory (fast) and are written to the database shortly after,
 * so a restart loses at most a couple of seconds of typing.
 */
export class DocumentPersistence {
  private entries = new Map<string, Entry>();
  private initPromise: Promise<void> | null = null;
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;

  constructor(private store: DocumentStore | null, opts: PersistenceOptions = {}) {
    this.debounceMs = opts.debounceMs ?? 2_000;
    this.maxWaitMs = opts.maxWaitMs ?? 10_000;
  }

  get enabled(): boolean {
    return this.store !== null;
  }

  /** Prepare the store (create tables). Retried lazily if it fails. */
  init(): Promise<void> {
    if (!this.store) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = (this.store.init?.() ?? Promise.resolve()).catch((err) => {
        this.initPromise = null; // try again on next use
        throw err;
      });
    }
    return this.initPromise;
  }

  /** Load a saved document. Retries once; throws if the store is unreachable. */
  async load(roomId: string): Promise<StoredDocument | null> {
    if (!this.store) return null;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.init();
        return await this.store.load(roomId);
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 1_000));
      }
    }
    throw lastError;
  }

  /** Record that a room changed; it will be saved after the debounce delay. */
  markDirty(roomId: string, snapshot: Snapshot): void {
    if (!this.store) return;
    let e = this.entries.get(roomId);
    if (!e) {
      e = { dirty: false, firstDirtyAt: 0, timer: null, saving: null, failures: 0, snapshot };
      this.entries.set(roomId, e);
    }
    e.snapshot = snapshot;
    if (!e.dirty) {
      e.dirty = true;
      e.firstDirtyAt = Date.now();
    }
    this.schedule(roomId, e);
  }

  isDirty(roomId: string): boolean {
    const e = this.entries.get(roomId);
    return !!e && (e.dirty || e.saving !== null);
  }

  private schedule(roomId: string, e: Entry, delayOverride?: number): void {
    if (e.timer) clearTimeout(e.timer);
    const waited = Date.now() - e.firstDirtyAt;
    const delay = delayOverride ?? Math.max(0, Math.min(this.debounceMs, this.maxWaitMs - waited));
    e.timer = setTimeout(() => {
      e.timer = null;
      void this.saveNow(roomId);
    }, delay);
  }

  private saveNow(roomId: string): Promise<void> {
    const e = this.entries.get(roomId);
    if (!e || !this.store) return Promise.resolve();
    if (e.saving) return e.saving; // the follow-up save is scheduled when it finishes
    if (e.timer) {
      clearTimeout(e.timer);
      e.timer = null;
    }
    if (!e.dirty) return Promise.resolve();

    e.dirty = false;
    const { content, language } = e.snapshot();
    const store = this.store;

    e.saving = (async () => {
      try {
        await this.init();
        await store.save(roomId, content, language);
        if (e.failures > 0) console.log(`💾 Room ${roomId} saved after ${e.failures} failed attempt(s)`);
        e.failures = 0;
      } catch (err) {
        e.failures++;
        e.dirty = true; // keep the changes queued
        if (e.failures === 1 || e.failures % 10 === 0) {
          console.error(`❌ Failed to save room ${roomId} (attempt ${e.failures}):`, (err as Error).message);
        }
      } finally {
        e.saving = null;
      }
      if (e.dirty) {
        // New edits arrived during the save, or it failed → go again (back off on failures)
        const retryDelay = e.failures > 0 ? Math.min(5_000 * e.failures, 60_000) : undefined;
        if (!e.firstDirtyAt || e.failures > 0) e.firstDirtyAt = Date.now();
        this.schedule(roomId, e, retryDelay);
      } else {
        this.entries.delete(roomId);
      }
    })();
    return e.saving;
  }

  /** Save a room immediately (e.g. when the last user leaves). */
  async flush(roomId: string): Promise<void> {
    for (let i = 0; i < 3 && this.isDirty(roomId); i++) {
      const e = this.entries.get(roomId);
      if (!e) return;
      if (e.saving) await e.saving;
      if (e.dirty) await this.saveNow(roomId);
      if (e.failures > 0) return; // store is down; the retry timer keeps trying
    }
  }

  /** Save every pending room (graceful shutdown). */
  async flushAll(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((id) => this.flush(id)));
  }

  /** Stop retry timers (tests / shutdown). */
  dispose(): void {
    for (const e of this.entries.values()) if (e.timer) clearTimeout(e.timer);
  }
}