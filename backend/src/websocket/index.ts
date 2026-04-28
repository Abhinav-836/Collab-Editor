import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { ConnectionManager } from './connectionManager.js';
import { MessageHandler } from './messageHandler.js';

export class WebSocketHandler {
  private wss: WebSocketServer;
  private connectionManager: ConnectionManager;
  private messageHandler: MessageHandler;
  
  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.connectionManager = new ConnectionManager();
    this.messageHandler = new MessageHandler(this.connectionManager);
    
    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('🔌 WebSocket handler initialized');
  }
  
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const roomId = url.searchParams.get('roomId');
    const userId = url.searchParams.get('userId') || Math.random().toString(36).substring(7);
    const userName = url.searchParams.get('userName') || `User_${userId.slice(0,4)}`;
    
    if (!roomId) {
      ws.close(1008, 'Room ID required');
      return;
    }
    
    console.log(`🔌 New connection: ${userName} (${userId}) to room ${roomId}`);
    
    this.connectionManager.addConnection(roomId, userId, userName, ws);
    
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.messageHandler.handleMessage(roomId, userId, message, ws);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log(`🔌 Connection closed: ${userName} (${userId})`);
      this.connectionManager.removeConnection(roomId, userId);
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${userName}:`, error);
    });
  }
}