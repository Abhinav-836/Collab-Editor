import { WebSocket } from 'ws';

interface BroadcastOptions {
  excludeSelf?: boolean;
  excludeUserId?: string;
}

export class BroadcastManager {
  private static instance: BroadcastManager;
  private connections: Map<string, Map<string, WebSocket>> = new Map();

  static getInstance(): BroadcastManager {
    if (!BroadcastManager.instance) {
      BroadcastManager.instance = new BroadcastManager();
    }
    return BroadcastManager.instance;
  }

  addConnection(roomId: string, userId: string, ws: WebSocket): void {
    if (!this.connections.has(roomId)) {
      this.connections.set(roomId, new Map());
    }
    this.connections.get(roomId)!.set(userId, ws);
  }

  removeConnection(roomId: string, userId: string): void {
    const room = this.connections.get(roomId);
    if (room) {
      room.delete(userId);
      if (room.size === 0) {
        this.connections.delete(roomId);
      }
    }
  }

  broadcastToRoom(
    roomId: string, 
    message: any, 
    options: BroadcastOptions = {}
  ): void {
    const room = this.connections.get(roomId);
    if (!room) return;

    const data = JSON.stringify(message);
    for (const [userId, client] of room) {
      if (options.excludeSelf && userId === options.excludeUserId) {
        continue;
      }
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  broadcastToAll(message: any): void {
    const data = JSON.stringify(message);
    for (const room of this.connections.values()) {
      for (const client of room.values()) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    }
  }

  sendToUser(roomId: string, userId: string, message: any): boolean {
    const room = this.connections.get(roomId);
    if (!room) return false;

    const client = room.get(userId);
    if (!client || client.readyState !== WebSocket.OPEN) return false;

    client.send(JSON.stringify(message));
    return true;
  }

  getRoomConnections(roomId: string): string[] {
    const room = this.connections.get(roomId);
    return room ? Array.from(room.keys()) : [];
  }

  getConnectionCount(roomId: string): number {
    const room = this.connections.get(roomId);
    return room ? room.size : 0;
  }

  getAllRooms(): string[] {
    return Array.from(this.connections.keys());
  }
}

// Export singleton instance
export const broadcast = BroadcastManager.getInstance();