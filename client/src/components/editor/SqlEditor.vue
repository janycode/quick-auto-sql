<template>
  <div class="editor-area">
    <div class="editor-toolbar">
      <el-select
        v-model="currentDatabase"
        placeholder="选择数据库"
        size="small"
        style="width: 180px"
        @change="handleDatabaseChange"
      >
        <el-option
          v-for="db in databases"
          :key="db.name"
          :label="db.name"
          :value="db.name"
        />
      </el-select>
      <el-button type="success" size="small" :icon="CaretRight" @click="handleExecute" :loading="executing">
        执行（Ctrl+Enter）
      </el-button>
      <el-button size="small" :icon="MagicStick" @click="handleFormat">
        格式化
      </el-button>
      <el-button type="primary" size="small" :icon="explaining ? undefined : MagicStick" @click="handleExplain" :loading="explaining">
        {{ explaining ? explainButtonText : 'AI SQL 解释' }}
      </el-button>
      <el-button type="warning" size="small" :icon="TrendCharts" @click="handleAnalyze" :loading="analyzing">
        AI SQL 分析
      </el-button>
      <el-button size="small" text type="primary" @click="handleOpenAnalysisHistory">
        <el-icon><Clock /></el-icon>
        <span>分析历史</span>
      </el-button>
      <div style="flex: 1" />
      <el-button size="small" text @click="handleClear">
        清空
      </el-button>
    </div>
    <div class="editor-content" ref="editorContainer"></div>

    <!-- SQL 性能分析结果弹窗 -->
    <el-dialog v-model="analyzeDialogVisible" title="AI SQL 性能分析" width="760px" :close-on-click-modal="false">
      <div class="analyze-body">
        <!-- 动态 loading：多步骤提示 + 旋转图形 + 跳动点 -->
        <div v-if="analyzing" class="analyze-loading">
          <div class="loading-ring">
            <span class="dot d1"></span>
            <span class="dot d2"></span>
            <span class="dot d3"></span>
            <span class="dot d4"></span>
            <span class="dot d5"></span>
            <span class="dot d6"></span>
            <span class="dot d7"></span>
            <span class="dot d8"></span>
          </div>
          <div class="loading-step">
            <span class="step-title">{{ loadingStep }}</span>
            <span class="step-dots">
              <span v-for="i in loadingDots" :key="i">.</span>
            </span>
          </div>
          <div class="loading-progress">
            <div class="loading-progress-bar" :style="{ width: loadingProgress + '%' }"></div>
          </div>
          <div class="loading-progress-text">{{ loadingProgress }}% · 预计剩余 {{ loadingRemain }}s</div>
          <div class="loading-hint">正在调用 AI 模型，稍等片刻 …</div>
        </div>

        <template v-else>
          <div v-if="analyzeResult" class="analyze-block">
            <div class="analyze-label">
              <span>分析结论</span>
              <el-tag
                v-if="analyzeResult.cached"
                size="small"
                type="success"
                effect="light"
                class="analyze-tag"
              >已缓存 · {{ formatDateTime(analyzeResult.createdAt) }}</el-tag>
              <el-tag
                v-else
                size="small"
                type="primary"
                effect="light"
                class="analyze-tag"
              >AI 实时分析 · {{ formatDateTime(analyzeResult.createdAt) }}</el-tag>
            </div>
            <pre
              class="analyze-text hljs"
              v-html="highlightedAnalysis"
            ></pre>
          </div>

          <div v-if="analyzeResult && analyzeResult.explain.length" class="analyze-collapse-wrap">
            <el-collapse v-model="explainCollapseState" class="analyze-collapse">
              <el-collapse-item title="EXPLAIN 原始结果（鼠标悬停查看释义）" name="explain">
                <el-table
                  :data="analyzeResult.explain"
                  size="small"
                  border
                  stripe
                  style="width: 100%"
                  :cell-class-name="getExplainCellClass"
                >
                  <el-table-column
                    v-for="col in explainColumns"
                    :key="col"
                    :prop="col"
                    :label="col"
                    :min-width="110"
                    show-overflow-tooltip
                  >
                    <template #default="{ row }">
                      <el-tooltip
                        :content="cellTooltip(col, row[col])"
                        placement="top"
                        effect="light"
                        :disabled="!cellTooltip(col, row[col])"
                        popper-class="explain-tip"
                      >
                        <span
                          class="explain-cell-value"
                          :title="cellTooltip(col, row[col])"
                        >{{ row[col] === null || row[col] === undefined ? '' : row[col] }}</span>
                      </el-tooltip>
                    </template>
                  </el-table-column>
                </el-table>

                <div class="explain-legend">
                  <span class="legend-item legend-good">🟢 无需优化</span>
                  <span class="legend-item legend-warn">🟠 可选优化</span>
                  <span class="legend-item legend-bad">🔴 必须优化</span>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>

          <div v-if="!analyzeResult" class="analyze-empty">
            暂无分析结果
          </div>
        </template>
      </div>

      <template #footer>
        <el-button @click="analyzeDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- SQL 分析历史列表弹窗 -->
    <el-dialog
      v-model="historyDialogVisible"
      title="SQL 分析历史"
      width="820px"
      :close-on-click-modal="false"
    >
      <div class="history-toolbar">
        <el-button size="small" type="danger" plain @click="handleClearHistory">
          清空历史
        </el-button>
        <div style="flex: 1" />
        <el-text type="info" size="small">共 {{ historyItems.length }} 条</el-text>
      </div>

      <el-empty
        v-if="!loadingHistory && historyItems.length === 0"
        description="暂无分析历史"
        :image-size="120"
      />

      <el-table
        v-else
        :data="historyItems"
        size="small"
        border
        stripe
        style="width: 100%"
        @row-click="handleViewHistoryItem"
        highlight-current-row
      >
        <el-table-column label="序号" type="index" width="55" align="center" />
        <el-table-column label="SQL 片段" min-width="260">
          <template #default="{ row }">
            <span
              class="history-sql"
              :title="row.sql"
            >{{ row.sql.replace(/\s+/g, ' ').slice(0, 120) }}{{ row.sql.length > 120 ? '…' : '' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="分析时间" width="180">
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="SQL 长度" width="100" align="right">
          <template #default="{ row }">
            {{ row.sql.length }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              size="small"
              @click.stop="handleViewHistoryItem(row)"
            >查看详情</el-button>
            <el-button
              link
              type="success"
              size="small"
              @click.stop="handleCopyHistorySql(row)"
            >复制 SQL</el-button>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="historyDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 历史详情弹窗 -->
    <el-dialog
      v-model="historyDetailVisible"
      title="分析详情"
      width="820px"
      :close-on-click-modal="false"
    >
      <template v-if="historyDetailItem">
        <el-collapse v-model="historyDetailCollapse" class="analyze-collapse">
          <el-collapse-item title="原始 SQL" name="sql">
            <pre class="history-detail-pre">{{ historyDetailItem.sql }}</pre>
          </el-collapse-item>
          <el-collapse-item
            :title="`EXPLAIN 结果（${historyDetailItem.explain?.length || 0} 行）`"
            name="explain"
          >
            <el-table
              v-if="historyDetailItem.explain && historyDetailItem.explain.length > 0"
              :data="historyDetailItem.explain"
              size="small"
              border
              stripe
              style="width: 100%"
              :cell-class-name="getExplainCellClass"
            >
              <el-table-column
                v-for="col in getExplainColumns(historyDetailItem.explain)"
                :key="col"
                :prop="col"
                :label="col"
                :min-width="110"
              >
                <template #default="{ row }">
                  <span :title="String(row[col] ?? '')">
                    {{ row[col] === null || row[col] === undefined ? '' : row[col] }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="无 EXPLAIN 数据" />
          </el-collapse-item>
        </el-collapse>

        <div class="analyze-block" style="margin-top: 12px">
          <div class="analyze-label">分析结论（{{ formatDateTime(historyDetailItem.createdAt) }}）</div>
          <pre
            class="analyze-text hljs"
            v-html="highlightAnalysis(historyDetailItem.analysis)"
          ></pre>
        </div>
      </template>

      <template #footer>
        <el-button @click="historyDetailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, onUnmounted } from 'vue'
import { CaretRight, MagicStick, Delete, TrendCharts, Clock } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as monaco from 'monaco-editor'
import { formatSql } from '@/utils/sql-formatter'
import * as aiApi from '@/api/ai'
import type { IDatabase } from '@/api/database'
import hljs from 'highlight.js/lib/core'
import hljsSql from 'highlight.js/lib/languages/sql'
// 不引入 highlight.js 主题文件，使用下方自定义的浅色语法配色

try {
  hljs.registerLanguage('sql', hljsSql)
} catch (e) {
  // ignore — language already registered or not needed
}

// 对中文/HTML 转义
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 从分析文本中，挑出疑似 SQL 的片段并做 SQL 高亮：
// 1) ```sql ... ``` 三引号代码块
// 2) 独立成行的 SQL 语句（以 SELECT/INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/WITH/UNION/SHOW/DESCRIBE/EXPLAIN/REPLACE 开头）
// 3) 行内被反引号包裹的 `SELECT ... FROM` 片段
// 其他文本原样保留（先 HTML 转义）。
function highlightAnalysis(text: string): string {
  if (!text) return ''
  const SQL_START = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|REPLACE|WITH|UNION|SHOW|DESCRIBE|EXPLAIN)\b/i
  const INLINE_BACKTICK = /`([^`\n]{10,500})`/g

  function highlightSqlBlock(code: string): string {
    try {
      return hljs.highlight(code, { language: 'sql' }).value
    } catch {
      return escapeHtml(code)
    }
  }

  const lines = text.split('\n')
  const out: string[] = []
  let buf: string[] = []
  let inFence = false

  function flushBufAsCode() {
    if (!buf.length) return
    const block = buf.join('\n').trim()
    out.push(`<pre class="hljs inline-sql">${highlightSqlBlock(block)}</pre>`)
    buf = []
  }

  function flushBufAsText() {
    if (!buf.length) return
    // 聚合文本行做行内处理
    const line = buf.join('\n')
    const escaped = escapeHtml(line).replace(INLINE_BACKTICK, (_, inner) => {
      if (SQL_START.test(inner)) {
        return `<code class="hljs inline-sql-fragment">${highlightSqlBlock(inner)}</code>`
      }
      return `\`${escapeHtml(inner)}\``
    })
    out.push(`<span class="analyze-line">${escaped}</span>`)
    buf = []
  }

  for (const rawLine of lines) {
    const fenceMatch = rawLine.match(/^\s*```(\w*)\s*$/)
    if (fenceMatch) {
      if (inFence) {
        flushBufAsCode()
        inFence = false
      } else {
        flushBufAsText()
        inFence = true
      }
      continue
    }

    if (inFence) {
      buf.push(rawLine)
      continue
    }

    // 非代码块：判断是否是独立 SQL 行
    if (SQL_START.test(rawLine)) {
      flushBufAsText()
      buf = [rawLine]
      flushBufAsCode()
    } else {
      buf.push(rawLine)
    }
  }
  // 收尾
  if (inFence) flushBufAsCode()
  else flushBufAsText()

  return out.join('\n')
}

const props = defineProps<{
  modelValue: string
  databases: IDatabase[]
  executing?: boolean
  selectedDatabase?: string
  connectionId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'execute': [sql: string]
  'database-change': [database: string]
}>()

const editorContainer = ref<HTMLElement>()
const currentDatabase = ref('')
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const analyzing = ref(false)
const explaining = ref(false)
const analyzeDialogVisible = ref(false)
const analyzeResult = ref<{
  explain: Record<string, unknown>[]
  analysis: string
  cached?: boolean
  createdAt?: string
} | null>(null)
// 默认展开 EXPLAIN 结果，允许用户折叠
const explainCollapseState = ref<string | string[]>(['explain'])

// 分析历史相关
const historyDialogVisible = ref(false)
const historyDetailVisible = ref(false)
const loadingHistory = ref(false)
interface IHistoryItem {
  sql: string
  analysis: string
  explain: Record<string, unknown>[]
  createdAt: string
}
const historyItems = ref<IHistoryItem[]>([])
const historyDetailItem = ref<IHistoryItem | null>(null)
const historyDetailCollapse = ref<string | string[]>(['sql', 'explain'])

async function handleOpenAnalysisHistory() {
  historyDialogVisible.value = true
  await loadAnalysisHistory()
}

async function loadAnalysisHistory() {
  loadingHistory.value = true
  try {
    const resp = await aiApi.getAnalysisHistory()
    historyItems.value = (resp?.data?.items as IHistoryItem[]) || []
  } catch (e: any) {
    ElMessage.error(e?.message || '获取分析历史失败')
    historyItems.value = []
  } finally {
    loadingHistory.value = false
  }
}

function handleViewHistoryItem(row: IHistoryItem) {
  if (!row) return
  historyDetailItem.value = row
  historyDetailVisible.value = true
}

function handleCopyHistorySql(row: IHistoryItem) {
  if (!row?.sql) return
  try {
    const ta = document.createElement('textarea')
    ta.value = row.sql
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success('SQL 已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择文本复制')
  }
}

async function handleClearHistory() {
  if (!historyItems.value.length) {
    ElMessage.info('历史已为空')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定清空全部 ${historyItems.value.length} 条分析历史？此操作不可恢复。`,
      '清空历史',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await aiApi.clearAnalysisHistory()
    ElMessage.success('已清空分析历史')
    historyItems.value = []
  } catch (e: any) {
    ElMessage.error(e?.message || '清空历史失败')
  }
}

const highlightedAnalysis = computed(() => {
  if (!analyzeResult.value) return ''
  try {
    return highlightAnalysis(analyzeResult.value.analysis)
  } catch {
    return analyzeResult.value.analysis
  }
})

function formatDateTime(s?: string): string {
  if (!s) return ''
  try {
    const d = new Date(s)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

// EXPLAIN 关键字段的中文含义映射（鼠标悬停提示）
const TYPE_TIPS: Record<string, string> = {
  system: '系统表，仅一行，极快，通常可忽略',
  const: '主键/唯一索引命中一行，可当作常量',
  eq_ref: '唯一索引关联，每个驱动行对应一行',
  ref: '非唯一索引扫描，返回匹配的多行',
  fulltext: '全文索引扫描',
  'ref_or_null': '类似 ref，额外处理 NULL 值',
  'index_merge': '索引合并优化（多索引组合使用）',
  'unique_subquery': 'IN 子查询替换为唯一索引查找',
  'index_subquery': 'IN 子查询替换为普通索引查找',
  range: '索引范围扫描（between/<、>/in）',
  index: '遍历整棵索引树，比全表扫略好',
  all: '全表扫描，性能最差，建议添加索引',
}

const EXTRA_TIPS: Record<string, string> = {
  'Using where': 'WHERE 条件在读取行后再过滤（未走索引时常见）',
  'Using index': '仅从索引读取数据（覆盖索引），无需回表，性能好',
  'Using filesort': '无法利用索引排序，需要额外排序操作，性能差',
  'Using temporary': '需要创建临时表存中间结果，性能差，常见于 GROUP BY/ORDER BY',
  'Impossible WHERE': 'WHERE 条件恒假，不会返回任何行',
  'Using join buffer': '关联时使用了连接缓存，通常代表未走索引关联',
  'Using index condition': '索引条件下推（ICP），在索引层先过滤，减少回表',
  'Using MRR': '多范围读取优化，减少随机 IO',
  'No tables used': '无表访问（例如 SELECT 常量）',
  'Select tables optimized away': '已通过索引/聚合优化掉表扫描',
  'Backward index scan': '倒序扫描索引（InnoDB DESC 扫描）',
}

const SELECT_TYPE_TIPS: Record<string, string> = {
  SIMPLE: '简单查询，无 UNION/子查询',
  PRIMARY: '最外层查询',
  UNION: 'UNION 中的第二个及后续查询',
  'UNION RESULT': 'UNION 的合并结果集',
  SUBQUERY: '不依赖外层的子查询（可被优化器提前执行）',
  DEPENDENT: '依赖外层查询的子查询（每行重算，性能差）',
  DEPENDENT_SUBQUERY: '依赖外层查询的子查询（每行重算，性能差）',
  'DEPENDENT UNION': 'UNION 中的子查询依赖外层查询',
  DERIVED: '派生表/临时结果集',
  MATERIALIZED: '物化子查询',
  UNCACHEABLE: '无法缓存的子查询',
  'UNCACHEABLE SUBQUERY': '结果不可缓存，每次执行需重算',
  'UNCACHEABLE UNION': 'UNION 中不可缓存的子查询',
}

function cellTooltip(col: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const str = String(value).trim()
  if (col === 'type') {
    const lower = str.toLowerCase()
    if (TYPE_TIPS[lower]) return `${str} — ${TYPE_TIPS[lower]}`
    return str
  }
  if (col === 'Extra') {
    const upper = str.toUpperCase()
    const hit = Object.keys(EXTRA_TIPS).find(k => upper.includes(k.toUpperCase()))
    if (hit) return `${str}（${EXTRA_TIPS[hit]}）`
    return str
  }
  if (col === 'select_type') {
    const key = Object.keys(SELECT_TYPE_TIPS).find(k => str.toUpperCase().includes(k))
    if (key) return `${str}（${SELECT_TYPE_TIPS[key]}）`
    return str
  }
  if (col === 'rows') {
    const n = Number(str)
    if (!Number.isFinite(n)) return str
    if (n > 10000) return `${str} 行（扫描行数较多，可能需优化）`
    if (n > 1000) return `${str} 行（扫描行数中等）`
    return `${str} 行`
  }
  if (col === 'filtered') {
    const n = Number(str.replace('%', ''))
    if (!Number.isFinite(n)) return str
    if (n < 30) return `${str}（仅少量行被保留，过滤效率低，可能缺少索引）`
    if (n < 80) return `${str}（中等过滤效率）`
    return `${str}（过滤效率良好）`
  }
  if (col === 'key' || col === 'possible_keys') {
    return `${col}：${str}`
  }
  return str
}

// 动态 loading 状态
const LOADING_STEPS = [
  '正在解析 SQL 语句',
  '正在执行 EXPLAIN',
  '正在分析执行计划',
  '正在生成优化建议',
  '即将完成分析',
]
const loadingStepIdx = ref(0)
const loadingStep = computed(() => LOADING_STEPS[loadingStepIdx.value] || '')
const loadingDots = ref(1)
const loadingProgress = ref(3)
const loadingRemain = ref(8)
let loadingTimer: ReturnType<typeof setInterval> | null = null
let loadingTick = 0

function startLoadingAnimation() {
  stopLoadingAnimation()
  loadingStepIdx.value = 0
  loadingDots.value = 1
  loadingProgress.value = 3
  loadingRemain.value = 8
  loadingTick = 0
  loadingTimer = setInterval(() => {
    loadingTick++
    // 每 800ms 切换一次步骤提示
    loadingStepIdx.value = Math.min(LOADING_STEPS.length - 1, Math.floor(loadingTick / 8))
    // 跳动点 1~4 循环
    loadingDots.value = (loadingTick % 4) + 1
    // 渐进进度（缓慢增长，到 95% 封顶，等到实际完成才 100）
    const progress = Math.min(95, 3 + loadingTick * 0.7)
    loadingProgress.value = Math.round(progress)
    // 预计剩余秒数，缓慢递减
    loadingRemain.value = Math.max(1, Math.round(10 - loadingTick / 10))
  }, 100)
}

function stopLoadingAnimation() {
  if (loadingTimer) {
    clearInterval(loadingTimer)
    loadingTimer = null
  }
}

// ======== AI SQL 解释：按钮文字动态变化 ========
const EXPLAIN_LOADING_STEPS = ['正在解析 SQL…', '正在调用模型…', '正在生成描述…', '即将完成输出…']
const explainLoadingStepIdx = ref(0)
const explainButtonText = computed(() => EXPLAIN_LOADING_STEPS[explainLoadingStepIdx.value] || '')
let explainLoadingTimer: ReturnType<typeof setInterval> | null = null

function startExplainAnimation() {
  stopExplainAnimation()
  explainLoadingStepIdx.value = 0
  explainLoadingTimer = setInterval(() => {
    explainLoadingStepIdx.value = (explainLoadingStepIdx.value + 1) % EXPLAIN_LOADING_STEPS.length
  }, 800)
}

function stopExplainAnimation() {
  if (explainLoadingTimer) {
    clearInterval(explainLoadingTimer)
    explainLoadingTimer = null
  }
}

onUnmounted(() => {
  stopLoadingAnimation()
  stopExplainAnimation()
})

const explainColumns = computed(() => {
  if (!analyzeResult.value || !analyzeResult.value.explain.length) return []
  return Object.keys(analyzeResult.value.explain[0])
})

function getExplainColumns(rows: Record<string, unknown>[]): string[] {
  if (!rows || !rows.length) return []
  return Object.keys(rows[0])
}

// 影响性能的关键字段：type / rows / filtered / Extra / key / possible_keys
// 其他列（id、table、type 等）按自身内容再判断
function getExplainCellClass({ row, column }: { row: Record<string, unknown>; column: { property?: string } }) {
  const prop = column.property
  if (!prop) return ''
  const value = row[prop]
  const str = value === null || value === undefined ? '' : String(value)

  // ------- 类型 type -------
  if (prop === 'type') {
    const v = str.trim().toUpperCase()
    if (['SYSTEM', 'CONST', 'EQ_REF', 'REF'].includes(v)) return 'cell-good'
    if (['REF_OR_NULL', 'INDEX_SUBQUERY', 'SUBQUERY', 'RANGE', 'INDEX_MERGE', 'UNIQUE_SUBQUERY'].includes(v) || v === 'RANGE') return 'cell-warn'
    if (v === 'INDEX') return 'cell-warn'
    if (v === 'ALL') return 'cell-bad'
  }

  // ------- rows -------
  if (prop === 'rows') {
    const n = Number(str)
    if (!Number.isFinite(n)) return ''
    if (n <= 100) return 'cell-good'
    if (n <= 5000) return 'cell-warn'
    return 'cell-bad'
  }

  // ------- filtered -------
  if (prop === 'filtered') {
    let n: number
    if (typeof value === 'number') n = value
    else {
      const s = str.replace('%', '').trim()
      n = Number(s)
    }
    if (!Number.isFinite(n)) return ''
    if (n >= 80) return 'cell-good'
    if (n >= 30) return 'cell-warn'
    return 'cell-bad'
  }

  // ------- Extra -------
  if (prop === 'Extra') {
    const upper = str.toUpperCase()
    if (upper.includes('USING TEMPORARY') || upper.includes('USING FILESORT') || upper.includes('IMPOSSIBLE WHERE') || upper.includes('FULL SCAN')) return 'cell-bad'
    if (upper.includes('USING INDEX')) return 'cell-good'
    if (upper.includes('USING WHERE') || upper.includes('BACKWARD SCAN')) return 'cell-warn'
    // 其他中性内容不染色
    return ''
  }

  // ------- key / possible_keys -------
  if (prop === 'key') {
    if (!str) {
      // 没有用到索引
      const pk = row['possible_keys']
      if (pk && String(pk).trim()) return 'cell-bad' // 有可选索引但未使用
      return 'cell-warn'
    }
    return 'cell-good'
  }
  if (prop === 'possible_keys') {
    if (!str) return 'cell-warn'
    return 'cell-good'
  }

  // ------- select_type -------
  if (prop === 'select_type') {
    const v = str.trim().toUpperCase()
    if (v === 'SIMPLE' || v === 'PRIMARY') return ''
    if (v.includes('UNION') || v.includes('DERIVED')) return 'cell-warn'
    if (v.includes('DEPENDENT SUBQUERY')) return 'cell-bad'
    return ''
  }

  // 其他列默认不染色
  return ''
}

onMounted(() => {
  if (props.selectedDatabase) {
    currentDatabase.value = props.selectedDatabase
  }

  if (editorContainer.value) {
    editor = monaco.editor.create(editorContainer.value, {
      value: props.modelValue,
      language: 'sql',
      theme: 'vs',
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      automaticLayout: true,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      folding: true,
      tabSize: 2,
    })

    editor.onDidChangeModelContent(() => {
      emit('update:modelValue', editor?.getValue() || '')
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute()
    })
  }
})

onBeforeUnmount(() => {
  editor?.dispose()
})

watch(() => props.modelValue, (newVal) => {
  if (editor && editor.getValue() !== newVal) {
    editor.setValue(newVal)
  }
})

watch(() => props.selectedDatabase, (newDb) => {
  if (newDb && currentDatabase.value !== newDb) {
    currentDatabase.value = newDb
  }
})

function handleExecute() {
  const sql = editor?.getValue()?.trim()
  if (sql) {
    emit('execute', sql)
  }
}

function handleFormat() {
  if (editor) {
    const sql = editor.getValue()
    editor.setValue(formatSql(sql))
  }
}

async function handleExplain() {
  if (!editor) return
  const original = editor.getValue()
  const sql = original.trim()
  if (!sql) {
    ElMessage.warning('请先输入 SQL')
    return
  }
  explaining.value = true
  startExplainAnimation()
  try {
    const res = await aiApi.explainSql({ sql })
    const explanation = (res?.data?.explanation || '').trim()
    if (!explanation) {
      ElMessage.warning('未生成解释内容')
      return
    }
    const lineBreak = original.includes('\r\n') ? '\r\n' : '\n'
    const commentLine = `-- ${explanation}`
    const firstLineMatch = original.match(/^\s*--[^\r\n]*[\r\n]+/)
    const newContent = firstLineMatch
      ? commentLine + lineBreak + original.slice(firstLineMatch[0].length)
      : commentLine + lineBreak + original
    editor.setValue(newContent)
    ElMessage.success('已在 SQL 首行添加解释注释')
  } catch (e: any) {
    ElMessage.error(e?.message || 'SQL 解释失败')
  } finally {
    explaining.value = false
    stopExplainAnimation()
  }
}

function handleClear() {
  if (editor) {
    editor.setValue('')
  }
}

function handleDatabaseChange(db: string) {
  emit('database-change', db)
}

function setSql(sql: string) {
  if (editor) {
    editor.setValue(sql)
  }
}

async function handleAnalyze() {
  const sql = editor?.getValue()?.trim()
  if (!sql) {
    ElMessage.warning('请先输入 SQL')
    return
  }
  if (!props.connectionId) {
    ElMessage.warning('请先选择数据库连接')
    return
  }
  if (!currentDatabase.value) {
    ElMessage.warning('请先选择数据库')
    return
  }

  analyzeResult.value = null
  explainCollapseState.value = ['explain']
  analyzeDialogVisible.value = true
  analyzing.value = true
  startLoadingAnimation()
  try {
    const res = await aiApi.analyzeSql({
      connectionId: props.connectionId,
      database: currentDatabase.value,
      sql,
    })
    analyzeResult.value = res.data
  } catch (e: any) {
    ElMessage.error(e?.message || 'SQL 性能分析失败')
    analyzeDialogVisible.value = false
  } finally {
    // 完成后把进度填到 100%，短暂停一下再隐藏 loading
    loadingProgress.value = 100
    loadingStepIdx.value = LOADING_STEPS.length - 1
    setTimeout(() => {
      analyzing.value = false
      stopLoadingAnimation()
    }, 250)
  }
}

defineExpose({ setSql })
</script>

<style scoped lang="scss">
.editor-area {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .editor-toolbar {
    padding: 8px 12px;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .editor-content {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
  }
}

.analyze-body {
  min-height: 260px;
}

.history-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.history-sql {
  font-family: Consolas, 'Microsoft YaHei', monospace;
  font-size: 12.5px;
  color: #303133;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-detail-pre {
  background: #f7f8fa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px 12px;
  font-family: Consolas, 'Microsoft YaHei', monospace;
  font-size: 12.5px;
  color: #303133;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* ---------- 动态 Loading ---------- */
.analyze-loading {
  padding: 36px 16px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  .loading-ring {
    position: relative;
    width: 96px;
    height: 96px;
    margin-bottom: 4px;

    .dot {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 10px;
      height: 10px;
      margin: -5px 0 0 -5px;
      border-radius: 50%;
      background: #409eff;
      opacity: 0.2;
      transform-origin: center center;
      animation: loading-pulse 1.2s linear infinite;
    }

    .d1 { transform: rotate(0deg) translate(42px); animation-delay: 0s; background: #409eff; }
    .d2 { transform: rotate(45deg) translate(42px); animation-delay: 0.15s; background: #409eff; }
    .d3 { transform: rotate(90deg) translate(42px); animation-delay: 0.3s; background: #67c23a; }
    .d4 { transform: rotate(135deg) translate(42px); animation-delay: 0.45s; background: #67c23a; }
    .d5 { transform: rotate(180deg) translate(42px); animation-delay: 0.6s; background: #e6a23c; }
    .d6 { transform: rotate(225deg) translate(42px); animation-delay: 0.75s; background: #e6a23c; }
    .d7 { transform: rotate(270deg) translate(42px); animation-delay: 0.9s; background: #f56c6c; }
    .d8 { transform: rotate(315deg) translate(42px); animation-delay: 1.05s; background: #f56c6c; }

    &::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 56px;
      height: 56px;
      margin: -28px 0 0 -28px;
      border: 4px solid transparent;
      border-top-color: #409eff;
      border-right-color: #67c23a;
      border-radius: 50%;
      animation: loading-spin 1.1s linear infinite;
    }
  }

  .loading-step {
    font-size: 15px;
    font-weight: 500;
    color: #303133;
    min-height: 22px;
    font-family: Consolas, 'Microsoft YaHei', '微软雅黑', monospace;
  }

  .step-dots {
    display: inline-block;
    min-width: 18px;
    text-align: left;
    color: #606266;
  }

  .loading-progress {
    width: 280px;
    height: 8px;
    background: #ebeef5;
    border-radius: 999px;
    overflow: hidden;

    .loading-progress-bar {
      height: 100%;
      width: 0;
      background: linear-gradient(90deg, #409eff, #67c23a, #e6a23c);
      background-size: 300% 100%;
      border-radius: 999px;
      transition: width 0.25s ease-out;
      animation: progress-flow 2.2s linear infinite;
    }
  }

  .loading-progress-text {
    font-size: 12px;
    color: #909399;
    font-family: Consolas, 'Microsoft YaHei', '微软雅黑', monospace;
  }

  .loading-hint {
    margin-top: 4px;
    font-size: 12px;
    color: #c0c4cc;
    font-family: Consolas, 'Microsoft YaHei', '微软雅黑', monospace;
  }
}

@keyframes loading-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes loading-pulse {
  0%, 100% { opacity: 0.25; transform-origin: center; }
  50% { opacity: 1; }
}

@keyframes progress-flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

.analyze-block {
  margin-bottom: 12px;

  .analyze-label {
    font-weight: 600;
    color: #303133;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 8px;

    .analyze-tag {
      font-weight: normal;
    }
  }

  .analyze-text {
    margin: 0;
    padding: 12px 14px;
    background: #f7f8fa;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    font-family: Consolas, 'Microsoft YaHei', '微软雅黑', Menlo, Monaco, 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.8;
    color: #303133;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;

    /* hljs 代码块：保持浅色背景，只做语法关键字/字符串等染色 */
    pre.hljs {
      background: #ffffff;
      border: 1px solid #ebeef5;
      border-radius: 6px;
      padding: 10px 12px;
      margin: 6px 0;
      color: #24292f;
      font-family: Consolas, 'Microsoft YaHei', '微软雅黑', Menlo, Monaco, 'Courier New', monospace;
      font-size: 12.5px;
      line-height: 1.7;
      overflow-x: auto;
      white-space: pre;
    }

    code.hljs {
      background: transparent;
      padding: 0;
    }

    .inline-sql-fragment {
      background: #eef5ff;
      color: #0969da;
      padding: 1px 6px;
      border-radius: 4px;
      font-family: Consolas, 'Microsoft YaHei', monospace;
      margin: 0 2px;
    }

    /* 关键字/字符串/数字等常见 hljs 语法颜色（与浅色背景兼容） */
    :deep(.hljs-keyword),
    :deep(.hljs-selector-tag),
    :deep(.hljs-literal) {
      color: #cf222e;
      font-weight: 600;
    }
    :deep(.hljs-string),
    :deep(.hljs-quote) {
      color: #0a3069;
    }
    :deep(.hljs-number),
    :deep(.hljs-symbol) {
      color: #0550ae;
    }
    :deep(.hljs-title),
    :deep(.hljs-section),
    :deep(.hljs-selector-id) {
      color: #6639ba;
    }
    :deep(.hljs-attr),
    :deep(.hljs-variable),
    :deep(.hljs-template-variable),
    :deep(.hljs-class .hljs-title) {
      color: #953800;
    }
    :deep(.hljs-built_in),
    :deep(.hljs-type) {
      color: #8250df;
    }
    :deep(.hljs-comment),
    :deep(.hljs-quote) {
      color: #6e7781;
      font-style: italic;
    }
    :deep(.hljs-meta),
    :deep(.hljs-meta-keyword),
    :deep(.hljs-meta-string) {
      color: #b7791f;
    }
    :deep(.hljs-tag) {
      color: #116329;
    }

    .analyze-line {
      display: block;
    }
  }
}

.analyze-collapse-wrap {
  margin-top: 4px;
}

.analyze-collapse {
  margin-top: 0;
}

.explain-legend {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: #606266;

  .legend-item {
    padding: 2px 8px;
    border-radius: 999px;
    font-family: Consolas, 'Microsoft YaHei', '微软雅黑', monospace;
    font-size: 11px;
    line-height: 1.6;

    &.legend-good {
      background: #f0f9eb;
      color: #67c23a;
    }
    &.legend-warn {
      background: #fdf6ec;
      color: #e6a23c;
    }
    &.legend-bad {
      background: #fef0f0;
      color: #f56c6c;
    }
  }
}

/* el-table cell 染色（需穿透 scoped 才能作用到内部 td） */
:deep(.cell-good) {
  background: #f0f9eb !important;
  color: #67c23a;
  font-weight: 600;
}
:deep(.cell-warn) {
  background: #fdf6ec !important;
  color: #e6a23c;
  font-weight: 600;
}
:deep(.cell-bad) {
  background: #fef0f0 !important;
  color: #f56c6c;
  font-weight: 600;
}

.explain-cell-value {
  display: inline-block;
  min-height: 18px;
  cursor: help;
}

.analyze-empty {
  text-align: center;
  color: #909399;
  padding: 24px 0;
}
</style>
