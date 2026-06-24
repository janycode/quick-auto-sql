import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { IQueryResult } from '@/api/query'

const STORAGE_PREFIX = 'quick-auto-sql_workspace_'
const KEY_SQL = STORAGE_PREFIX + 'sql'
const KEY_RESULT = STORAGE_PREFIX + 'query-result'
const KEY_AI_QUESTION = STORAGE_PREFIX + 'ai-question'
const KEY_AI_SQL = STORAGE_PREFIX + 'ai-generated-sql'
const KEY_AI_OPTIMIZED_SQL = STORAGE_PREFIX + 'ai-optimized-sql'
const KEY_CHECKED_TABLES = STORAGE_PREFIX + 'checked-tables'
const KEY_EXPANDED_KEYS = STORAGE_PREFIX + 'expanded-keys'
const KEY_CURRENT_DB = STORAGE_PREFIX + 'current-database'
const KEY_CONVERSATION = STORAGE_PREFIX + 'conversation'

// 关联表对象结构
export interface ICheckedTable {
  database: string
  table: string
  comment: string
}

// 对话消息结构
export interface IConversationMessage {
  role: 'user' | 'assistant'
  content: string
  sql?: string
  timestamp: number
}

function safeParse<T>(raw: string | null, def: T): T {
  if (!raw) return def
  try {
    return JSON.parse(raw) as T
  } catch {
    return def
  }
}

export const useWorkspaceStore = defineStore('workspace', () => {
  // 编辑器 SQL 内容
  const sql = ref(localStorage.getItem(KEY_SQL) || '')
  // 查询结果
  const queryResult = ref<IQueryResult | null>(safeParse<IQueryResult | null>(localStorage.getItem(KEY_RESULT), null))
  // AI 面板：用户输入的问题
  const aiQuestion = ref(localStorage.getItem(KEY_AI_QUESTION) || '')
  // AI 面板：生成的 SQL
  const aiGeneratedSql = ref(localStorage.getItem(KEY_AI_SQL) || '')
  // AI 面板：优化后的 SQL
  const aiOptimizedSql = ref(localStorage.getItem(KEY_AI_OPTIMIZED_SQL) || '')
  // AI 面板：勾选的表（完整数据，用于 AI 提示）
  const checkedTables = ref<ICheckedTable[]>(safeParse<ICheckedTable[]>(localStorage.getItem(KEY_CHECKED_TABLES), []))
  // 树节点 key 列表（用于恢复勾选状态）
  const checkedTableKeys = ref<string[]>(safeParse<string[]>(localStorage.getItem(KEY_CHECKED_TABLES + '-keys'), []))
  // 树的展开节点 keys
  const expandedKeys = ref<string[]>(safeParse<string[]>(localStorage.getItem(KEY_EXPANDED_KEYS), []))
  // 当前激活数据库（下拉选择的那个，供编辑器使用）
  const currentDatabase = ref(localStorage.getItem(KEY_CURRENT_DB) || '')
  // 是否正在执行查询（防止重复点击）
  const executing = ref(false)
  // AI 面板：是否正在生成 SQL
  const aiGenerating = ref(false)
  // AI 面板：是否正在优化 SQL
  const aiOptimizing = ref(false)
  // AI 对话消息历史
  const conversationMessages = ref<IConversationMessage[]>(
    safeParse<IConversationMessage[]>(localStorage.getItem(KEY_CONVERSATION), [])
  )

  // 监听 & 持久化
  watch(sql, v => localStorage.setItem(KEY_SQL, v))
  watch(queryResult, v => {
    if (v) localStorage.setItem(KEY_RESULT, JSON.stringify(v))
    else localStorage.removeItem(KEY_RESULT)
  }, { deep: true })
  watch(aiQuestion, v => localStorage.setItem(KEY_AI_QUESTION, v))
  watch(aiGeneratedSql, v => localStorage.setItem(KEY_AI_SQL, v))
  watch(aiOptimizedSql, v => localStorage.setItem(KEY_AI_OPTIMIZED_SQL, v))
  watch(checkedTables, v => localStorage.setItem(KEY_CHECKED_TABLES, JSON.stringify(v)), { deep: true })
  watch(checkedTableKeys, v => localStorage.setItem(KEY_CHECKED_TABLES + '-keys', JSON.stringify(v)), { deep: true })
  watch(expandedKeys, v => localStorage.setItem(KEY_EXPANDED_KEYS, JSON.stringify(v)), { deep: true })
  watch(currentDatabase, v => {
    if (v) localStorage.setItem(KEY_CURRENT_DB, v)
    else localStorage.removeItem(KEY_CURRENT_DB)
  })
  watch(conversationMessages, v => localStorage.setItem(KEY_CONVERSATION, JSON.stringify(v)), { deep: true })

  // 清空查询结果
  function clearQueryResult() {
    queryResult.value = null
  }

  // 设置 SQL 内容
  function setSql(v: string) {
    sql.value = v
  }

  // 设置展开节点 keys
  function setExpandedKeys(keys: string[]) {
    expandedKeys.value = keys
  }

  // 添加展开节点 key
  function addExpandedKey(key: string) {
    if (!expandedKeys.value.includes(key)) {
      expandedKeys.value = [...expandedKeys.value, key]
    }
  }

  // 移除展开节点 key
  function removeExpandedKey(key: string) {
    expandedKeys.value = expandedKeys.value.filter(k => k !== key)
  }

  // 设置 AI 生成的 SQL
  function setAiGeneratedSql(v: string) {
    aiGeneratedSql.value = v
  }

  // 设置 AI 优化后的 SQL
  function setAiOptimizedSql(v: string) {
    aiOptimizedSql.value = v
  }

  // 设置 AI 生成中状态（右侧面板 loading 显示）
  function setAiGenerating(v: boolean) {
    aiGenerating.value = v
  }

  // 设置 AI 优化中状态（右侧面板 loading 显示）
  function setAiOptimizing(v: boolean) {
    aiOptimizing.value = v
  }

  // 设置 AI 问题
  function setAiQuestion(v: string) {
    aiQuestion.value = v
  }

  // 设置勾选表（联动 AI 面板）
  function setCheckedTables(tables: ICheckedTable[], keys: string[]) {
    checkedTables.value = tables
    checkedTableKeys.value = keys
  }

  // 清空勾选表
  function clearCheckedTables() {
    checkedTables.value = []
    checkedTableKeys.value = []
  }

  // 清空展开节点 keys
  function clearExpandedKeys() {
    expandedKeys.value = []
  }

  // 设置当前数据库
  function setCurrentDatabase(db: string) {
    currentDatabase.value = db
  }

  // 设置查询结果
  function setQueryResult(result: IQueryResult | null) {
    queryResult.value = result
  }

  // 添加对话消息
  function addConversationMessage(msg: IConversationMessage) {
    conversationMessages.value.push(msg)
  }

  // 清空对话历史
  function clearConversation() {
    conversationMessages.value = []
  }

  // 获取对话历史（用于发送给 AI）
  function getConversationForAI(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return conversationMessages.value.map(m => ({
      role: m.role,
      content: m.sql ? `${m.content}\n\n生成的 SQL:\n\`\`\`sql\n${m.sql}\n\`\`\`` : m.content,
    }))
  }

  // 清空所有与连接相关的状态（切换连接时调用）
  function clearAll() {
    sql.value = ''
    queryResult.value = null
    aiQuestion.value = ''
    aiGeneratedSql.value = ''
    aiOptimizedSql.value = ''
    aiGenerating.value = false
    aiOptimizing.value = false
    checkedTables.value = []
    checkedTableKeys.value = []
    expandedKeys.value = []
    currentDatabase.value = ''
    conversationMessages.value = []
  }

  return {
    sql,
    queryResult,
    aiQuestion,
    aiGeneratedSql,
    aiOptimizedSql,
    aiGenerating,
    aiOptimizing,
    checkedTables,
    checkedTableKeys,
    expandedKeys,
    currentDatabase,
    executing,
    conversationMessages,
    clearQueryResult,
    setSql,
    setAiGeneratedSql,
    setAiOptimizedSql,
    setAiGenerating,
    setAiOptimizing,
    setAiQuestion,
    setCheckedTables,
    clearCheckedTables,
    setCurrentDatabase,
    setQueryResult,
    setExpandedKeys,
    addExpandedKey,
    removeExpandedKey,
    clearExpandedKeys,
    addConversationMessage,
    clearConversation,
    getConversationForAI,
    clearAll,
  }
})
