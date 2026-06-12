import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { IQueryResult } from '@/api/query'

const STORAGE_PREFIX = 'quick-auto-sql_workspace_'
const KEY_SQL = STORAGE_PREFIX + 'sql'
const KEY_RESULT = STORAGE_PREFIX + 'query-result'
const KEY_AI_QUESTION = STORAGE_PREFIX + 'ai-question'
const KEY_AI_SQL = STORAGE_PREFIX + 'ai-generated-sql'
const KEY_CHECKED_TABLES = STORAGE_PREFIX + 'checked-tables'
const KEY_EXPANDED_KEYS = STORAGE_PREFIX + 'expanded-keys'
const KEY_CURRENT_DB = STORAGE_PREFIX + 'current-database'

// 关联表对象结构
export interface ICheckedTable {
  database: string
  table: string
  comment: string
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

  // 监听 & 持久化
  watch(sql, v => localStorage.setItem(KEY_SQL, v))
  watch(queryResult, v => {
    if (v) localStorage.setItem(KEY_RESULT, JSON.stringify(v))
    else localStorage.removeItem(KEY_RESULT)
  }, { deep: true })
  watch(aiQuestion, v => localStorage.setItem(KEY_AI_QUESTION, v))
  watch(aiGeneratedSql, v => localStorage.setItem(KEY_AI_SQL, v))
  watch(checkedTables, v => localStorage.setItem(KEY_CHECKED_TABLES, JSON.stringify(v)), { deep: true })
  watch(checkedTableKeys, v => localStorage.setItem(KEY_CHECKED_TABLES + '-keys', JSON.stringify(v)), { deep: true })
  watch(expandedKeys, v => localStorage.setItem(KEY_EXPANDED_KEYS, JSON.stringify(v)), { deep: true })
  watch(currentDatabase, v => {
    if (v) localStorage.setItem(KEY_CURRENT_DB, v)
    else localStorage.removeItem(KEY_CURRENT_DB)
  })

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

  // 设置当前数据库
  function setCurrentDatabase(db: string) {
    currentDatabase.value = db
  }

  // 设置查询结果
  function setQueryResult(result: IQueryResult | null) {
    queryResult.value = result
  }

  return {
    sql,
    queryResult,
    aiQuestion,
    aiGeneratedSql,
    checkedTables,
    checkedTableKeys,
    expandedKeys,
    currentDatabase,
    executing,
    clearQueryResult,
    setSql,
    setAiGeneratedSql,
    setAiQuestion,
    setCheckedTables,
    clearCheckedTables,
    setCurrentDatabase,
    setQueryResult,
    setExpandedKeys,
    addExpandedKey,
    removeExpandedKey,
  }
})
