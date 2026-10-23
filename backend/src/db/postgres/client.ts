import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || '';

/** Persistence is optional: without DATABASE_URL the app runs in-memory only. */
export const isDatabaseConfigured = (): boolean => DATABASE_URL.length > 0;

let pool: pg.Pool | null = null;
let lastPingOk = false;

/** Lazily create the pool so importing this module never opens a connection. */
export const getPool = (): pg.Pool => {
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is not set');
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      // node-postgres ignores channel_binding in the URL, so pass it explicitly (Neon supports it)
      enableChannelBinding: /channel_binding=require/i.test(DATABASE_URL),
      max: 10,
      idleTimeoutMillis: 30_000,
      // Neon's free tier suspends compute; waking it can take several seconds
      connectionTimeoutMillis: 15_000
    } as pg.PoolConfig);

    // Idle clients get disconnected by the server (Neon does this regularly).
    // That's harmless — the pool replaces them. Never crash the process for it.
    pool.on('error', (err) => {
      console.warn('⚠️ PostgreSQL idle client error (will reconnect):', err.message);
    });
  }
  return pool;
};

export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now();
  const res = await getPool().query(text, params as any[]);
  const duration = Date.now() - start;
  if (duration > 1_000) {
    console.warn(`🐢 Slow query (${duration}ms): ${text.replace(/\s+/g, ' ').slice(0, 80)}`);
  }
  return res;
};

export const getClient = async () => getPool().connect();

export const pingDatabase = async (): Promise<boolean> => {
  if (!isDatabaseConfigured()) return false;
  try {
    await query('SELECT 1');
    lastPingOk = true;
  } catch {
    lastPingOk = false;
  }
  return lastPingOk;
};

export const isDatabaseReady = (): boolean => lastPingOk;

/**
 * Create the tables persistence needs if they don't exist yet.
 * Same definitions as migrations/001 and 002 (all statements are idempotent),
 * so a fresh database works without running `npm run migrate` first.
 */
export const ensureSchema = async (): Promise<void> => {
  await query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      owner_id VARCHAR(50),
      settings JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      max_users INTEGER DEFAULT 10
    );
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      room_id VARCHAR(50) REFERENCES rooms(id) ON DELETE CASCADE,
      content TEXT,
      version INTEGER DEFAULT 0,
      language VARCHAR(20) DEFAULT 'javascript',
      last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_id)
    );
    CREATE INDEX IF NOT EXISTS idx_documents_last_modified ON documents(last_modified);
  `);
  lastPingOk = true;
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    const p = pool;
    pool = null;
    // Don't let a stuck connection block shutdown
    await Promise.race([p.end().catch(() => undefined), new Promise((r) => setTimeout(r, 3_000))]);
  }
};