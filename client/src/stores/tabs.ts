import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { IQueryResult } from '@/api/query'

export interface ITab {
  id: string
  title: string
  sql: string
  queryResult: IQueryResult | null
  database: string
  executing: boolean
  createdAt: number
}

let tabIdCounter = 0

function generateTabId(): string {
  return `tab_${Date.now()}_${++tabIdCounter}`
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<ITab[]>([])
  const activeTabId = ref<string>('')

  const activeTab = computed(() => {
    return tabs.value.find(t => t.id === activeTabId.value) || null
  })

  const activeTabIndex = computed(() => {
    return tabs.value.findIndex(t => t.id === activeTabId.value)
  })

  function addTab(title?: string, database?: string): ITab {
    const id = generateTabId()
    const tab: ITab = {
      id,
      title: title || `SQL ${tabs.value.length + 1}`,
      sql: '',
      queryResult: null,
      database: database || '',
      executing: false,
      createdAt: Date.now(),
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function closeTab(id: string) {
    const idx = tabs.value.findIndex(t => t.id === id)
    if (idx === -1) return

    tabs.value.splice(idx, 1)

    if (tabs.value.length === 0) {
      addTab()
      return
    }

    if (activeTabId.value === id) {
      const newIdx = Math.min(idx, tabs.value.length - 1)
      activeTabId.value = tabs.value[newIdx].id
    }
  }

  function switchTab(id: string) {
    if (tabs.value.some(t => t.id === id)) {
      activeTabId.value = id
    }
  }

  function renameTab(id: string, title: string) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.title = title
    }
  }

  function updateTabSql(id: string, sql: string) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.sql = sql
    }
  }

  function updateTabResult(id: string, result: IQueryResult | null) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.queryResult = result
    }
  }

  function updateTabDatabase(id: string, database: string) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.database = database
    }
  }

  function setTabExecuting(id: string, executing: boolean) {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.executing = executing
    }
  }

  function closeOtherTabs(id: string) {
    tabs.value = tabs.value.filter(t => t.id === id)
    activeTabId.value = id
  }

  function closeAllTabs() {
    tabs.value = []
    addTab()
  }

  // Initialize with one empty tab if none exist
  function ensureAtLeastOneTab() {
    if (tabs.value.length === 0) {
      addTab()
    }
    if (!activeTabId.value || !tabs.value.some(t => t.id === activeTabId.value)) {
      activeTabId.value = tabs.value[0].id
    }
  }

  ensureAtLeastOneTab()

  return {
    tabs,
    activeTabId,
    activeTab,
    activeTabIndex,
    addTab,
    closeTab,
    switchTab,
    renameTab,
    updateTabSql,
    updateTabResult,
    updateTabDatabase,
    setTabExecuting,
    closeOtherTabs,
    closeAllTabs,
    ensureAtLeastOneTab,
  }
})
