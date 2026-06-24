import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import { AuthRequest } from '../middleware/auth';
import * as connectionService from '../services/connection';
import { addAuditLog } from '../services/audit';

const router = Router();

// 获取所有连接（按当前用户隔离）
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const connections = connectionService.getAllConnections(req.auth?.userId);
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

// 测试已保存的连接（校验归属）
router.post('/:id/test', asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    await connectionService.testSavedConnection(req.params.id, req.auth?.userId);
    success(res, true, '连接成功');
  } catch (error: any) {
    fail(res, `连接失败: ${error.message}`);
  }
}));

// 创建连接（绑定当前用户）
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const connection = connectionService.createConnection(req.body, req.auth?.userId);
  addAuditLog({
    userId: req.auth?.userId || '',
    username: req.auth?.username || '',
    action: 'create',
    target: 'connection',
    details: `创建连接: ${req.body.name || '未命名'}`,
    ip: req.ip || '',
  });
  success(res, connection, '创建成功');
}));

// 更新连接（校验归属）
router.put('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const connection = connectionService.updateConnection(req.params.id, req.body, req.auth?.userId);
  if (!connection) {
    fail(res, '连接不存在或无权限');
    return;
  }
  addAuditLog({
    userId: req.auth?.userId || '',
    username: req.auth?.username || '',
    action: 'update',
    target: 'connection',
    details: `更新连接: ${req.params.id}`,
    ip: req.ip || '',
  });
  success(res, connection, '更新成功');
}));

// 删除连接（校验归属）
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = connectionService.deleteConnection(req.params.id, req.auth?.userId);
  if (!deleted) {
    fail(res, '连接不存在或无权限');
    return;
  }
  addAuditLog({
    userId: req.auth?.userId || '',
    username: req.auth?.username || '',
    action: 'delete',
    target: 'connection',
    details: `删除连接: ${req.params.id}`,
    ip: req.ip || '',
  });
  success(res, null, '删除成功');
}));

export default router;
