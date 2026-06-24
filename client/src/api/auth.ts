import request from '@/utils/request'

export type PlanType = 'free' | 'pro' | 'team' | 'enterprise'

export interface IQuotaUsage {
  used: number
  limit: number
}

export interface IQuotaInfo {
  plan: PlanType
  planExpiresAt?: string
  aiGenerateOwnKey: IQuotaUsage
  aiGeneratePlatform: IQuotaUsage
  aiAnalyze: IQuotaUsage
  sqlExecute: IQuotaUsage
  historyLimit: number
  historyUsed: number
  hasCustomPrompts: boolean
  trialUsed?: boolean
}

export interface ILoginRequest {
  username: string
  password: string
}

export interface IRegisterRequest {
  email: string
  password: string
  code: string
}

export interface ILoginResult {
  token: string
  userId: string
  username: string
  role?: string
  plan?: PlanType
  quota?: IQuotaInfo
}

export interface IMeResult {
  userId: string
  username: string
  role?: string
  plan?: PlanType
  quota?: IQuotaInfo
}

export function login(data: ILoginRequest) {
  // 登录请求静默错误处理：账号密码错误时，由登录页面自行提示
  // 避免全局 401 拦截器把它当成「会话失效」弹框并跳转
  return request.post<any, { code: number; data: ILoginResult; message?: string }>('/auth/login', data, {
    _silentError: true,
  } as any)
}

export function register(data: IRegisterRequest) {
  // 注册同样静默错误处理，由注册页自行提示
  return request.post<any, { code: number; data: ILoginResult; message?: string }>(
    '/auth/register',
    data,
    { _silentError: true } as any
  )
}

export function sendEmailCode(data: { email: string }) {
  return request.post<any, { code: number; data: { sent: boolean; expiresIn: number; devMode?: boolean; previewUrl?: string } }>(
    '/auth/email/send-code',
    data
  )
}

export function logout() {
  return request.post<any, { code: number; data: null }>('/auth/logout')
}

export function getMe() {
  return request.get<any, { code: number; data: IMeResult }>('/auth/me')
}

export function getQuotaInfo() {
  return request.get<any, { code: number; data: IQuotaInfo }>('/quota')
}

export function upgradePlan(plan: PlanType) {
  return request.post<any, { code: number; data: IQuotaInfo }>('/quota/upgrade', { plan })
}
