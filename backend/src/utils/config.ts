import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  ollamaUrl: string;
  corsOrigin: string;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  websocket: {
    pingInterval: number;
    pingTimeout: number;
  };
}

export const config: Config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/collab',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  },
  websocket: {
    pingInterval: 30000, // 30 seconds
    pingTimeout: 10000 // 10 seconds
  }
};

export const validateConfig = (): boolean => {
  const required = ['DATABASE_URL', 'REDIS_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
    console.warn('Using default values for missing variables');
  }
  
  return true;
};

export const isProduction = (): boolean => {
  return config.nodeEnv === 'production';
};

export const isDevelopment = (): boolean => {
  return config.nodeEnv === 'development';
};