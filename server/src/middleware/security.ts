import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ==================== CSRF Token ====================
// 简单的 CSRF token 实现：基于 session token 生成 HMAC

const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');

export function generateCsrfToken(sessionToken: string): string {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(`${sessionToken}:${timestamp}`);
  const signature = hmac.digest('hex');
  return `${timestamp}:${signature}`;
}

export function validateCsrfToken(sessionToken: string, csrfToken: string): boolean {
  if (!csrfToken || !sessionToken) return false;

  const parts = csrfToken.split(':');
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  // Token 有效期：24 小时
  if (Date.now() - ts > 24 * 60 * 60 * 1000) return false;

  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(`${sessionToken}:${timestamp}`);
  const expected = hmac.digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// CSRF 保护中间件（仅对非 GET 请求生效）
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // GET/HEAD/OPTIONS 不需要 CSRF 保护
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  // 从 header 或 body 获取 CSRF token
  const csrfToken = req.headers['x-csrf-token'] as string || (req.body as any)?._csrf;
  const sessionToken = req.headers['authorization']?.replace('Bearer ', '') || '';

  if (!csrfToken || !validateCsrfToken(sessionToken, csrfToken)) {
    // 开发环境下放宽限制
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ code: 403, message: 'CSRF token 无效', data: null });
      return;
    }
  }

  next();
}

// ==================== Rate Limiting ====================
// 简单的内存速率限制器

interface IRateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, IRateLimitEntry>();

// 定期清理过期条目
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000).unref();

export interface RateLimitOptions {
  windowMs: number;    // 时间窗口（毫秒）
  max: number;         // 最大请求数
  message?: string;    // 超限提示
  keyGenerator?: (req: Request) => string;  // 自定义 key 生成器
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs = 60 * 1000,
    max = 60,
    message = '请求过于频繁，请稍后再试',
    keyGenerator = (req) => req.ip || 'unknown',
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    const resetAt = now + windowMs;

    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    // 设置响应头
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.status(429).json({ code: 429, message, data: null });
      return;
    }

    next();
  };
}

// 预定义的速率限制配置
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: 'API 请求过于频繁，请稍后再试',
});

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: '登录尝试次数过多，请稍后再试',
  keyGenerator: (req) => `auth:${req.ip || 'unknown'}`,
});

export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'AI 请求过于频繁，请稍后再试',
  keyGenerator: (req) => `ai:${(req as any).auth?.userId || req.ip || 'unknown'}`,
});

// ==================== SQL 注入防护 ====================
// 简单的 SQL 注入检测（用于前端输入校验）

const SQL_INJECTION_PATTERNS = [
  /(\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
  /(--|;|\/\*|\*\/|xp_|sp_|0x[0-9a-f]+)/i,
  /(\bOR\b\s+\b\d+\b\s*=\s*\b\d+\b)/i,
  /(\bUNION\b\s+\bSELECT\b)/i,
  /(\bEXEC\b|\bEXECUTE\b)/i,
];

export function detectSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}
