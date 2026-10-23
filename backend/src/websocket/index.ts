import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { ConnectionManager } from './connectionManager.js';
import { MessageHandler } from './messageHandler.js';
import { config } from '../utils/config.js';
import { DocumentPersistence } from '../services/documentPersistence.js';
import { canEnterRoom } from '../services/roomAuth.js';

/** Close codes the client understands */
export const CLOSE_PASSWORD_REQUIRED = 4401;
const CLOSE_TRY_AGAIN = 1013;

const ROOM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_NAME_LENGTH = 40;

type AliveSocket = WebSocket & { isAlive?: boolean };

export class WebSocketHandler {
  private wss: WebSocketServer;
  private connectionManager: ConnectionManager;
  private messageHandler: MessageHandler;
  private heartbeat: ReturnType<typeof setInterval>;

  constructor(wss: WebSocketServer, persistence?: DocumentPersistence) {
    this.wss = wss;
    this.connectionManager = new ConnectionManager();
    this.messageHandler = new MessageHandler(this.connectionManager, persistence);
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

  /** Save every room with unsaved edits (graceful shutdown). */
  flushAll(): Promise<void> {
    return this.messageHandler.flushAll();
  }

  private handleConnection(ws: AliveSocket, req: IncomingMessage): void {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let roomId: string | null;
    let userId: string;
    let userName: string;
    let token: string | null;

    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      roomId = url.searchParams.get('roomId');
      const rawUserId = url.searchParams.get('userId') || '';
      userId = USER_ID_RE.test(rawUserId) ? rawUserId : Math.random().toString(36).slice(2, 10);
      userName = (url.searchParams.get('userName') || '').trim().slice(0, MAX_NAME_LENGTH) || `User_${userId.slice(0, 4)}`;
      token = url.searchParams.get('token');
    } catch {
      ws.close(1008, 'Invalid URL');
      return;
    }

    if (!roomId || !ROOM_ID_RE.test(roomId)) {
      ws.close(1008, 'Valid room ID required');
      return;
    }

    const room = roomId;

    // Messages can arrive while we're still checking access — queue them.
    let admitted = false;
    const pending: Record<string, unknown>[] = [];
    const dispatch = (message: Record<string, unknown>) =>
      this.messageHandler
        .handleMessage(room, userId, message, ws)
        .catch((error) => console.error('Error handling message:', error));

    ws.on('message', (data) => {
      let message: unknown;
      try {
        message = JSON.parse(data.toString());
      } catch {
        console.warn(`Ignoring non-JSON message from ${userName}`);
        return;
      }
      if (!message || typeof message !== 'object') return;
      if (admitted) dispatch(message as Record<string, unknown>);
      else if (pending.length < 100) pending.push(message as Record<string, unknown>);
    });

    ws.on('close', () => {
      if (admitted && this.connectionManager.removeConnection(room, userId, ws)) {
        this.messageHandler.onUserLeft(room);
      }
    });
    ws.on('error', (error) => console.error(`WebSocket error for ${userName}:`, error.message));

    canEnterRoom(room, token)
      .then((allowed) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (!allowed) {
          ws.close(CLOSE_PASSWORD_REQUIRED, 'Password required');
          return;
        }
        admitted = true;
        this.connectionManager.addConnection(room, userId, userName, ws);
        this.messageHandler.onUserJoined(room);
        for (const message of pending.splice(0)) dispatch(message);
      })
      .catch((err) => {
        // Fail closed: if we can't verify, don't let anyone into a possibly protected room
        console.error(`Access check failed for room ${room}:`, (err as Error).message);
        if (ws.readyState === WebSocket.OPEN) ws.close(CLOSE_TRY_AGAIN, 'Try again later');
      });
  }
}