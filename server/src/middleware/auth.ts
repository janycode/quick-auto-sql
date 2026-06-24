import { Request, Response, NextFunction } from 'express';
import { findSession, findUserById } from '../services/auth';
import type { UserRole } from '../types';

export const UNAUTHORIZED_CODE = 401;

export interface AuthRequest extends Request {
  auth?: {
    token: string;
    userId: string;
    username: string;
    role?: UserRole;
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

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }
  const session = findSession(token);
  if (!session) {
    next();
    return;
  }
  const user = findUserById(session.userId);
  req.auth = {
    token: session.token,
    userId: session.userId,
    username: session.username,
    role: user?.role || 'viewer',
  };
  next();
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
  // 获取用户角色
  const user = findUserById(session.userId);
  req.auth = {
    token: session.token,
    userId: session.userId,
    username: session.username,
    role: user?.role || 'viewer',
  };
  next();
}

// 角色权限中间件
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ code: 401, message: '未登录', data: null });
      return;
    }
    const userRole = req.auth.role || 'viewer';
    if (!roles.includes(userRole)) {
      res.status(403).json({ code: 403, message: '权限不足', data: null });
      return;
    }
    next();
  };
}

// 要求至少 editor 权限（可执行 SQL、管理连接）
export const requireEditor = requireRole('admin', 'editor');

// 要求 admin 权限（管理用户、AI 配置、提示词模板）
export const requireAdmin = requireRole('admin');
