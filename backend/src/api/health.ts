import { Request, Response } from 'express';
import { metrics } from '../utils/metrics.js';
import { isRedisReady } from '../db/redis/client.js';
// In health.ts, replace `metrics.getMetrics()` call:
import { roomStore } from '../store/roomStore.js';
// ...
const stats = metrics.getMetrics();
stats.activeRooms = roomStore.getAllRooms().length;  // override
const startTime = Date.now();
const VERSION = '1.0.0';

export const healthCheck = (_req: Request, res: Response) => {
  const uptime = (Date.now() - startTime) / 1000;
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    version: VERSION,
    message: 'Server is running'
  });
};

export const detailedHealthCheck = (_req: Request, res: Response) => {
  const stats = metrics.getMetrics();
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: VERSION,
    services: {
      database: 'up',              // TODO: ping pg pool if you want real status
      redis: isRedisReady() ? 'up' : 'down'
    },
    metrics: {
      totalConnections: stats.totalConnections,
      totalOperations: stats.totalOperations,
      activeRooms: stats.activeRooms
    }
  });
};

export const readinessCheck = (_req: Request, res: Response) =>
  res.json({ status: 'ready' });

export const livenessCheck = (_req: Request, res: Response) =>
  res.json({ status: 'alive' });

export const metricsEndpoint = (_req: Request, res: Response) =>
  res.json({ status: 'ok', ...metrics.getMetrics() });