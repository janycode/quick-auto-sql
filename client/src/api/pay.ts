import request from '@/utils/request'
import type { PlanType } from './auth'

export type PayMethod = 'alipay' | 'wechat'
export type PayOrderStatus = 'pending' | 'paid' | 'cancelled' | 'failed'

export interface IPayOrderResult {
  orderId: string
  plan: PlanType
  billingCycle: 'monthly' | 'yearly'
  method: PayMethod
  amount: number
  currency: string
  status: PayOrderStatus
  createdAt: string
  paidAt?: string
  expireSeconds?: number
  qrCodeUrl?: string
}

export interface IPayCreateParams {
  plan: PlanType
  billingCycle?: 'monthly' | 'yearly'
  method: PayMethod
}

export function createPayOrder(params: IPayCreateParams) {
  return request.post<any, { code: number; data: IPayOrderResult; message?: string }>(
    '/pay/create',
    params
  )
}

export function getPayOrderStatus(orderId: string) {
  return request.get<any, { code: number; data: IPayOrderResult; message?: string }>(
    `/pay/status/${orderId}`
  )
}

export function confirmPayOrder(orderId: string) {
  return request.post<any, { code: number; data: IPayOrderResult; message?: string }>(
    '/pay/confirm',
    { orderId }
  )
}

export function cancelPayOrder(orderId: string) {
  return request.post<any, { code: number; data: IPayOrderResult; message?: string }>(
    '/pay/cancel',
    { orderId }
  )
}

export function calculatePayAmount(
  plan: PlanType,
  billingCycle: 'monthly' | 'yearly' = 'monthly'
) {
  return request.post<any, {
    code: number
    data: { plan: PlanType; billingCycle: 'monthly' | 'yearly'; amount: number; currency: string }
    message?: string
  }>('/pay/calculate', { plan, billingCycle })
}
