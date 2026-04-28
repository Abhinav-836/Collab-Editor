import Redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = Redis.createClient({
  url: redisUrl
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('ready', () => {
  console.log('✅ Redis ready to accept commands');
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    // Continue without Redis - app will work with reduced functionality
  }
};

export const disconnectRedis = async () => {
  try {
    await redisClient.disconnect();
    console.log('Redis disconnected');
  } catch (error) {
    console.error('Error disconnecting Redis:', error);
  }
};