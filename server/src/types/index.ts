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

// AI 单条配置
export interface IAiConfig {
  id: string;
  apiKey: string;
  apiUrl: string;
  model: string;
  createdAt: string;
}

// AI 配置新增入参
export interface IAiConfigCreate {
  apiKey: string;
  apiUrl: string;
  model: string;
}

// AI 配置存储（含 activeId）
export interface IAiConfigStoreData {
  configs: IAiConfig[];
  activeId: string | null;
}

export interface IAiGenerateRequest {
  connectionId: string;
  database: string;
  tables: string[];
  question: string;
}

export interface IAiHistory {
  id: string;
  connectionId: string;
  database: string;
  tables: string[];
  question: string;
  sql: string;
  createdAt: string;
}

export interface IAiHistoryCreate {
  connectionId: string;
  database: string;
  tables: string[];
  question: string;
  sql: string;
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

// AI 模型服务商（Provider）
export interface IAiProvider {
  name: string;         // 唯一标识，如 "deepseek"
  displayName: string;  // 展示名称，如 "DeepSeek"
  chatUrl: string;      // 聊天补全接口（chat/completions）
  modelsUrl: string;    // 模型列表接口 (/models)
  defaultModel: string; // 默认模型
}

// 提示词模板类型
export type IPromptTemplateType = 'generate_sql' | 'analyze_sql' | 'explain_sql' | 'optimize_sql';

// 提示词模板
export interface IPromptTemplate {
  type: IPromptTemplateType;
  prompt: string;
  updatedAt: string;
}
