import crypto from 'crypto';
import { promisify } from 'util';
import { ensureSchema, isDatabaseConfigured, query } from '../db/postgres/client.js';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 100;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Secret for signing room access tokens.
 * Prefer ROOM_TOKEN_SECRET. Otherwise derive one from DATABASE_URL (itself a
 * secret, and stable across restarts so tokens survive deploys). Without
 * either, use a random secret — tokens then expire on every restart.
 */
const TOKEN_SECRET: Buffer = (() => {
  if (process.env.ROOM_TOKEN_SECRET) return Buffer.from(process.env.ROOM_TOKEN_SECRET);
  if (process.env.DATABASE_URL) {
    return crypto.createHash('sha256').update(`collab-room-token:${process.env.DATABASE_URL}`).digest();
  }
  console.warn('⚠️ ROOM_TOKEN_SECRET not set — room passwords must be re-entered after each restart');
  return crypto.randomBytes(32);
})();

// ---------- passwords ----------

export const validatePassword = (pw: unknown): string | null => {
  if (typeof pw !== 'string') return 'Password must be text';
  if (pw.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (pw.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  return null;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------- access tokens ----------

const sign = (data: string) => crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');

export function issueToken(roomId: string, now = Date.now()): string {
  const exp = now + TOKEN_TTL_MS;
  return `${exp}.${sign(`${roomId}.${exp}`)}`;
}

export function verifyToken(roomId: string, token: string | null | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now || !sig) return false;
  const expected = Buffer.from(sign(`${roomId}.${exp}`));
  const given = Buffer.from(sig);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// ---------- storage ----------

/**
 * Password hashes per room. Cached in memory; backed by Postgres when configured
 * so protection survives restarts. `null` = room has no password.
 */
class RoomAuthStore {
  private cache = new Map<string, string | null>();

  async getHash(roomId: string): Promise<string | null> {
    if (this.cache.has(roomId)) return this.cache.get(roomId)!;
    if (!isDatabaseConfigured()) return null;
    // Throws if the DB is unreachable — callers must fail closed
    const hash = await this.fetchHash(roomId);
    if (this.cache.size > 10_000) this.cache.clear(); // random room ids must not grow memory forever
    this.cache.set(roomId, hash);
    return hash;
  }

  private async fetchHash(roomId: string): Promise<string | null> {
    try {
      const res = await query(`SELECT password_hash FROM rooms WHERE id = $1`, [roomId]);
      return res.rows[0]?.password_hash ?? null;
    } catch (err: any) {
      // 42P01 = table missing, 42703 = column missing → create schema once, then retry
      if (err?.code !== '42P01' && err?.code !== '42703') throw err;
      await ensureSchema();
      const res = await query(`SELECT password_hash FROM rooms WHERE id = $1`, [roomId]);
      return res.rows[0]?.password_hash ?? null;
    }
  }

  async setHash(roomId: string, hash: string): Promise<void> {
    if (isDatabaseConfigured()) {
      await query(
        `INSERT INTO rooms (id, password_hash) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = CURRENT_TIMESTAMP`,
        [roomId, hash]
      );
    }
    this.cache.set(roomId, hash);
  }

  /** Test helper */
  clear(): void {
    this.cache.clear();
  }
}

export const roomAuthStore = new RoomAuthStore();

export async function isRoomProtected(roomId: string): Promise<boolean> {
  return (await roomAuthStore.getHash(roomId)) !== null;
}

/** Can a connection with this token enter the room? Throws if the DB can't be checked. */
export async function canEnterRoom(roomId: string, token: string | null | undefined): Promise<boolean> {
  const hash = await roomAuthStore.getHash(roomId);
  return hash === null || verifyToken(roomId, token);
}