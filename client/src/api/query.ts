import request from '@/utils/request'

export interface IQueryResult {
  columns: string[]
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
