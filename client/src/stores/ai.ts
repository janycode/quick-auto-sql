import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { IAiConfig } from '@/api/ai'
import * as aiApi from '@/api/ai'

export const useAiStore = defineStore('ai', () => {
  const config = ref<IAiConfig>({
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
  })
  const generating = ref(false)
  const generatedSql = ref('')

  async function fetchConfig() {
    const res = await aiApi.getAiConfig()
    config.value = res.data || config.value
  }

  async function saveConfig(data: Partial<IAiConfig>) {
    const res = await aiApi.updateAiConfig(data)
    config.value = res.data
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

  return {
    config,
    generating,
    generatedSql,
    fetchConfig,
    saveConfig,
    setGenerating,
    setGeneratedSql,
    appendGeneratedSql,
    clearGeneratedSql,
  }
})
