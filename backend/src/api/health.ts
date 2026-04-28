import { Request, Response } from 'express';
import { metrics } from '../utils/metrics.js';

// Server start time
const startTime = Date.now();
const VERSION = '1.0.0';

// Mock database and redis functions (since we're using in-memory storage)
async function checkDatabase(): Promise<{ status: 'up' | 'down' | 'degraded'; latency?: number; error?: string }> {
  // Since we're using in-memory storage, database is always "up" but not used
  return { status: 'up', latency: 1 };
}

async function checkRedis(): Promise<{ status: 'up' | 'down' | 'degraded'; latency?: number; error?: string }> {
  // Since we're using in-memory storage, Redis is always "up" but not used
  return { status: 'up', latency: 1 };
}

async function checkOllama(): Promise<{ status: 'up' | 'down' | 'not_configured'; models?: string[] }> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  
  if (process.env.NODE_ENV === 'test' || !ollamaUrl) {
    return { status: 'not_configured' };
  }
  
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];
      return { status: 'up', models };
    }
    return { status: 'down' };
  } catch (error) {
    return { status: 'down' };
  }
}

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
    message: 'Server is running'
  });
};

/**
 * Detailed health check endpoint
 */
export const detailedHealthCheck = async (req: Request, res: Response) => {
  const uptime = (Date.now() - startTime) / 1000;
  
  const [dbStatus, redisStatus, ollamaStatus] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkOllama()
  ]);
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (dbStatus.status === 'down' || redisStatus.status === 'down') {
    overallStatus = 'unhealthy';
  } else if (dbStatus.status === 'degraded' || redisStatus.status === 'degraded') {
    overallStatus = 'degraded';
  }
  
  const stats = metrics.getMetrics();
  
  const healthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    version: VERSION,
    services: {
      server: {
        status: 'up',
        port: parseInt(process.env.PORT || '8080', 10)
      },
      database: dbStatus,
      redis: redisStatus,
      ollama: ollamaStatus
    },
    metrics: {
      totalConnections: stats.totalConnections,
      totalOperations: stats.totalOperations,
      activeRooms: stats.activeRooms,
      operationsPerSecond: stats.avgOperationsPerSecond || 0
    }
  };
  
  const httpStatus = overallStatus === 'unhealthy' ? 503 : 
                     overallStatus === 'degraded' ? 207 : 200;
  
  res.status(httpStatus).json(healthStatus);
};

/**
 * Readiness probe endpoint
 */
export const readinessCheck = async (req: Request, res: Response) => {
  const dbStatus = await checkDatabase();
  const redisStatus = await checkRedis();
  
  const isReady = dbStatus.status === 'up' && redisStatus.status === 'up';
  
  if (isReady) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ 
      status: 'not_ready',
      reason: {
        database: dbStatus.status,
        redis: redisStatus.status
      }
    });
  }
};

/**
 * Liveness probe endpoint
 */
export const livenessCheck = (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString()
  });
};

/**
 * Metrics endpoint
 */
export const metricsEndpoint = (req: Request, res: Response) => {
  const stats = metrics.getMetrics();
  
  const prometheusMetrics = [
    `# HELP server_uptime_seconds Server uptime in seconds`,
    `# TYPE server_uptime_seconds gauge`,
    `server_uptime_seconds ${(Date.now() - startTime) / 1000}`,
    ``,
    `# HELP total_connections Total number of WebSocket connections`,
    `# TYPE total_connections gauge`,
    `total_connections ${stats.totalConnections}`,
    ``,
    `# HELP total_operations Total number of CRDT operations processed`,
    `# TYPE total_operations counter`,
    `total_operations ${stats.totalOperations}`,
    ``,
    `# HELP active_rooms Number of active rooms`,
    `# TYPE active_rooms gauge`,
    `active_rooms ${stats.activeRooms}`,
    ``,
    `# HELP operations_per_second Operations per second`,
    `# TYPE operations_per_second gauge`,
    `operations_per_second ${stats.avgOperationsPerSecond || 0}`
  ].join('\n');
  
  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
};