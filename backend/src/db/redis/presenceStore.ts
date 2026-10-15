import { redisClient } from './client.js';

const PRESENCE_PREFIX = 'presence:';
const TTL_SECONDS = 60;

export interface UserPresence {
  userId: string;
  userName: string;
  roomId: string;
  lastSeen: number;
  cursorPosition?: number;
  color?: string;
}

// Internal helper: write a presence object with TTL
async function writePresence(presence: UserPresence): Promise<void> {
  const key = `${PRESENCE_PREFIX}${presence.roomId}:${presence.userId}`;
  await redisClient.setEx(key, TTL_SECONDS, JSON.stringify(presence));
}

export const presenceStore = {
  async updatePresence(
    userId: string,
    roomId: string,
    userName: string,
    cursorPosition?: number,
    color?: string
  ): Promise<void> {
    const existing = await this.getUserPresence(roomId, userId);

    const presence: UserPresence = {
      userId,
      userName,
      roomId,
      lastSeen: Date.now(),
      cursorPosition: cursorPosition ?? existing?.cursorPosition,
      color: color ?? existing?.color
    };

    await writePresence(presence);
  },

  async getUserPresence(roomId: string, userId: string): Promise<UserPresence | null> {
    const key = `${PRESENCE_PREFIX}${roomId}:${userId}`;
    const data = await redisClient.get(key);
    return data ? (JSON.parse(data) as UserPresence) : null;
  },

  async getRoomUsers(roomId: string): Promise<UserPresence[]> {
    const pattern = `${PRESENCE_PREFIX}${roomId}:*`;
    const keys = await redisClient.keys(pattern);
    const users: UserPresence[] = [];

    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) users.push(JSON.parse(data));
    }

    return users;
  },

  async removeUser(userId: string, roomId: string): Promise<void> {
    await redisClient.del(`${PRESENCE_PREFIX}${roomId}:${userId}`);
  },

  async updateCursor(roomId: string, userId: string, position: number): Promise<void> {
    const presence = await this.getUserPresence(roomId, userId);
    if (!presence) return;

    presence.cursorPosition = position;
    presence.lastSeen = Date.now();
    await writePresence(presence);
  }
};

// Cleanup stale entries every 30s
setInterval(async () => {
  try {
    const allKeys = await redisClient.keys(`${PRESENCE_PREFIX}*`);
    const now = Date.now();
    for (const key of allKeys) {
      const data = await redisClient.get(key);
      if (!data) continue;
      const presence: UserPresence = JSON.parse(data);
      if (now - presence.lastSeen > TTL_SECONDS * 1000) {
        await redisClient.del(key);
      }
    }
  } catch (error) {
    console.error('Error cleaning up presence:', error);
  }
}, 30_000);