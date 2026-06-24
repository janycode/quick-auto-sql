import request from '@/utils/request'

export interface IAuditLog {
  id: string
  userId: string
  username: string
  action: string
  target: string
  details: string
  ip: string
  createdAt: string
}

export function getAuditLogs(params?: { page?: number; pageSize?: number }) {
  return request.get<any, { code: number; data: { items: IAuditLog[]; total: number } }>('/audit', { params })
}

export function clearAuditLogs() {
  return request.delete<any, { code: number; data: { cleared: number } }>('/audit')
}
