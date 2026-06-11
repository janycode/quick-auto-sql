import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { IAiConfig, IAiConfigStoreData, IAiHistory, IPromptTemplate, PromptTemplateType } from '@/api/ai'
import * as aiApi from '@/api/ai'

export const useAiStore = defineStore('ai', () => {
  // AI 配置列表（含 activeId）
  const configStore = ref<IAiConfigStoreData>({ configs: [], activeId: null })
  const generating = ref(false)
  const generatedSql = ref('')
  const history = ref<IAiHistory[]>([])
  // 提示词模板
  const promptTemplates = ref<Record<PromptTemplateType, IPromptTemplate> | null>(null)

  // 当前激活的配置（兼容旧版 aiStore.config 用法）
  const config = computed<IAiConfig>(() => {
    const activeId = configStore.value.activeId
    if (!activeId) {
      return { id: '', apiKey: '', apiUrl: '', model: '', createdAt: '' }
    }
    return configStore.value.configs.find(c => c.id === activeId)
      || { id: '', apiKey: '', apiUrl: '', model: '', createdAt: '' }
  })

  // 拉取配置列表（兼容旧版 fetchConfig）
  async function fetchConfigList() {
    const res = await aiApi.getAiConfigList()
    configStore.value = res.data || { configs: [], activeId: null }
  }

  // 兼容旧版 fetchConfig
  async function fetchConfig() {
    return fetchConfigList()
  }

  // 新增配置
  async function addConfig(data: { apiKey: string; apiUrl?: string; model?: string }) {
    const res = await aiApi.addAiConfig(data)
    configStore.value = res.data || configStore.value
  }

  // 删除配置
  async function deleteConfig(id: string) {
    const res = await aiApi.deleteAiConfig(id)
    configStore.value = res.data || configStore.value
  }

  // 激活配置
  async function activateConfig(id: string) {
    const res = await aiApi.activateAiConfig(id)
    configStore.value = res.data || configStore.value
  }

  // 获取历史
  async function fetchHistory(connectionId?: string) {
    const res = await aiApi.getAiHistory(connectionId ? { connectionId } : undefined)
    history.value = res.data || []
  }

  // 新增历史
  async function addHistory(data: {
    connectionId: string
    database: string
    tables: string[]
    question: string
    sql: string
  }) {
    const res = await aiApi.createAiHistory(data)
    if (res.data) {
      history.value = [res.data, ...history.value]
    }
  }

  // 删除单条
  async function removeHistory(id: string) {
    await aiApi.deleteAiHistory(id)
    history.value = history.value.filter(h => h.id !== id)
  }

  // 清空全部
  async function clearHistory() {
    await aiApi.clearAiHistory()
    history.value = []
  }

  function setGenerating(value: boolean) {
    generating.value = value
  }

  function setGeneratedSql(sql: string) {
    generatedSql.value = sql
  }

  function appendGeneratedSql(chunk: string) {
    generatedSql.value += chunk
  }

  function clearGeneratedSql() {
    generatedSql.value = ''
  }

  // 拉取所有提示词模板
  async function fetchPromptTemplates(force = false) {
    if (promptTemplates.value && !force) return promptTemplates.value
    const res = await aiApi.listPromptTemplates()
    if (res && res.data) {
      promptTemplates.value = res.data
    }
    return promptTemplates.value
  }

  // 更新单个提示词模板
  async function updatePromptTemplate(type: PromptTemplateType, prompt: string) {
    const res = await aiApi.updatePromptTemplate(type, prompt)
    if (res && res.data && promptTemplates.value) {
      promptTemplates.value[type] = res.data
    }
    return res.data
  }

  // 重置为默认提示词
  async function resetPromptTemplate(type: PromptTemplateType) {
    const res = await aiApi.resetPromptTemplate(type)
    if (res && res.data && promptTemplates.value) {
      promptTemplates.value[type] = res.data
    }
    return res.data
  }

  return {
    configStore,
    config,
    generating,
    generatedSql,
    history,
    promptTemplates,
    fetchConfigList,
    fetchConfig,
    addConfig,
    deleteConfig,
    activateConfig,
    fetchHistory,
    addHistory,
    removeHistory,
    clearHistory,
    setGenerating,
    setGeneratedSql,
    appendGeneratedSql,
    clearGeneratedSql,
    fetchPromptTemplates,
    updatePromptTemplate,
    resetPromptTemplate,
  }
})
