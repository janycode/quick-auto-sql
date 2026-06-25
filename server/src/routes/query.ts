import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import { AuthRequest } from '../middleware/auth';
import * as queryService from '../services/query';
import { addQueryHistory, listQueryHistoryPage, deleteQueryHistory, clearQueryHistory } from '../store/json-store';
import { addAuditLog } from '../services/audit';
import { requireSqlExecuteQuota } from '../middleware/quota';

const router = Router();

// 执行 SQL 查询
router.post('/execute', requireSqlExecuteQuota, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId, database, sql } = req.body;
  if (!connectionId || !database || !sql) {
    fail(res, 'connectionId、database 和 sql 参数必填');
    return;
  }

  // 安全检查：禁止危险 DDL/DML 操作（按分号分割后逐条检查）
  const trimmedSql = sql.trim().toUpperCase();
  const forbiddenKeywords = ['DROP', 'TRUNCATE', 'GRANT', 'REVOKE'];
  const statements = trimmedSql.split(';').map((s: string) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    for (const keyword of forbiddenKeywords) {
      if (stmt.startsWith(keyword)) {
        fail(res, `不允许执行 ${keyword} 操作`);
        return;
      }
    }
  }

  let result;
  let successFlag = true;
  let errorMessage = '';
  try {
    result = await queryService.executeQuery(connectionId, database, sql, req.auth?.userId);
  } catch (err: any) {
    successFlag = false;
    errorMessage = err.message || '执行失败';
    throw err;
  } finally {
    addQueryHistory({
      sql: sql.slice(0, 2000),
      connectionId,
      database,
      executionTime: result?.executionTime || 0,
      rowCount: result?.rowCount || 0,
      success: successFlag,
      errorMessage: errorMessage || undefined,
      userId: req.auth?.userId || '',
    });
    // 审计日志
    addAuditLog({
      userId: req.auth?.userId || '',
      username: req.auth?.username || '',
      action: 'execute',
      target: 'query',
      details: `执行 SQL: ${sql.slice(0, 200)}... (${successFlag ? '成功' : '失败'})`,
      ip: req.ip || '',
    });
  }
  success(res, result);
}));

// 查询执行历史（分页；按当前用户隔离）
router.get('/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const connectionId = req.query.connectionId as string | undefined;
  const result = listQueryHistoryPage(page, pageSize, connectionId, req.auth?.userId);
  success(res, result);
}));

// 删除单条执行历史（校验归属）
router.delete('/history/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const ok = deleteQueryHistory(req.params.id, req.auth?.userId);
  if (!ok) {
    fail(res, '记录不存在或无权限', 404);
    return;
  }
  success(res, true, '删除成功');
}));

// 清空当前用户的全部执行历史
router.delete('/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const count = clearQueryHistory(req.auth?.userId);
  success(res, count, `已清空 ${count} 条历史`);
}));

export default router;
