import { Request, Response, NextFunction } from 'express';
import { findSession } from '../services/auth';

export const UNAUTHORIZED_CODE = 401;

export interface AuthRequest extends Request {
  auth?: {
    token: string;
    userId: string;
    username: string;
  };
}

export function extractToken(req: Request): string | null {
  const header = req.headers['authorization'] || req.headers['x-auth-token'];
  if (typeof header === 'string') {
    const trimmed = header.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice('bearer '.length).trim();
    }
    return trimmed.length > 0 ? trimmed : null;
  }
  // 兼容前端通过 URL 参数或 body 传入 token 的情况
  const queryToken = (req.query as any)?.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) return queryToken;
  const bodyToken = (req.body as any)?.token;
  if (typeof bodyToken === 'string' && bodyToken.length > 0) return bodyToken;
  return null;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ code: UNAUTHORIZED_CODE, message: '未登录或会话已失效', data: null });
    return;
  }
  const session = findSession(token);
  if (!session) {
    res.status(401).json({ code: UNAUTHORIZED_CODE, message: '未登录或会话已失效', data: null });
    return;
  }
  req.auth = { token: session.token, userId: session.userId, username: session.username };
  next();
}
