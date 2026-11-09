import { Request, Response, NextFunction } from 'express';

/**
 * Daily limits on AI requests, because every one is a paid call to Ollama
 * Cloud on your account. Both reset at midnight UTC:
 *   AI_DAILY_LIMIT_PER_IP  requests one visitor (IP) can make  (default 40)
 *   AI_DAILY_LIMIT_TOTAL   requests the whole server will make (default 500)
 * Set either to 0 to switch it off. Counters are in memory, so they reset when
 * the server restarts (deploys); good enough for a cost guard.
 */
const envInt = (name: string, fallback: number) => {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

let day = '';
let total = 0;
const perIp = new Map<string, number>();

const roll = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    total = 0;
    perIp.clear();
  }
};

export const resetAiQuota = () => {
  day = '';
  roll();
};

export const aiQuota = (req: Request, res: Response, next: NextFunction) => {
  roll();
  const ipLimit = envInt('AI_DAILY_LIMIT_PER_IP', 40);
  const totalLimit = envInt('AI_DAILY_LIMIT_TOTAL', 500);
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const used = perIp.get(ip) ?? 0;

  if (totalLimit > 0 && total >= totalLimit) {
    return res.status(429).json({
      success: false,
      error: 'The AI assistant has reached its daily limit. It will be back tomorrow.'
    });
  }
  if (ipLimit > 0 && used >= ipLimit) {
    return res.status(429).json({
      success: false,
      error: `You've used your ${ipLimit} AI requests for today. They reset at midnight UTC.`
    });
  }
  perIp.set(ip, used + 1);
  total += 1;
  next();
};
