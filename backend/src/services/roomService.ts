import { v4 as uuidv4 } from 'uuid';

interface Room {
  id: string;
  createdAt: string;
  updatedAt: string;
  users: Map<string, User>;
  documentContent: string;
  settings: RoomSettings;
}

interface User {
  id: string;
  name: string;
  joinedAt: string;
}

interface RoomSettings {
  language: string;
  theme: string;
  fontSize: number;
  tabSize: number;
}

class RoomService {
  private rooms: Map<string, Room> = new Map();
  
  createRoom(settings?: Partial<RoomSettings>): Room {
    const roomId = uuidv4().slice(0, 8);
    const room: Room = {
      id: roomId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      users: new Map(),
      documentContent: '// Welcome to collaborative coding!\n// Share this room ID with friends to code together!\n\n',
      settings: {
        language: 'javascript',
        theme: 'vs-dark',
        fontSize: 14,
        tabSize: 2,
        ...settings
      }
    };
    
    this.rooms.set(roomId, room);
    console.log(`🏠 Room created: ${roomId}`);
    return room;
  }
  
  getRoom(roomId: string): Room | null {
    return this.rooms.get(roomId) || null;
  }
  
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }
  
  deleteRoom(roomId: string): boolean {
    const deleted = this.rooms.delete(roomId);
    if (deleted) {
      console.log(`🗑️ Room deleted: ${roomId}`);
    }
    return deleted;
  }
  
  addUser(roomId: string, userId: string, userName: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    if (!room.users.has(userId)) {
      room.users.set(userId, {
        id: userId,
        name: userName,
        joinedAt: new Date().toISOString()
      });
      room.updatedAt = new Date().toISOString();
      console.log(`👤 User ${userName} joined room ${roomId}`);
    }
    
    return room;
  }
  
  removeUser(roomId: string, userId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const user = room.users.get(userId);
    if (user) {
      room.users.delete(userId);
      room.updatedAt = new Date().toISOString();
      console.log(`👋 User ${user.name} left room ${roomId}`);
    }
    
    // Auto-delete empty rooms
    if (room.users.size === 0) {
      this.deleteRoom(roomId);
    }
    
    return room;
  }
  
  getUsersInRoom(roomId: string): User[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.users.values()) : [];
  }
  
  updateDocument(roomId: string, content: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    room.documentContent = content;
    room.updatedAt = new Date().toISOString();
    return true;
  }
  
  getDocument(roomId: string): string | null {
    const room = this.rooms.get(roomId);
    return room ? room.documentContent : null;
  }
  
  updateSettings(roomId: string, settings: Partial<RoomSettings>): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    
    room.settings = { ...room.settings, ...settings };
    room.updatedAt = new Date().toISOString();
    return true;
  }
  
  getRoomStats(): { totalRooms: number; totalUsers: number; activeRooms: number } {
    const rooms = Array.from(this.rooms.values());
    const totalUsers = rooms.reduce((sum, room) => sum + room.users.size, 0);
    const activeRooms = rooms.filter(room => room.users.size > 0).length;
    
    return {
      totalRooms: rooms.length,
      totalUsers,
      activeRooms
    };
  }
}

export const roomService = new RoomService();