import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import {
  verifyUser,
  createSession,
  revokeSession,
  findSession,
  findUserById,
  createUser,
  sendEmailCodeFor,
  verifyEmailCodeFor,
  validateEmail,
  validatePassword,
} from '../services/auth';
import { verifySmtpConfig } from '../services/email';
import { config } from '../config';
import { AuthRequest, extractToken } from '../middleware/auth';
import type { ILoginRequest, IRegisterRequest, IEmailCodeRequest } from '../types';
import { getQuotaInfo } from '../services/quota';

const router = Router();

function getReqIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return (req.ip || req.socket?.remoteAddress || 'unknown').trim();
}

// POST /api/auth/email/send-code —— 发送邮箱验证码
router.post('/email/send-code', asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body || {}) as IEmailCodeRequest;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!validateEmail(email)) {
    fail(res, '邮箱格式不正确', 400, 400);
    return;
  }
  const result = await sendEmailCodeFor(email, getReqIp(req));
  if (!result.ok) {
    fail(res, result.reason || '验证码发送失败', 400, 400);
    return;
  }
  success(res, {
    sent: true,
    expiresIn: result.expiresIn,
    devMode: !!result.devMode,
    previewUrl: result.previewUrl || null,
  }, '验证码已发送');
}));

// POST /api/auth/email/check —— SMTP 自检（打印配置 & 尝试连接发送）
router.post('/email/check', asyncHandler(async (req: Request, res: Response) => {
  // 回显配置（不返回密码）
  const maskedPass = config.smtp.pass ? '****' + (config.smtp.pass.length > 4 ? config.smtp.pass.slice(-4) : '') : '';
  const configInfo = {
    host: config.smtp.host,
    port: config.smtp.port,
    secure: typeof config.smtp.secure,
    user: config.smtp.user,
    pass: maskedPass,
    from: config.smtp.from,
    devMode: config.smtp.devMode,
  };
  const body = (req.body || {}) as { email?: string };
  const testEmail = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;

  const verify = await verifySmtpConfig();

  let sendInfo: { ok: boolean; reason?: string; response?: string; responseCode?: number; command?: string; previewUrl?: string } = { ok: true };
  if (testEmail && verify.ok) {
    const r = await sendEmailCodeFor(testEmail, getReqIp(req));
    sendInfo = {
      ok: r.ok,
      reason: r.reason,
      response: r.response,
      responseCode: r.responseCode,
      command: r.command,
      previewUrl: r.previewUrl,
    };
  }

  success(res, {
    config: configInfo,
    verify,
    testEmail,
    send: sendInfo,
  }, verify.ok ? 'SMTP 配置正常' : 'SMTP 连接异常');
}));

// POST /api/auth/register —— 注册（要求邮箱 + 密码 + 验证码）
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body || {}) as IRegisterRequest;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';

  if (!validateEmail(email)) {
    fail(res, '邮箱格式不正确', 400, 400);
    return;
  }

  const pw = validatePassword(password);
  if (!pw.ok) {
    fail(res, pw.reason || '密码不符合要求', 400, 400);
    return;
  }

  const verifyResult = verifyEmailCodeFor(email, code);
  if (!verifyResult.ok) {
    fail(res, verifyResult.reason || '验证码校验失败', 400, 400);
    return;
  }

  try {
    const { user } = createUser(email, password);
    const session = createSession(user);
    const quota = getQuotaInfo(user.id);
    success(res, {
      token: session.token,
      userId: session.userId,
      username: session.username,
      role: user.role || 'editor',
      plan: quota.plan,
      quota,
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
    fail(res, '账号或密码不能为空', 400, 400);
    return;
  }

  const user = verifyUser(username, password);
  if (!user) {
    fail(res, '账号或密码错误', 401, 401);
    return;
  }

  const session = createSession(user);
  const quota = getQuotaInfo(user.id);
  success(res, {
    token: session.token,
    userId: session.userId,
    username: session.username,
    role: user.role || 'viewer',
    plan: quota.plan,
    quota,
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
  const user = findUserById(session.userId);
  const quota = getQuotaInfo(session.userId);
  success(res, {
    userId: session.userId,
    username: session.username,
    role: user?.role || 'viewer',
    plan: quota.plan,
    quota,
  }, 'ok');
}));

export default router;
