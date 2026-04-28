import { WebSocket } from 'ws';
import { query } from '../db/postgres/client.js';

interface Connection {
  ws: WebSocket;
  userId: string;
  userName: string;
}

export class ConnectionManager {
  private rooms: Map<string, Map<string, Connection>> = new Map();
  private messageHandlerRef: any = null;
  
  setMessageHandler(handler: any): void {
    this.messageHandlerRef = handler;
  }
  
  addConnection(roomId: string, userId: string, userName: string, ws: WebSocket): void {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    
    const room = this.rooms.get(roomId)!;
    
    if (room.has(userId)) {
      console.log(`⚠️ User ${userName} already in room ${roomId}, skipping duplicate`);
      return;
    }
    
    room.set(userId, { ws, userId, userName });
    console.log(`✅ User ${userName} (${userId}) joined room ${roomId}`);
    console.log(`📊 Room ${roomId} now has ${room.size} users:`, Array.from(room.keys()));
    
    // Send current users list to new user
    ws.send(JSON.stringify({
      type: 'users_list',
      users: this.getUsersInRoom(roomId)
    }));
    
    // Broadcast to others
    this.broadcastToRoom(roomId, {
      type: 'user_joined',
      userId,
      userName,
      users: this.getUsersInRoom(roomId)
    }, userId);
  }
  
  async removeConnection(roomId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const connection = room.get(userId);
    if (!connection) return;
    
    const userName = connection.userName;
    room.delete(userId);
    console.log(`❌ User ${userName} (${userId}) left room ${roomId}`);
    console.log(`📊 Room ${roomId} now has ${room.size} users`);
    
    this.broadcastToRoom(roomId, {
      type: 'user_left',
      userId,
      users: this.getUsersInRoom(roomId)
    }, userId);
    
    if (room.size === 0) {
      this.rooms.delete(roomId);
      console.log(`🗑️ Room ${roomId} deleted from memory`);
    }
  }
  
  getConnection(roomId: string, userId: string): WebSocket | undefined {
    return this.rooms.get(roomId)?.get(userId)?.ws;
  }
  
  broadcastToRoom(roomId: string, message: any, excludeUserId?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log(`⚠️ Room ${roomId} not found for broadcast`);
      return;
    }
    
    const data = JSON.stringify(message);
    let sentCount = 0;
    const usersInRoom = Array.from(room.keys());
    
    console.log(`📡 Broadcasting to room ${roomId}, users:`, usersInRoom, `exclude: ${excludeUserId || 'none'}`);
    
    for (const [userId, connection] of room) {
      if (userId !== excludeUserId && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(data);
        sentCount++;
        console.log(`📡 Sent to ${connection.userName} (${userId})`);
      }
    }
    
    console.log(`📡 Broadcast complete: sent to ${sentCount} users`);
  }
  
  getUsersInRoom(roomId: string): Array<{ userId: string; userName: string }> {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    
    return Array.from(room.entries()).map(([userId, conn]) => ({
      userId,
      userName: conn.userName
    }));
  }
  
  getAllRooms(): string[] {
    return Array.from(this.rooms.keys());
  }
}