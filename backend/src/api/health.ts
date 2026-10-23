import { Request, Response } from 'express';
import { metrics } from '../utils/metrics.js';
import { isRedisReady } from '../db/redis/client.js';

const startTime = Date.now();
const VERSION = '1.0.0';

// Injected from index.ts so health can report live WebSocket rooms
let activeRoomCounter: () => number = () => metrics.getMetrics().activeRooms;
export const setActiveRoomCounter = (fn: () => number) => {
  activeRoomCounter = fn;
};

export const healthCheck = (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
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
      redis: isRedisReady() ? 'up' : 'down'
    },
    metrics: {
      totalConnections: stats.totalConnections,
      totalOperations: stats.totalOperations,
      activeRooms: activeRoomCounter()
    }
  });
};

export const readinessCheck = (_req: Request, res: Response) => res.json({ status: 'ready' });

export const livenessCheck = (_req: Request, res: Response) => res.json({ status: 'alive' });

export const metricsEndpoint = (_req: Request, res: Response) =>
  res.json({ status: 'ok', ...metrics.getMetrics(), activeRooms: activeRoomCounter() });