import { WebSocket } from 'ws';
import { ConnectionManager } from './connectionManager.js';
import { Operation, InsertOp, DeleteOp } from '../crdt/types.js';
import { Document } from '../crdt/document.js';

interface RoomState {
  document: Document;
  language: string;
}

export class MessageHandler {
  private connectionManager: ConnectionManager;
  private rooms: Map<string, RoomState> = new Map();

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.connectionManager.setMessageHandler(this);
  }

  private getRoom(roomId: string): RoomState {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        document: new Document(`// Welcome to Collaborative Code Editor!
// Share this room ID with friends to code together in real-time.

function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("Collaborator");`),
        language: 'javascript'
      });
    }
    return this.rooms.get(roomId)!;
  }

  getDocumentContent(roomId: string): string | null {
    const room = this.rooms.get(roomId);
    return room ? room.document.getContent() : null;
  }

  handleMessage(roomId: string, userId: string, message: any, ws: WebSocket): void {
    switch (message.type) {
      case 'operation':
        this.handleOperation(roomId, userId, message.operation);
        break;
      case 'get_document':
        this.handleGetDocument(roomId, ws);
        break;
      case 'cursor':
        this.handleCursor(roomId, userId, message);
        break;
      case 'save_document':
        this.handleSaveDocument(roomId, message.content);
        break;
      case 'change_language':
        this.handleChangeLanguage(roomId, userId, message.language);
        break;
      default:
        console.log('⚠️ Unknown message type:', message.type);
    }
  }

  private handleOperation(roomId: string, userId: string, operation: Operation): void {
    if (!operation || (operation.type !== 'insert' && operation.type !== 'delete')) return;

    const room = this.getRoom(roomId);
    room.document.applyOperation(operation as InsertOp | DeleteOp);

    this.connectionManager.broadcastToRoom(
      roomId,
      { type: 'operation', userId, operation },
      userId
    );
  }

  private handleGetDocument(roomId: string, ws: WebSocket): void {
    const room = this.getRoom(roomId);
    ws.send(JSON.stringify({
      type: 'document_sync',
      content: room.document.getContent(),
      version: room.document.getVersion(),
      language: room.language
    }));
  }

  private handleCursor(roomId: string, userId: string, message: any): void {
    this.connectionManager.broadcastToRoom(
      roomId,
      { type: 'cursor_update', userId, position: message.position },
      userId
    );
  }

  private handleSaveDocument(roomId: string, content: string): void {
    if (typeof content !== 'string') return;
    this.getRoom(roomId).document.setContent(content);
  }

  private handleChangeLanguage(roomId: string, userId: string, language: string): void {
    if (typeof language !== 'string') return;
    const room = this.getRoom(roomId);
    room.language = language;

    console.log(`🌐 Room ${roomId}: language changed to ${language} by ${userId}`);

    // Broadcast to everyone (including sender, so their editor syncs via the same path)
    this.connectionManager.broadcastToRoom(roomId, {
      type: 'language_changed',
      language,
      userId
    });
  }
}