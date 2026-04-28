import { query } from '../client.js';

export interface OperationRecord {
  id: number;
  room_id: string;
  operation_type: string;
  operation_data: any;
  user_id: string;
  user_name: string;
  timestamp: Date;
  version_before: number;
  version_after: number;
}

export const historyQueries = {
  async logOperation(
    roomId: string,
    operationType: string,
    operationData: any,
    userId: string,
    userName: string,
    versionBefore: number,
    versionAfter: number
  ): Promise<void> {
    await query(
      `INSERT INTO operations_history 
       (room_id, operation_type, operation_data, user_id, user_name, version_before, version_after)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [roomId, operationType, operationData, userId, userName, versionBefore, versionAfter]
    );
  },
  
  async getRoomHistory(roomId: string, limit: number = 100): Promise<OperationRecord[]> {
    const result = await query(
      `SELECT * FROM operations_history 
       WHERE room_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [roomId, limit]
    );
    return result.rows;
  },
  
  async getUserHistory(userId: string, limit: number = 50): Promise<OperationRecord[]> {
    const result = await query(
      `SELECT * FROM operations_history 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  },
  
  async logUserSession(
    userId: string,
    userName: string,
    roomId: string,
    joinedAt: Date
  ): Promise<void> {
    await query(
      `INSERT INTO user_sessions (user_id, user_name, room_id, joined_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, userName, roomId, joinedAt]
    );
  },
  
  async endUserSession(userId: string, roomId: string): Promise<void> {
    await query(
      `UPDATE user_sessions 
       SET left_at = CURRENT_TIMESTAMP,
           duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - joined_at))
       WHERE user_id = $1 AND room_id = $2 AND left_at IS NULL`,
      [userId, roomId]
    );
  }
};