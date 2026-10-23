import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { ConnectionManager } from './connectionManager.js';
import { MessageHandler } from './messageHandler.js';
import { config } from '../utils/config.js';

const ROOM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_NAME_LENGTH = 40;

type AliveSocket = WebSocket & { isAlive?: boolean };

export class WebSocketHandler {
  private wss: WebSocketServer;
  private connectionManager: ConnectionManager;
  private messageHandler: MessageHandler;
  private heartbeat: ReturnType<typeof setInterval>;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.connectionManager = new ConnectionManager();
    this.messageHandler = new MessageHandler(this.connectionManager);
    this.wss.on('connection', (ws, req) => this.handleConnection(ws as AliveSocket, req));

    // Heartbeat: hosting proxies (Render, Railway, Nginx…) silently drop idle
    // sockets after ~60s. Ping every 30s and terminate peers that stop answering.
    this.heartbeat = setInterval(() => {
      for (const client of this.wss.clients as Set<AliveSocket>) {
        if (client.isAlive === false) {
          client.terminate();
          continue;
        }
        client.isAlive = false;
        try { client.ping(); } catch { /* noop */ }
      }
    }, config.websocket.pingInterval);
    this.wss.on('close', () => clearInterval(this.heartbeat));

    console.log('🔌 WebSocket handler initialized');
  }

  getActiveRoomCount(): number {
    return this.connectionManager.getAllRooms().length;
  }

  private handleConnection(ws: AliveSocket, req: IncomingMessage): void {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let roomId: string | null;
    let userId: string;
    let userName: string;

    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      roomId = url.searchParams.get('roomId');
      const rawUserId = url.searchParams.get('userId') || '';
      userId = USER_ID_RE.test(rawUserId) ? rawUserId : Math.random().toString(36).slice(2, 10);
      userName = (url.searchParams.get('userName') || '').trim().slice(0, MAX_NAME_LENGTH) || `User_${userId.slice(0, 4)}`;
    } catch {
      ws.close(1008, 'Invalid URL');
      return;
    }

    if (!roomId || !ROOM_ID_RE.test(roomId)) {
      ws.close(1008, 'Valid room ID required');
      return;
    }

    const room = roomId;
    this.connectionManager.addConnection(room, userId, userName, ws);
    this.messageHandler.onUserJoined(room);

    ws.on('message', (data) => {
      let message: unknown;
      try {
        message = JSON.parse(data.toString());
      } catch {
        console.warn(`Ignoring non-JSON message from ${userName}`);
        return;
      }
      if (!message || typeof message !== 'object') return;
      try {
        this.messageHandler.handleMessage(room, userId, message as Record<string, unknown>, ws);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    ws.on('close', () => {
      if (this.connectionManager.removeConnection(room, userId, ws)) {
        this.messageHandler.onUserLeft(room);
      }
    });
    ws.on('error', (error) => console.error(`WebSocket error for ${userName}:`, error.message));
  }
}