/** Backend base URL (no trailing slash). */
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

/** Explicit WebSocket base, if set. Otherwise derived from API_BASE. */
export const WS_BASE_OVERRIDE = process.env.NEXT_PUBLIC_WS_URL || '';