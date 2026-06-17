import request from '@/utils/request'

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
}

export interface IMeResult {
  userId: string
  username: string
}

export function login(data: ILoginRequest) {
  return request.post<any, { code: number; data: ILoginResult }>('/auth/login', data)
}

export function register(data: IRegisterRequest) {
  return request.post<any, { code: number; data: ILoginResult }>('/auth/register', data)
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
