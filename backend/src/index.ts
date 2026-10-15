import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

import { config } from './utils/config.js';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

import { healthCheck, detailedHealthCheck } from './api/health.js';
import { aiRoutes } from './api/ai/index.js';
import { createRoom, getRooms } from './api/rooms/createRoom.js';
import { getRoom, getRoomStats } from './api/rooms/getRoom.js';
import { deleteRoom } from './api/rooms/deleteRoom.js';

import { WebSocketHandler } from './websocket/index.js';
import { connectRedis, disconnectRedis } from './db/redis/client.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(logger);
app.use(rateLimiter(config.rateLimit.maxRequests, config.rateLimit.windowMs));

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

// Error handler (last)
app.use(errorHandler);

// WebSocket
const wss = new WebSocketServer({ server, path: '/ws' });
new WebSocketHandler(wss);

// Boot
async function start() {
  try {
    await connectRedis();
  } catch (err) {
    console.warn('⚠️ Redis not available, continuing without it:', err);
  }

  server.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`🔌 WebSocket on ws://localhost:${config.port}/ws`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await disconnectRedis();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await disconnectRedis();
  server.close(() => process.exit(0));
});

start();