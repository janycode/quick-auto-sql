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
        <div class="tab-bar">
          <div class="tab-list" ref="tabListRef">
            <div
              v-for="tab in tabsStore.tabs"
              :key="tab.id"
              class="tab-item"
              :class="{ active: tab.id === tabsStore.activeTabId }"
              @click="tabsStore.switchTab(tab.id)"
              @dblclick="startRename(tab)"
              @contextmenu.prevent="showTabContextMenu($event, tab)"
            >
              <span class="tab-title" v-if="renamingTabId !== tab.id">{{ tab.title }}</span>
              <input
                v-else
                ref="renameInputRef"
                class="tab-rename-input"
                :value="tab.title"
                @blur="finishRename(tab, ($event.target as HTMLInputElement).value)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
                @keydown.escape="cancelRename"
                @click.stop
              />
              <el-icon
                v-if="tabsStore.tabs.length > 1"
                class="tab-close"
                @click.stop="tabsStore.closeTab(tab.id)"
              ><Close /></el-icon>
            </div>
          </div>
          <el-button class="tab-add" size="small" link @click="tabsStore.addTab()">
            <el-icon><Plus /></el-icon>
          </el-button>
          <div class="tab-bar-spacer" />
          <el-dropdown v-if="tabsStore.tabs.length > 1" trigger="click" size="small">
            <el-button size="small" link>
              <el-icon><MoreFilled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="tabsStore.closeOtherTabs(tabsStore.activeTabId)">
                  关闭其他标签页
                </el-dropdown-item>
                <el-dropdown-item @click="tabsStore.closeAllTabs()">
                  关闭所有标签页
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <SqlEditor
          ref="sqlEditorRef"
          v-model="currentSql"
          :databases="databases"
          :executing="tabsStore.activeTab?.executing"
          :selected-database="tabsStore.activeTab?.database || workspaceStore.currentDatabase"
          :connection-id="connectionStore.activeConnection?.id"
          :table-names="tableNames"
          :columns-by-table="columnsByTable"
          @execute="handleExecute"
          @database-change="handleDatabaseChange"
        />
        <QueryResult :result="tabsStore.activeTab?.queryResult || null" />
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

    <!-- 标签页右键菜单 -->
    <Teleport to="body">
      <div
        v-if="tabContextMenu.visible"
        class="tab-context-menu"
        :style="{ left: tabContextMenu.x + 'px', top: tabContextMenu.y + 'px' }"
        @click.stop
      >
        <div class="context-menu-item" @click="handleRenameFromMenu">
          <el-icon><Edit /></el-icon>
          <span>重命名</span>
        </div>
        <div class="context-menu-item" @click="handleDuplicateTab">
          <el-icon><CopyDocument /></el-icon>
          <span>复制标签页</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" @click="handleCloseOthers">
          <el-icon><Close /></el-icon>
          <span>关闭其他</span>
        </div>
        <div class="context-menu-item danger" @click="handleCloseTab">
          <el-icon><Delete /></el-icon>
          <span>关闭</span>
        </div>
      </div>
    </Teleport>
  </AppHeader>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { Plus, Close, MoreFilled, Edit, CopyDocument, Delete } from '@element-plus/icons-vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SqlEditor from '@/components/editor/SqlEditor.vue'
import QueryResult from '@/components/editor/QueryResult.vue'
import AiChat from '@/components/ai/AiChat.vue'
import ConnectionManager from '@/views/connection/ConnectionManager.vue'
import { useConnectionStore } from '@/stores/connection'
import { useDatabaseStore } from '@/stores/database'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTabsStore } from '@/stores/tabs'
import * as databaseApi from '@/api/database'
import * as queryApi from '@/api/query'
import type { IColumn } from '@/api/database'
import type { ITab } from '@/stores/tabs'

const connectionStore = useConnectionStore()
const databaseStore = useDatabaseStore()
const workspaceStore = useWorkspaceStore()
const tabsStore = useTabsStore()

const sqlEditorRef = ref()
const aiChatRef = ref()
const appSidebarRef = ref()
const tabListRef = ref<HTMLElement>()
const showConnectionDialog = ref(false)
const databases = ref<{ name: string; comment?: string }[]>([])

// 标签页重命名
const renamingTabId = ref('')
const renameInputRef = ref<HTMLInputElement[]>()

// 标签页右键菜单
const tabContextMenu = ref({ visible: false, x: 0, y: 0, tabId: '' })

const currentSql = computed({
  get: () => tabsStore.activeTab?.sql || '',
  set: (v: string) => {
    if (tabsStore.activeTab) {
      tabsStore.updateTabSql(tabsStore.activeTab.id, v)
    }
  },
})

const tableNames = computed(() => (databaseStore.tables || []).map((t: any) => t.name || t))
const columnsByTable = ref<Record<string, IColumn[]>>({})

onMounted(async () => {
  await connectionStore.fetchConnections()
  document.addEventListener('click', hideTabContextMenu)
})

function hideTabContextMenu() {
  tabContextMenu.value.visible = false
}

watch(
  () => connectionStore.activeConnection,
  async (conn) => {
    if (conn) {
      const res = await databaseApi.getDatabases(conn.id)
      databases.value = res.data || []
    } else {
      databases.value = []
    }
  },
  { immediate: true }
)

watch(
  () => workspaceStore.currentDatabase,
  async (db) => {
    if (!db || !connectionStore.activeConnection) return
    try {
      await databaseStore.fetchTables(connectionStore.activeConnection.id, db)
    } catch (_) { /* 忽略 */ }
  },
  { immediate: !!workspaceStore.currentDatabase }
)

function handleDatabaseChange(db: string) {
  workspaceStore.setCurrentDatabase(db)
  if (tabsStore.activeTab) {
    tabsStore.updateTabDatabase(tabsStore.activeTab.id, db)
  }
}

async function handleSelectTable(database: string, table: string) {
  workspaceStore.setCurrentDatabase(database)
  await databaseStore.fetchColumns(connectionStore.activeConnection!.id, database, table)
  if (databaseStore.columns?.length) {
    columnsByTable.value = {
      ...columnsByTable.value,
      [table]: [...databaseStore.columns] as IColumn[],
    }
  }
}

function handleCheckedTablesChange(tables: { database: string; table: string; comment: string }[]) {
  aiChatRef.value?.setCheckedTables(tables)
  if (tables.length > 0 && tables[0].database) {
    workspaceStore.setCurrentDatabase(tables[0].database)
  }
}

function handleClearTables() {
  appSidebarRef.value?.clearCheckedTables()
}

async function handleExecute(sqlText: string) {
  const tab = tabsStore.activeTab
  if (!tab) return
  if (!connectionStore.activeConnection) return
  const database = tab.database || workspaceStore.currentDatabase
  if (!database) return

  tabsStore.setTabExecuting(tab.id, true)
  try {
    const res = await queryApi.executeQuery({
      connectionId: connectionStore.activeConnection.id,
      database,
      sql: sqlText,
    })
    tabsStore.updateTabResult(tab.id, res.data)
  } catch {
    tabsStore.updateTabResult(tab.id, null)
  } finally {
    tabsStore.setTabExecuting(tab.id, false)
  }
}

function handleUseSql(generatedSql: string) {
  if (tabsStore.activeTab) {
    tabsStore.updateTabSql(tabsStore.activeTab.id, generatedSql)
  }
  sqlEditorRef.value?.setSql(generatedSql)
}

// 标签页重命名
function startRename(tab: ITab) {
  renamingTabId.value = tab.id
  nextTick(() => {
    const input = renameInputRef.value?.[0]
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function finishRename(tab: ITab, newTitle: string) {
  const trimmed = newTitle.trim()
  if (trimmed && trimmed !== tab.title) {
    tabsStore.renameTab(tab.id, trimmed)
  }
  renamingTabId.value = ''
}

function cancelRename() {
  renamingTabId.value = ''
}

// 标签页右键菜单
function showTabContextMenu(event: MouseEvent, tab: ITab) {
  tabContextMenu.value = { visible: true, x: event.clientX, y: event.clientY, tabId: tab.id }
}

function handleRenameFromMenu() {
  const tab = tabsStore.tabs.find((t: ITab) => t.id === tabContextMenu.value.tabId)
  hideTabContextMenu()
  if (tab) startRename(tab)
}

function handleDuplicateTab() {
  const tab = tabsStore.tabs.find((t: ITab) => t.id === tabContextMenu.value.tabId)
  hideTabContextMenu()
  if (tab) {
    const newTab = tabsStore.addTab(tab.title + ' (副本)', tab.database)
    tabsStore.updateTabSql(newTab.id, tab.sql)
  }
}

function handleCloseOthers() {
  hideTabContextMenu()
  tabsStore.closeOtherTabs(tabContextMenu.value.tabId)
}

function handleCloseTab() {
  hideTabContextMenu()
  tabsStore.closeTab(tabContextMenu.value.tabId)
}
</script>

<style scoped lang="scss">
.db-type-tags {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.tab-bar {
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  height: 36px;
  padding: 0 4px;
  flex-shrink: 0;
  gap: 2px;
}

.tab-list {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
  height: 100%;

  &::-webkit-scrollbar { height: 0; }
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 28px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
  user-select: none;

  &:hover {
    background: var(--border-color);
    color: var(--text-primary);
  }

  &.active {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .tab-close {
    font-size: 12px;
    color: var(--text-muted);
    border-radius: 3px;
    padding: 1px;
    transition: all 0.15s;
    display: none;

    &:hover {
      color: #f56c6c;
      background: rgba(245, 108, 108, 0.1);
    }
  }

  &:hover .tab-close,
  &.active .tab-close {
    display: inline-flex;
  }
}

.tab-rename-input {
  width: 80px;
  height: 20px;
  padding: 0 4px;
  font-size: 12px;
  border: 1px solid #409eff;
  border-radius: 3px;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.tab-add {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  border-radius: 4px;
  flex-shrink: 0;

  &:hover {
    color: #409eff;
    background: #ecf5ff;
  }
}

.tab-bar-spacer {
  flex: 0;
}
</style>

<style lang="scss">
.tab-context-menu {
  position: fixed;
  z-index: 10000;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  padding: 4px 0;
  min-width: 140px;

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.1s;

    &:hover {
      background: var(--bg-tertiary);
    }

    &.danger {
      color: #f56c6c;
      &:hover {
        background: #fef0f0;
      }
    }
  }

  .context-menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 4px 0;
  }
}
</style>
