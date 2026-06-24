export interface IConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string; // 加密存储
  database?: string;
  userId: string;    // 所属用户
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

export interface ITableStatus {
  name: string;
  engine: string | null;
  version: number | null;
  rowFormat: string | null;
  rows: number | null;
  avgRowLength: number | null;
  dataLength: number | null;
  maxDataLength: number | null;
  indexLength: number | null;
  dataFree: number | null;
  autoIncrement: number | null;
  createTime: string | null;
  updateTime: string | null;
  checkTime: string | null;
  collation: string | null;
  comment: string | null;
  columnCount: number;
  indexCount: number;
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
  isDefault?: boolean;
  displayModel?: string;
  displayApiUrl?: string;
  ownerName?: string;        // 所属用户显示名（仅 admin 可见）
}

// AI 配置新增入参
export interface IAiConfigCreate {
  apiKey: string;
  apiUrl: string;
  model: string;
}

// AI 配置存储（纯配置库：不再记录用户激活关系，由 users.json 的 aiConfigs 处理）
export interface IAiConfigStoreData {
  configs: IAiConfig[];
}

export interface IAiGenerateRequest {
  connectionId: string;
  database: string;
  tables: string[];
  question: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface IAiHistory {
  id: string;
  connectionId: string;
  database: string;
  tables: string[];
  question: string;
  sql: string;
  userId: string;      // 所属用户
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

// ==================== 套餐 & 配额 ====================
export type PlanType = 'free' | 'pro' | 'team' | 'enterprise';

export interface IUsageRecord {
  userId: string;
  date: string;        // YYYY-MM-DD
  aiGenerateOwnKey: number;
  aiGeneratePlatform: number;
  aiAnalyze: number;
  sqlExecute: number;
  updatedAt: string;
}

export interface IQuotaUsage {
  used: number;
  limit: number;       // -1 表示无限
}

export interface IQuotaInfo {
  plan: PlanType;
  planExpiresAt?: string;
  aiGenerateOwnKey: IQuotaUsage;
  aiGeneratePlatform: IQuotaUsage;
  aiAnalyze: IQuotaUsage;
  sqlExecute: IQuotaUsage;
  historyLimit: number;
  historyUsed: number;
  hasCustomPrompts: boolean;
  trialUsed?: boolean;
}

// ==================== 用户登录 ====================
export type UserRole = 'admin' | 'editor' | 'viewer';

// 用户可访问的 AI 配置条目
// state: 1 表示"使用中"，0 表示"可用但未使用"
export interface IUserAiConfig {
  id: string;
  state: 0 | 1;
}

export interface IUser {
  id: string;
  email?: string;          // 新注册用户：邮箱（账号）
  username?: string;       // 旧用户兼容：保留 username 用于旧数据
  passwordHash: string;
  emailVerified: boolean;
  role: UserRole;
  createdAt: string;
  aiConfigs: IUserAiConfig[];  // 该用户可用的 AI 配置列表及激活状态
  plan?: PlanType;
  planExpiresAt?: string;
  trialUsed?: boolean;
}

// 审计日志
export interface IAuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  target: string;
  details: string;
  ip: string;
  createdAt: string;
}

export interface IUserStoreData {
  users: IUser[];
}

export interface ILoginRequest {
  username: string;   // 兼容：既可以是邮箱，也可以是旧 username
  password: string;
}

export interface IRegisterRequest {
  email: string;
  password: string;
  code: string;
}

export interface IEmailCodeRequest {
  email: string;
}

export interface ILoginResult {
  token: string;
  username: string;   // 实际返回显示用的用户名（email 或旧 username）
  userId: string;
}

export interface IAuthSession {
  token: string;
  userId: string;
  username: string;
  createdAt: string;
  expiresAt: string;
}

// ==================== 反馈 ====================
export type FeedbackType = 'bug' | 'suggestion' | 'security' | 'other';
export type FeedbackStatus = 'pending' | 'processing' | 'resolved' | 'rejected';

export interface IFeedback {
  id: string;
  type: FeedbackType;
  description: string;
  email?: string;
  userId?: string;
  username?: string;
  status: FeedbackStatus;
  reply?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IFeedbackCreate {
  type: FeedbackType;
  description: string;
  email?: string;
}
