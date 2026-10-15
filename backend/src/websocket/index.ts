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
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    console.log('🔌 WebSocket handler initialized');
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    let roomId: string | null = null;
    let userId: string | null = null;
    let userName: string | null = null;

    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      roomId = url.searchParams.get('roomId');
      userId = url.searchParams.get('userId') || Math.random().toString(36).substring(7);
      userName = url.searchParams.get('userName') || `User_${userId.slice(0, 4)}`;
    } catch {
      ws.close(1008, 'Invalid URL');
      return;
    }

    if (!roomId) { ws.close(1008, 'Room ID required'); return; }

    this.connectionManager.addConnection(roomId, userId, userName, ws);

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.messageHandler.handleMessage(roomId!, userId!, message, ws);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => this.connectionManager.removeConnection(roomId!, userId!));
    ws.on('error', (error) => console.error(`WebSocket error for ${userName}:`, error));
  }
}