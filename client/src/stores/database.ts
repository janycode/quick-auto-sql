import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { IDatabase, ITable, IColumn } from '@/api/database'
import * as databaseApi from '@/api/database'

const STORAGE_KEY_CURRENT_DB = 'quick-auto-sql-current-database'

export const useDatabaseStore = defineStore('database', () => {
  const databases = ref<IDatabase[]>([])
  const tables = ref<ITable[]>([])
  const columns = ref<IColumn[]>([])
  const currentDatabase = ref(localStorage.getItem(STORAGE_KEY_CURRENT_DB) || '')
  const currentTable = ref('')
  const selectedTables = ref<string[]>([])
  const loading = ref(false)

  // 持久化当前数据库
  watch(currentDatabase, (db) => {
    if (db) {
      localStorage.setItem(STORAGE_KEY_CURRENT_DB, db)
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_DB)
    }
  })

  async function fetchDatabases(connectionId: string) {
    loading.value = true
    try {
      const res = await databaseApi.getDatabases(connectionId)
      databases.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function fetchTables(connectionId: string, database: string) {
    loading.value = true
    currentDatabase.value = database
    try {
      const res = await databaseApi.getTables(connectionId, database)
      tables.value = res.data || []
    } finally {
      loading.value = false
    }
  }

  async function fetchColumns(connectionId: string, database: string, table: string) {
    currentTable.value = table
    const res = await databaseApi.getColumns(connectionId, database, table)
    columns.value = res.data || []
  }

  async function fetchTableDDL(connectionId: string, database: string, table: string): Promise<string> {
    const res = await databaseApi.getTableDDL(connectionId, database, table)
    return res.data || ''
  }

  function addSelectedTable(tableName: string) {
    if (!selectedTables.value.includes(tableName)) {
      selectedTables.value.push(tableName)
    }
  }

  function removeSelectedTable(tableName: string) {
    selectedTables.value = selectedTables.value.filter(t => t !== tableName)
  }

  function clearSelectedTables() {
    selectedTables.value = []
  }

  function reset() {
    databases.value = []
    tables.value = []
    columns.value = []
    currentDatabase.value = ''
    currentTable.value = ''
    selectedTables.value = []
  }

  return {
    databases,
    tables,
    columns,
    currentDatabase,
    currentTable,
    selectedTables,
    loading,
    fetchDatabases,
    fetchTables,
    fetchColumns,
    fetchTableDDL,
    addSelectedTable,
    removeSelectedTable,
    clearSelectedTables,
    reset,
  }
})
