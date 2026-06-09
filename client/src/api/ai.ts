import request from '@/utils/request'

export interface IAiConfig {
  apiKey: string
  apiUrl: string
  model: string
}

// 获取 AI 配置
export function getAiConfig() {
  return request.get<any, { code: number; data: IAiConfig }>('/ai/config')
}

// 更新 AI 配置
export function updateAiConfig(data: Partial<IAiConfig>) {
  return request.put<any, { code: number; data: IAiConfig }>('/ai/config', data)
}
