import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import { AuthRequest } from '../middleware/auth';
import * as databaseService from '../services/database';

const router = Router();

// 获取数据库列表（按当前用户校验连接归属）
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId } = req.query;
  if (!connectionId) {
    fail(res, 'connectionId 参数必填');
    return;
  }
  const databases = await databaseService.getDatabases(connectionId as string, req.auth?.userId);
  success(res, databases);
}));

// 获取表列表（按当前用户校验连接归属）
router.get('/tables', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId, database } = req.query;
  if (!connectionId || !database) {
    fail(res, 'connectionId 和 database 参数必填');
    return;
  }
  const tables = await databaseService.getTables(connectionId as string, database as string, req.auth?.userId);
  success(res, tables);
}));

// 获取表字段信息（按当前用户校验连接归属）
router.get('/columns', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId, database, table } = req.query;
  if (!connectionId || !database || !table) {
    fail(res, 'connectionId、database 和 table 参数必填');
    return;
  }
  const columns = await databaseService.getColumns(
    connectionId as string,
    database as string,
    table as string,
    req.auth?.userId
  );
  success(res, columns);
}));

// 获取表 DDL（按当前用户校验连接归属）
router.get('/ddl', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId, database, table } = req.query;
  if (!connectionId || !database || !table) {
    fail(res, 'connectionId、database 和 table 参数必填');
    return;
  }
  const ddl = await databaseService.getTableDDL(
    connectionId as string,
    database as string,
    table as string,
    req.auth?.userId
  );
  success(res, ddl);
}));

// 获取表状态信息（按当前用户校验连接归属）
router.get('/table-status', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId, database, table } = req.query;
  if (!connectionId || !database || !table) {
    fail(res, 'connectionId、database 和 table 参数必填');
    return;
  }
  const status = await databaseService.getTableStatus(
    connectionId as string,
    database as string,
    table as string,
    req.auth?.userId
  );
  success(res, status);
}));

export default router;
