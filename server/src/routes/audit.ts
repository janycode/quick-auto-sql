import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/auth';
import * as auditService from '../services/audit';

const router = Router();

// 获取审计日志（仅 admin）
router.get('/', requireAuth, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 50;
  const result = auditService.getAuditLogs(page, pageSize);
  success(res, result);
}));

// 清空审计日志（仅 admin）
router.delete('/', requireAuth, requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const count = auditService.clearAuditLogs();
  success(res, { cleared: count }, `已清空 ${count} 条审计日志`);
}));

export default router;
