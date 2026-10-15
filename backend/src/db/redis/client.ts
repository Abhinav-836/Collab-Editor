import Redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = Redis.createClient({ url: redisUrl });

let isConnected = false;

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message);
  isConnected = false;
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
  isConnected = true;
});

redisClient.on('ready', () => {
  console.log('✅ Redis ready to accept commands');
  isConnected = true;
});

redisClient.on('end', () => {
  console.log('⚠️ Redis connection ended');
  isConnected = false;
});

export const connectRedis = async (): Promise<void> => {
  if (isConnected) return;
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', (error as Error).message);
    console.warn('⚠️ Continuing without Redis — some features may be degraded');
  }
};

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (isConnected) {
      await redisClient.disconnect();
      console.log('Redis disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting Redis:', (error as Error).message);
  }
};

export const isRedisReady = (): boolean => isConnected;