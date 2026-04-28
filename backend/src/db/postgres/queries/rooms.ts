import { query } from '../client.js';

export interface RoomRecord {
  id: string;
  name: string | null;
  created_at: Date;
  updated_at: Date;
  owner_id: string | null;
  settings: any;
  is_active: boolean;
  max_users: number;
}

export const roomQueries = {
  async createRoom(roomId: string, ownerId?: string, settings?: any): Promise<void> {
    await query(
      `INSERT INTO rooms (id, owner_id, settings) 
       VALUES ($1, $2, $3)`,
      [roomId, ownerId || null, settings || {}]
    );
  },
  
  async getRoom(roomId: string): Promise<RoomRecord | null> {
    const result = await query(
      `SELECT * FROM rooms WHERE id = $1 AND is_active = true`,
      [roomId]
    );
    return result.rows[0] || null;
  },
  
  async updateRoomSettings(roomId: string, settings: any): Promise<void> {
    await query(
      `UPDATE rooms SET settings = settings || $1 WHERE id = $2`,
      [settings, roomId]
    );
  },
  
  async deactivateRoom(roomId: string): Promise<void> {
    await query(
      `UPDATE rooms SET is_active = false WHERE id = $1`,
      [roomId]
    );
  },
  
  async getActiveRooms(): Promise<RoomRecord[]> {
    const result = await query(
      `SELECT * FROM rooms WHERE is_active = true ORDER BY created_at DESC`
    );
    return result.rows;
  },
  
  async getRoomCount(): Promise<number> {
    const result = await query(`SELECT COUNT(*) FROM rooms WHERE is_active = true`);
    return parseInt(result.rows[0].count, 10);
  }
};