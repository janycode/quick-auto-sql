<template>
  <div class="ai-panel">
    <div class="ai-panel-header">
      <el-icon><ChatDotRound /></el-icon>
      <span>AI SQL 对话</span>
      <div style="flex: 1" />
      <el-button size="small" link @click="handleOpenHistory">
        <el-icon><Clock /></el-icon>
        <span style="margin-left: 2px">历史</span>
      </el-button>
    </div>
    <div ref="panelBody" class="ai-panel-body">
      <!-- 已选表 -->
      <div style="margin-bottom: 12px">
        <div class="table-header">
          <div class="table-title">
            关联表:
            <span v-if="workspaceStore.checkedTables.length > 0" style="color: #909399; font-size: 12px">
              (在左侧树中勾选表自动关联)
            </span>
          </div>
          <el-button
            v-if="workspaceStore.checkedTables.length > 0"
            type="danger"
            link
            size="small"
            @click="handleClear"
          >
            清空
          </el-button>
        </div>
        <TableSelector
          :tables="workspaceStore.checkedTables"
          @remove="removeTable"
        />
      </div>

      <!-- AI 输出区域 -->
      <div v-if="workspaceStore.aiGeneratedSql || generating" class="ai-output">
        <div v-if="generating && !workspaceStore.aiGeneratedSql" class="ai-loading">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span class="loading-text">{{ loadingHint }}{{ loadingDots }}</span>
        </div>
        <div v-else class="ai-sql-output">
          <div class="sql-label">原始 SQL</div>
          <pre><code v-html="highlightSql(workspaceStore.aiGeneratedSql)"></code></pre>
        </div>
        <div v-if="workspaceStore.aiGeneratedSql && !generating" class="ai-actions">
          <el-button type="primary" size="small" @click="handleUseSql">使用此 SQL</el-button>
          <el-button type="success" size="small" :loading="optimizing" @click="handleOptimize">优化写法</el-button>
        </div>

        <!-- 优化后的 SQL（显示在下方） -->
        <div v-if="workspaceStore.aiOptimizedSql || optimizing" class="ai-optimized-output">
          <div v-if="optimizing && !workspaceStore.aiOptimizedSql" class="ai-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span class="loading-text">{{ optimizingHint }}{{ loadingDots }}</span>
          </div>
          <div v-else class="ai-sql-output optimized">
            <div class="sql-label">优化后 SQL</div>
            <pre><code v-html="highlightSql(workspaceStore.aiOptimizedSql)"></code></pre>
          </div>
          <el-button
            v-if="workspaceStore.aiOptimizedSql && !optimizing"
            type="success"
            size="small"
            style="margin-top: 8px; width: 100%"
            @click="handleUseOptimizedSql"
          >
            使用优化后的 SQL
          </el-button>
        </div>
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
            link
            :disabled="!aiStore.history.length"
            @click="handleClearAllHistory"
          >
            <el-icon><Delete /></el-icon>
            <span style="margin-left: 2px">清空全部</span>
          </el-button>
        </div>

        <div class="history-list" v-loading="historyLoading">
          <div
            v-for="(item, index) in paginatedHistory"
            :key="item.id"
            class="history-item"
          >
            <div class="history-index">{{ (historyPage - 1) * historyPageSize + index + 1 }}</div>
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
              <el-button size="small" type="danger" link @click="handleDeleteHistory(item)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          <div v-if="!historyLoading && filteredHistory.length === 0" class="history-empty">
            <el-empty :description="aiStore.history.length ? '没有匹配的历史记录' : '暂无历史对话'" :image-size="60" />
          </div>
        </div>

        <div class="history-pagination" v-if="filteredHistory.length > historyPageSize">
          <el-pagination
            v-model:current-page="historyPage"
            v-model:page-size="historyPageSize"
            :page-sizes="[10, 20, 50]"
            :total="filteredHistory.length"
            layout="prev, pager, next, jumper, sizes, total"
            background
            small
          />
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ChatDotRound, Promotion, Loading, Clock, Search, Delete, DocumentCopy } from '@element-plus/icons-vue'
import hljs from 'highlight.js'
import type { IAiHistory } from '@/api/ai'
import TableSelector from './TableSelector.vue'
import { useAiStore } from '@/stores/ai'
import { useConnectionStore } from '@/stores/connection'
import { useWorkspaceStore } from '@/stores/workspace'
import { fetchSSE } from '@/utils/sse'
import { formatSql } from '@/utils/sql-formatter'
import dayjs from 'dayjs'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('sql', sql)

// 注：此处显式导入 sql 语言
import sql from 'highlight.js/lib/languages/sql'

const emit = defineEmits<{
  'use-sql': [sql: string]
  'clear-tables': []
}>()

const aiStore = useAiStore()
const connectionStore = useConnectionStore()
const workspaceStore = useWorkspaceStore()

// question 绑定到 workspace store 的 aiQuestion
const question = computed({
  get: () => workspaceStore.aiQuestion,
  set: (v: string) => workspaceStore.setAiQuestion(v),
})
const generating = ref(false)
const optimizing = ref(false)
let abortController: AbortController | null = null
const panelBody = ref<HTMLElement | null>(null)

function scrollPanelToBottom() {
  nextTick(() => {
    if (panelBody.value) {
      panelBody.value.scrollTop = panelBody.value.scrollHeight
    }
  })
}

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
const optimizingHint = ref('')
let loadingTimer: ReturnType<typeof setInterval> | null = null
let hintTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // 组件挂载时启动 loading 计时器（当 generating 变化时由 watch 控制）
})

onUnmounted(() => {
  if (loadingTimer) clearInterval(loadingTimer)
  if (hintTimer) clearInterval(hintTimer)
})

// 监听 generating / optimizing 状态，切换加载提示
watch([generating, optimizing], ([gen, opt]) => {
  const isLoading = gen || opt
  if (isLoading) {
    if (opt) optimizingHint.value = '正在执行 EXPLAIN 并优化 SQL'
    loadingDots.value = '.'
    let dotCount = 1
    let hintIndex = 0
    if (loadingTimer) clearInterval(loadingTimer)
    if (hintTimer) clearInterval(hintTimer)
    loadingTimer = setInterval(() => {
      dotCount = (dotCount % 3) + 1
      loadingDots.value = '.'.repeat(dotCount)
    }, 500)
    hintTimer = setInterval(() => {
      if (gen) {
        hintIndex = (hintIndex + 1) % loadingHintTexts.length
        loadingHint.value = loadingHintTexts[hintIndex]
      } else if (opt) {
        const optHints = ['正在执行 EXPLAIN 分析执行计划', '正在根据 EXPLAIN 结果改写 SQL', '正在为你生成优化后的 SQL']
        hintIndex = (hintIndex + 1) % optHints.length
        optimizingHint.value = optHints[hintIndex]
      }
    }, 3000)
  } else {
    if (loadingTimer) clearInterval(loadingTimer)
    if (hintTimer) clearInterval(hintTimer)
    loadingDots.value = ''
  }
})

// 历史对话
const showHistoryModal = ref(false)
const showSqlPreview = ref(false)
const searchKeyword = ref('')
const historyLoading = ref(false)
const currentPreviewSql = ref('')
const historyPage = ref(1)
const historyPageSize = ref(10)

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

const paginatedHistory = computed(() => {
  const start = (historyPage.value - 1) * historyPageSize.value
  const end = start + historyPageSize.value
  return filteredHistory.value.slice(start, end)
})

watch(searchKeyword, () => {
  historyPage.value = 1
})

watch(historyPageSize, () => {
  historyPage.value = 1
})

// 由 Workspace 调用：同步左侧树勾选的表
function setCheckedTables(tables: { database: string; table: string; comment: string }[]) {
  workspaceStore.setCheckedTables(tables, tables.map(t => `table_${t.database}_${t.table}`))
}

function removeTable(tableName: string) {
  const filtered = workspaceStore.checkedTables.filter(t => t.table !== tableName)
  workspaceStore.setCheckedTables(filtered, filtered.map(t => `table_${t.database}_${t.table}`))
}

function handleClear() {
  workspaceStore.clearCheckedTables()
  emit('clear-tables')
}

async function handleOpenHistory() {
  showHistoryModal.value = true
  historyPage.value = 1
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
  currentPreviewSql.value = item.sql
  showSqlPreview.value = true
}

function useSqlFromHistory(item: IAiHistory) {
  emit('use-sql', item.sql)
  showHistoryModal.value = false
}

function usePreviewSql() {
  emit('use-sql', currentPreviewSql.value)
  showSqlPreview.value = false
}

async function handleDeleteHistory(item: IAiHistory) {
  try {
    await useConfirm()
    await aiStore.removeHistory(item.id)
  } catch {
    // 取消
  }
}

async function handleClearAllHistory() {
  try {
    await useConfirm('确定要清空所有历史对话吗？此操作不可恢复。')
    await aiStore.clearHistory()
  } catch {
    // 取消
  }
}

async function handleCopyQuestion(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

import { ElMessageBox } from 'element-plus'
function useConfirm(message = '确定要删除该历史记录吗？') {
  return ElMessageBox.confirm(message, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
}

async function handleGenerate() {
  if (!question.value.trim()) {
    ElMessage.warning('请输入自然语言描述')
    return
  }
  if (workspaceStore.checkedTables.length === 0) {
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

  const database = workspaceStore.checkedTables[0].database
  if (!database) {
    ElMessage.warning('请先选择数据库')
    return
  }

  generating.value = true
  workspaceStore.setAiGeneratedSql('')
  workspaceStore.setAiOptimizedSql('')

  const tableNames = workspaceStore.checkedTables.map((t: any) => t.table)
  const connectionId = connectionStore.activeConnection.id
  const currentQuestion = question.value.trim()

  // 单次请求：返回 Promise；失败或无结果则 reject
  function callGenerateOnce() {
    return new Promise<string>((resolve, reject) => {
      let rawBuffer = ''
      let gotAnySql = false
      let gotDone = false

      const ctrl = fetchSSE('/api/ai/generate', {
        connectionId,
        database,
        tables: tableNames,
        question: currentQuestion,
      }, {
        onMessage: (data: any) => {
          if (data.type === 'thinking') {
            // 思考中
          } else if (data.type === 'sql') {
            gotAnySql = true
            rawBuffer += data.content
            workspaceStore.setAiGeneratedSql(rawBuffer)
          } else if (data.type === 'error') {
            reject(new Error(data.content || 'AI 接口返回错误'))
          } else if (data.type === 'done') {
            gotDone = true
            const finalSql = formatSql(rawBuffer)
            workspaceStore.setAiGeneratedSql(finalSql)
            if (gotAnySql && finalSql.trim()) {
              resolve(finalSql)
            } else {
              reject(new Error('NO_RESULT'))
            }
          }
        },
        onError: (error: any) => {
          reject(error)
        },
        onComplete: () => {
          // 流结束但没有收到 done + 有效内容时
          if (!gotDone) {
            const finalSql = formatSql(rawBuffer)
            if (gotAnySql && finalSql.trim()) {
              resolve(finalSql)
            } else {
              reject(new Error('NO_RESULT'))
            }
          }
        },
      })

      abortController = ctrl
    })
  }

  try {
    let result = ''
    try {
      result = await callGenerateOnce()
    } catch (firstError: any) {
      // 首次失败：自动重试一次
      workspaceStore.setAiGeneratedSql('')
      try {
        result = await callGenerateOnce()
      } catch {
        // 重试也失败：统一提示"服务器繁忙"
        ElMessage.error('AI接口服务器繁忙，请再次尝试')
        generating.value = false
        return
      }
    }

    // 成功：保存历史
    generating.value = false
    if (result && result.trim()) {
      aiStore.addHistory({
        connectionId,
        database,
        tables: tableNames,
        question: currentQuestion,
        sql: result,
      }).catch(err => {
        console.error('保存历史失败:', err)
      })
    }
  } catch {
    generating.value = false
    ElMessage.error('AI接口服务器繁忙，请再次尝试')
  }
}

function handleUseSql() {
  if (workspaceStore.aiGeneratedSql) {
    emit('use-sql', workspaceStore.aiGeneratedSql)
  }
}

function handleUseOptimizedSql() {
  if (workspaceStore.aiOptimizedSql) {
    emit('use-sql', workspaceStore.aiOptimizedSql)
  }
}

async function handleOptimize() {
  if (!workspaceStore.aiGeneratedSql.trim()) {
    ElMessage.warning('请先生成 SQL')
    return
  }
  if (!connectionStore.activeConnection) {
    ElMessage.warning('请先选择数据库连接')
    return
  }
  const database = workspaceStore.checkedTables[0]?.database || connectionStore.activeConnection.database || ''
  if (!database) {
    ElMessage.warning('请先选择数据库')
    return
  }
  if (!aiStore.config.apiKey) {
    ElMessage.warning('请先配置 AI API Key')
    return
  }

  optimizing.value = true
  workspaceStore.setAiOptimizedSql('')
  const rawOpt = ref('')

  const tableNames = workspaceStore.checkedTables.map((t: any) => t.table)
  const connectionId = connectionStore.activeConnection.id

  abortController = fetchSSE('/api/ai/optimize', {
    connectionId,
    database,
    sql: workspaceStore.aiGeneratedSql,
    tables: tableNames,
  }, {
    onMessage: (data: any) => {
      if (data.type === 'thinking') {
        // 思考中
      } else if (data.type === 'sql') {
        rawOpt.value += data.content
        workspaceStore.setAiOptimizedSql(rawOpt.value)
        scrollPanelToBottom()
      } else if (data.type === 'error') {
        ElMessage.error(data.content)
      } else if (data.type === 'done') {
        const finalSql = formatSql(rawOpt.value)
        workspaceStore.setAiOptimizedSql(finalSql)
        optimizing.value = false
        scrollPanelToBottom()
      }
    },
    onError: (error: any) => {
      ElMessage.error(error.message)
      optimizing.value = false
    },
    onComplete: () => {
      optimizing.value = false
      scrollPanelToBottom()
    },
  })
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
  }

  .ai-sql-output {
    background: #f5f7fa;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;

    :deep(pre) { margin: 0; background: transparent; }
    :deep(code) {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #333;
      background: transparent;
      white-space: pre-wrap;
      word-break: break-all;
    }
    :deep(.hljs-keyword) { color: #c7254e; }
    :deep(.hljs-string) { color: #22863a; }
    :deep(.hljs-number) { color: #005cc5; }

    &.optimized {
      background: #f0f9eb;
      border: 1px dashed #67c23a;
    }

    .sql-label {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      color: #606266;
      padding: 2px 8px;
      background: #fff;
      border: 1px solid #dcdfe6;
      border-radius: 3px;
      margin-bottom: 8px;
    }
  }

  .ai-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;

    .el-button {
      flex: 1;
    }
  }

  .ai-optimized-output {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #dcdfe6;
  }
}

.history-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.history-list {
  min-height: 80px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;

  &:last-child { border-bottom: none; }
  &:hover { background-color: #f5f7fa; }
}

.history-index {
  flex-shrink: 0;
  width: 32px;
  text-align: center;
  font-size: 12px;
  color: #909399;
  font-family: Consolas, Monaco, monospace;
  font-weight: 500;
}

.history-content { flex: 1; overflow: hidden; min-width: 0; }
.history-question-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.copy-question-icon { font-size: 14px; color: #909399; cursor: pointer; &:hover { color: #409eff; } }
.history-question {
  font-size: 13px; color: #303133; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; flex: 1; min-width: 0;
}
.history-meta { font-size: 12px; color: #909399; display: flex; align-items: center; gap: 6px; }
.meta-divider { color: #c0c4cc; }

.history-actions { display: flex; gap: 6px; flex-shrink: 0; }
.history-empty { padding: 24px 0; }

.history-pagination {
  display: flex;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  margin-top: 8px;
}

.sql-preview-code {
  margin: 0; padding: 0; border: 1px solid #e8e8e8; border-radius: 4px;
  overflow: hidden; background: #fff;

  :deep(code) {
    display: block; padding: 16px;
    font-family: Consolas, 'Microsoft YaHei UI', 'Courier New', monospace !important;
    font-size: 13px; line-height: 1.6; white-space: pre-wrap !important;
    word-wrap: break-word !important; overflow-wrap: break-word !important;
    max-height: 400px; overflow-y: auto;
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); } to { transform: rotate(360deg); }
}
</style>
