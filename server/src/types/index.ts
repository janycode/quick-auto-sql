export interface IConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string; // 加密存储
  database?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IConnectionCreate {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
}

export interface IDatabase {
  name: string;
  charset?: string;
  collation?: string;
}

export interface ITable {
  name: string;
  comment?: string;
  engine?: string;
  rowCount?: number;
}

export interface IColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  comment: string;
  isPrimary: boolean;
  autoIncrement: boolean;
}

export interface IQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

export interface IQueryRequest {
  connectionId: string;
  database: string;
  sql: string;
}

export interface IAiConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
}

export interface IAiGenerateRequest {
  connectionId: string;
  database: string;
  tables: string[];
  question: string;
}

export interface ISseMessage {
  type: 'thinking' | 'sql' | 'error' | 'done';
  content: string;
}

export interface IApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}
