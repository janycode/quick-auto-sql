import { Router } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import { AuthRequest } from '../middleware/auth';
import {
  createOrder,
  findOrder,
  markOrderPaid,
  cancelOrder,
  calculateAmount,
} from '../services/pay';
import type { PayMethod, IPayOrder } from '../services/pay';
import type { PlanType } from '../types';

const router = Router();

function validatePlan(plan: any): plan is PlanType {
  return typeof plan === 'string' && ['pro', 'team', 'enterprise'].includes(plan);
}

function validateMethod(method: any): method is PayMethod {
  return typeof method === 'string' && ['alipay', 'wechat'].includes(method);
}

function validateBillingCycle(bc: any): bc is 'monthly' | 'yearly' {
  return typeof bc === 'string' && ['monthly', 'yearly'].includes(bc);
}

/**
 * POST /api/pay/create
 * body: { plan, billingCycle, method }
 * 创建订单，返回订单信息（包含二维码/金额）
 */
router.post('/create', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    fail(res, '未登录', 401, 401);
    return;
  }
  const { plan, billingCycle = 'monthly', method } = req.body || {};
  if (!validatePlan(plan)) {
    fail(res, '无效的套餐类型');
    return;
  }
  if (!validateBillingCycle(billingCycle)) {
    fail(res, '无效的计费周期');
    return;
  }
  if (!validateMethod(method)) {
    fail(res, '无效的支付方式');
    return;
  }
  const order = createOrder(userId, plan, billingCycle, method);
  success(res, {
    orderId: order.orderId,
    plan: order.plan,
    billingCycle: order.billingCycle,
    method: order.method,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    createdAt: order.createdAt,
    expireSeconds: order.expireSeconds,
    qrCodeUrl: order.qrCodeUrl,
  }, '订单创建成功');
}));

/**
 * GET /api/pay/status/:orderId
 * 查询订单状态（用于轮询支付结果）
 */
router.get('/status/:orderId', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    fail(res, '未登录', 401, 401);
    return;
  }
  const orderId = req.params.orderId;
  const order = findOrder(orderId);
  if (!order) {
    fail(res, '订单不存在', 404);
    return;
  }
  if (order.userId !== userId) {
    fail(res, '无权限查看该订单', 403);
    return;
  }
  success(res, {
    orderId: order.orderId,
    plan: order.plan,
    billingCycle: order.billingCycle,
    method: order.method,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  });
}));

/**
 * POST /api/pay/confirm
 * body: { orderId }
 * 模拟"用户完成支付"——在真实环境下应由支付宝/微信通过回调通知后端。
 * 这里提供一个显式接口，便于前端在模拟模式下点选"我已支付"来触发升级。
 */
router.post('/confirm', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    fail(res, '未登录', 401, 401);
    return;
  }
  const { orderId } = req.body || {};
  if (!orderId || typeof orderId !== 'string') {
    fail(res, '缺少 orderId');
    return;
  }
  const order = findOrder(orderId);
  if (!order) {
    fail(res, '订单不存在', 404);
    return;
  }
  if (order.userId !== userId) {
    fail(res, '无权限操作该订单', 403);
    return;
  }
  const result = markOrderPaid(orderId);
  if (!result.ok) {
    fail(res, result.reason || '支付失败');
    return;
  }
  success(res, { orderId, status: 'paid', plan: order.plan }, '支付成功，套餐已升级');
}));

/**
 * POST /api/pay/cancel
 * body: { orderId }
 * 取消订单（用户主动放弃）
 */
router.post('/cancel', asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    fail(res, '未登录', 401, 401);
    return;
  }
  const { orderId } = req.body || {};
  const order = findOrder(orderId);
  if (!order) {
    fail(res, '订单不存在', 404);
    return;
  }
  if (order.userId !== userId) {
    fail(res, '无权限操作该订单', 403);
    return;
  }
  const ok = cancelOrder(orderId);
  if (!ok) {
    fail(res, '订单无法取消');
    return;
  }
  success(res, { orderId, status: 'cancelled' }, '订单已取消');
}));

/**
 * POST /api/pay/calculate
 * body: { plan, billingCycle }
 * 计算金额（给前端在跳转到支付页前预览）
 */
router.post('/calculate', asyncHandler(async (req: AuthRequest, res) => {
  const { plan, billingCycle = 'monthly' } = req.body || {};
  if (!validatePlan(plan) || !validateBillingCycle(billingCycle)) {
    fail(res, '无效参数');
    return;
  }
  const amount = calculateAmount(plan, billingCycle);
  success(res, { plan, billingCycle, amount, currency: 'CNY' });
}));

export default router;
