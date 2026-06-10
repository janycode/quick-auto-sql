<template>
  <div class="db-tree">
    <el-tree
      ref="treeRef"
      :data="treeData"
      :props="treeProps"
      lazy
      :load="loadNode"
      node-key="key"
      :default-expanded-keys="expandedKeys"
      show-checkbox
      :check-on-click-node="false"
      @check="handleCheck"
      @node-click="handleNodeClick"
    >
      <template #default="{ node, data }">
        <div v-if="data.type === 'search'" class="search-wrapper">
          <el-input
            v-model="searchText[data.dbKey]"
            placeholder="搜索表名..."
            size="small"
            clearable
            @input="filterTables(data.dbKey)"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
        <div v-else-if="data.type === 'database'" class="node-content">
          <el-icon :size="14"><Coin /></el-icon>
          <span style="margin-left: 4px">{{ node.label }}</span>
          <span v-if="data.comment" class="tree-comment">{{ data.comment }}</span>
        </div>
        <div v-else-if="data.type === 'table'" class="node-content">
          <span class="table-icon-wrapper" @click.stop="showTableStructure(data.database, data.table, data.comment)">
            <el-icon :size="14" class="table-icon"><Grid /></el-icon>
          </span>
          <span style="margin-left: 4px">{{ node.label }}</span>
          <span v-if="data.comment" class="tree-comment">{{ data.comment }}</span>
        </div>
        <div 
          v-else-if="data.type === 'column'" 
          class="node-content column-node"
          @mouseenter="showColumnInfo($event, data)"
          @mouseleave="hideColumnInfo"
          @mousemove="updateColumnInfoPosition($event)"
        >
          <el-icon :size="14"><Key v-if="data.isPrimary" /><Document v-else /></el-icon>
          <span style="margin-left: 4px">{{ node.label }}</span>
        </div>
      </template>
    </el-tree>

    <!-- 字段信息跟随鼠标悬浮框 -->
    <Teleport to="body">
      <div 
        v-if="showColumnInfoPanel" 
        class="column-info-panel"
        :style="{ left: columnInfoPosition.x + 'px', top: columnInfoPosition.y + 'px' }"
      >
        <div class="column-info-header">
          <span class="column-info-title">{{ currentColumnInfo.database }}.{{ currentColumnInfo.table }}.{{ currentColumnInfo.columnName }}</span>
        </div>
        <div class="column-info-body">
          <div class="info-item">
            <span class="info-label">字段名:</span>
            <span class="info-value">{{ currentColumnInfo.columnName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">类型:</span>
            <span class="info-value">{{ currentColumnInfo.columnType }}</span>
          </div>
          <div v-if="currentColumnInfo.isPrimary" class="info-item">
            <span class="info-label">主键:</span>
            <span class="info-value primary">是</span>
          </div>
          <div class="info-item">
            <span class="info-label">可空:</span>
            <span class="info-value">{{ currentColumnInfo.nullable ? '是' : '否' }}</span>
          </div>
          <div v-if="currentColumnInfo.comment" class="info-item">
            <span class="info-label">注释:</span>
            <span class="info-value">{{ currentColumnInfo.comment }}</span>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showTableModal" class="table-modal-overlay" @click.self="closeTableModal">
        <div
          class="table-modal"
          :style="{ left: modalPosition.x + 'px', top: modalPosition.y + 'px' }"
        >
          <div class="modal-header">
            <span class="modal-title">{{ currentTableInfo.database }}.{{ currentTableInfo.table }}<span v-if="currentTableInfo.comment" class="modal-comment"> - {{ currentTableInfo.comment }}</span></span>
            <el-button size="mini" @click="closeTableModal">×</el-button>
          </div>
          <div class="modal-body">
            <pre class="ddl-code"><code v-html="highlightDDL(currentTableInfo.ddl)"></code></pre>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { Coin, Grid, Key, Document, Search } from '@element-plus/icons-vue'
import { useDatabaseStore } from '@/stores/database'
import * as databaseApi from '@/api/database'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import sql from 'highlight.js/lib/languages/sql'

hljs.registerLanguage('sql', sql)

const props = defineProps<{
  connectionId: string
}>()

const emit = defineEmits<{
  'select-table': [database: string, table: string]
  'checked-tables-change': [tables: { database: string; table: string; comment: string }[]]
}>()

const databaseStore = useDatabaseStore()
const treeRef = ref()
const treeData = ref<any[]>([])
const expandedKeys = ref<string[]>([])
const searchText = ref<Record<string, string>>({})
const originalTablesMap = ref<Record<string, any[]>>({})

// 表结构弹窗相关
const showTableModal = ref(false)
const modalPosition = ref({ x: 0, y: 0 })
const currentTableInfo = ref({
  database: '',
  table: '',
  comment: '',
  ddl: ''
})

// 字段信息悬浮框相关
const showColumnInfoPanel = ref(false)
const columnInfoPosition = ref({ x: 0, y: 0 })
const currentColumnInfo = ref({
  database: '',
  table: '',
  columnName: '',
  columnType: '',
  isPrimary: false,
  nullable: false,
  comment: ''
})

const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: 'isLeaf',
}

onMounted(async () => {
  await loadDatabases()
  await nextTick()
  hideNonTableCheckboxes()
})

async function loadDatabases() {
  const res = await databaseApi.getDatabases(props.connectionId)
  const dbs = res.data || []
  treeData.value = dbs.map((db: any) => ({
    key: `db_${db.name}`,
    label: db.name,
    type: 'database',
    database: db.name,
    isLeaf: false,
  }))
}

async function loadNode(node: any, resolve: Function) {
  if (node.level === 0) {
    resolve(treeData.value)
    return
  }

  const data = node.data
  if (data.type === 'database') {
    const res = await databaseApi.getTables(props.connectionId, data.database)
    const tables = res.data || []
    const dbKey = `db_${data.database}`
    
    originalTablesMap.value[dbKey] = tables.map((t: any) => ({
      key: `table_${data.database}_${t.name}`,
      label: t.name,
      type: 'table',
      database: data.database,
      table: t.name,
      comment: t.comment,
      isLeaf: false,
    }))
    
    if (!searchText.value[dbKey]) {
      searchText.value[dbKey] = ''
    }
    
    const searchNode = {
      key: `search_${dbKey}`,
      type: 'search',
      dbKey: dbKey,
      isLeaf: true,
      label: '',
    }
    
    resolve([searchNode, ...originalTablesMap.value[dbKey]])
  } else if (data.type === 'table') {
    const res = await databaseApi.getColumns(props.connectionId, data.database, data.table)
    const cols = res.data || []
    resolve(cols.map((c: any) => ({
      key: `col_${data.database}_${data.table}_${c.name}`,
      label: `${c.name} (${c.type})`,
      type: 'column',
      database: data.database,
      table: data.table,
      columnName: c.name,
      columnType: c.type,
      isPrimary: c.isPrimary,
      nullable: c.nullable,
      comment: c.comment,
      isLeaf: true,
    })))
  } else {
    resolve([])
  }

  await nextTick()
  hideNonTableCheckboxes()
}

function filterTables(dbKey: string) {
  const text = searchText.value[dbKey] || ''
  const node = treeRef.value?.getNode(dbKey)
  if (!node) return
  
  const original = originalTablesMap.value[dbKey] || []
  const filtered = original.filter(t => 
    t.label.toLowerCase().includes(text.toLowerCase()) ||
    (t.comment && t.comment.toLowerCase().includes(text.toLowerCase()))
  )
  
  const searchNode = {
    key: `search_${dbKey}`,
    type: 'search',
    dbKey: dbKey,
    isLeaf: true,
    label: '',
  }
  
  treeRef.value?.updateKeyChildren(dbKey, [searchNode, ...filtered])
  
  nextTick(() => {
    hideNonTableCheckboxes()
  })
}

function hideNonTableCheckboxes() {
  const treeEl = treeRef.value?.$el
  if (!treeEl) return
  const nodes = treeEl.querySelectorAll('.el-tree-node')
  nodes.forEach((nodeEl: Element) => {
    const content = nodeEl.querySelector('.el-tree-node__content')
    if (!content) return
    const isTable = content.querySelector('.table-icon')
    const isSearch = content.querySelector('.search-wrapper')
    const checkbox = content.querySelector('.el-checkbox') as HTMLElement
    const expandIcon = content.querySelector('.el-tree-node__expand-icon') as HTMLElement
    if (checkbox) {
      checkbox.style.display = isTable ? '' : 'none'
    }
    if (expandIcon && isSearch) {
      expandIcon.style.display = 'none'
    }
  })
}

async function handleNodeClick(data: any) {
  if (data.type === 'search') {
    return
  }
  if (data.type === 'table') {
    emit('select-table', data.database, data.table)
  }
  if (data.type === 'column') {
    // 点击字段时，选中对应的表
    const tableKey = `table_${data.database}_${data.table}`
    const tableNode = treeRef.value?.getNode(tableKey)
    if (tableNode) {
      // 设置表节点为选中状态
      treeRef.value?.setChecked(tableKey, true, false)
      // 触发 select-table 事件
      emit('select-table', data.database, data.table)
      // 同时触发 checked-tables-change 事件，保持状态同步
      handleCheck()
    }
  }
}

async function showTableStructure(database: string, table: string, comment?: string) {
  const res = await databaseApi.getTableDDL(props.connectionId, database, table)
  currentTableInfo.value = {
    database,
    table,
    comment: comment || '',
    ddl: res.data || ''
  }

  const mouseX = window.event?.clientX || 200
  const mouseY = window.event?.clientY || 200
  const modalWidth = 900
  modalPosition.value = {
    x: Math.min(mouseX + 20, window.innerWidth - modalWidth - 40),
    y: Math.min(mouseY, 100)
  }

  showTableModal.value = true
}

function highlightDDL(ddl: string): string {
  if (!ddl) return ''
  try {
    return hljs.highlight(ddl, { language: 'sql' }).value
  } catch (error) {
    console.error('SQL highlighting failed:', error)
    return ddl
  }
}

function closeTableModal() {
  showTableModal.value = false
}

// 字段信息悬浮框相关函数
function showColumnInfo(event: MouseEvent, data: any) {
  currentColumnInfo.value = {
    database: data.database,
    table: data.table,
    columnName: data.columnName,
    columnType: data.columnType,
    isPrimary: data.isPrimary,
    nullable: data.nullable,
    comment: data.comment || ''
  }
  updateColumnInfoPosition(event)
  showColumnInfoPanel.value = true
}

function hideColumnInfo() {
  showColumnInfoPanel.value = false
}

function updateColumnInfoPosition(event: MouseEvent) {
  // 计算悬浮框位置，让它在鼠标右下方
  const offsetX = 15
  const offsetY = 15
  columnInfoPosition.value = {
    x: event.clientX + offsetX,
    y: event.clientY + offsetY
  }
}

function handleCheck() {
  const checkedNodes = treeRef.value?.getCheckedNodes() || []
  const tables = checkedNodes
    .filter((n: any) => n.type === 'table')
    .map((n: any) => ({ database: n.database, table: n.table, comment: n.comment || '' }))
  emit('checked-tables-change', tables)
}

defineExpose({
  getCheckedTables: () => {
    const checkedNodes = treeRef.value?.getCheckedNodes() || []
    return checkedNodes
      .filter((n: any) => n.type === 'table')
      .map((n: any) => ({ database: n.database, table: n.table, comment: n.comment || '' }))
  },
  clearChecked: () => {
    treeRef.value?.setCheckedKeys([])
  },
})
</script>

<style scoped lang="scss">
.db-tree {
  :deep(.el-tree-node__content) {
    height: 28px;
  }

  :deep(.search-wrapper) {
    width: 100%;
    padding: 4px 0;
  }

  .node-content {
    display: flex;
    align-items: center;
    font-size: 13px;
    gap: 2px;
  }

  .table-icon-wrapper {
    cursor: pointer;
  }

  .table-icon {
    color: #409eff;
  }

  .tree-comment {
    color: #909399;
    font-size: 12px;
    margin-left: 4px;
  }

  .column-node {
    cursor: pointer;
  }
}

.column-tooltip {
  font-size: 12px;
  line-height: 1.8;

  b {
    color: #9cdcfe;
  }
}

.column-info-panel {
  position: fixed;
  z-index: 10000;
  background: #1e1e1e;
  color: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 200px;
  max-width: 300px;
  pointer-events: none;

  .column-info-header {
    padding: 10px 14px;
    background: #2d2d2d;
    border-bottom: 1px solid #404040;
    border-radius: 6px 6px 0 0;

    .column-info-title {
      font-size: 13px;
      font-weight: 600;
      color: #e0e0e0;
    }
  }

  .column-info-body {
    padding: 12px 14px;

    .info-item {
      display: flex;
      margin-bottom: 8px;
      font-size: 12px;
      line-height: 1.5;

      &:last-child {
        margin-bottom: 0;
      }

      .info-label {
        color: #9cdcfe;
        min-width: 60px;
        font-weight: 500;
      }

      .info-value {
        color: #ce9178;
        flex: 1;

        &.primary {
          color: #4ec9b0;
        }
      }
    }
  }
}

.table-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.table-modal {
  position: fixed;
  z-index: 9999;
  width: 900px;
  max-width: 90vw;
  max-height: 90vh;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid #e4e7ed;
  overflow-x: hidden;
  overflow-y: auto;

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;

    .modal-title {
      font-weight: 600;
      color: #303133;
    }

    .modal-comment {
      font-weight: 400;
      color: #909399;
      font-size: 12px;
    }

    .el-button {
      padding: 0;
      width: 24px;
      height: 24px;
      line-height: 24px;
      color: #909399;
    }
  }

  .modal-body {
    overflow: auto;
    padding: 16px;
  }

  .ddl-code {
    margin: 0;
    padding: 0;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    overflow-x: hidden;

    :deep(code) {
      font-family: Consolas, 'Microsoft YaHei UI', 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
    }
  }
}
</style>
