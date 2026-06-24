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
            <span v-else-if="workspaceStore.currentDatabase" style="color: #67c23a; font-size: 12px">
              (未勾选，将使用数据库 [{{ workspaceStore.currentDatabase }}] 下的所有表)
            </span>
            <span v-else style="color: #e6a23c; font-size: 12px">
              (请在左侧树中点击或展开一个数据库)
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
          v-if="workspaceStore.checkedTables.length > 0"
          :tables="workspaceStore.checkedTables"
          @remove="removeTable"
        />
      </div>

      <!-- 对话历史 -->
      <div v-if="workspaceStore.conversationMessages.length > 0" class="conversation-history">
        <div class="conversation-header">
          <span class="conversation-title">对话历史</span>
          <el-button size="small" link type="danger" @click="handleClearConversation">
            <el-icon><Delete /></el-icon>
            清空
          </el-button>
        </div>
        <div
          v-for="(msg, idx) in workspaceStore.conversationMessages"
          :key="idx"
          class="conversation-message"
          :class="msg.role"
        >
          <div class="message-role">{{ msg.role === 'user' ? '你' : 'AI' }}</div>
          <div class="message-content">{{ msg.content }}</div>
          <div v-if="msg.sql" class="message-sql">
            <pre><code v-html="highlightSql(msg.sql)"></code></pre>
          </div>
        </div>
      </div>

      <!-- AI 输出区域 -->
      <div v-if="workspaceStore.aiGeneratedSql || generating" class="ai-output">
        <div v-if="generating && !workspaceStore.aiGeneratedSql" class="ai-loading">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span class="loading-text">{{ loadingHint }}{{ loadingDots }}</span>
        </div>
        <div v-else class="ai-sql-output">
          <div class="sql-label">
            原始 SQL
            <el-tooltip content="复制 SQL" placement="top">
              <el-icon class="copy-sql-icon" @click="handleCopySql(workspaceStore.aiGeneratedSql)"><DocumentCopy /></el-icon>
            </el-tooltip>
          </div>
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
            <div class="sql-label">
              优化后 SQL
              <el-tooltip content="复制 SQL" placement="top">
                <el-icon class="copy-sql-icon" @click="handleCopySql(workspaceStore.aiOptimizedSql)"><DocumentCopy /></el-icon>
              </el-tooltip>
            </div>
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

        <!-- SQL Diff 对比视图 -->
        <div v-if="workspaceStore.aiGeneratedSql && workspaceStore.aiOptimizedSql && !generating && !optimizing" class="sql-diff-section">
          <div class="sql-diff-header" @click="showDiff = !showDiff">
            <span class="sql-diff-title">
              <el-icon><Document /></el-icon>
              SQL 对比
            </span>
            <el-icon class="diff-toggle" :class="{ expanded: showDiff }"><ArrowDown /></el-icon>
          </div>
          <div v-if="showDiff" class="sql-diff-content">
            <div class="diff-side">
              <div class="diff-label">原始</div>
              <pre class="diff-code original"><code>{{ workspaceStore.aiGeneratedSql }}</code></pre>
            </div>
            <div class="diff-side">
              <div class="diff-label">优化后</div>
              <pre class="diff-code optimized"><code>{{ workspaceStore.aiOptimizedSql }}</code></pre>
            </div>
          </div>
        </div>
      </div>

      <!-- 悬浮提示：有新内容需要滚动 -->
      <div
        v-if="showScrollHint"
        class="scroll-hint"
        @click="scrollPanelToBottomSmooth"
      >
        <el-icon class="scroll-hint-icon"><ArrowDown /></el-icon>
        <span>滚动查看更新</span>
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
import { ChatDotRound, Promotion, Loading, Clock, Search, Delete, DocumentCopy, ArrowDown, Document } from '@element-plus/icons-vue'
import hljs from 'highlight.js'
import type { IAiHistory } from '@/api/ai'
import TableSelector from './TableSelector.vue'
import { useAiStore } from '@/stores/ai'
import { useConnectionStore } from '@/stores/connection'
import { useWorkspaceStore } from '@/stores/workspace'
import { useUserStore } from '@/stores/user'
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
const userStore = useUserStore()

// question 绑定到 workspace store 的 aiQuestion
const question = computed({
  get: () => workspaceStore.aiQuestion,
  set: (v: string) => workspaceStore.setAiQuestion(v),
})
const generating = computed(() => workspaceStore.aiGenerating)
const optimizing = computed(() => workspaceStore.aiOptimizing)
const showDiff = ref(false)
let abortController: AbortController | null = null
const panelBody = ref<HTMLElement | null>(null)
const showScrollHint = ref(false)
let resizeObserver: ResizeObserver | null = null

function scrollPanelToBottom() {
  nextTick(() => {
    if (panelBody.value) {
      panelBody.value.scrollTop = panelBody.value.scrollHeight
    }
  })
}

function scrollPanelToBottomSmooth() {
  if (panelBody.value) {
    panelBody.value.scrollTo({
      top: panelBody.value.scrollHeight,
      behavior: 'smooth'
    })
  }
}

function updateScrollHint() {
  if (!panelBody.value) return
  const el = panelBody.value
  const needsScroll = el.scrollHeight > el.clientHeight + 4
  const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20
  showScrollHint.value = needsScroll && !isNearBottom
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
  // 设置滚动监听 + ResizeObserver 检测内容变化
  if (panelBody.value) {
    panelBody.value.addEventListener('scroll', updateScrollHint, { passive: true })
    // ResizeObserver 监听容器尺寸变化（窗口高度变化等）
    resizeObserver = new ResizeObserver(() => {
      updateScrollHint()
    })
    resizeObserver.observe(panelBody.value)
    // 同时监听容器内 DOM 变化，以检测内容是否增多
    const mo = new MutationObserver(() => {
      nextTick(updateScrollHint)
    })
    mo.observe(panelBody.value, { childList: true, subtree: true, attributes: false, characterData: false })
    // 存到 resizeObserver 便于统一清理
    ;(resizeObserver as any)._mo = mo
  }
  nextTick(updateScrollHint)
})

onUnmounted(() => {
  if (loadingTimer) clearInterval(loadingTimer)
  if (hintTimer) clearInterval(hintTimer)
  if (panelBody.value) {
    panelBody.value.removeEventListener('scroll', updateScrollHint)
  }
  if (resizeObserver) {
    try {
      const mo = (resizeObserver as any)._mo
      if (mo) mo.disconnect()
    } catch (_) { /* ignore */ }
    resizeObserver.disconnect()
  }
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

function handleClearConversation() {
  workspaceStore.clearConversation()
  workspaceStore.setAiGeneratedSql('')
  workspaceStore.setAiOptimizedSql('')
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
  if (!connectionStore.activeConnection) {
    ElMessage.warning('请先选择数据库连接')
    return
  }
  if (!aiStore.config.id) {
    ElMessage.warning('请先配置 AI API Key')
    return
  }

  const hasCheckedTables = workspaceStore.checkedTables.length > 0
  let database: string
  if (hasCheckedTables) {
    database = workspaceStore.checkedTables[0].database
  } else {
    // 未勾选表时，使用当前激活的数据库（由后端拉取全库表）
    database = workspaceStore.currentDatabase
  }
  if (!database) {
    ElMessage.warning('请先选择数据库（在左侧树点击或展开一个数据库）')
    return
  }

  workspaceStore.setAiGenerating(true)
  workspaceStore.setAiGeneratedSql('')
  workspaceStore.setAiOptimizedSql('')

  const tableNames = hasCheckedTables
    ? workspaceStore.checkedTables.map((t: any) => t.table)
    : []
  const connectionId = connectionStore.activeConnection.id
  const currentQuestion = question.value.trim()

  // 单次请求 Promise 化：成功 resolve(finalSql)，失败 reject(error)
  // 不可重试错误会在 message 前加 'FATAL:' 前缀
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
        messages: workspaceStore.getConversationForAI(),
      }, {
        onMessage: (data: any) => {
          if (data.type === 'thinking') {
            // 思考中
          } else if (data.type === 'sql') {
            gotAnySql = true
            rawBuffer += data.content
            workspaceStore.setAiGeneratedSql(rawBuffer)
          } else if (data.type === 'error') {
            const msg = data.content || 'AI 接口返回错误'
            // 对"配置缺失 / 鉴权失败"类错误标记为不可重试
            const isFatal = /请先|API Key|Key|密钥|未配置|401|403|Unauthorized|key|invalid/i.test(msg)
            reject(new Error(isFatal ? `FATAL:${msg}` : msg))
          } else if (data.type === 'done') {
            gotDone = true
            const finalSql = formatSql(rawBuffer)
            workspaceStore.setAiGeneratedSql(finalSql)
            if (gotAnySql && finalSql.trim()) {
              resolve(finalSql)
            } else {
              reject(new Error('AI 未返回有效 SQL，请重试'))
            }
          }
        },
        onError: (error: any) => {
          // 网络层失败（后端未启动、CORS、断网等）
          const msg = error?.message || String(error) || '网络请求失败'
          reject(new Error(msg))
        },
        onComplete: () => {
          if (!gotDone) {
            const finalSql = formatSql(rawBuffer)
            if (gotAnySql && finalSql.trim()) {
              resolve(finalSql)
            } else {
              reject(new Error('AI 未返回有效 SQL，请重试'))
            }
          }
        },
      })

      abortController = ctrl
    })
  }

  // 执行请求（最多 2 次，自动重试一次可恢复的错误）
  let result = ''
  let firstErrorMessage = ''
  try {
    result = await callGenerateOnce()
  } catch (firstError: any) {
    firstErrorMessage = firstError?.message || ''
    const isFatal = firstErrorMessage.startsWith('FATAL:')
    const cleanMsg = firstErrorMessage.replace(/^FATAL:/, '')

    if (isFatal) {
      // 不可恢复的错误：直接展示给用户，不重试
      ElMessage.error(cleanMsg)
      workspaceStore.setAiGenerating(false)
      console.error('[AI] 不可恢复错误:', cleanMsg)
      return
    }

    // 可恢复错误：静默重试一次
    workspaceStore.setAiGeneratedSql('')
    try {
      result = await callGenerateOnce()
    } catch (secondError: any) {
      const secondMsg = secondError?.message || ''
      ElMessage.error(`AI 生成失败：${secondMsg.replace(/^FATAL:/, '') || firstErrorMessage.replace(/^FATAL:/, '')}`)
      workspaceStore.setAiGenerating(false)
      console.error('[AI] 两次请求均失败，首次错误:', firstErrorMessage, '; 二次错误:', secondMsg)
      return
    }
  }

  // 成功：保存历史并添加对话消息
  workspaceStore.setAiGenerating(false)
  if (result && result.trim()) {
    userStore.fetchQuota().catch(() => {})
    aiStore.addHistory({
      connectionId,
      database,
      tables: tableNames,
      question: currentQuestion,
      sql: result,
    }).catch(err => {
      console.error('保存历史失败:', err)
    })

    // 添加到对话历史
    workspaceStore.addConversationMessage({
      role: 'user',
      content: currentQuestion,
      timestamp: Date.now(),
    })
    workspaceStore.addConversationMessage({
      role: 'assistant',
      content: `已生成 SQL`,
      sql: result,
      timestamp: Date.now(),
    })
  }
}

async function handleCopySql(sql: string) {
  if (!sql) return
  try {
    await navigator.clipboard.writeText(sql)
    ElMessage.success('SQL 已复制到剪贴板')
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = sql
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('SQL 已复制到剪贴板')
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
  const database = workspaceStore.checkedTables[0]?.database
    || workspaceStore.currentDatabase
    || connectionStore.activeConnection.database
    || ''
  if (!database) {
    ElMessage.warning('请先选择数据库（在左侧树点击或展开一个数据库）')
    return
  }
  if (!aiStore.config.id) {
    ElMessage.warning('请先配置 AI API Key')
    return
  }

  workspaceStore.setAiOptimizing(true)
  workspaceStore.setAiOptimizedSql('')

  const tableNames = workspaceStore.checkedTables.length > 0
    ? workspaceStore.checkedTables.map((t: any) => t.table)
    : []
  const connectionId = connectionStore.activeConnection.id
  const originalSql = workspaceStore.aiGeneratedSql

  function callOptimizeOnce() {
    return new Promise<string>((resolve, reject) => {
      let rawOpt = ''
      let gotAnySql = false
      let gotDone = false

      const ctrl = fetchSSE('/api/ai/optimize', {
        connectionId,
        database,
        sql: originalSql,
        tables: tableNames,
      }, {
        onMessage: (data: any) => {
          if (data.type === 'thinking') {
            // 思考中（正在跑 EXPLAIN）
          } else if (data.type === 'sql') {
            gotAnySql = true
            rawOpt += data.content
            workspaceStore.setAiOptimizedSql(rawOpt)
            scrollPanelToBottom()
          } else if (data.type === 'error') {
            const msg = data.content || 'AI 接口返回错误'
            const isFatal = /请先|API Key|Key|密钥|未配置|401|403|Unauthorized|key|invalid/i.test(msg)
            reject(new Error(isFatal ? `FATAL:${msg}` : msg))
          } else if (data.type === 'done') {
            gotDone = true
            const finalSql = formatSql(rawOpt)
            workspaceStore.setAiOptimizedSql(finalSql)
            scrollPanelToBottom()
            if (gotAnySql && finalSql.trim()) {
              resolve(finalSql)
            } else {
              reject(new Error('AI 未返回有效的优化 SQL，请重试'))
            }
          }
        },
        onError: (error: any) => {
          reject(new Error(error?.message || '网络请求失败'))
        },
        onComplete: () => {
          if (!gotDone) {
            const finalSql = formatSql(rawOpt)
            if (gotAnySql && finalSql.trim()) {
              resolve(finalSql)
            } else {
              reject(new Error('AI 未返回有效的优化 SQL，请重试'))
            }
          }
        },
      })

      abortController = ctrl
    })
  }

  try {
    const result = await callOptimizeOnce()
    workspaceStore.setAiOptimizing(false)
    if (result && result.trim()) {
      userStore.fetchQuota().catch(() => {})
      scrollPanelToBottom()
      workspaceStore.addConversationMessage({
        role: 'user',
        content: `[优化 SQL] ${originalSql.slice(0, 60)}...`,
        timestamp: Date.now(),
      })
      workspaceStore.addConversationMessage({
        role: 'assistant',
        content: '优化后的 SQL',
        sql: result,
        timestamp: Date.now(),
      })
      aiStore.addHistory({
        connectionId,
        database,
        tables: tableNames,
        question: `[优化] ${originalSql.slice(0, 60)}...`,
        sql: result,
      }).catch(err => {
        console.error('保存优化SQL历史失败:', err)
      })
    }
  } catch (err: any) {
    workspaceStore.setAiOptimizing(false)
    const msg = (err?.message || '').replace(/^FATAL:/, '')
    ElMessage.error(`AI 优化失败：${msg || '未知错误'}`)
    console.error('[AI] 优化SQL失败:', msg)
  }
}

defineExpose({ setCheckedTables })
</script>

<style scoped lang="scss">
.ai-panel {
  width: 380px;
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--ai-panel-bg);

  .ai-panel-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ai-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    position: relative;
  }

  .scroll-hint {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    margin: 12px -16px -16px;
    padding: 10px 16px;
    background: linear-gradient(to top, var(--ai-panel-bg), var(--ai-panel-bg));
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    color: #409eff;
    cursor: pointer;
    user-select: none;
    z-index: 5;
    transition: opacity 0.2s;

    &:hover {
      color: #66b1ff;
      .scroll-hint-icon {
        animation: bounceDown 0.8s ease-in-out infinite;
      }
    }

    .scroll-hint-icon {
      font-size: 14px;
    }
  }

  .ai-panel-footer {
    padding: 12px;
    border-top: 1px solid var(--border-color);

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
    color: var(--text-secondary);
  }
}

.conversation-history {
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;

  .conversation-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);

    .conversation-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
    }
  }

  .conversation-message {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-color);

    &:last-child {
      border-bottom: none;
    }

    &.user {
      background: var(--bg-primary);
    }

    &.assistant {
      background: var(--bg-tertiary);
    }

    .message-role {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .message-content {
      font-size: 13px;
      color: var(--text-primary);
      line-height: 1.5;
    }

    .message-sql {
      margin-top: 8px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 8px;
      overflow-x: auto;

      pre {
        margin: 0;
        background: transparent;
      }

      code {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        line-height: 1.5;
        color: var(--text-primary);
        white-space: pre-wrap;
        word-break: break-all;
      }
    }
  }
}

.ai-output {
  margin-top: 12px;

  .ai-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 12px;
    color: var(--text-muted);
    font-size: 13px;
    background: var(--bg-tertiary);
    border-radius: 4px;

    .is-loading {
      color: #409eff;
      animation: rotate 1s linear infinite;
    }
  }

  .ai-sql-output {
    background: var(--bg-tertiary);
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;

    :deep(pre) { margin: 0; background: transparent; }
    :deep(code) {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-primary);
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
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      padding: 2px 8px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      margin-bottom: 8px;

      .copy-sql-icon {
        cursor: pointer;
        font-size: 13px;
        color: var(--text-muted);
        transition: color 0.2s;

        &:hover {
          color: #409eff;
        }
      }
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
    border-top: 1px dashed var(--border-color);
  }

  .sql-diff-section {
    margin-top: 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;

    .sql-diff-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--bg-tertiary);
      cursor: pointer;
      user-select: none;

      &:hover {
        background: var(--border-color);
      }

      .sql-diff-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
      }

      .diff-toggle {
        transition: transform 0.2s;
        color: var(--text-muted);

        &.expanded {
          transform: rotate(180deg);
        }
      }
    }

    .sql-diff-content {
      display: flex;
      gap: 0;
      border-top: 1px solid var(--border-color);

      .diff-side {
        flex: 1;
        min-width: 0;

        &:first-child {
          border-right: 1px solid var(--border-color);
        }

        .diff-label {
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted);
          background: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
          text-transform: uppercase;
        }

        .diff-code {
          margin: 0;
          padding: 8px;
          font-size: 11px;
          line-height: 1.5;
          overflow-x: auto;
          max-height: 200px;
          background: var(--bg-primary);

          code {
            font-family: 'Consolas', 'Monaco', monospace;
            color: var(--text-primary);
            white-space: pre-wrap;
            word-break: break-all;
          }

          &.original {
            background: var(--bg-primary);
          }

          &.optimized {
            background: #f0f9eb;
          }
        }
      }
    }
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
  border-bottom: 1px solid var(--border-color);

  &:last-child { border-bottom: none; }
  &:hover { background-color: var(--bg-tertiary); }
}

.history-index {
  flex-shrink: 0;
  width: 32px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  font-family: Consolas, Monaco, monospace;
  font-weight: 500;
}

.history-content { flex: 1; overflow: hidden; min-width: 0; }
.history-question-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.copy-question-icon { font-size: 14px; color: var(--text-muted); cursor: pointer; &:hover { color: #409eff; } }
.history-question {
  font-size: 13px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; flex: 1; min-width: 0;
}
.history-meta { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
.meta-divider { color: var(--text-muted); }

.history-actions { display: flex; gap: 6px; flex-shrink: 0; }
.history-empty { padding: 24px 0; }

.history-pagination {
  display: flex;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  margin-top: 8px;
}

.sql-preview-code {
  margin: 0; padding: 0; border: 1px solid var(--border-color); border-radius: 4px;
  overflow: hidden; background: var(--bg-primary);

  :deep(code) {
    display: block; padding: 16px;
    font-family: Consolas, 'Microsoft YaHei UI', 'Courier New', monospace !important;
    font-size: 13px; line-height: 1.6; white-space: pre-wrap !important;
    word-wrap: break-word !important; overflow-wrap: break-word !important;
    max-height: 400px; overflow-y: auto;
    color: var(--text-primary);
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); } to { transform: rotate(360deg); }
}

@keyframes bounceDown {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}
</style>
