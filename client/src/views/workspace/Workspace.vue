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
          v-model="sql"
          :databases="databases"
          :executing="executing"
          :selected-database="currentDatabase"
          @execute="handleExecute"
          @database-change="handleDatabaseChange"
        />
        <QueryResult :result="queryResult" />
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
import { ref, onMounted, computed } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SqlEditor from '@/components/editor/SqlEditor.vue'
import QueryResult from '@/components/editor/QueryResult.vue'
import AiChat from '@/components/ai/AiChat.vue'
import ConnectionManager from '@/views/connection/ConnectionManager.vue'
import { useConnectionStore } from '@/stores/connection'
import { useDatabaseStore } from '@/stores/database'
import * as databaseApi from '@/api/database'
import * as queryApi from '@/api/query'
import type { IDatabase } from '@/api/database'
import type { IQueryResult } from '@/api/query'

const connectionStore = useConnectionStore()
const databaseStore = useDatabaseStore()

const sql = ref('')
const sqlEditorRef = ref()
const aiChatRef = ref()
const appSidebarRef = ref()
const showConnectionDialog = ref(false)
const executing = ref(false)
const queryResult = ref<IQueryResult | null>(null)
const databases = ref<IDatabase[]>([])
// 从 store 恢复持久化的数据库
const currentDatabase = ref(databaseStore.currentDatabase)

onMounted(async () => {
  await connectionStore.fetchConnections()
})

async function handleDatabaseChange(db: string) {
  currentDatabase.value = db
  databaseStore.currentDatabase = db
}

async function handleSelectTable(database: string, table: string) {
  currentDatabase.value = database
  databaseStore.currentDatabase = database
  await databaseStore.fetchColumns(connectionStore.activeConnection!.id, database, table)
}

function handleCheckedTablesChange(tables: { database: string; table: string; comment: string }[]) {
  // 自动同步选中的表到 AI 面板
  aiChatRef.value?.setCheckedTables(tables)
  // 如果勾选了表，自动切换到第一个表所在的数据库
  if (tables.length > 0 && tables[0].database) {
    currentDatabase.value = tables[0].database
    databaseStore.currentDatabase = tables[0].database
  }
}

function handleClearTables() {
  appSidebarRef.value?.clearCheckedTables()
}

async function handleExecute(sqlText: string) {
  if (!connectionStore.activeConnection) {
    return
  }
  if (!currentDatabase.value) {
    return
  }

  executing.value = true
  try {
    const res = await queryApi.executeQuery({
      connectionId: connectionStore.activeConnection.id,
      database: currentDatabase.value,
      sql: sqlText,
    })
    queryResult.value = res.data
  } catch {
    queryResult.value = null
  } finally {
    executing.value = false
  }
}

function handleUseSql(generatedSql: string) {
  sql.value = generatedSql
  sqlEditorRef.value?.setSql(generatedSql)
}

// 监听活跃连接变化，加载数据库列表
import { watch } from 'vue'
watch(() => connectionStore.activeConnection, async (conn) => {
  if (conn) {
    const res = await databaseApi.getDatabases(conn.id)
    databases.value = res.data || []
  } else {
    databases.value = []
  }
})
</script>

<style scoped lang="scss">
.db-type-tags {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}
</style>
