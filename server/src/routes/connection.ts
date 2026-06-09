import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import * as connectionService from '../services/connection';

const router = Router();

// 获取所有连接
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const connections = connectionService.getAllConnections();
  success(res, connections);
}));

// 测试连接（未保存的）
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  try {
    await connectionService.testConnection(req.body);
    success(res, true, '连接成功');
  } catch (error: any) {
    fail(res, `连接失败: ${error.message}`);
  }
}));

// 测试已保存的连接
router.post('/:id/test', asyncHandler(async (req: Request, res: Response) => {
  try {
    await connectionService.testSavedConnection(req.params.id);
    success(res, true, '连接成功');
  } catch (error: any) {
    fail(res, `连接失败: ${error.message}`);
  }
}));

// 创建连接
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const connection = connectionService.createConnection(req.body);
  success(res, connection, '创建成功');
}));

// 更新连接
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const connection = connectionService.updateConnection(req.params.id, req.body);
  if (!connection) {
    fail(res, '连接不存在');
    return;
  }
  success(res, connection, '更新成功');
}));

// 删除连接
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const deleted = connectionService.deleteConnection(req.params.id);
  if (!deleted) {
    fail(res, '连接不存在');
    return;
  }
  success(res, null, '删除成功');
}));

export default router;
