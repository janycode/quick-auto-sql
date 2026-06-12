<template>
  <AppHeader>
    <div class="app-body">
      <AppSidebar
        ref="appSidebarRef"
        @add-connection="showConnectionDialog = true"
        @select-table="handleSelectTable"
        @checked-tables-change="handleCheckedTablesChange"
      />
      <div class="app-main">
        <SqlEditor
          ref="sqlEditorRef"
          v-model="workspaceStore.sql"
          :databases="databases"
          :executing="workspaceStore.executing"
          :selected-database="workspaceStore.currentDatabase"
          :connection-id="connectionStore.activeConnection?.id"
          @execute="handleExecute"
          @database-change="handleDatabaseChange"
        />
        <QueryResult :result="workspaceStore.queryResult" />
      </div>
      <AiChat ref="aiChatRef" @use-sql="handleUseSql" @clear-tables="handleClearTables" />
    </div>

    <!-- 连接管理弹窗 -->
    <el-dialog v-model="showConnectionDialog" title="连接管理" width="700px" :close-on-click-modal="false">
      <div class="db-type-tags">
        <el-tag type="primary" effect="plain">MySQL</el-tag>
      </div>
      <ConnectionManager @close="showConnectionDialog = false" />
    </el-dialog>
  </AppHeader>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SqlEditor from '@/components/editor/SqlEditor.vue'
import QueryResult from '@/components/editor/QueryResult.vue'
import AiChat from '@/components/ai/AiChat.vue'
import ConnectionManager from '@/views/connection/ConnectionManager.vue'
import { useConnectionStore } from '@/stores/connection'
import { useDatabaseStore } from '@/stores/database'
import { useWorkspaceStore } from '@/stores/workspace'
import * as databaseApi from '@/api/database'
import * as queryApi from '@/api/query'

const connectionStore = useConnectionStore()
const databaseStore = useDatabaseStore()
const workspaceStore = useWorkspaceStore()

const sqlEditorRef = ref()
const aiChatRef = ref()
const appSidebarRef = ref()
const showConnectionDialog = ref(false)
const databases = ref<{name: string; comment?: string}[]>([])

onMounted(async () => {
  await connectionStore.fetchConnections()
})

// 监听活跃连接变化，加载数据库列表
watch(() => connectionStore.activeConnection, async (conn) => {
  if (conn) {
    const res = await databaseApi.getDatabases(conn.id)
    databases.value = res.data || []
  } else {
    databases.value = []
  }
}, { immediate: true })

function handleDatabaseChange(db: string) {
  workspaceStore.setCurrentDatabase(db)
}

async function handleSelectTable(database: string, table: string) {
  workspaceStore.setCurrentDatabase(database)
  await databaseStore.fetchColumns(connectionStore.activeConnection!.id, database, table)
}

function handleCheckedTablesChange(tables: { database: string; table: string; comment: string }[]) {
  // 自动同步选中的表到 AI 面板（通过 workspace store 共享数据）
  aiChatRef.value?.setCheckedTables(tables)
  // 如果勾选了表，自动切换到第一个表所在的数据库
  if (tables.length > 0 && tables[0].database) {
    workspaceStore.setCurrentDatabase(tables[0].database)
  }
}

function handleClearTables() {
  appSidebarRef.value?.clearCheckedTables()
}

async function handleExecute(sqlText: string) {
  if (!connectionStore.activeConnection) return
  if (!workspaceStore.currentDatabase) return
  workspaceStore.executing = true
  try {
    const res = await queryApi.executeQuery({
      connectionId: connectionStore.activeConnection.id,
      database: workspaceStore.currentDatabase,
      sql: sqlText,
    })
    workspaceStore.setQueryResult(res.data)
  } catch {
    workspaceStore.setQueryResult(null)
  } finally {
    workspaceStore.executing = false
  }
}

function handleUseSql(generatedSql: string) {
  workspaceStore.setSql(generatedSql)
  sqlEditorRef.value?.setSql(generatedSql)
}
</script>

<style scoped lang="scss">
.db-type-tags {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}
</style>
