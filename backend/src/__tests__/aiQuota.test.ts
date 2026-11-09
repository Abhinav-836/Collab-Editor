import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { aiQuota, resetAiQuota } from '../middleware/aiQuota.js';
import { normalizeToFreeModel, DEFAULT_MODEL } from '../services/ollamaService.js';

function run(ip: string) {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  let passed = false;
  aiQuota({ ip } as any, res, () => (passed = true));
  return { passed, res };
}

describe('AI daily quota', () => {
  beforeEach(() => {
    process.env.AI_DAILY_LIMIT_PER_IP = '2';
    process.env.AI_DAILY_LIMIT_TOTAL = '3';
    resetAiQuota();
  });
  afterEach(() => {
    delete process.env.AI_DAILY_LIMIT_PER_IP;
    delete process.env.AI_DAILY_LIMIT_TOTAL;
  });

  it('allows each visitor their daily requests, then 429', () => {
    expect(run('1.1.1.1').passed).toBe(true);
    expect(run('1.1.1.1').passed).toBe(true);
    const third = run('1.1.1.1');
    expect(third.passed).toBe(false);
    expect(third.res.statusCode).toBe(429);
    expect(third.res.body.error).toMatch(/2 AI requests/);
  });

  it('stops everyone once the server-wide total is used', () => {
    run('1.1.1.1');
    run('2.2.2.2');
    run('3.3.3.3');
    const r = run('4.4.4.4');
    expect(r.passed).toBe(false);
    expect(r.res.body.error).toMatch(/daily limit/);
  });

  it('0 switches a limit off', () => {
    process.env.AI_DAILY_LIMIT_PER_IP = '0';
    process.env.AI_DAILY_LIMIT_TOTAL = '0';
    for (let i = 0; i < 10; i++) expect(run('5.5.5.5').passed).toBe(true);
  });
});

describe('model choice', () => {
  it('never passes an unlisted (possibly expensive) model to Ollama', () => {
    expect(normalizeToFreeModel('kimi-k2:1t-cloud')).toBe(DEFAULT_MODEL);
    expect(normalizeToFreeModel(DEFAULT_MODEL)).toBe(DEFAULT_MODEL);
    expect(normalizeToFreeModel('gemma4:31b')).toBe(DEFAULT_MODEL);
  });
});
