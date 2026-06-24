import { Router } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import { AuthRequest } from '../middleware/auth';
import { getQuotaInfo, updateUserPlan } from '../services/quota';

const router = Router();

// 获取当前用户的配额信息
router.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    fail(res, '未登录', 401, 401);
    return;
  }
  const info = getQuotaInfo(userId);
  success(res, info);
}));

// 升级套餐（简化版：直接切换，无需支付）
router.post('/upgrade', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    fail(res, '未登录', 401, 401);
    return;
  }
  const { plan } = req.body || {};
  if (!plan || !['free', 'pro', 'team', 'enterprise'].includes(plan)) {
    fail(res, '无效的套餐类型');
    return;
  }
  // 默认 30 天有效期（付费套餐）
  const expiresDays = plan === 'free' ? undefined : 30;
  const ok = updateUserPlan(userId, plan, expiresDays);
  if (!ok) {
    fail(res, '套餐更新失败');
    return;
  }
  success(res, getQuotaInfo(userId), '套餐已更新');
}));

export default router;
