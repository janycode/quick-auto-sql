import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { IConnection, IConnectionForm } from '@/api/connection'
import * as connectionApi from '@/api/connection'

const STORAGE_KEY_ACTIVE_CONN = 'quick-auto-sql-active-connection-id'

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<IConnection[]>([])
  const activeConnection = ref<IConnection | null>(null)
  const loading = ref(false)

  // 从 localStorage 恢复活跃连接 ID
  function getSavedConnectionId(): string {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_CONN) || ''
  }

  // 监听活跃连接变化，持久化 ID
  watch(activeConnection, (conn) => {
    if (conn) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_CONN, conn.id)
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_CONN)
    }
  })

  async function fetchConnections() {
    loading.value = true
    try {
      const res = await connectionApi.getConnections()
      connections.value = res.data || []

      // 恢复之前选择的连接
      const savedId = getSavedConnectionId()
      if (savedId && !activeConnection.value) {
        const saved = connections.value.find(c => c.id === savedId)
        if (saved) {
          activeConnection.value = saved
        }
      }
    } finally {
      loading.value = false
    }
  }

  async function addConnection(data: IConnectionForm) {
    const res = await connectionApi.createConnection(data)
    connections.value.push(res.data)
    return res.data
  }

  async function editConnection(id: string, data: Partial<IConnectionForm>) {
    const res = await connectionApi.updateConnection(id, data)
    const index = connections.value.findIndex(c => c.id === id)
    if (index !== -1) connections.value[index] = res.data
    return res.data
  }

  async function removeConnection(id: string) {
    await connectionApi.deleteConnection(id)
    connections.value = connections.value.filter(c => c.id !== id)
    if (activeConnection.value?.id === id) {
      activeConnection.value = null
    }
  }

  async function testConnection(data: IConnectionForm) {
    return connectionApi.testConnection(data)
  }

  async function testSavedConnection(id: string) {
    return connectionApi.testSavedConnection(id)
  }

  function setActiveConnection(conn: IConnection | null) {
    activeConnection.value = conn
  }

  return {
    connections,
    activeConnection,
    loading,
    fetchConnections,
    addConnection,
    editConnection,
    removeConnection,
    testConnection,
    testSavedConnection,
    setActiveConnection,
  }
})
