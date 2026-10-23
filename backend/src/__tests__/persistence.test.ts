import { describe, it, expect, vi, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { DocumentPersistence, DocumentStore } from '../services/documentPersistence.js';
import { MessageHandler } from '../websocket/messageHandler.js';
import { ConnectionManager } from '../websocket/connectionManager.js';
import { TextOperation } from '../ot/textOperation.js';

/** In-memory stand-in for Postgres. */
class FakeStore implements DocumentStore {
  data = new Map<string, { content: string; language: string }>();
  saves = 0;
  failNextSaves = 0;
  failLoads = false;

  async load(roomId: string) {
    if (this.failLoads) throw new Error('db down');
    return this.data.get(roomId) ?? null;
  }
  async save(roomId: string, content: string, language: string) {
    if (this.failNextSaves > 0) {
      this.failNextSaves--;
      throw new Error('db down');
    }
    this.saves++;
    this.data.set(roomId, { content, language });
  }
}

const mockSocket = () =>
  ({ send: vi.fn(), close: vi.fn(), readyState: WebSocket.OPEN }) as unknown as WebSocket & {
    send: ReturnType<typeof vi.fn>;
  };

const lastMessage = (ws: { send: ReturnType<typeof vi.fn> }, type: string) =>
  ws.send.mock.calls.map((c) => JSON.parse(c[0])).filter((m) => m.type === type).pop();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('DocumentPersistence', () => {
  let p: DocumentPersistence;
  afterEach(() => p?.dispose());

  it('debounces many edits into one save', async () => {
    const store = new FakeStore();
    p = new DocumentPersistence(store, { debounceMs: 30, maxWaitMs: 1000 });
    let text = '';
    for (let i = 0; i < 20; i++) {
      text += 'x';
      p.markDirty('r1', () => ({ content: text, language: 'python' }));
    }
    await sleep(80);
    expect(store.saves).toBe(1);
    expect(store.data.get('r1')).toEqual({ content: 'x'.repeat(20), language: 'python' });
  });

  it('still saves during non-stop typing (max wait)', async () => {
    const store = new FakeStore();
    p = new DocumentPersistence(store, { debounceMs: 50, maxWaitMs: 100 });
    const start = Date.now();
    while (Date.now() - start < 250) {
      p.markDirty('r1', () => ({ content: String(Date.now()), language: 'javascript' }));
      await sleep(10);
    }
    expect(store.saves).toBeGreaterThanOrEqual(2);
  });

  it('retries after a failed save and flush() writes immediately', async () => {
    const store = new FakeStore();
    store.failNextSaves = 1;
    p = new DocumentPersistence(store, { debounceMs: 10_000 });
    p.markDirty('r1', () => ({ content: 'hello', language: 'javascript' }));
    await p.flush('r1'); // first attempt fails
    expect(store.data.has('r1')).toBe(false);
    expect(p.isDirty('r1')).toBe(true);
    await p.flush('r1'); // second succeeds
    expect(store.data.get('r1')?.content).toBe('hello');
    expect(p.isDirty('r1')).toBe(false);
  });
});

describe('MessageHandler persistence', () => {
  const op = (doc: string, text: string) => new TextOperation().retain(doc.length).insert(text);

  it('saves edits and restores them after a "restart"', async () => {
    const store = new FakeStore();

    // --- first server process
    const cm1 = new ConnectionManager();
    const p1 = new DocumentPersistence(store, { debounceMs: 20 });
    const h1 = new MessageHandler(cm1, p1);
    const ws1 = mockSocket();
    cm1.addConnection('room1', 'u1', 'Alice', ws1);
    h1.onUserJoined('room1');
    await h1.handleMessage('room1', 'u1', { type: 'get_document' }, ws1);
    const sync = lastMessage(ws1, 'document_sync');

    await h1.handleMessage('room1', 'u1', { type: 'change_language', language: 'python' }, ws1);
    await h1.handleMessage(
      'room1', 'u1',
      { type: 'operation', revision: sync.revision, operation: op(sync.content, '\nprint("saved")').toJSON() },
      ws1
    );
    await h1.flushAll(); // what SIGTERM does
    h1.dispose();

    // --- second server process (fresh memory, same database)
    const cm2 = new ConnectionManager();
    const h2 = new MessageHandler(cm2, new DocumentPersistence(store));
    const ws2 = mockSocket();
    cm2.addConnection('room1', 'u2', 'Bob', ws2);
    h2.onUserJoined('room1');
    await h2.handleMessage('room1', 'u2', { type: 'get_document' }, ws2);
    const restored = lastMessage(ws2, 'document_sync');
    expect(restored.content).toBe(sync.content + '\nprint("saved")');
    expect(restored.language).toBe('python');
    h2.dispose();
  });

  it('never overwrites saved code when the database could not be read', async () => {
    const store = new FakeStore();
    store.data.set('room1', { content: 'IMPORTANT CODE', language: 'javascript' });
    store.failLoads = true;

    const cm = new ConnectionManager();
    const h = new MessageHandler(cm, new DocumentPersistence(store, { debounceMs: 10 }));
    const ws = mockSocket();
    cm.addConnection('room1', 'u1', 'Alice', ws);
    await h.handleMessage('room1', 'u1', { type: 'get_document' }, ws);
    const sync = lastMessage(ws, 'document_sync');
    await h.handleMessage(
      'room1', 'u1',
      { type: 'operation', revision: sync.revision, operation: op(sync.content, 'x').toJSON() },
      ws
    );
    await h.flushAll();
    await sleep(30);
    expect(store.data.get('room1')?.content).toBe('IMPORTANT CODE');
    h.dispose();
  }, 10_000);

  it('works with no database configured (memory only)', async () => {
    const cm = new ConnectionManager();
    const h = new MessageHandler(cm);
    const ws = mockSocket();
    cm.addConnection('r', 'u', 'A', ws);
    await h.handleMessage('r', 'u', { type: 'get_document' }, ws);
    expect(lastMessage(ws, 'document_sync').content).toContain('Welcome');
    h.dispose();
  });
});