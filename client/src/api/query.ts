import request from '@/utils/request'

export interface IQueryResult {
  columns: string[]
  columnComments: Record<string, string>
  rows: Record<string, unknown>[]
  rowCount: number
  executionTime: number
}

export interface IQueryRequest {
  connectionId: string
  database: string
  sql: string
}

// 执行 SQL 查询
export function executeQuery(data: IQueryRequest) {
  return request.post<any, { code: number; data: IQueryResult }>('/query/execute', data)
}

// SQL 执行历史
export interface IQueryHistoryEntry {
  id: string
  sql: string
  connectionId: string
  database: string
  executionTime: number
  rowCount: number
  success: boolean
  errorMessage?: string
  createdAt: string
}

export function getQueryHistory(params?: { page?: number; pageSize?: number; connectionId?: string }) {
  return request.get<any, { code: number; data: { items: IQueryHistoryEntry[]; total: number } }>('/query/history', { params })
}

export function deleteQueryHistory(id: string) {
  return request.delete<any, { code: number; data: boolean }>(`/query/history/${id}`)
}

export function clearQueryHistory() {
  return request.delete<any, { code: number; data: number }>('/query/history')
}
