import { WebSocket } from 'ws';
import { ConnectionManager } from './connectionManager.js';
import { Operation, InsertOp, DeleteOp } from '../crdt/types.js';
import { Document } from '../crdt/document.js';

export class MessageHandler {
  private connectionManager: ConnectionManager;
  private documents: Map<string, Document> = new Map();
  
  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.connectionManager.setMessageHandler(this);
  }
  
  private getDocument(roomId: string): Document {
    if (!this.documents.has(roomId)) {
      const doc = new Document(`// Welcome to Collaborative Code Editor!
// Share this room ID with friends to code together in real-time!
// 
// 🔗 How to collaborate:
// 1. Share this room ID with your friends
// 2. Have them join using the same room ID
// 3. Start coding together in real-time!
//
// 💡 Features:
// • Real-time sync - See changes as others type
// • AI Assistant - Get code suggestions (select model from dropdown)
// • Multiple cursors - See where others are editing
//
// Happy collaborating! 🚀

function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("Collaborator");`);
      this.documents.set(roomId, doc);
    }
    return this.documents.get(roomId)!;
  }
  
  getDocumentContent(roomId: string): string | null {
    const doc = this.documents.get(roomId);
    return doc ? doc.getContent() : null;
  }
  
  handleMessage(roomId: string, userId: string, message: any, ws: WebSocket): void {
    console.log(`📨 Received message type: ${message.type} from ${userId} in room ${roomId}`);
    
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
        
      default:
        console.log('⚠️ Unknown message type:', message.type);
    }
  }
  
  private handleOperation(roomId: string, userId: string, operation: Operation): void {
    console.log(`🔧 Handling operation: ${operation.type} from ${userId} in room ${roomId}`);
    
    const doc = this.getDocument(roomId);
    
    if (operation.type === 'insert' || operation.type === 'delete') {
      doc.applyOperation(operation);
      console.log(`📝 Applied ${operation.type} at position ${operation.position} in room ${roomId}`);
      console.log(`📄 Document now has ${doc.getContent().length} characters`);
    }
    
    console.log(`📡 Broadcasting operation to room ${roomId} (excluding ${userId})`);
    
    this.connectionManager.broadcastToRoom(roomId, {
      type: 'operation',
      userId: userId,
      operation: operation
    }, userId);
  }
  
  private handleGetDocument(roomId: string, ws: WebSocket): void {
    const doc = this.getDocument(roomId);
    const content = doc.getContent();
    const version = doc.getVersion();
    
    ws.send(JSON.stringify({
      type: 'document_sync',
      content: content,
      version: version
    }));
    
    console.log(`📄 Document sent to client in room ${roomId} (${content.length} chars, version ${version})`);
  }
  
  private handleCursor(roomId: string, userId: string, message: any): void {
    this.connectionManager.broadcastToRoom(roomId, {
      type: 'cursor_update',
      userId: userId,
      position: message.position
    }, userId);
  }
  
  private handleSaveDocument(roomId: string, content: string): void {
    const doc = this.getDocument(roomId);
    doc.setContent(content);
    console.log(`💾 Document saved in room ${roomId} (${content.length} chars)`);
  }
}