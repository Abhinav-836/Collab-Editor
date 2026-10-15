import { v4 as uuidv4 } from 'uuid';

export interface RoomUser {
  id: string;
  name: string;
  joinedAt: string;
}

export interface Room {
  id: string;
  createdAt: string;
  updatedAt: string;
  users: RoomUser[];
  documentContent: string;
  settings: {
    language: string;
    theme: string;
    fontSize?: number;
    tabSize?: number;
  };
}

class RoomStore {
  private rooms: Map<string, Room> = new Map();

  createRoom(settings?: Partial<Room['settings']>): Room {
    const roomId = uuidv4().slice(0, 8);
    const room: Room = {
      id: roomId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      users: [],
      documentContent:
        '// Welcome to collaborative coding!\n// Share this room with friends!\n\n',
      settings: {
        language: 'javascript',
        theme: 'vs-dark',
        fontSize: 14,
        tabSize: 2,
        ...settings
      }
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  deleteRoom(id: string): boolean {
    return this.rooms.delete(id);
  }

  addUser(roomId: string, user: RoomUser): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    if (!room.users.find((u) => u.id === user.id)) {
      room.users.push(user);
      room.updatedAt = new Date().toISOString();
    }
    return room;
  }

  removeUser(roomId: string, userId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.users = room.users.filter((u) => u.id !== userId);
    room.updatedAt = new Date().toISOString();
    if (room.users.length === 0) this.rooms.delete(roomId);
  }

  updateDocument(roomId: string, content: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.documentContent = content;
    room.updatedAt = new Date().toISOString();
    return true;
  }

  cleanupInactive(maxAgeMs = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      const lastActive = new Date(room.updatedAt).getTime();
      if (now - lastActive > maxAgeMs && room.users.length === 0) {
        this.rooms.delete(id);
        console.log(`🧹 Cleaned up inactive room: ${id}`);
      }
    }
  }
}

export const roomStore = new RoomStore();