import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_RETRIES = 3;

let isConnected = false;
let gaveUp = false;
let lastErrorMessage = '';

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    connectTimeout: 5_000,
    // Default strategy retries forever, which made connect() never resolve
    // and the HTTP server never start when Redis is absent.
    reconnectStrategy: (retries: number) => {
      if (retries >= MAX_RETRIES) {
        gaveUp = true;
        return new Error('Redis unreachable — giving up');
      }
      return Math.min(500 * 2 ** retries, 3_000);
    }
  }
});

redisClient.on('error', (err: Error) => {
  isConnected = false;
  // Avoid flooding logs with the same error on every retry
  if (err.message !== lastErrorMessage) {
    console.error('Redis Client Error:', err.message);
    lastErrorMessage = err.message;
  }
});

redisClient.on('ready', () => {
  console.log('✅ Redis ready to accept commands');
  isConnected = true;
  lastErrorMessage = '';
});

redisClient.on('end', () => {
  isConnected = false;
});

export const connectRedis = async (): Promise<void> => {
  if (isConnected || gaveUp || redisClient.isOpen) return;
  try {
    await redisClient.connect();
  } catch (error) {
    console.warn(`⚠️ Continuing without Redis (${(error as Error).message})`);
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient.isReady) {
      // Graceful QUIT only works on a live connection…
      await Promise.race([redisClient.quit(), new Promise((r) => setTimeout(r, 2_000))]);
      console.log('Redis disconnected');
    } else if (redisClient.isOpen) {
      // …while still (re)connecting, quit() would wait forever — force-close instead.
      gaveUp = true;
      await redisClient.disconnect();
    }
  } catch (error) {
    console.error('Error disconnecting Redis:', (error as Error).message);
  }
};

export const isRedisReady = (): boolean => isConnected;