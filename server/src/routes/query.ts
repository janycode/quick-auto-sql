import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import * as queryService from '../services/query';

const router = Router();

// 执行 SQL 查询
router.post('/execute', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database, sql } = req.body;
  if (!connectionId || !database || !sql) {
    fail(res, 'connectionId、database 和 sql 参数必填');
    return;
  }

  // 安全检查：禁止 DDL 操作（第一版简化处理），放开 ALTER 操作用于添加索引和改表
  const trimmedSql = sql.trim().toUpperCase();
  const forbiddenKeywords = ['DROP', 'TRUNCATE', 'GRANT', 'REVOKE'];
  for (const keyword of forbiddenKeywords) {
    if (trimmedSql.startsWith(keyword)) {
      fail(res, `不允许执行 ${keyword} 操作`);
      return;
    }
  }

  const result = await queryService.executeQuery(connectionId, database, sql);
  success(res, result);
}));

export default router;
