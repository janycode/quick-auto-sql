import request from '@/utils/request'

export interface IConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  password: string
  database?: string
  createdAt: string
  updatedAt: string
}

export interface IConnectionForm {
  name: string
  host: string
  port: number
  username: string
  password: string
  database?: string
}

// 获取所有连接
export function getConnections() {
  return request.get<any, { code: number; data: IConnection[] }>('/connections')
}

// 创建连接
export function createConnection(data: IConnectionForm) {
  return request.post<any, { code: number; data: IConnection }>('/connections', data)
}

// 更新连接
export function updateConnection(id: string, data: Partial<IConnectionForm>) {
  return request.put<any, { code: number; data: IConnection }>(`/connections/${id}`, data)
}

// 删除连接
export function deleteConnection(id: string) {
  return request.delete<any, { code: number; data: null }>(`/connections/${id}`)
}

// 测试连接（未保存的）
export function testConnection(data: IConnectionForm) {
  return request.post<any, { code: number; data: boolean }>('/connections/test', data)
}

// 测试已保存的连接
export function testSavedConnection(id: string) {
  return request.post<any, { code: number; data: boolean }>(`/connections/${id}/test`)
}
