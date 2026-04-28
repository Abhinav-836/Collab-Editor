import { redisClient } from './client.js';

const PRESENCE_PREFIX = 'presence:';
const USER_PREFIX = 'user:';
const TTL_SECONDS = 60; // 1 minute heartbeat

export interface UserPresence {
  userId: string;
  userName: string;
  roomId: string;
  lastSeen: number;
  cursorPosition?: number;
  color?: string;
}

export const presenceStore = {
  async updatePresence(userId: string, roomId: string, userName: string): Promise<void> {
    const key = `${PRESENCE_PREFIX}${roomId}:${userId}`;
    const presence: UserPresence = {
      userId,
      userName,
      roomId,
      lastSeen: Date.now()
    };
    await redisClient.setEx(key, TTL_SECONDS, JSON.stringify(presence));
  },
  
  async getUserPresence(roomId: string, userId: string): Promise<UserPresence | null> {
    const key = `${PRESENCE_PREFIX}${roomId}:${userId}`;
    const data = await redisClient.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  },
  
  async getRoomUsers(roomId: string): Promise<UserPresence[]> {
    const pattern = `${PRESENCE_PREFIX}${roomId}:*`;
    const keys = await redisClient.keys(pattern);
    const users: UserPresence[] = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        users.push(JSON.parse(data));
      }
    }
    
    return users;
  },
  
  async removeUser(userId: string, roomId: string): Promise<void> {
    const key = `${PRESENCE_PREFIX}${roomId}:${userId}`;
    await redisClient.del(key);
  },
  
  async updateCursor(roomId: string, userId: string, position: number): Promise<void> {
    const presence = await this.getUserPresence(roomId, userId);
    if (presence) {
      presence.cursorPosition = position;
      await this.updatePresence(userId, roomId, presence.userName);
    }
  }
};

// Cleanup old presence entries periodically
setInterval(async () => {
  try {
    const allKeys = await redisClient.keys(`${PRESENCE_PREFIX}*`);
    const now = Date.now();
    
    for (const key of allKeys) {
      const data = await redisClient.get(key);
      if (data) {
        const presence: UserPresence = JSON.parse(data);
        if (now - presence.lastSeen > TTL_SECONDS * 1000) {
          await redisClient.del(key);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up presence:', error);
  }
}, 30000); // Run every 30 seconds