import request from '@/utils/request'

export interface IDatabase {
  name: string
  charset?: string
  collation?: string
}

export interface ITable {
  name: string
  comment?: string
  engine?: string
  rowCount?: number
}

export interface IColumn {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  comment: string
  isPrimary: boolean
  autoIncrement: boolean
}

// 获取数据库列表
export function getDatabases(connectionId: string) {
  return request.get<any, { code: number; data: IDatabase[] }>('/databases', { params: { connectionId } })
}

// 获取表列表
export function getTables(connectionId: string, database: string) {
  return request.get<any, { code: number; data: ITable[] }>('/databases/tables', { params: { connectionId, database } })
}

// 获取表字段信息
export function getColumns(connectionId: string, database: string, table: string) {
  return request.get<any, { code: number; data: IColumn[] }>('/databases/columns', { params: { connectionId, database, table } })
}

// 获取表 DDL
export function getTableDDL(connectionId: string, database: string, table: string) {
  return request.get<any, { code: number; data: string }>('/databases/ddl', { params: { connectionId, database, table } })
}
