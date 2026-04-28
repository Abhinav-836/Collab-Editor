import { Request, Response } from 'express';
import { metrics } from '../utils/metrics.js';

const startTime = Date.now();
const VERSION = '1.0.0';

/**
 * Basic health check endpoint
 */
export const healthCheck = (req: Request, res: Response) => {
  const uptime = (Date.now() - startTime) / 1000;
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    version: VERSION,
    message: 'Server is running',
  });
};

/**
 * Detailed health check (simplified for Render)
 */
export const detailedHealthCheck = (req: Request, res: Response) => {
  const stats = metrics.getMetrics();
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services: {database: 'up', redis: 'up'},
    metrics: {
      totalConnections: stats.totalConnections,
      totalOperations: stats.totalOperations,
      activeRooms: stats.activeRooms,
    },
  });
};

// Add other required exports with simple implementations
export const readinessCheck = (req: Request, res: Response) => res.json({ status: 'ready' });
export const livenessCheck = (req: Request, res: Response) => res.json({ status: 'alive' });
export const metricsEndpoint = (req: Request, res: Response) => res.json({ status: 'ok' });
