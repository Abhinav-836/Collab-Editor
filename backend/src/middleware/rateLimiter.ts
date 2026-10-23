import { Request, Response, NextFunction } from 'express';

export interface RateLimitOptions {
  /** Build the bucket key (default: client IP). */
  key?: (req: Request) => string;
  message?: string;
}

/**
 * Sliding-window rate limiter. Each call creates an independent limiter with
 * its own counters (the previous version shared one map between all limiters,
 * so a stricter per-route limit would have counted the global requests too).
 */
export const rateLimiter = (maxRequests = 100, windowMs = 60_000, opts: RateLimitOptions = {}) => {
  const requests = new Map<string, number[]>();
  const keyOf = opts.key ?? ((req: Request) => req.ip || req.socket.remoteAddress || 'unknown');

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requests) {
      const recent = timestamps.filter((t) => now - t < windowMs);
      if (recent.length === 0) requests.delete(key);
      else requests.set(key, recent);
    }
  }, Math.max(windowMs, 60_000));
  cleanup.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyOf(req);
    const now = Date.now();
    const recent = (requests.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= maxRequests) {
      const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
      return res.status(429).json({ success: false, error: opts.message ?? 'Too many requests' });
    }
    recent.push(now);
    requests.set(key, recent);
    next();
  };
};