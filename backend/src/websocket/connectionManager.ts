import { WebSocket } from 'ws';
import { metrics } from '../utils/metrics.js';

interface Connection {
  ws: WebSocket;
  userId: string;
  userName: string;
}

export interface RoomUserInfo {
  userId: string;
  userName: string;
}

export class ConnectionManager {
  private rooms: Map<string, Map<string, Connection>> = new Map();

  addConnection(roomId: string, userId: string, userName: string, ws: WebSocket): void {
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map());
    const room = this.rooms.get(roomId)!;

    const existing = room.get(userId);
    if (existing && existing.ws !== ws) {
      // Same user reconnected (e.g. network blip). Replace the old socket.
      // Its 'close' event will call removeConnection with the OLD ws, which
      // we ignore below because it no longer matches the stored one.
      try { existing.ws.close(4000, 'Replaced by newer connection'); } catch { /* noop */ }
    } else {
      metrics.incrementConnections();
    }

    room.set(userId, { ws, userId, userName });
    this.send(ws, { type: 'users_list', users: this.getUsersInRoom(roomId) });
    this.broadcastToRoom(
      roomId,
      { type: 'user_joined', userId, userName, users: this.getUsersInRoom(roomId) },
      userId
    );
  }

  /**
   * Remove a connection. If `ws` is given, only remove it when it is still the
   * active socket for that user — otherwise a stale socket closing would kick
   * out the user's fresh connection.
   */
  removeConnection(roomId: string, userId: string, ws?: WebSocket): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const current = room.get(userId);
    if (!current) return false;
    if (ws && current.ws !== ws) return false;

    room.delete(userId);
    metrics.decrementConnections();
    this.broadcastToRoom(roomId, { type: 'user_left', userId, users: this.getUsersInRoom(roomId) }, userId);
    if (room.size === 0) this.rooms.delete(roomId);
    return true;
  }

  getConnection(roomId: string, userId: string): WebSocket | undefined {
    return this.rooms.get(roomId)?.get(userId)?.ws;
  }

  getRoomSize(roomId: string): number {
    return this.rooms.get(roomId)?.size ?? 0;
  }

  broadcastToRoom(roomId: string, message: unknown, excludeUserId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify(message);
    for (const [userId, connection] of room) {
      if (userId !== excludeUserId) this.sendRaw(connection.ws, data);
    }
  }

  send(ws: WebSocket, message: unknown): void {
    this.sendRaw(ws, JSON.stringify(message));
  }

  private sendRaw(ws: WebSocket, data: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(data);
    } catch (err) {
      console.error('WebSocket send failed:', (err as Error).message);
    }
  }

  getUsersInRoom(roomId: string): RoomUserInfo[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.values()).map((c) => ({ userId: c.userId, userName: c.userName }));
  }

  getAllRooms(): string[] {
    return Array.from(this.rooms.keys());
  }
}