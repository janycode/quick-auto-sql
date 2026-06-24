import { Router, Response, Request } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import { requireAuth, requireAdmin, optionalAuth, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/security';
import * as feedbackService from '../services/feedback';
import { sendFeedbackNotification } from '../services/email';
import { config } from '../config';
import type { FeedbackStatus, FeedbackType } from '../types';

const router = Router();

const feedbackRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: '反馈提交过于频繁，请稍后再试',
  keyGenerator: (req) => `feedback:${req.ip || 'unknown'}`,
});

function getBaseUrl(req: Request): string {
  const origin = req.headers['origin'];
  if (typeof origin === 'string' && origin) {
    return origin;
  }
  const host = req.headers['host'];
  const protocol = req.protocol || 'http';
  return host ? `${protocol}://${host}` : '';
}

// 提交反馈（公开接口，登录用户会自动关联用户信息）
router.post('/', optionalAuth, feedbackRateLimit, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, description, email } = req.body;
  if (!type || !description) {
    return fail(res, '问题类型和描述不能为空', 400);
  }
  const validTypes: FeedbackType[] = ['bug', 'suggestion', 'security', 'other'];
  if (!validTypes.includes(type)) {
    return fail(res, '无效的问题类型', 400);
  }
  if (String(description).length > 2000) {
    return fail(res, '反馈描述不能超过 2000 字符', 400);
  }
  const feedback = feedbackService.createFeedback(
    { type, description, email },
    req.auth?.userId,
    req.auth?.username,
  );

  const baseUrl = getBaseUrl(req);
  setImmediate(async () => {
    try {
      await sendFeedbackNotification(feedback, config.adminEmail, baseUrl);
    } catch (e) {
      console.error('[FEEDBACK] 通知邮件发送失败', e);
    }
  });

  success(res, feedback, '反馈提交成功');
}));

// 获取待处理数量（仅 admin）
router.get('/pending-count', requireAuth, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  const count = feedbackService.getPendingCount();
  success(res, { count });
}));

// 获取反馈列表（所有登录用户均可访问，admin 可看全部，普通用户只看自己的）
router.get('/', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const status = req.query.status as FeedbackStatus | undefined;
  const type = req.query.type as FeedbackType | undefined;

  // 非 admin 用户只能查看自己的反馈
  const isAdmin = req.auth?.role === 'admin';
  const userId = req.auth?.userId;

  const result = feedbackService.getFeedbackList({
    page,
    pageSize,
    status,
    type,
    userId: isAdmin ? undefined : userId,
  });
  success(res, result);
}));

// 更新反馈状态（仅 admin）
router.put('/:id/status', requireAuth, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, reply } = req.body;
  const validStatuses: FeedbackStatus[] = ['pending', 'processing', 'resolved', 'rejected'];
  if (!validStatuses.includes(status)) {
    return fail(res, '无效的状态值', 400);
  }
  const updated = feedbackService.updateFeedbackStatus(id, status, reply);
  if (!updated) {
    return fail(res, '反馈不存在', 404);
  }
  success(res, updated, '状态更新成功');
}));

// 删除反馈（仅 admin）
router.delete('/:id', requireAuth, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const deleted = feedbackService.deleteFeedback(id);
  if (!deleted) {
    return fail(res, '反馈不存在', 404);
  }
  success(res, null, '删除成功');
}));

export default router;
