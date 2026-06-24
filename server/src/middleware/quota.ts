import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { consumeQuota, QUOTA_LABELS, QuotaKey } from '../services/quota';

export function requireQuota(key: QuotaKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    const userId = authReq.auth?.userId;
    if (!userId) {
      res.status(401).json({ code: 401, message: '未登录', data: null });
      return;
    }
    const result = consumeQuota(userId, key);
    if (!result.allowed) {
      const label = QUOTA_LABELS[key] || key;
      res.status(429).json({
        code: 429,
        message: `本月${label}次数已用完（${result.used}/${result.limit}），升级可获得更多额度`,
        data: {
          upgradeHint: true,
          key,
          used: result.used,
          limit: result.limit,
        },
      });
      return;
    }
    next();
  };
}

export const requireAiAnalyzeQuota = requireQuota('aiAnalyze');
export const requireSqlExecuteQuota = requireQuota('sqlExecute');
