import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import { verifyUser, createSession, revokeSession, findSession, createUser } from '../services/auth';
import { AuthRequest, extractToken } from '../middleware/auth';
import { ILoginRequest } from '../types';

const router = Router();

// POST /api/auth/register
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body || {}) as ILoginRequest;
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  try {
    const { user } = createUser(username, password);
    const session = createSession(user);
    success(res, {
      token: session.token,
      userId: session.userId,
      username: session.username,
    }, '注册成功');
  } catch (e: any) {
    fail(res, e?.message || '注册失败', 400, 400);
  }
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body || {}) as ILoginRequest;
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    fail(res, '用户名或密码不能为空', 400, 400);
    return;
  }

  const user = verifyUser(username, password);
  if (!user) {
    fail(res, '用户名或密码错误', 401, 401);
    return;
  }

  const session = createSession(user);
  success(res, {
    token: session.token,
    userId: session.userId,
    username: session.username,
  }, '登录成功');
}));

// POST /api/auth/logout
router.post('/logout', asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = extractToken(req);
  if (token) revokeSession(token);
  success(res, null, '已退出登录');
}));

// GET /api/auth/me
router.get('/me', asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    fail(res, '未登录', 401, 401);
    return;
  }
  const session = findSession(token);
  if (!session) {
    fail(res, '未登录或会话已失效', 401, 401);
    return;
  }
  success(res, { userId: session.userId, username: session.username }, 'ok');
}));

export default router;
