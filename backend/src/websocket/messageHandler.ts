import { WebSocket } from 'ws';
import { ConnectionManager } from './connectionManager.js';
import { TextOperation } from '../ot/textOperation.js';
import { ServerDocument } from '../ot/serverDocument.js';
import { metrics } from '../utils/metrics.js';
import { DocumentPersistence } from '../services/documentPersistence.js';

const SUPPORTED_LANGUAGES = new Set([
  'javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust', 'html', 'css', 'json'
]);

/**
 * How long an empty room stays in memory. With a database it can be short
 * (the document is saved and reloaded on demand); without one, keep it a day.
 */
const EMPTY_ROOM_TTL_PERSISTED_MS = 30 * 60 * 1000;
const EMPTY_ROOM_TTL_MEMORY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const WELCOME = `// Welcome to Collaborative Code Editor!
// Share this room ID with friends to code together in real-time.

function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("Collaborator");`;

interface RoomState {
  document: ServerDocument;
  language: string;
  lastActive: number;
  /** False if loading from the DB failed — we then never save, so a DB outage can't overwrite real code. */
  persist: boolean;
  /** Resolves once the saved document (if any) has been loaded. */
  ready: Promise<void>;
}

export class MessageHandler {
  private connectionManager: ConnectionManager;
  private persistence: DocumentPersistence;
  private rooms: Map<string, RoomState> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(connectionManager: ConnectionManager, persistence: DocumentPersistence = new DocumentPersistence(null)) {
    this.connectionManager = connectionManager;
    this.persistence = persistence;
    this.cleanupTimer = setInterval(() => void this.cleanupRooms(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref?.();
  }

  /** Get a room, loading its saved document on first access. */
  private ensureRoom(roomId: string): Promise<RoomState> {
    let room = this.rooms.get(roomId);
    if (!room) {
      const fresh: RoomState = {
        document: new ServerDocument(WELCOME),
        language: 'javascript',
        lastActive: Date.now(),
        persist: this.persistence.enabled,
        ready: Promise.resolve()
      };
      fresh.ready = this.loadSaved(roomId, fresh);
      room = fresh;
      this.rooms.set(roomId, room);
      metrics.setActiveRooms(this.rooms.size);
    }
    room.lastActive = Date.now();
    const r = room;
    return r.ready.then(() => r);
  }

  private async loadSaved(roomId: string, room: RoomState): Promise<void> {
    if (!this.persistence.enabled) return;
    try {
      const saved = await this.persistence.load(roomId);
      if (saved) {
        room.document = new ServerDocument(saved.content);
        if (SUPPORTED_LANGUAGES.has(saved.language)) room.language = saved.language;
        console.log(`📂 Loaded room ${roomId} from database (${saved.content.length} chars)`);
      }
    } catch (err) {
      room.persist = false;
      console.error(
        `❌ Could not load room ${roomId} from database — serving it without saving ` +
          `so saved code isn't overwritten: ${(err as Error).message}`
      );
    }
  }

  private markChanged(roomId: string, room: RoomState): void {
    if (!room.persist) return;
    this.persistence.markDirty(roomId, () => ({
      content: room.document.getContent(),
      language: room.language
    }));
  }

  getDocumentContent(roomId: string): string | null {
    return this.rooms.get(roomId)?.document.getContent() ?? null;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  onUserJoined(roomId: string): void {
    // Start loading right away so the document is ready when the client asks for it
    this.ensureRoom(roomId).catch((err) => console.error('Room load error:', err));
  }

  onUserLeft(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.lastActive = Date.now();
    // Last person left → save now instead of waiting for the debounce
    if (this.connectionManager.getRoomSize(roomId) === 0) {
      void this.persistence.flush(roomId);
    }
  }

  async cleanupRooms(now = Date.now()): Promise<void> {
    for (const [id, room] of this.rooms) {
      const ttl = room.persist && this.persistence.enabled ? EMPTY_ROOM_TTL_PERSISTED_MS : EMPTY_ROOM_TTL_MEMORY_MS;
      if (this.connectionManager.getRoomSize(id) > 0 || now - room.lastActive <= ttl) continue;
      if (this.persistence.isDirty(id)) {
        await this.persistence.flush(id);
        if (this.persistence.isDirty(id)) continue; // DB down — keep it in memory for now
      }
      // Someone may have rejoined while we were saving
      if (this.connectionManager.getRoomSize(id) > 0) continue;
      this.rooms.delete(id);
      console.log(`🧹 Unloaded idle room ${id}`);
    }
    metrics.setActiveRooms(this.rooms.size);
  }

  /** Save all unsaved rooms (called on shutdown). */
  flushAll(): Promise<void> {
    return this.persistence.flushAll();
  }

  dispose(): void {
    clearInterval(this.cleanupTimer);
    this.persistence.dispose();
  }

  async handleMessage(roomId: string, userId: string, message: Record<string, unknown>, ws: WebSocket): Promise<void> {
    switch (message.type) {
      case 'operation':
        await this.handleOperation(roomId, userId, message, ws);
        break;
      case 'get_document':
        await this.sendDocument(roomId, ws);
        break;
      case 'cursor':
        this.handleCursor(roomId, userId, message);
        break;
      case 'change_language':
        await this.handleChangeLanguage(roomId, userId, message.language);
        break;
      default:
        console.log('⚠️ Unknown message type:', message.type);
    }
  }

  private async handleOperation(roomId: string, userId: string, message: Record<string, unknown>, ws: WebSocket): Promise<void> {
    const room = await this.ensureRoom(roomId);
    const revision = message.revision;

    let accepted: TextOperation;
    try {
      if (typeof revision !== 'number') throw new Error('missing revision');
      const op = TextOperation.fromJSON(message.operation);
      accepted = room.document.receiveOperation(revision, op);
    } catch (err) {
      // The client's view is out of sync (bad op, stale revision, …).
      // Send it the authoritative document so it can recover.
      console.warn(`⚠️ Rejected op from ${userId} in ${roomId}: ${(err as Error).message}`);
      await this.sendDocument(roomId, ws, true);
      return;
    }

    metrics.incrementOperations();
    this.markChanged(roomId, room);
    const newRevision = room.document.getRevision();

    this.connectionManager.send(ws, { type: 'ack', revision: newRevision });
    this.connectionManager.broadcastToRoom(
      roomId,
      { type: 'operation', userId, operation: accepted.toJSON(), revision: newRevision },
      userId
    );
  }

  private async sendDocument(roomId: string, ws: WebSocket, resync = false): Promise<void> {
    const room = await this.ensureRoom(roomId);
    this.connectionManager.send(ws, {
      type: 'document_sync',
      content: room.document.getContent(),
      revision: room.document.getRevision(),
      language: room.language,
      resync
    });
  }

  private handleCursor(roomId: string, userId: string, message: Record<string, unknown>): void {
    const position = message.position;
    const selectionEnd = message.selectionEnd;
    if (typeof position !== 'number' || !Number.isFinite(position)) return;
    this.connectionManager.broadcastToRoom(
      roomId,
      {
        type: 'cursor_update',
        userId,
        position,
        selectionEnd: typeof selectionEnd === 'number' && Number.isFinite(selectionEnd) ? selectionEnd : position
      },
      userId
    );
  }

  private async handleChangeLanguage(roomId: string, userId: string, language: unknown): Promise<void> {
    if (typeof language !== 'string' || !SUPPORTED_LANGUAGES.has(language)) return;
    const room = await this.ensureRoom(roomId);
    room.language = language;
    this.markChanged(roomId, room);
    console.log(`🌐 Room ${roomId}: language changed to ${language} by ${userId}`);
    this.connectionManager.broadcastToRoom(roomId, { type: 'language_changed', language, userId });
  }
}