import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';

import { config, isOriginAllowed } from './utils/config.js';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

import { healthCheck, detailedHealthCheck, setActiveRoomCounter } from './api/health.js';
import { aiRoutes } from './api/ai/index.js';
import { createRoom, getRooms } from './api/rooms/createRoom.js';
import { getRoom, getRoomStats } from './api/rooms/getRoom.js';
import { deleteRoom } from './api/rooms/deleteRoom.js';

import { WebSocketHandler } from './websocket/index.js';
import { connectRedis, disconnectRedis } from './db/redis/client.js';
import { isDatabaseConfigured, ensureSchema, closeDatabase } from './db/postgres/client.js';
import { documentQueries } from './db/postgres/queries/documents.js';
import { DocumentPersistence } from './services/documentPersistence.js';

const app = express();
const server = http.createServer(app);

// Behind Render/Railway/Heroku the client IP is in X-Forwarded-For.
// Without this every user shares the proxy's IP and one rate-limit bucket.
app.set('trust proxy', 1);

// Middleware
app.use(
  cors({
    origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
    credentials: true
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(logger);
app.use(rateLimiter(config.rateLimit.maxRequests, config.rateLimit.windowMs));

// Root — friendly info instead of Express' default "Cannot GET /"
app.get('/', (_req, res) => {
  res.json({
    name: 'Collab Editor API',
    status: 'running',
    endpoints: {
      health: '/health',
      healthDetailed: '/health/detailed',
      rooms: '/api/rooms',
      ai: '/api/ai/{chat,explain,suggest,models}',
      websocket: '/ws?roomId=...&userId=...&userName=...'
    }
  });
});

// Health
app.get('/health', healthCheck);
app.get('/health/detailed', detailedHealthCheck);

// AI Routes
app.use('/api/ai', aiRoutes);

// Room Routes
app.post('/api/rooms', createRoom);
app.get('/api/rooms', getRooms);
app.get('/api/rooms/:id', getRoom);
app.get('/api/rooms/:id/stats', getRoomStats);
app.delete('/api/rooms/:id', deleteRoom);

// Unknown API routes → JSON 404 (instead of Express' HTML page)
app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// Error handler (last)
app.use(errorHandler);

// WebSocket
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: config.websocket.maxPayloadBytes,
  verifyClient: ({ origin }: { origin?: string }) => isOriginAllowed(origin)
});
// Room documents are saved to Postgres when DATABASE_URL is set, otherwise kept in memory only
const persistence = new DocumentPersistence(
  isDatabaseConfigured() ? { init: ensureSchema, load: documentQueries.load, save: documentQueries.save } : null
);
const wsHandler = new WebSocketHandler(wss, persistence);
setActiveRoomCounter(() => wsHandler.getActiveRoomCount());

// Boot
function start() {
  // Listen first — an optional dependency must never block the server.
  server.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`🔌 WebSocket on ws://localhost:${config.port}/ws`);
    console.log(`🌍 Allowed origins: ${config.corsOrigins.join(', ')}`);
  });

  if (persistence.enabled) {
    persistence
      .init()
      .then(() => console.log('💾 Persistence: rooms are saved to PostgreSQL'))
      .catch((err) => console.error('⚠️ PostgreSQL not reachable yet (will retry on first use):', err.message));
  } else {
    console.warn('⚠️ DATABASE_URL not set — rooms are kept in memory and lost on restart');
  }

  connectRedis().catch((err) =>
    console.warn('⚠️ Redis not available, continuing without it:', (err as Error).message)
  );
}

// Graceful shutdown
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);
  // Don't hang forever (Render gives ~30s after SIGTERM)
  setTimeout(() => process.exit(0), 20_000).unref();

  for (const client of wss.clients) client.close(1001, 'Server shutting down');
  wss.close();
  // Save unsaved edits before exiting — this is what makes deploys lossless
  try {
    await wsHandler.flushAll();
    if (persistence.enabled) console.log('💾 All rooms saved');
  } catch (err) {
    console.error('❌ Error saving rooms on shutdown:', (err as Error).message);
  }
  try { await disconnectRedis(); } catch { /* noop */ }
  await closeDatabase();
  server.close(() => process.exit(0));
  // Idle keep-alive HTTP connections would otherwise keep the port open
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 2_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

start();