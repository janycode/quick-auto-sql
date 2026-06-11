<template>
  <div class="ai-panel">
    <div class="ai-panel-header">
      <el-icon><ChatDotRound /></el-icon>
      <span>AI SQL 对话</span>
      <div style="flex: 1" />
      <el-button size="small" text @click="handleOpenHistory">
        <el-icon><Clock /></el-icon>
        <span style="margin-left: 2px">历史</span>
      </el-button>
    </div>
    <div class="ai-panel-body">
      <!-- 已选表 -->
      <div style="margin-bottom: 12px">
        <div class="table-header">
          <div class="table-title">
            关联表:
            <span v-if="selectedTables.length > 0" style="color: #909399; font-size: 12px">
              (在左侧树中勾选表自动关联)
            </span>
          </div>
          <el-button
            v-if="selectedTables.length > 0"
            type="danger"
            text
            size="small"
            @click="handleClear"
          >
            清空
          </el-button>
        </div>
        <TableSelector
          :tables="selectedTables"
          @remove="removeTable"
        />
      </div>

      <!-- AI 输出区域 -->
      <div v-if="generatedSql || generating" class="ai-output">
        <div v-if="generating && !generatedSql" class="ai-loading">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span class="loading-text">{{ loadingHint }}{{ loadingDots }}</span>
        </div>
        <div v-else class="ai-sql-output">
          <pre><code v-html="highlightSql(generatedSql)"></code></pre>
        </div>
        <el-button
          v-if="generatedSql && !generating"
          type="primary"
          size="small"
          style="margin-top: 8px; width: 100%"
          @click="handleUseSql"
        >
          使用此 SQL
        </el-button>
      </div>
    </div>
    <div class="ai-panel-footer">
      <el-input
        class="ai-question-input"
        v-model="question"
        type="textarea"
        placeholder="输入自然语言描述，如：查询所有用户的订单数量"
        :disabled="generating"
        resize="none"
        @keydown.ctrl.enter.prevent="handleGenerate"
      />
      <el-button
        type="primary"
        :icon="Promotion"
        :loading="generating"
        style="margin-top: 8px; width: 100%"
        @click="handleGenerate"
      >
        生成 SQL (Ctrl+Enter)
      </el-button>
    </div>

    <!-- 历史对话弹窗 -->
    <Teleport to="body">
      <el-dialog
        v-model="showHistoryModal"
        title="历史对话"
        width="760px"
        :close-on-click-modal="false"
      >
        <div class="history-header">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索历史对话..."
            :prefix-icon="Search"
            clearable
            style="flex: 1"
          />
          <el-button
            type="danger"
            text
            :disabled="!aiStore.history.length"
            @click="handleClearAllHistory"
          >
            <el-icon><Delete /></el-icon>
            <span style="margin-left: 2px">清空全部</span>
          </el-button>
        </div>

        <div class="history-list" v-loading="historyLoading">
          <div
            v-for="item in filteredHistory"
            :key="item.id"
            class="history-item"
          >
            <div class="history-content">
              <div class="history-question-row">
                <el-tooltip content="复制提示词" placement="top">
                  <el-icon
                    class="copy-question-icon"
                    @click.stop="handleCopyQuestion(item.question)"
                  ><DocumentCopy /></el-icon>
                </el-tooltip>
                <el-tooltip :content="item.question" placement="top" :show-after="300">
                  <div class="history-question">{{ item.question }}</div>
                </el-tooltip>
              </div>
              <div class="history-meta">
                <span>{{ formatTime(item.createdAt) }}</span>
                <span class="meta-divider">·</span>
                <span>{{ item.database }}</span>
                <span v-if="item.tables?.length" class="meta-divider">·</span>
                <span v-if="item.tables?.length">{{ item.tables.join(', ') }}</span>
              </div>
            </div>
            <div class="history-actions">
              <el-button size="small" @click="viewSql(item)">查看SQL</el-button>
              <el-button size="small" type="primary" @click="useSqlFromHistory(item)">使用SQL</el-button>
              <el-button size="small" type="danger" text @click="handleDeleteHistory(item)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          <div v-if="!historyLoading && filteredHistory.length === 0" class="history-empty">
            <el-empty :description="aiStore.history.length ? '没有匹配的历史记录' : '暂无历史对话'" :image-size="60" />
          </div>
        </div>
      </el-dialog>
    </Teleport>

    <!-- SQL 预览弹窗 -->
    <Teleport to="body">
      <el-dialog
        v-model="showSqlPreview"
        title="SQL 预览"
        width="640px"
        :close-on-click-modal="false"
      >
        <pre class="sql-preview-code"><code v-html="highlightSql(currentPreviewSql)"></code></pre>
        <template #footer>
          <el-button @click="showSqlPreview = false">关闭</el-button>
          <el-button type="primary" @click="usePreviewSql">使用此 SQL</el-button>
        </template>
      </el-dialog>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ChatDotRound, Promotion, Loading, Clock, Search, Delete, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import TableSelector from './TableSelector.vue'
import { useAiStore } from '@/stores/ai'
import { useConnectionStore } from '@/stores/connection'
import { useDatabaseStore } from '@/stores/database'
import { fetchSSE } from '@/utils/sse'
import { formatSql } from '@/utils/sql-formatter'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'
import sql from 'highlight.js/lib/languages/sql'
import type { IAiHistory } from '@/api/ai'

hljs.registerLanguage('sql', sql)

interface ISelectedTable {
  database: string
  table: string
  comment: string
}

const emit = defineEmits<{
  'use-sql': [sql: string]
  'clear-tables': []
}>()

const aiStore = useAiStore()
const connectionStore = useConnectionStore()
const databaseStore = useDatabaseStore()

// 组件挂载时加载 AI 配置
onMounted(() => {
  aiStore.fetchConfig()
})

const question = ref('')
const selectedTables = ref<ISelectedTable[]>([])
const generating = ref(false)
const generatedSql = ref('')
const rawSql = ref('') // 原始未格式化的 SQL
let abortController: AbortController | null = null

// 动态加载提示
const loadingHintTexts = [
  '正在生成 SQL',
  '正在理解你的需求',
  '正在分析表结构',
  '正在拼接关联条件',
  '正在优化查询计划',
  '正在为你编写 SQL',
]
const loadingHint = ref(loadingHintTexts[0])
const loadingDots = ref('')
let loadingTimer: ReturnType<typeof setInterval> | null = null
let hintTimer: ReturnType<typeof setInterval> | null = null

watch(generating, (val) => {
  if (val) {
    // 开始生成时，启动动态提示
    loadingHint.value = loadingHintTexts[0]
    loadingDots.value = '.'
    let dotCount = 1
    let hintIndex = 0
    loadingTimer = setInterval(() => {
      dotCount = (dotCount % 3) + 1
      loadingDots.value = '.'.repeat(dotCount)
    }, 500)
    hintTimer = setInterval(() => {
      hintIndex = (hintIndex + 1) % loadingHintTexts.length
      loadingHint.value = loadingHintTexts[hintIndex]
    }, 3000)
  } else {
    // 停止生成后，清理定时器
    if (loadingTimer) {
      clearInterval(loadingTimer)
      loadingTimer = null
    }
    if (hintTimer) {
      clearInterval(hintTimer)
      hintTimer = null
    }
  }
})

onUnmounted(() => {
  if (loadingTimer) clearInterval(loadingTimer)
  if (hintTimer) clearInterval(hintTimer)
})

// 历史相关
const showHistoryModal = ref(false)
const showSqlPreview = ref(false)
const searchKeyword = ref('')
const historyLoading = ref(false)
const currentPreviewSql = ref('')
const currentPreviewItem = ref<IAiHistory | null>(null)

// 搜索过滤
const filteredHistory = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return aiStore.history
  return aiStore.history.filter(h =>
    h.question.toLowerCase().includes(kw) ||
    h.sql.toLowerCase().includes(kw) ||
    (h.database || '').toLowerCase().includes(kw) ||
    (h.tables || []).some(t => t.toLowerCase().includes(kw))
  )
})

// 由 Workspace 调用，自动同步左侧树勾选的表
function setCheckedTables(tables: ISelectedTable[]) {
  selectedTables.value = tables
}

function removeTable(tableName: string) {
  selectedTables.value = selectedTables.value.filter(t => t.table !== tableName)
}

function handleClear() {
  selectedTables.value = []
  emit('clear-tables')
}

async function handleOpenHistory() {
  showHistoryModal.value = true
  historyLoading.value = true
  try {
    await aiStore.fetchHistory()
  } finally {
    historyLoading.value = false
  }
}

function formatTime(t: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : ''
}

function highlightSql(content: string): string {
  if (!content) return ''
  try {
    return hljs.highlight(content, { language: 'sql' }).value
  } catch {
    return content
  }
}

function viewSql(item: IAiHistory) {
  currentPreviewItem.value = item
  currentPreviewSql.value = item.sql
  showSqlPreview.value = true
}

function useSqlFromHistory(item: IAiHistory) {
  emit('use-sql', item.sql)
  showHistoryModal.value = false
}

function usePreviewSql() {
  if (currentPreviewItem.value) {
    emit('use-sql', currentPreviewItem.value.sql)
  }
  showSqlPreview.value = false
}

async function handleDeleteHistory(item: IAiHistory) {
  try {
    await ElMessageBox.confirm(
      `确定要删除该历史记录吗？`,
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await aiStore.removeHistory(item.id)
    ElMessage.success('已删除')
  } catch {
    // 用户取消
  }
}

async function handleClearAllHistory() {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有历史对话吗？此操作不可恢复。',
      '警告',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await aiStore.clearHistory()
    ElMessage.success('已清空全部历史')
  } catch {
    // 用户取消
  }
}

async function handleCopyQuestion(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('已复制到剪贴板')
  }
}

async function handleGenerate() {
  if (!question.value.trim()) {
    ElMessage.warning('请输入自然语言描述')
    return
  }
  if (selectedTables.value.length === 0) {
    ElMessage.warning('请至少在左侧树中勾选一个表')
    return
  }
  if (!connectionStore.activeConnection) {
    ElMessage.warning('请先选择数据库连接')
    return
  }
  if (!aiStore.config.apiKey) {
    ElMessage.warning('请先配置 AI API Key')
    return
  }

  // 使用第一个选中表所在的数据库
  const database = selectedTables.value[0].database
  if (!database) {
    ElMessage.warning('请先选择数据库')
    return
  }

  generating.value = true
  generatedSql.value = ''
  rawSql.value = ''

  const tableNames = selectedTables.value.map(t => t.table)
  const connectionId = connectionStore.activeConnection.id
  const currentQuestion = question.value

  abortController = fetchSSE('/api/ai/generate', {
    connectionId,
    database,
    tables: tableNames,
    question: currentQuestion,
  }, {
    onMessage: (data) => {
      if (data.type === 'thinking') {
        // 思考中
      } else if (data.type === 'sql') {
        rawSql.value += data.content
        generatedSql.value += data.content
      } else if (data.type === 'error') {
        ElMessage.error(data.content)
      } else if (data.type === 'done') {
        // 流式完成后格式化 SQL
        const finalSql = formatSql(rawSql.value)
        generatedSql.value = finalSql
        generating.value = false
        // 异步保存到后端（仅当生成的 SQL 非空时）
        if (finalSql && finalSql.trim()) {
          aiStore.addHistory({
            connectionId,
            database,
            tables: tableNames,
            question: currentQuestion,
            sql: finalSql,
          }).catch(err => {
            console.error('保存历史失败:', err)
          })
        }
      }
    },
    onError: (error) => {
      ElMessage.error(error.message)
      generating.value = false
    },
    onComplete: () => {
      generating.value = false
    },
  })
}

function handleUseSql() {
  if (generatedSql.value) {
    // 使用格式化后的 SQL
    emit('use-sql', generatedSql.value)
  }
}

defineExpose({ setCheckedTables })
</script>

<style scoped lang="scss">
.ai-panel {
  width: 380px;
  border-left: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: #fafafa;

  .ai-panel-header {
    padding: 12px 16px;
    border-bottom: 1px solid #e4e7ed;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ai-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .ai-panel-footer {
    padding: 12px;
    border-top: 1px solid #e4e7ed;

    :deep(.ai-question-input .el-textarea__inner) {
      height: 100px !important;
      min-height: 100px;
    }
  }

  .table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .table-title {
    font-size: 13px;
    color: #606266;
  }
}

.ai-output {
  margin-top: 12px;

  .ai-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 12px;
    color: #909399;
    font-size: 13px;
    background: #f5f7fa;
    border-radius: 4px;

    .is-loading {
      color: #409eff;
      animation: rotate 1s linear infinite;
    }

    .loading-text {
      min-width: 180px;
    }
  }

  .ai-sql-output {
    background: #f5f7fa;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;

    :deep(pre) {
      margin: 0;
      background: transparent;
    }

    :deep(code) {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #333;
      background: transparent;
      white-space: pre-wrap;
      word-break: break-all;
      display: block;
    }

    :deep(.hljs-keyword) { color: #c7254e; }
    :deep(.hljs-string) { color: #22863a; }
    :deep(.hljs-number) { color: #005cc5; }
    :deep(.hljs-comment) { color: #998; font-style: italic; }
    :deep(.hljs-built_in), :deep(.hljs-type) { color: #6f42c1; }
    :deep(.hljs-function) { color: #6f42c1; }
    :deep(.hljs-title) { color: #6f42c1; }
  }
}

.history-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.history-list {
  max-height: 480px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  transition: background-color 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: #f5f7fa;
  }
}

.history-content {
  flex: 1;
  overflow: hidden;
  min-width: 0;
}

.history-question-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.copy-question-icon {
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.2s;

  &:hover {
    color: #409eff;
  }
}

.history-question {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
  flex: 1;
  min-width: 0;
}

.history-meta {
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  .meta-divider {
    color: #c0c4cc;
  }
}

.history-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.history-empty {
  padding: 24px 0;
}

.sql-preview-code {
  margin: 0;
  padding: 0;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;

  :deep(code) {
    display: block;
    padding: 16px;
    font-family: Consolas, 'Microsoft YaHei UI', 'Courier New', Courier, monospace !important;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
    max-height: 400px;
    overflow-y: auto;
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
