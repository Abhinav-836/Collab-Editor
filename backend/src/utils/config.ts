import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  ollamaUrl: string;
  /** Allowed browser origins. Contains '*' to allow any origin. */
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  websocket: {
    pingInterval: number;
    maxPayloadBytes: number;
  };
}

/**
 * CORS_ORIGIN may hold several comma-separated origins, e.g.
 *   CORS_ORIGIN=https://my-app.vercel.app,http://localhost:5173
 * Trailing slashes are stripped because browsers never send them.
 */
const parseOrigins = (raw: string | undefined): string[] =>
  (raw || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

export const config: Config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/collab',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  ollamaUrl: process.env.OLLAMA_CLOUD_URL || 'https://ollama.com/api',
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  },
  websocket: {
    pingInterval: 30_000,
    maxPayloadBytes: 2 * 1024 * 1024
  }
};

export const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true; // curl, server-to-server, same-origin navigation
  if (config.corsOrigins.includes('*')) return true;
  return config.corsOrigins.includes(origin.replace(/\/+$/, ''));
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