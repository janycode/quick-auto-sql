<template>
  <div class="db-tree">
    <el-tree
      ref="treeRef"
      :data="treeData"
      :props="treeProps"
      lazy
      :load="loadNode"
      node-key="key"
      :default-expanded-keys="workspaceStore.expandedKeys"
      show-checkbox
      :check-on-click-node="false"
      @check="handleCheck"
      @node-click="handleNodeClick"
      @node-expand="handleNodeExpand"
      @node-collapse="handleNodeCollapse"
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
        <div v-else-if="data.type === 'database'" class="node-content database-node">
          <el-icon :size="14"><Coin /></el-icon>
          <span style="margin-left: 4px">{{ node.label }}</span>
          <span v-if="data.comment" class="tree-comment">{{ data.comment }}</span>
        </div>
        <div 
          v-else-if="data.type === 'table'" 
          class="node-content table-node"
          @contextmenu.prevent.stop="showContextMenu($event, 'table', data)"
        >
          <span class="table-icon-wrapper" @click.stop="showTableStructure(data.database, data.table, data.comment)">
            <el-icon :size="14" class="table-icon"><Grid /></el-icon>
          </span>
          <span class="copy-icon-wrapper" @click.stop="copyTableName(data.table, data.key)" title="复制表名">
            <el-icon :size="12" class="copy-icon"><Check v-if="copiedTableKey === data.key" /><CopyDocument v-else /></el-icon>
          </span>
          <span 
            class="table-name-label"
            style="margin-left: 4px"
            @mouseenter="showTableInfo($event, data)"
            @mouseleave="hideTableInfo"
            @mousemove="updateTableInfoPosition($event)"
          >{{ node.label }}</span>
          <span v-if="data.comment" class="tree-comment">{{ data.comment }}</span>
        </div>
        <div 
          v-else-if="data.type === 'column'" 
          class="node-content column-node"
          @mouseenter="showColumnInfo($event, data)"
          @mouseleave="hideColumnInfo"
          @mousemove="updateColumnInfoPosition($event)"
          @contextmenu.prevent.stop="showContextMenu($event, 'column', data)"
        >
          <el-icon :size="14"><Key v-if="data.isPrimary" /><Document v-else /></el-icon>
          <span style="margin-left: 4px">{{ node.label }}</span>
          <span v-if="data.comment" class="tree-comment">{{ data.comment }}</span>
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

    <!-- 表信息跟随鼠标悬浮框 -->
    <Teleport to="body">
      <div 
        v-if="showTableInfoPanel" 
        class="table-info-panel"
        :style="{ left: tableInfoPosition.x + 'px', top: tableInfoPosition.y + 'px' }"
      >
        <div class="table-info-header">
          <span class="table-info-title">{{ currentTableInfoForHover.database }}.{{ currentTableInfoForHover.table }}</span>
        </div>
        <div class="table-info-body">
          <div v-if="currentTableInfoForHover.comment" class="info-item">
            <span class="info-label">表注释:</span>
            <span class="info-value">{{ currentTableInfoForHover.comment }}</span>
          </div>
          <div v-else class="info-item">
            <span class="info-value no-comment">暂无注释</span>
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
            <el-button size="small" @click="closeTableModal">×</el-button>
          </div>
          <div class="modal-body">
            <!-- 表统计信息栏 -->
            <div v-if="tableStatus" class="table-stats-bar">
              <div class="stat-item">
                <span class="stat-value">{{ formatNumber(tableStatus.rows) }}</span>
                <span class="stat-label">数据行数</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-value">{{ tableStatus.columnCount }}</span>
                <span class="stat-label">字段数</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-value">{{ tableStatus.indexCount }}</span>
                <span class="stat-label">索引数</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-value">{{ tableStatus.engine || '-' }}</span>
                <span class="stat-label">引擎</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-value">{{ formatBytes(tableStatus.dataLength) }}</span>
                <span class="stat-label">数据大小</span>
              </div>
              <div class="stat-divider"></div>
              <div class="stat-item">
                <span class="stat-value">{{ formatCollation(tableStatus.collation) }}</span>
                <span class="stat-label">字符集</span>
              </div>
            </div>
            <div v-else-if="tableStatusLoading" class="table-stats-bar loading">
              <span>加载统计信息中...</span>
            </div>

            <!-- DDL 代码区域（可折叠） -->
            <div class="ddl-section">
              <div class="section-header" @click="toggleDdlCollapsed">
                <el-icon class="collapse-icon" :class="{ 'collapsed': ddlCollapsed }"><ArrowDown /></el-icon>
                <span class="section-title">表结构 DDL</span>
              </div>
              <div v-show="!ddlCollapsed" class="section-content">
                <pre class="ddl-code"><code v-html="highlightDDL(currentTableInfo.ddl)"></code></pre>
              </div>
            </div>

            <!-- 数据预览区域 -->
            <div class="data-section">
              <div class="section-header no-click">
                <el-icon class="section-icon"><DataLine /></el-icon>
                <span class="section-title">最新数据（按主键倒序前 10 条）</span>
              </div>
              <div class="section-content">
                <div v-if="tableDataLoading" class="data-loading">
                  <el-icon class="loading-icon"><Loading /></el-icon>
                  <span>数据加载中...</span>
                </div>
                <div v-else-if="tableDataError" class="data-error">
                  <el-icon class="error-icon"><Warning /></el-icon>
                  <span>{{ tableDataError }}</span>
                </div>
                <div v-else-if="tableData.rows.length === 0" class="data-empty">
                  <el-icon class="empty-icon"><DocumentDelete /></el-icon>
                  <span>暂无数据</span>
                </div>
                <div v-else class="data-table-wrapper">
                  <el-table
                    :data="tableData.rows"
                    border
                    size="small"
                    max-height="400"
                    style="width: 100%"
                  >
                    <el-table-column
                      v-for="col in tableData.columns"
                      :key="col"
                      :prop="col"
                      :label="col"
                      :min-width="120"
                      show-overflow-tooltip
                    >
                      <template #default="scope">
                        <span v-if="scope.row[col] === null" class="cell-null">NULL</span>
                        <span v-else>{{ formatCellValue(scope.row[col]) }}</span>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div class="data-count">共 {{ tableData.rows.length }} 条记录</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div 
        v-if="contextMenu.visible" 
        class="context-menu"
        :style="{ left: contextMenu.position.x + 'px', top: contextMenu.position.y + 'px' }"
        @click.stop
      >
        <!-- 表节点右键菜单 -->
        <template v-if="contextMenu.type === 'table'">
          <div class="context-menu-item" @click="openTableDialog('rename')">
            <el-icon><Edit /></el-icon>
            <span>修改表名</span>
          </div>
          <div class="context-menu-item" @click="openTableDialog('comment')">
            <el-icon><ChatDotRound /></el-icon>
            <span>修改表注释</span>
          </div>
          <div class="context-menu-item" @click="openTableDialog('engine')">
            <el-icon><Setting /></el-icon>
            <span>修改存储引擎</span>
          </div>
          <div class="context-menu-item" @click="openTableDialog('charset')">
            <el-icon><Brush /></el-icon>
            <span>修改字符集</span>
          </div>
          <div class="context-menu-divider"></div>
          <div class="context-menu-item" @click="openTableDialog('addColumn')">
            <el-icon><Plus /></el-icon>
            <span>新增字段</span>
          </div>
          <div class="context-menu-item" @click="copyTableName(contextMenu.data.table, contextMenu.data.key)">
            <el-icon><CopyDocument /></el-icon>
            <span>复制表名</span>
          </div>
          <div class="context-menu-divider"></div>
          <div class="context-menu-item danger" @click="confirmDropTable">
            <el-icon><Delete /></el-icon>
            <span>删除表</span>
          </div>
          <div class="context-menu-item danger" @click="confirmTruncateTable">
            <el-icon><DeleteLocation /></el-icon>
            <span>清空表数据</span>
          </div>
        </template>

        <!-- 字段节点右键菜单 -->
        <template v-if="contextMenu.type === 'column'">
          <div class="context-menu-item" @click="openColumnDialog('rename')">
            <el-icon><Edit /></el-icon>
            <span>修改字段名</span>
          </div>
          <div class="context-menu-item" @click="openColumnDialog('type')">
            <el-icon><Document /></el-icon>
            <span>修改字段类型</span>
          </div>
          <div class="context-menu-item" @click="openColumnDialog('nullable')">
            <el-icon><CircleCheck v-if="!contextMenu.data.nullable" /><CircleClose v-else /></el-icon>
            <span>{{ contextMenu.data.nullable ? '设为 NOT NULL' : '允许为 NULL' }}</span>
          </div>
          <div class="context-menu-item" @click="openColumnDialog('default')">
            <el-icon><Operation /></el-icon>
            <span>修改默认值</span>
          </div>
          <div class="context-menu-item" @click="openColumnDialog('comment')">
            <el-icon><ChatDotRound /></el-icon>
            <span>修改字段注释</span>
          </div>
          <div class="context-menu-divider"></div>
          <div class="context-menu-item" @click="togglePrimaryKey">
            <el-icon><Key /></el-icon>
            <span>{{ contextMenu.data.isPrimary ? '取消主键' : '设为主键' }}</span>
          </div>
          <div class="context-menu-item" @click="openColumnDialog('addAfter')">
            <el-icon><Plus /></el-icon>
            <span>在后面插入字段</span>
          </div>
          <div class="context-menu-item" @click="copyColumnName(contextMenu.data.columnName)">
            <el-icon><CopyDocument /></el-icon>
            <span>复制字段名</span>
          </div>
          <div class="context-menu-divider"></div>
          <div class="context-menu-item danger" @click="confirmDropColumn">
            <el-icon><Delete /></el-icon>
            <span>删除字段</span>
          </div>
        </template>
      </div>
    </Teleport>

    <!-- 修改表属性对话框 -->
    <el-dialog 
      v-model="tableDialog.visible" 
      :title="tableDialog.title" 
      width="500px"
      @closed="handleTableDialogClosed"
    >
      <el-form :model="tableDialog.form" label-width="100px">
        <el-form-item v-if="tableDialog.action === 'rename'" label="新表名">
          <el-input v-model="tableDialog.form.newTableName" placeholder="请输入新的表名" />
        </el-form-item>
        <el-form-item v-if="tableDialog.action === 'comment'" label="表注释">
          <el-input v-model="tableDialog.form.comment" placeholder="请输入表注释" />
        </el-form-item>
        <el-form-item v-if="tableDialog.action === 'engine'" label="存储引擎">
          <el-select v-model="tableDialog.form.engine" placeholder="请选择存储引擎">
            <el-option label="InnoDB" value="InnoDB" />
            <el-option label="MyISAM" value="MyISAM" />
            <el-option label="MEMORY" value="MEMORY" />
            <el-option label="ARCHIVE" value="ARCHIVE" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="tableDialog.action === 'charset'" label="字符集">
          <el-select v-model="tableDialog.form.charset" placeholder="请选择字符集" style="width: 100%">
            <el-option label="utf8mb4" value="utf8mb4" />
            <el-option label="utf8" value="utf8" />
            <el-option label="gbk" value="gbk" />
            <el-option label="latin1" value="latin1" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="tableDialog.action === 'charset'" label="排序规则">
          <el-select v-model="tableDialog.form.collation" placeholder="请选择排序规则" style="width: 100%">
            <el-option label="utf8mb4_general_ci" value="utf8mb4_general_ci" />
            <el-option label="utf8mb4_unicode_ci" value="utf8mb4_unicode_ci" />
            <el-option label="utf8_general_ci" value="utf8_general_ci" />
            <el-option label="gbk_chinese_ci" value="gbk_chinese_ci" />
            <el-option label="latin1_swedish_ci" value="latin1_swedish_ci" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="tableDialog.action === 'addColumn'">
          <div class="add-column-form">
            <el-form-item label="字段名">
              <el-input v-model="tableDialog.form.newColumn.name" placeholder="请输入字段名" />
            </el-form-item>
            <el-form-item label="字段类型">
              <el-select v-model="tableDialog.form.newColumn.type" placeholder="请选择字段类型" style="width: 100%">
                <el-option label="INT" value="INT" />
                <el-option label="BIGINT" value="BIGINT" />
                <el-option label="VARCHAR(255)" value="VARCHAR(255)" />
                <el-option label="VARCHAR(500)" value="VARCHAR(500)" />
                <el-option label="TEXT" value="TEXT" />
                <el-option label="DATETIME" value="DATETIME" />
                <el-option label="DATE" value="DATE" />
                <el-option label="DECIMAL(10,2)" value="DECIMAL(10,2)" />
                <el-option label="TINYINT(1)" value="TINYINT(1)" />
                <el-option label="JSON" value="JSON" />
              </el-select>
            </el-form-item>
            <el-form-item label="允许为NULL">
              <el-switch v-model="tableDialog.form.newColumn.nullable" />
            </el-form-item>
            <el-form-item label="默认值">
              <el-input v-model="tableDialog.form.newColumn.defaultValue" placeholder="请输入默认值（可选）" />
            </el-form-item>
            <el-form-item label="注释">
              <el-input v-model="tableDialog.form.newColumn.comment" placeholder="请输入字段注释（可选）" />
            </el-form-item>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tableDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="executeTableAction">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改字段属性对话框 -->
    <el-dialog 
      v-model="columnDialog.visible" 
      :title="columnDialog.title" 
      width="500px"
      @closed="handleColumnDialogClosed"
    >
      <el-form :model="columnDialog.form" label-width="100px">
        <el-form-item v-if="columnDialog.action === 'rename'" label="新字段名">
          <el-input v-model="columnDialog.form.newColumnName" placeholder="请输入新的字段名" />
        </el-form-item>
        <el-form-item v-if="columnDialog.action === 'type'" label="字段类型">
          <el-select v-model="columnDialog.form.newType" placeholder="请选择字段类型" style="width: 100%">
            <el-option label="INT" value="INT" />
            <el-option label="BIGINT" value="BIGINT" />
            <el-option label="VARCHAR(50)" value="VARCHAR(50)" />
            <el-option label="VARCHAR(100)" value="VARCHAR(100)" />
            <el-option label="VARCHAR(255)" value="VARCHAR(255)" />
            <el-option label="VARCHAR(500)" value="VARCHAR(500)" />
            <el-option label="TEXT" value="TEXT" />
            <el-option label="MEDIUMTEXT" value="MEDIUMTEXT" />
            <el-option label="LONGTEXT" value="LONGTEXT" />
            <el-option label="DATETIME" value="DATETIME" />
            <el-option label="DATE" value="DATE" />
            <el-option label="TIME" value="TIME" />
            <el-option label="DECIMAL(10,2)" value="DECIMAL(10,2)" />
            <el-option label="DECIMAL(18,4)" value="DECIMAL(18,4)" />
            <el-option label="TINYINT(1)" value="TINYINT(1)" />
            <el-option label="FLOAT" value="FLOAT" />
            <el-option label="DOUBLE" value="DOUBLE" />
            <el-option label="JSON" value="JSON" />
            <el-option label="BLOB" value="BLOB" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="columnDialog.action === 'default'" label="默认值">
          <el-input v-model="columnDialog.form.defaultValue" placeholder="请输入默认值（留空表示无默认值）" />
        </el-form-item>
        <el-form-item v-if="columnDialog.action === 'comment'" label="字段注释">
          <el-input v-model="columnDialog.form.comment" placeholder="请输入字段注释" />
        </el-form-item>
        <el-form-item v-if="columnDialog.action === 'addAfter'">
          <div class="add-column-form">
            <el-form-item label="字段名">
              <el-input v-model="columnDialog.form.newColumn.name" placeholder="请输入字段名" />
            </el-form-item>
            <el-form-item label="字段类型">
              <el-select v-model="columnDialog.form.newColumn.type" placeholder="请选择字段类型" style="width: 100%">
                <el-option label="INT" value="INT" />
                <el-option label="BIGINT" value="BIGINT" />
                <el-option label="VARCHAR(255)" value="VARCHAR(255)" />
                <el-option label="VARCHAR(500)" value="VARCHAR(500)" />
                <el-option label="TEXT" value="TEXT" />
                <el-option label="DATETIME" value="DATETIME" />
                <el-option label="DATE" value="DATE" />
                <el-option label="DECIMAL(10,2)" value="DECIMAL(10,2)" />
                <el-option label="TINYINT(1)" value="TINYINT(1)" />
                <el-option label="JSON" value="JSON" />
              </el-select>
            </el-form-item>
            <el-form-item label="允许为NULL">
              <el-switch v-model="columnDialog.form.newColumn.nullable" />
            </el-form-item>
            <el-form-item label="默认值">
              <el-input v-model="columnDialog.form.newColumn.defaultValue" placeholder="请输入默认值（可选）" />
            </el-form-item>
            <el-form-item label="注释">
              <el-input v-model="columnDialog.form.newColumn.comment" placeholder="请输入字段注释（可选）" />
            </el-form-item>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="columnDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="executeColumnAction">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed, onUnmounted } from 'vue'
import { 
  Coin, Grid, Key, Document, Search, CopyDocument, Check, ArrowDown, DataLine, 
  Loading, Warning, DocumentDelete, Edit, ChatDotRound, Setting, Brush, Plus, 
  Delete, DeleteLocation, Operation, CircleCheck, CircleClose 
} from '@element-plus/icons-vue'
import { useDatabaseStore } from '@/stores/database'
import { useWorkspaceStore } from '@/stores/workspace'
import * as databaseApi from '@/api/database'
import type { ITableStatus } from '@/api/database'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import sql from 'highlight.js/lib/languages/sql'
import * as queryApi from '@/api/query'
import { formatSql } from '@/utils/sql-formatter'

hljs.registerLanguage('sql', sql)

const props = defineProps<{
  connectionId: string
}>()

const emit = defineEmits<{
  'select-table': [database: string, table: string]
  'checked-tables-change': [tables: { database: string; table: string; comment: string }[]]
}>()

const databaseStore = useDatabaseStore()
const workspaceStore = useWorkspaceStore()
const treeRef = ref()
const treeData = ref<any[]>([])
const searchText = ref<Record<string, string>>({})
const originalTablesMap = ref<Record<string, any[]>>({})
const copiedTableKey = ref<string>('')
const copiedColumnName = ref<string>('')

// 右键菜单相关
const contextMenu = ref({
  visible: false,
  type: '' as 'table' | 'column' | '',
  position: { x: 0, y: 0 },
  data: {} as any
})

// 表属性对话框相关
const tableDialog = ref({
  visible: false,
  title: '',
  action: '' as 'rename' | 'comment' | 'engine' | 'charset' | 'addColumn' | '',
  form: {
    newTableName: '',
    comment: '',
    engine: '',
    charset: '',
    collation: '',
    newColumn: {
      name: '',
      type: '',
      nullable: true,
      defaultValue: '',
      comment: ''
    }
  }
})

// 字段属性对话框相关
const columnDialog = ref({
  visible: false,
  title: '',
  action: '' as 'rename' | 'type' | 'nullable' | 'default' | 'comment' | 'addAfter' | '',
  form: {
    newColumnName: '',
    newType: '',
    nullable: false,
    defaultValue: '',
    comment: '',
    newColumn: {
      name: '',
      type: '',
      nullable: true,
      defaultValue: '',
      comment: ''
    }
  }
})

// 表结构弹窗相关
const showTableModal = ref(false)
const modalPosition = ref({ x: 0, y: 0 })
const ddlCollapsed = ref(false)
const tableDataLoading = ref(false)
const tableDataError = ref('')
const currentTableInfo = ref({
  database: '',
  table: '',
  comment: '',
  ddl: ''
})
const tableStatus = ref<ITableStatus | null>(null)
const tableStatusLoading = ref(false)
const tableData = ref<{
  columns: string[]
  rows: Record<string, unknown>[]
}>({
  columns: [],
  rows: []
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

// 表信息悬浮框相关
const showTableInfoPanel = ref(false)
const tableInfoPosition = ref({ x: 0, y: 0 })
const currentTableInfoForHover = ref({
  database: '',
  table: '',
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
  // 稍微延迟一下，恢复勾选状态
  setTimeout(() => {
    restoreCheckedKeys()
  }, 200)
  // 点击页面任意位置时隐藏右键菜单
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})

// 监听连接 ID 变化，自动重新加载数据库列表
watch(
  () => props.connectionId,
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
      await refresh()
    }
  }
)

// 恢复保存的勾选状态
function restoreCheckedKeys() {
  const savedKeys = workspaceStore.checkedTableKeys
  if (savedKeys.length > 0 && treeRef.value) {
    treeRef.value.setCheckedKeys(savedKeys)
  }
  hideNonTableCheckboxes()
}

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
    
    // 节点加载完成后，尝试恢复保存的勾选状态
    nextTick(() => {
      restoreCheckedKeys()
    })
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
    
    // 通过类名明确检测不同类型的节点
    const isTableNode = content.querySelector('.table-node') !== null
    const isSearchNode = content.querySelector('.search-wrapper') !== null
    const isColumnNode = content.querySelector('.column-node') !== null
    const isDatabaseNode = content.querySelector('.database-node') !== null
    
    const checkbox = content.querySelector('.el-checkbox') as HTMLElement
    const expandIcon = content.querySelector('.el-tree-node__expand-icon') as HTMLElement
    
    // 只隐藏复选框，绝不动展开箭头
    if (checkbox && !isTableNode) {
      checkbox.style.display = 'none'
    }
    
    // 只隐藏搜索框节点的展开箭头（因为搜索框是插入的假节点，不是真正的树节点）
    // 数据库节点、表节点、字段节点的展开箭头都保持默认行为
    if (expandIcon && isSearchNode) {
      expandIcon.style.display = 'none'
    }
    // 注意：数据库节点的展开箭头和表节点的展开箭头都保持默认行为
  })
}

// ==================== 右键菜单相关方法 ====================

function showContextMenu(event: MouseEvent, type: 'table' | 'column', data: any) {
  // 隐藏悬浮框
  hideColumnInfo()
  hideTableInfo()
  
  // 设置右键菜单位置和数据
  contextMenu.value.position = {
    x: event.clientX,
    y: event.clientY
  }
  contextMenu.value.type = type
  contextMenu.value.data = { ...data }
  contextMenu.value.visible = true
}

// 点击页面其他位置时隐藏右键菜单
function hideContextMenu() {
  contextMenu.value.visible = false
}

// ==================== 表节点右键菜单操作 ====================

function openTableDialog(action: 'rename' | 'comment' | 'engine' | 'charset' | 'addColumn') {
  hideContextMenu()
  
  tableDialog.value.action = action
  tableDialog.value.visible = true
  
  // 根据不同操作设置标题和初始值
  switch (action) {
    case 'rename':
      tableDialog.value.title = '修改表名'
      tableDialog.value.form.newTableName = contextMenu.value.data.table || ''
      break
    case 'comment':
      tableDialog.value.title = '修改表注释'
      tableDialog.value.form.comment = contextMenu.value.data.comment || ''
      break
    case 'engine':
      tableDialog.value.title = '修改存储引擎'
      tableDialog.value.form.engine = contextMenu.value.data.engine || 'InnoDB'
      break
    case 'charset':
      tableDialog.value.title = '修改字符集和排序规则'
      tableDialog.value.form.charset = contextMenu.value.data.charset || 'utf8mb4'
      tableDialog.value.form.collation = contextMenu.value.data.collation || 'utf8mb4_general_ci'
      break
    case 'addColumn':
      tableDialog.value.title = '新增字段'
      tableDialog.value.form.newColumn = {
        name: '',
        type: 'VARCHAR(255)',
        nullable: true,
        defaultValue: '',
        comment: ''
      }
      break
  }
}

async function executeTableAction() {
  try {
    const { database, table } = contextMenu.value.data
    const { action, form } = tableDialog.value
    
    // 构造 SQL 语句
    let sql = ''
    
    switch (action) {
      case 'rename':
        if (!form.newTableName || form.newTableName === table) {
          return
        }
        sql = `RENAME TABLE \`${database}\`.\`${table}\` TO \`${database}\`.\`${form.newTableName}\``
        break
      case 'comment':
        sql = `ALTER TABLE \`${database}\`.\`${table}\` COMMENT = '${form.comment.replace(/'/g, "\\'")}'`
        break
      case 'engine':
        sql = `ALTER TABLE \`${database}\`.\`${table}\` ENGINE = ${form.engine}`
        break
      case 'charset':
        sql = `ALTER TABLE \`${database}\`.\`${table}\` CONVERT TO CHARACTER SET ${form.charset} COLLATE ${form.collation}`
        break
      case 'addColumn':
        if (!form.newColumn.name) {
          return
        }
        let columnDef = `\`${form.newColumn.name}\` ${form.newColumn.type}`
        if (!form.newColumn.nullable) {
          columnDef += ' NOT NULL'
        }
        if (form.newColumn.defaultValue) {
          columnDef += ` DEFAULT '${form.newColumn.defaultValue.replace(/'/g, "\\'")}'`
        }
        if (form.newColumn.comment) {
          columnDef += ` COMMENT '${form.newColumn.comment.replace(/'/g, "\\'")}'`
        }
        sql = `ALTER TABLE \`${database}\`.\`${table}\` ADD COLUMN ${columnDef}`
        break
    }
    
    if (sql) {
      // 执行 SQL（这里暂时使用 queryApi，后续可添加专门的 API）
      await queryApi.executeQuery({
        connectionId: props.connectionId,
        database,
        sql
      })
      
      // 提示成功并刷新数据
      // Element Plus 的 ElMessage 需要单独导入
      console.log('操作成功：', sql)
    }
    
    tableDialog.value.visible = false
  } catch (error: any) {
    console.error('操作失败：', error)
  }
}

function handleTableDialogClosed() {
  // 重置表单
  tableDialog.value.form = {
    newTableName: '',
    comment: '',
    engine: '',
    charset: '',
    collation: '',
    newColumn: {
      name: '',
      type: '',
      nullable: true,
      defaultValue: '',
      comment: ''
    }
  }
}

function confirmDropTable() {
  hideContextMenu()
  const { database, table } = contextMenu.value.data
  // 使用原生 confirm，后续可改为 Element Plus 的 ElMessageBox
  if (confirm(`确定要删除表 \`${database}\`.\`${table}\` 吗？此操作不可恢复！`)) {
    try {
      const sql = `DROP TABLE \`${database}\`.\`${table}\``
      queryApi.executeQuery({
        connectionId: props.connectionId,
        database,
        sql
      })
      console.log('表删除成功')
    } catch (error) {
      console.error('删除表失败：', error)
    }
  }
}

function confirmTruncateTable() {
  hideContextMenu()
  const { database, table } = contextMenu.value.data
  if (confirm(`确定要清空表 \`${database}\`.\`${table}\` 的所有数据吗？此操作不可恢复！`)) {
    try {
      const sql = `TRUNCATE TABLE \`${database}\`.\`${table}\``
      queryApi.executeQuery({
        connectionId: props.connectionId,
        database,
        sql
      })
      console.log('表清空成功')
    } catch (error) {
      console.error('清空表失败：', error)
    }
  }
}

// ==================== 字段节点右键菜单操作 ====================

function openColumnDialog(action: 'rename' | 'type' | 'nullable' | 'default' | 'comment' | 'addAfter') {
  hideContextMenu()
  
  columnDialog.value.action = action
  columnDialog.value.visible = true
  
  // 根据不同操作设置标题和初始值
  const { columnName, columnType, nullable, defaultValue, comment } = contextMenu.value.data
  
  switch (action) {
    case 'rename':
      columnDialog.value.title = '修改字段名'
      columnDialog.value.form.newColumnName = columnName || ''
      break
    case 'type':
      columnDialog.value.title = '修改字段类型'
      columnDialog.value.form.newType = columnType || ''
      break
    case 'nullable':
      columnDialog.value.title = '修改字段是否允许为 NULL'
      columnDialog.value.form.nullable = nullable || false
      break
    case 'default':
      columnDialog.value.title = '修改默认值'
      columnDialog.value.form.defaultValue = defaultValue || ''
      break
    case 'comment':
      columnDialog.value.title = '修改字段注释'
      columnDialog.value.form.comment = comment || ''
      break
    case 'addAfter':
      columnDialog.value.title = '在后面插入新字段'
      columnDialog.value.form.newColumn = {
        name: '',
        type: 'VARCHAR(255)',
        nullable: true,
        defaultValue: '',
        comment: ''
      }
      break
  }
}

async function executeColumnAction() {
  try {
    const { database, table, columnName } = contextMenu.value.data
    const { action, form } = columnDialog.value
    
    let sql = ''
    
    switch (action) {
      case 'rename':
        if (!form.newColumnName || form.newColumnName === columnName) {
          return
        }
        // 注意：MySQL 的 RENAME COLUMN 需要知道旧的完整定义
        sql = `ALTER TABLE \`${database}\`.\`${table}\` RENAME COLUMN \`${columnName}\` TO \`${form.newColumnName}\``
        break
      case 'type':
        if (!form.newType) {
          return
        }
        sql = `ALTER TABLE \`${database}\`.\`${table}\` MODIFY COLUMN \`${columnName}\` ${form.newType}`
        break
      case 'nullable':
        // 这里需要知道完整的列定义
        sql = `ALTER TABLE \`${database}\`.\`${table}\` MODIFY COLUMN \`${columnName}\` ${contextMenu.value.data.columnType} ${form.nullable ? 'NULL' : 'NOT NULL'}`
        break
      case 'default':
        if (form.defaultValue) {
          sql = `ALTER TABLE \`${database}\`.\`${table}\` ALTER COLUMN \`${columnName}\` SET DEFAULT '${form.defaultValue.replace(/'/g, "\\'")}'`
        } else {
          sql = `ALTER TABLE \`${database}\`.\`${table}\` ALTER COLUMN \`${columnName}\` DROP DEFAULT`
        }
        break
      case 'comment':
        sql = `ALTER TABLE \`${database}\`.\`${table}\` MODIFY COLUMN \`${columnName}\` ${contextMenu.value.data.columnType} COMMENT '${form.comment.replace(/'/g, "\\'")}'`
        break
      case 'addAfter':
        if (!form.newColumn.name) {
          return
        }
        let columnDef = `\`${form.newColumn.name}\` ${form.newColumn.type}`
        if (!form.newColumn.nullable) {
          columnDef += ' NOT NULL'
        }
        if (form.newColumn.defaultValue) {
          columnDef += ` DEFAULT '${form.newColumn.defaultValue.replace(/'/g, "\\'")}'`
        }
        if (form.newColumn.comment) {
          columnDef += ` COMMENT '${form.newColumn.comment.replace(/'/g, "\\'")}'`
        }
        sql = `ALTER TABLE \`${database}\`.\`${table}\` ADD COLUMN ${columnDef} AFTER \`${columnName}\``
        break
    }
    
    if (sql) {
      await queryApi.executeQuery({
        connectionId: props.connectionId,
        database,
        sql
      })
      console.log('操作成功：', sql)
    }
    
    columnDialog.value.visible = false
  } catch (error: any) {
    console.error('操作失败：', error)
  }
}

function handleColumnDialogClosed() {
  columnDialog.value.form = {
    newColumnName: '',
    newType: '',
    nullable: false,
    defaultValue: '',
    comment: '',
    newColumn: {
      name: '',
      type: '',
      nullable: true,
      defaultValue: '',
      comment: ''
    }
  }
}

function togglePrimaryKey() {
  hideContextMenu()
  const { database, table, columnName, isPrimary } = contextMenu.value.data
  
  let sql = ''
  if (isPrimary) {
    // 取消主键（需要先检查是否有主键约束）
    sql = `ALTER TABLE \`${database}\`.\`${table}\` DROP PRIMARY KEY`
    if (confirm(`确定要取消字段 \`${columnName}\` 的主键约束吗？`)) {
      queryApi.executeQuery({
        connectionId: props.connectionId,
        database,
        sql
      })
    }
  } else {
    // 设置为主键（需要先确保没有其他主键）
    sql = `ALTER TABLE \`${database}\`.\`${table}\` ADD PRIMARY KEY (\`${columnName}\`)`
    if (confirm(`确定要将字段 \`${columnName}\` 设置为主键吗？`)) {
      queryApi.executeQuery({
        connectionId: props.connectionId,
        database,
        sql
      })
    }
  }
}

function confirmDropColumn() {
  hideContextMenu()
  const { database, table, columnName } = contextMenu.value.data
  if (confirm(`确定要删除字段 \`${columnName}\` 吗？此操作不可恢复！`)) {
    try {
      const sql = `ALTER TABLE \`${database}\`.\`${table}\` DROP COLUMN \`${columnName}\``
      queryApi.executeQuery({
        connectionId: props.connectionId,
        database,
        sql
      })
      console.log('字段删除成功')
    } catch (error) {
      console.error('删除字段失败：', error)
    }
  }
}

async function copyColumnName(name: string) {
  hideContextMenu()
  try {
    await navigator.clipboard.writeText(name)
    console.log('字段名已复制：', name)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = name
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

async function handleNodeClick(data: any) {
  if (data.type === 'search') {
    return
  }
  if (data.type === 'database') {
    workspaceStore.setCurrentDatabase(data.database)
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
  ddlCollapsed.value = false
  tableDataLoading.value = false
  tableDataError.value = ''
  tableData.value = { columns: [], rows: [] }
  tableStatus.value = null
  tableStatusLoading.value = true

  const ddlRes = await databaseApi.getTableDDL(props.connectionId, database, table)
  currentTableInfo.value = {
    database,
    table,
    comment: comment || '',
    ddl: ddlRes.data || ''
  }

  databaseApi.getTableStatus(props.connectionId, database, table)
    .then(res => {
      tableStatus.value = res.data
    })
    .catch(() => {
      tableStatus.value = null
    })
    .finally(() => {
      tableStatusLoading.value = false
    })

  const mouseX = (window.event as MouseEvent)?.clientX || 200
  const mouseY = (window.event as MouseEvent)?.clientY || 200
  const modalWidth = 900
  modalPosition.value = {
    x: Math.min(mouseX + 20, window.innerWidth - modalWidth - 40),
    y: Math.min(mouseY, 100)
  }

  showTableModal.value = true

  loadTableData(database, table)
}

async function loadTableData(database: string, table: string) {
  tableDataLoading.value = true
  tableDataError.value = ''

  try {
    // 先获取表字段信息，找到主键字段
    let primaryKey = 'id'
    try {
      const colRes = await databaseApi.getColumns(props.connectionId, database, table)
      const cols = colRes.data || []
      const pk = cols.find((c: any) => c.isPrimary)
      if (pk) {
        primaryKey = pk.name
      }
    } catch {
      // 如果获取字段失败，默认使用 id
    }

    // 构建查询 SQL：以主键倒序的前 10 条
    const sql = `SELECT * FROM \`${table}\` ORDER BY \`${primaryKey}\` DESC LIMIT 10`

    // 执行查询
    const result = await queryApi.executeQuery({
      connectionId: props.connectionId,
      database,
      sql
    })

    if (result.data && result.data.columns) {
      tableData.value = {
        columns: result.data.columns,
        rows: result.data.rows || []
      }
    }
  } catch (error: any) {
    tableDataError.value = error?.message || '数据加载失败'
  } finally {
    tableDataLoading.value = false
  }
}

function toggleDdlCollapsed() {
  ddlCollapsed.value = !ddlCollapsed.value
}

function highlightDDL(ddl: string): string {
  if (!ddl) return ''
  try {
    const formatted = formatSql(ddl)
    return hljs.highlight(formatted, { language: 'sql' }).value
  } catch (error) {
    console.error('SQL highlighting failed:', error)
    return ddl
  }
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  // 处理 Buffer 格式: {"type":"Buffer","data":[0]} -> "0"
  if (typeof value === 'object' && value !== null) {
    const obj = value as any
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      // 单值 Buffer（如 tinyint）直接取 data[0]
      if (obj.data.length === 1) {
        return String(obj.data[0])
      }
      // 多值 Buffer 转换为字符串
      if (obj.data.length > 0) {
        try {
          // 尝试将字节数组转换为字符串
          const decoder = new TextDecoder('utf-8')
          const str = decoder.decode(new Uint8Array(obj.data))
          return str
        } catch {
          // 如果转换失败，则显示为逗号分隔的数值
          return obj.data.join(', ')
        }
      }
      return ''
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value)
}

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '-'
  if (num >= 100000000) return (num / 100000000).toFixed(2) + '亿'
  if (num >= 10000) return (num / 10000).toFixed(2) + '万'
  return num.toLocaleString()
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '-'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2) + ' ' + units[i]
}

function formatCollation(collation: string | null | undefined): string {
  if (!collation) return '-'
  const parts = collation.split('_')
  return parts[0] || collation
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

// 表信息悬浮框相关函数
function showTableInfo(event: MouseEvent, data: any) {
  currentTableInfoForHover.value = {
    database: data.database,
    table: data.table,
    comment: data.comment || ''
  }
  updateTableInfoPosition(event)
  showTableInfoPanel.value = true
}

function hideTableInfo() {
  showTableInfoPanel.value = false
}

function updateTableInfoPosition(event: MouseEvent) {
  // 计算悬浮框位置，让它在鼠标右下方
  const offsetX = 15
  const offsetY = 15
  tableInfoPosition.value = {
    x: event.clientX + offsetX,
    y: event.clientY + offsetY
  }
}

async function copyTableName(tableName: string, tableKey: string) {
  try {
    await navigator.clipboard.writeText(tableName)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = tableName
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
  copiedTableKey.value = tableKey
  setTimeout(() => {
    if (copiedTableKey.value === tableKey) {
      copiedTableKey.value = ''
    }
  }, 1500)
}

function handleCheck() {
  const checkedNodes = treeRef.value?.getCheckedNodes() || []
  const tables = checkedNodes
    .filter((n: any) => n.type === 'table')
    .map((n: any) => ({ database: n.database, table: n.table, comment: n.comment || '' }))
  // 同步到 workspace store：表完整信息 + keys
  const keys = tables.map((t: { database: string; table: string; comment: string }) => `table_${t.database}_${t.table}`)
  workspaceStore.setCheckedTables(tables, keys)
  emit('checked-tables-change', tables)
}

function handleNodeExpand(data: any) {
  if (data.key) {
    workspaceStore.addExpandedKey(data.key)
  }
  // 展开数据库节点时，自动将其设为当前激活数据库
  if (data.type === 'database' && data.database) {
    workspaceStore.setCurrentDatabase(data.database)
  }
  nextTick(() => {
    hideNonTableCheckboxes()
  })
}

function handleNodeCollapse(data: any) {
  if (data.key) {
    workspaceStore.removeExpandedKey(data.key)
  }
}

async function refresh() {
  // 清空树数据，强制重新懒加载
  treeData.value = []
  
  // 清除勾选状态和展开状态
  workspaceStore.clearCheckedTables()
  workspaceStore.clearExpandedKeys()
  
  // 重新加载数据库列表
  await loadDatabases()
  
  // 等待 DOM 更新后，重新设置复选框隐藏逻辑
  await nextTick()
  hideNonTableCheckboxes()
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
    workspaceStore.clearCheckedTables()
  },
  refresh,
})
</script>

<style scoped lang="scss">
.db-tree {
  :deep(.el-tree-node__content) {
    height: 28px;
  }

  // 规则1: 隐藏搜索框节点的复选框和展开箭头
  // 搜索框是插入的特殊节点，不需要任何交互控件
  :deep(.el-tree-node > .el-tree-node__content:has(.search-wrapper) .el-checkbox) {
    display: none !important;
  }
  :deep(.el-tree-node > .el-tree-node__content:has(.search-wrapper) .el-tree-node__expand-icon) {
    display: none !important;
  }

  // 规则2: 隐藏字段节点的复选框
  // 字段节点是叶子节点，没有展开箭头，只需要隐藏复选框
  :deep(.el-tree-node > .el-tree-node__content:has(.column-node) .el-checkbox) {
    display: none !important;
  }

  // 规则3: 隐藏数据库节点的复选框
  // 数据库节点保留展开箭头，可以展开查看表列表
  :deep(.el-tree-node > .el-tree-node__content:has(.database-node) .el-checkbox) {
    display: none !important;
  }

  // 规则4: 表节点（.table-node 类）完全不做任何修改
  // 保持 Element Plus 默认行为：显示展开箭头 + 显示复选框
  // 不需要任何 CSS 规则来覆盖表节点的默认行为

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

  .copy-icon-wrapper {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 2px;
    opacity: 0.5;
    transition: opacity 0.2s, transform 0.2s;

    &:hover {
      opacity: 1;
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.9);
    }
  }

  .copy-icon {
    color: #67c23a;
  }

  .tree-comment {
    color: #909399;
    font-size: 12px;
    margin-left: 4px;
  }

  .column-node {
    cursor: pointer;
  }

  .table-node {
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

.table-info-panel {
  position: fixed;
  z-index: 10000;
  background: #1e1e1e;
  color: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 180px;
  max-width: 280px;
  pointer-events: none;

  .table-info-header {
    padding: 10px 14px;
    background: #2d2d2d;
    border-bottom: 1px solid #404040;
    border-radius: 6px 6px 0 0;

    .table-info-title {
      font-size: 13px;
      font-weight: 600;
      color: #dcdcaa;
    }
  }

  .table-info-body {
    padding: 12px 14px;

    .info-item {
      display: flex;
      font-size: 12px;
      line-height: 1.5;

      .info-label {
        color: #9cdcfe;
        min-width: 60px;
        font-weight: 500;
      }

      .info-value {
        color: #ce9178;
        flex: 1;

        &.no-comment {
          color: #808080;
          font-style: italic;
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
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border-color);
  overflow-x: hidden;
  overflow-y: auto;

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);

    .modal-title {
      font-weight: 600;
      color: var(--text-primary);
    }

    .modal-comment {
      font-weight: 400;
      color: var(--text-muted);
      font-size: 12px;
    }

    .el-button {
      padding: 0;
      width: 24px;
      height: 24px;
      line-height: 24px;
      color: var(--text-muted);
    }
  }

  .modal-body {
    overflow: auto;
    padding: 16px;
  }

  .table-stats-bar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: var(--bg-secondary, #f5f7fa);
    border: 1px solid var(--border-color, #e4e7ed);
    border-radius: 6px;

    &.loading {
      justify-content: center;
      color: var(--text-muted, #909399);
      font-size: 13px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      min-width: 0;

      .stat-value {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary, #303133);
        line-height: 1.4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .stat-label {
        font-size: 12px;
        color: var(--text-muted, #909399);
        margin-top: 2px;
      }
    }

    .stat-divider {
      width: 1px;
      height: 32px;
      background: var(--border-color, #e4e7ed);
      flex-shrink: 0;
    }
  }

  // 分区公共样式
  .ddl-section, .data-section {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      padding: 8px 10px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      cursor: pointer;
      user-select: none;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 10px;
      transition: background 0.2s;

      &:hover {
        background: var(--border-color);
      }

      &.no-click {
        cursor: default;
        &:hover {
          background: var(--bg-tertiary);
        }
      }

      .collapse-icon, .section-icon {
        font-size: 14px;
        margin-right: 8px;
        color: #909399;
        transition: transform 0.2s;
      }

      .collapse-icon {
        cursor: pointer;

        &.collapsed {
          transform: rotate(-90deg);
        }
      }

      .section-title {
        flex: 1;
      }
    }

    .section-content {
      padding: 0 4px;
    }
  }

  // DDL 代码区
  .ddl-section {
    .ddl-code {
      margin: 0;
      padding: 0;
      border: 1px solid #e8e8e8;
      border-radius: 4px;
      overflow-x: hidden;

      :deep(code) {
        font-family: 'JetBrains Mono', Consolas, 'Microsoft YaHei UI', 'Courier New', Courier, monospace;
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
      }
    }
  }

  // 数据区
  .data-section {
    .data-loading, .data-error, .data-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px;
      color: #909399;
      font-size: 13px;

      .loading-icon, .error-icon, .empty-icon {
        margin-right: 8px;
        font-size: 16px;
      }

      .loading-icon {
        animation: rotate 2s linear infinite;
      }

      .error-icon {
        color: #f56c6c;
      }
    }

    .data-table-wrapper {
      .data-count {
        margin-top: 8px;
        text-align: right;
        font-size: 12px;
        color: #909399;
      }
    }

    .cell-null {
      color: #c0c4cc;
      font-style: italic;
    }
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// ==================== 右键菜单样式 ====================

.context-menu {
  position: fixed;
  z-index: 99999;
  min-width: 180px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  font-size: 13px;
  user-select: none;
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  color: var(--text-primary);
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--table-hover);
    color: #409eff;
  }

  &.danger {
    color: #f56c6c;

    &:hover {
      background-color: #fef0f0;
      color: #f56c6c;
    }
  }

  .el-icon {
    margin-right: 8px;
    font-size: 14px;
  }
}

.context-menu-divider {
  height: 1px;
  background-color: #e4e7ed;
  margin: 4px 0;
}

// ==================== 对话框表单样式 ====================

.add-column-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
