import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import type { PlanType } from '../types';
import { updateUserPlan } from './quota';

export type PayMethod = 'alipay' | 'wechat';
export type PayOrderStatus = 'pending' | 'paid' | 'cancelled' | 'failed';

export interface IPayOrder {
  orderId: string;
  userId: string;
  plan: PlanType;
  billingCycle: 'monthly' | 'yearly';
  method: PayMethod;
  amount: number;           // 金额（元）
  currency: string;         // CNY
  status: PayOrderStatus;
  createdAt: string;
  paidAt?: string;
  qrCodeUrl?: string;       // 二维码图片（base64 或 URL）
  expireSeconds?: number;   // 支付二维码有效期（秒）
}

const PAY_ORDERS_FILE = 'pay-orders.json';

// 套餐价格（元）- 与前端 plans.ts 保持一致
const PRICE_MONTHLY: Record<PlanType, number> = {
  free: 0,
  pro: 15,
  team: 39,
  enterprise: 0,
};
const PRICE_YEARLY_TOTAL: Record<PlanType, number> = {
  free: 0,
  pro: 138,
  team: 358,
  enterprise: 0,
};

function getFilePath(): string {
  return path.join(config.dataDir, PAY_ORDERS_FILE);
}

function readOrders(): IPayOrder[] {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(raw)) return [];
    return raw.filter((r: any) => r && typeof r.orderId === 'string');
  } catch {
    return [];
  }
}

function writeOrders(orders: IPayOrder[]): void {
  const filePath = getFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(orders, null, 2), 'utf-8');
}

/**
 * 根据套餐与计费周期计算金额
 */
export function calculateAmount(plan: PlanType, billingCycle: 'monthly' | 'yearly'): number {
  if (billingCycle === 'yearly') {
    return PRICE_YEARLY_TOTAL[plan] || 0;
  }
  return PRICE_MONTHLY[plan] || 0;
}

/**
 * 生成支付二维码（模拟）：返回 data URL，由前端以图片形式展示
 * 真实环境下这里应调用支付宝/微信的开放平台 SDK 生成二维码
 */
function generateQrCode(orderId: string, method: PayMethod, amount: number): string {
  const code = `${method}://pay/quick-auto-sql?order=${orderId}&amount=${amount}`;
  // 简单处理：直接返回一个 base64 占位；前端按 img 方式展示
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='%23fff'/><text x='50%25' y='50%25' text-anchor='middle' font-size='14' fill='%23333'>${method.toUpperCase()} QR</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '#' + encodeURIComponent(code);
}

/**
 * 创建订单
 */
export function createOrder(
  userId: string,
  plan: PlanType,
  billingCycle: 'monthly' | 'yearly',
  method: PayMethod
): IPayOrder {
  const amount = calculateAmount(plan, billingCycle);
  const order: IPayOrder = {
    orderId: uuidv4().replace(/-/g, '').toUpperCase(),
    userId,
    plan,
    billingCycle,
    method,
    amount,
    currency: 'CNY',
    status: 'pending',
    createdAt: new Date().toISOString(),
    expireSeconds: 15 * 60,
    qrCodeUrl: generateQrCode('', method, amount),
  };
  const orders = readOrders();
  orders.push(order);
  writeOrders(orders);
  return order;
}

/**
 * 查询订单
 */
export function findOrder(orderId: string): IPayOrder | undefined {
  return readOrders().find(o => o.orderId === orderId);
}

/**
 * 标记订单为已支付，并更新用户套餐
 */
export function markOrderPaid(orderId: string): { ok: boolean; reason?: string } {
  const orders = readOrders();
  const idx = orders.findIndex(o => o.orderId === orderId);
  if (idx === -1) return { ok: false, reason: '订单不存在' };
  const order = orders[idx];
  if (order.status === 'paid') return { ok: true };
  if (order.status !== 'pending') return { ok: false, reason: '订单状态不允许支付' };
  order.status = 'paid';
  order.paidAt = new Date().toISOString();
  orders[idx] = order;
  writeOrders(orders);
  // 更新用户套餐：付费 30 天；年付则 365 天
  const days = order.billingCycle === 'yearly' ? 365 : 30;
  updateUserPlan(order.userId, order.plan, days);
  return { ok: true };
}

/**
 * 取消订单（前端主动取消或超时）
 */
export function cancelOrder(orderId: string): boolean {
  const orders = readOrders();
  const idx = orders.findIndex(o => o.orderId === orderId);
  if (idx === -1) return false;
  if (orders[idx].status !== 'pending') return false;
  orders[idx].status = 'cancelled';
  writeOrders(orders);
  return true;
}
