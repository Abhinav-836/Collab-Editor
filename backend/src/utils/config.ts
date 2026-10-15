import dotenv from 'dotenv';

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
    windowMs: 60 * 1000,
    maxRequests: 100
  },
  websocket: {
    pingInterval: 30_000,
    pingTimeout: 10_000
  }
};

export const validateConfig = (): boolean => {
  const required = ['DATABASE_URL', 'REDIS_URL'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
    console.warn('Using default values for missing variables');
  }

  return true;
};

export const isProduction = (): boolean => config.nodeEnv === 'production';
export const isDevelopment = (): boolean => config.nodeEnv === 'development';