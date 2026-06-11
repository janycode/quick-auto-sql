import request from '@/utils/request'

// AI 单条配置
export interface IAiConfig {
  id: string
  apiKey: string
  apiUrl: string
  model: string
  createdAt: string
}

// AI 配置存储（含 activeId）
export interface IAiConfigStoreData {
  configs: IAiConfig[]
  activeId: string | null
}

// AI 历史对话
export interface IAiHistory {
  id: string
  connectionId: string
  database: string
  tables: string[]
  question: string
  sql: string
  createdAt: string
}

// 获取 AI 配置列表（含 activeId）
export function getAiConfigList() {
  return request.get<any, { code: number; data: IAiConfigStoreData }>('/ai/configs')
}

// 获取当前激活的 AI 配置
export function getActiveAiConfig() {
  return request.get<any, { code: number; data: IAiConfig | null }>('/ai/config')
}

// 新增 AI 配置
export function addAiConfig(data: { apiKey: string; apiUrl?: string; model?: string }) {
  return request.post<any, { code: number; data: IAiConfigStoreData }>('/ai/configs', data)
}

// 删除 AI 配置
export function deleteAiConfig(id: string) {
  return request.delete<any, { code: number; data: IAiConfigStoreData }>(`/ai/configs/${id}`)
}

// 激活 AI 配置
export function activateAiConfig(id: string) {
  return request.post<any, { code: number; data: IAiConfigStoreData }>(`/ai/configs/${id}/activate`)
}

// ==================== AI 历史对话 ====================

// 获取历史
export function getAiHistory(params?: { connectionId?: string }) {
  return request.get<any, { code: number; data: IAiHistory[] }>('/ai/history', { params })
}

// 新增历史
export function createAiHistory(data: {
  connectionId: string
  database: string
  tables: string[]
  question: string
  sql: string
}) {
  return request.post<any, { code: number; data: IAiHistory }>('/ai/history', data, {
    _silentError: true,
  })
}

// 删除单条
export function deleteAiHistory(id: string) {
  return request.delete<any, { code: number; data: boolean }>(`/ai/history/${id}`)
}

// 清空全部
export function clearAiHistory() {
  return request.delete<any, { code: number; data: number }>('/ai/history')
}

// ==================== AI 服务商（Provider）====================

// AI 模型服务商
export interface IAiProvider {
  name: string
  displayName: string
  chatUrl: string
  modelsUrl: string
  defaultModel: string
}

// 获取服务商列表
export function getAiProviders() {
  return request.get<any, { code: number; data: IAiProvider[] }>('/ai/providers')
}

// 拉取指定服务商的模型列表（走后端代理，避免 CORS）
// provider 传内置名称（如 'deepseek'）或 'custom' 走自定义 modelsUrl
// modelsUrl 仅自定义服务商时必填
export function fetchAiModels(provider: string, apiKey: string, modelsUrl?: string) {
  return request.post<any, { code: number; data: string[] }>('/ai/models', { provider, apiKey, modelsUrl })
}

// ==================== 提示词模板 ====================

export type PromptTemplateType = 'generate_sql' | 'analyze_sql' | 'explain_sql'

export interface IPromptTemplate {
  type: PromptTemplateType
  prompt: string
  updatedAt: string
}

// 获取所有提示词
export function listPromptTemplates() {
  return request.get<any, { code: number; data: Record<PromptTemplateType, IPromptTemplate> }>('/ai/prompts')
}

// 获取单个提示词
export function getPromptTemplate(type: PromptTemplateType) {
  return request.get<any, { code: number; data: IPromptTemplate }>(`/ai/prompts/${type}`)
}

// 更新提示词（不允许清空）
export function updatePromptTemplate(type: PromptTemplateType, prompt: string) {
  return request.put<any, { code: number; data: IPromptTemplate }>(`/ai/prompts/${type}`, { prompt })
}

// 重置为默认提示词
export function resetPromptTemplate(type: PromptTemplateType) {
  return request.post<any, { code: number; data: IPromptTemplate }>(`/ai/prompts/${type}/reset`)
}

// ==================== SQL 性能分析 ====================

export interface ISqlAnalyzeResult {
  explain: Record<string, unknown>[]
  analysis: string
  cached?: boolean
  createdAt?: string
}

export function analyzeSql(data: { connectionId: string; database: string; sql: string }) {
  return request.post<any, { code: number; data: ISqlAnalyzeResult }>('/ai/analyze', data)
}

export function getAnalysisHistory() {
  return request.get<any, { code: number; data: { items: ISqlAnalyzeResult[]; total: number } }>(
    '/ai/analysis-history'
  )
}

export function clearAnalysisHistory() {
  return request.delete<any, { code: number; data: { cleared: number } }>('/ai/analysis-history')
}

// ==================== SQL 业务解释 ====================

export function explainSql(data: { sql: string }) {
  return request.post<any, { code: number; data: { explanation: string } }>('/ai/explain', data)
}
