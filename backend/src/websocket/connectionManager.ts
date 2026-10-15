import { WebSocket } from 'ws';
import { metrics } from '../utils/metrics.js';

interface Connection {
  ws: WebSocket;
  userId: string;
  userName: string;
}

export class ConnectionManager {
  private rooms: Map<string, Map<string, Connection>> = new Map();
  private messageHandlerRef: any = null;

  setMessageHandler(handler: any): void { this.messageHandlerRef = handler; }

  addConnection(roomId: string, userId: string, userName: string, ws: WebSocket): void {
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map());
    const room = this.rooms.get(roomId)!;
    metrics.incrementConnections();

    if (room.has(userId)) {
      try { room.get(userId)?.ws.close(); } catch { /* noop */ }
    }

    room.set(userId, { ws, userId, userName });
    ws.send(JSON.stringify({ type: 'users_list', users: this.getUsersInRoom(roomId) }));
    this.broadcastToRoom(roomId, { type: 'user_joined', userId, userName, users: this.getUsersInRoom(roomId) }, userId);
  }

  removeConnection(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.delete(userId);
    metrics.decrementConnections();
    this.broadcastToRoom(roomId, { type: 'user_left', userId, users: this.getUsersInRoom(roomId) }, userId);
    if (room.size === 0) this.rooms.delete(roomId);
  }

  getConnection(roomId: string, userId: string): WebSocket | undefined {
    return this.rooms.get(roomId)?.get(userId)?.ws;
  }

  broadcastToRoom(roomId: string, message: any, excludeUserId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify(message);
    for (const [userId, connection] of room) {
      if (userId !== excludeUserId && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(data);
      }
    }
  }

  getUsersInRoom(roomId: string): Array<{ userId: string; userName: string }> {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.values()).map((c) => ({ userId: c.userId, userName: c.userName }));
  }

  getAllRooms(): string[] { return Array.from(this.rooms.keys()); }
}