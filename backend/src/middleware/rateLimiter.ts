import { Request, Response, NextFunction } from 'express';

const requests = new Map<string, number[]>();

export const rateLimiter = (maxRequests: number = 100, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const timestamps = requests.get(ip)!;
    const recent = timestamps.filter(t => now - t < windowMs);
    
    if (recent.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    
    recent.push(now);
    requests.set(ip, recent);
    next();
  };
};