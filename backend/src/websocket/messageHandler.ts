import { WebSocket } from 'ws';
import { ConnectionManager } from './connectionManager.js';
import { TextOperation } from '../ot/textOperation.js';
import { ServerDocument } from '../ot/serverDocument.js';
import { metrics } from '../utils/metrics.js';

const SUPPORTED_LANGUAGES = new Set([
  'javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust', 'html', 'css', 'json'
]);

/** Empty rooms keep their document this long so people can come back. */
const EMPTY_ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

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
}

export class MessageHandler {
  private connectionManager: ConnectionManager;
  private rooms: Map<string, RoomState> = new Map();

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    const timer = setInterval(() => this.cleanupRooms(), CLEANUP_INTERVAL_MS);
    timer.unref?.();
  }

  private getRoom(roomId: string): RoomState {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = { document: new ServerDocument(WELCOME), language: 'javascript', lastActive: Date.now() };
      this.rooms.set(roomId, room);
      metrics.setActiveRooms(this.rooms.size);
    }
    room.lastActive = Date.now();
    return room;
  }

  getDocumentContent(roomId: string): string | null {
    return this.rooms.get(roomId)?.document.getContent() ?? null;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  onUserJoined(roomId: string): void {
    this.getRoom(roomId);
  }

  onUserLeft(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) room.lastActive = Date.now();
  }

  cleanupRooms(now = Date.now()): void {
    for (const [id, room] of this.rooms) {
      if (this.connectionManager.getRoomSize(id) === 0 && now - room.lastActive > EMPTY_ROOM_TTL_MS) {
        this.rooms.delete(id);
        console.log(`🧹 Removed idle room ${id}`);
      }
    }
    metrics.setActiveRooms(this.rooms.size);
  }

  handleMessage(roomId: string, userId: string, message: Record<string, unknown>, ws: WebSocket): void {
    switch (message.type) {
      case 'operation':
        this.handleOperation(roomId, userId, message, ws);
        break;
      case 'get_document':
        this.sendDocument(roomId, ws);
        break;
      case 'cursor':
        this.handleCursor(roomId, userId, message);
        break;
      case 'change_language':
        this.handleChangeLanguage(roomId, userId, message.language);
        break;
      default:
        console.log('⚠️ Unknown message type:', message.type);
    }
  }

  private handleOperation(roomId: string, userId: string, message: Record<string, unknown>, ws: WebSocket): void {
    const room = this.getRoom(roomId);
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
      this.sendDocument(roomId, ws, true);
      return;
    }

    metrics.incrementOperations();
    const newRevision = room.document.getRevision();

    this.connectionManager.send(ws, { type: 'ack', revision: newRevision });
    this.connectionManager.broadcastToRoom(
      roomId,
      { type: 'operation', userId, operation: accepted.toJSON(), revision: newRevision },
      userId
    );
  }

  private sendDocument(roomId: string, ws: WebSocket, resync = false): void {
    const room = this.getRoom(roomId);
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

  private handleChangeLanguage(roomId: string, userId: string, language: unknown): void {
    if (typeof language !== 'string' || !SUPPORTED_LANGUAGES.has(language)) return;
    const room = this.getRoom(roomId);
    room.language = language;
    console.log(`🌐 Room ${roomId}: language changed to ${language} by ${userId}`);
    this.connectionManager.broadcastToRoom(roomId, { type: 'language_changed', language, userId });
  }
}