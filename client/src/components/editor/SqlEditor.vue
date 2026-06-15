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
      <el-button size="small" link type="primary" @click="handleOpenAnalysisHistory">
        <el-icon><Clock /></el-icon>
        <span>分析历史</span>
      </el-button>
      <div style="flex: 1" />
      <el-button size="small" link @click="handleClear">
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
                  >
                    <template #header="{ column }">
                      <el-tooltip
                        :content="headerTooltip(col as string)"
                        placement="top"
                        effect="light"
                        :disabled="!headerTooltip(col as string)"
                      >
                        <span class="explain-header">{{ column.label }}</span>
                      </el-tooltip>
                    </template>
                    <template #default="{ row }">
                      <el-tooltip
                        :content="cellTooltip(col, row[col])"
                        placement="top"
                        effect="light"
                        :disabled="!cellTooltip(col, row[col])"
                        popper-class="explain-tip"
                      >
                        <span class="explain-cell-value">{{ row[col] === null || row[col] === undefined ? '' : row[col] }}</span>
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
                <template #header="{ column }">
                  <el-tooltip
                    :content="headerTooltip(col as string)"
                    placement="top"
                    effect="light"
                    :disabled="!headerTooltip(col as string)"
                  >
                    <span class="explain-header">{{ column.label }}</span>
                  </el-tooltip>
                </template>
                <template #default="{ row }">
                  <el-tooltip
                    :content="cellTooltip(col, row[col])"
                    placement="top"
                    effect="light"
                    :disabled="!cellTooltip(col, row[col])"
                    popper-class="explain-tip"
                  >
                    <span class="explain-cell-value">{{ row[col] === null || row[col] === undefined ? '' : row[col] }}</span>
                  </el-tooltip>
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
import * as databaseApi from '@/api/database'
import type { IDatabase, IColumn } from '@/api/database'
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
  tableNames?: string[]
  columnsByTable?: Record<string, IColumn[]>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'execute': [sql: string]
  'database-change': [database: string]
}>()

const editorContainer = ref<HTMLElement>()
const currentDatabase = ref('')
let editor: monaco.editor.IStandaloneCodeEditor | null = null

// ============================================================
// SQL 编辑器增强：IntelliSense 补全 + 实时语法检查
// ============================================================

// 1. SQL 关键字 / 函数列表（用于补全 + 拼写检查）
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'IS', 'NULL',
  'AS', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA',
  'TRUNCATE', 'REPLACE', 'RENAME',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'ON', 'CROSS',
  'UNION', 'ALL', 'DISTINCT', 'DISTINCTROW',
  'EXISTS', 'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'WITH', 'RECURSIVE',
  'TRUE', 'FALSE',
  'ASC', 'DESC',
  'IF', 'IFNULL', 'NULLIF', 'COALESCE', 'CAST', 'CONVERT',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'FLOOR', 'CEIL', 'ABS',
  'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME', 'DATE', 'TIME',
  'CONCAT', 'SUBSTRING', 'LENGTH', 'LOWER', 'UPPER', 'TRIM', 'LTRIM', 'RTRIM',
  'REPLACE', 'LEFT', 'RIGHT', 'LPAD', 'RPAD', 'LOCATE', 'INSTR',
  'GROUP_CONCAT', 'JSON_EXTRACT', 'JSON_UNQUOTE',
  'EXPLAIN', 'DESCRIBE', 'DESC', 'SHOW', 'USE',
  'PRIMARY', 'KEY', 'UNIQUE', 'FOREIGN', 'REFERENCES', 'DEFAULT',
  'AUTO_INCREMENT', 'ENGINE', 'CHARSET', 'COLLATE', 'COMMENT',
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
  'VARCHAR', 'CHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
  'BOOLEAN', 'BOOL', 'BINARY', 'VARBINARY', 'BLOB', 'ENUM', 'SET', 'JSON',
]
const SQL_KEYWORD_SET = new Set(SQL_KEYWORDS.map((k) => k.toUpperCase()))

// 为补全缓存字段信息（表名 -> IColumn[]）
// 既接收上层传入的 columnsByTable，也在用户输入 `表名.` 时按需异步填充
const columnFetchPromises = new Map<string, Promise<IColumn[] | null>>()
function resolveTableColumns(tableName: string): IColumn[] {
  const byTable = props.columnsByTable
  if (byTable && byTable[tableName]) return byTable[tableName]
  return []
}
function getOrFetchColumns(tableName: string): Promise<IColumn[] | null> {
  const byTable = props.columnsByTable
  if (byTable && byTable[tableName]) return Promise.resolve(byTable[tableName])
  const cacheKey = `${props.connectionId || ''}::${currentDatabase.value || props.selectedDatabase || ''}::${tableName}`
  const hit = columnFetchPromises.get(cacheKey)
  if (hit) return hit
  if (!props.connectionId || !currentDatabase.value) return Promise.resolve(null)
  const p = databaseApi
    .getColumns(props.connectionId, currentDatabase.value, tableName)
    .then((r) => (r?.data || []) as IColumn[])
    .catch(() => null)
  columnFetchPromises.set(cacheKey, p)
  return p
}

// 从编辑器文本提取已出现的表名（简单解析：紧跟 FROM/JOIN 的标识符）
function extractReferencedTableNames(text: string): string[] {
  const names = new Set<string>()
  const re = /\b(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+([`"]?)([\w$]+)\1(?:\s+(?:AS\s+)?([`"]?)([\w$]+)\3)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m[2]) names.add(m[2])
    if (m[4]) names.add(m[4])
  }
  return Array.from(names)
}

// 构建 CompletionItem
function makeCompletionItem(
  label: string,
  kind: monaco.languages.CompletionItemKind,
  detail?: string,
  insertText?: string
): monaco.languages.CompletionItem {
  return {
    label,
    kind,
    detail,
    insertText: insertText || label,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    sortText: label,
  }
}

// 注册 SQL 补全提供者
let completionProvider: monaco.IDisposable | null = null
function registerCompletionProvider() {
  completionProvider = monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' ', '\n'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }
      const suggestions: monaco.languages.CompletionItem[] = []
      const textUntil = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })

      // --- 场景 1：输入 `表名.`，补全该表字段 ---
      const beforeWord = textUntil.slice(0, Math.max(0, textUntil.length - (word?.word?.length || 0)))
      const dotMatch = beforeWord.match(/([`"]?)([\w$]+)\1\.\s*$/)
      if (dotMatch) {
        const tableName = dotMatch[2]
        const cols = resolveTableColumns(tableName)
        for (const col of cols) {
          const item = makeCompletionItem(
            col.name,
            monaco.languages.CompletionItemKind.Field,
            `${col.type}${col.comment ? ` — ${col.comment}` : ''}`
          )
          item.range = range
          suggestions.push(item)
        }
        // 如果本地没这个表的字段信息，异步拉取后不阻塞当前返回，下次输入就会命中
        if (!cols.length) {
          getOrFetchColumns(tableName).then((freshCols) => {
            if (!freshCols || !freshCols.length) return
            // 下次 provider 被调用时会使用到缓存（通过 props.columnsByTable 填充给父组件，这里不需要手动触发刷新）
          })
        }
        if (suggestions.length) return { suggestions, incomplete: false }
      }

      // --- 场景 2：关键字补全 ---
      const kwPrefix = (word?.word || '').toUpperCase()
      for (const kw of SQL_KEYWORDS) {
        if (!kwPrefix || kw.startsWith(kwPrefix)) {
          const item = makeCompletionItem(kw, monaco.languages.CompletionItemKind.Keyword, 'SQL 关键字')
          item.range = range
          suggestions.push(item)
        }
      }

      // --- 场景 3：表名补全 ---
      const referencedTables = extractReferencedTableNames(model.getValue())
      const tableNames = new Set<string>(props.tableNames || [])
      for (const t of referencedTables) tableNames.add(t)
      for (const t of tableNames) {
        if (!kwPrefix || t.toUpperCase().startsWith(kwPrefix) || t.startsWith(word?.word || '')) {
          const item = makeCompletionItem(t, monaco.languages.CompletionItemKind.Struct, '表')
          item.range = range
          suggestions.push(item)
        }
      }

      // --- 场景 4：字段名补全（从本地已解析表和 props.columnsByTable 汇总）---
      const knownColumns = new Map<string, string>()
      const addCol = (name: string, meta: string) => {
        const prev = knownColumns.get(name)
        if (!prev || prev.length > meta.length) knownColumns.set(name, meta)
      }
      for (const t of tableNames) {
        const cols = resolveTableColumns(t)
        for (const c of cols) addCol(c.name, `${c.type} · ${t}${c.comment ? ` — ${c.comment}` : ''}`)
      }
      for (const [col, meta] of knownColumns) {
        if (!kwPrefix || col.toUpperCase().startsWith(kwPrefix) || col.startsWith(word?.word || '')) {
          const item = makeCompletionItem(col, monaco.languages.CompletionItemKind.Field, meta)
          item.range = range
          suggestions.push(item)
        }
      }

      return { suggestions, incomplete: false }
    },
  })
}

// ------------------------------------------------------------
// 轻量词法分析（用于 Monaco 的 Marker 红波浪线提示）
// 检查项：
//   - 未闭合的字符串/反引号
//   - 括号不匹配
//   - 疑似错误关键字拼写（编辑区内大写化校验）
//   - SELECT 语句缺失 FROM/WHERE 关键字的拼写（极简启发式）
// ------------------------------------------------------------
interface ISyntaxIssue {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  message: string
  severity: 'error' | 'warning'
}

function analyzeSqlSyntax(text: string): ISyntaxIssue[] {
  const issues: ISyntaxIssue[] = []
  if (!text) return issues

  const lines = text.split(/\r?\n/)
  let inSingleString = false
  let inDoubleString = false
  let inBacktick = false
  let inLineComment = false
  let inBlockComment = false
  let bracketDepth = 0
  let bracketOpenPos: { line: number; col: number } | null = null

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    inLineComment = false
    let i = 0
    while (i < line.length) {
      const ch = line[i]
      const next = line[i + 1]

      // 行注释 --
      if (!inSingleString && !inDoubleString && !inBacktick && !inBlockComment && ch === '-' && next === '-') {
        inLineComment = true
        break
      }
      // 块注释 /* */
      if (!inSingleString && !inDoubleString && !inBacktick && !inLineComment && ch === '/' && next === '*') {
        inBlockComment = true
        i += 2
        continue
      }
      if (inBlockComment && ch === '*' && next === '/') {
        inBlockComment = false
        i += 2
        continue
      }
      if (inBlockComment) {
        i++
        continue
      }

      // 字符串/反引号配对
      if (!inLineComment) {
        if (ch === "'" && !inDoubleString && !inBacktick) {
          if (inSingleString && next === "'") {
            i += 2 // 转义 ''
            continue
          }
          inSingleString = !inSingleString
          i++
          continue
        }
        if (ch === '"' && !inSingleString && !inBacktick) {
          inDoubleString = !inDoubleString
          i++
          continue
        }
        if (ch === '`' && !inSingleString && !inDoubleString) {
          inBacktick = !inBacktick
          i++
          continue
        }
        if (!inSingleString && !inDoubleString && !inBacktick) {
          if (ch === '(') {
            bracketDepth++
            if (!bracketOpenPos) bracketOpenPos = { line: lineIdx, col: i }
            i++
            continue
          }
          if (ch === ')') {
            if (bracketDepth === 0) {
              issues.push({
                startLineNumber: lineIdx + 1,
                startColumn: i + 1,
                endLineNumber: lineIdx + 1,
                endColumn: i + 2,
                message: '多余的右括号',
                severity: 'error',
              })
            } else {
              bracketDepth--
              if (bracketDepth === 0) bracketOpenPos = null
            }
            i++
            continue
          }
        }
      }

      i++
    }

    if (inSingleString) {
      issues.push({
        startLineNumber: lineIdx + 1,
        startColumn: 1,
        endLineNumber: lineIdx + 1,
        endColumn: line.length + 1,
        message: '未闭合的单引号字符串',
        severity: 'error',
      })
      inSingleString = false
    }
    if (inDoubleString) {
      issues.push({
        startLineNumber: lineIdx + 1,
        startColumn: 1,
        endLineNumber: lineIdx + 1,
        endColumn: line.length + 1,
        message: '未闭合的双引号字符串',
        severity: 'error',
      })
      inDoubleString = false
    }
  }

  if (inBacktick) {
    const last = lines.length
    issues.push({
      startLineNumber: last,
      startColumn: 1,
      endLineNumber: last,
      endColumn: (lines[last - 1]?.length || 1) + 1,
      message: '未闭合的反引号标识符',
      severity: 'error',
    })
  }
  if (inBlockComment) {
    const last = lines.length
    issues.push({
      startLineNumber: last,
      startColumn: 1,
      endLineNumber: last,
      endColumn: (lines[last - 1]?.length || 1) + 1,
      message: '未闭合的块注释 /* */',
      severity: 'error',
    })
  }
  if (bracketDepth > 0 && bracketOpenPos) {
    issues.push({
      startLineNumber: bracketOpenPos.line + 1,
      startColumn: bracketOpenPos.col + 1,
      endLineNumber: bracketOpenPos.line + 1,
      endColumn: bracketOpenPos.col + 2,
      message: `还有 ${bracketDepth} 个未闭合的左括号`,
      severity: 'error',
    })
  }

  // 关键字拼写错误（极简启发：取所有标识符，如与任一关键字的编辑距离=1 且本身不是关键字，则提示）
  const idRegex = /[A-Za-z_][A-Za-z_0-9]*/g
  const codeWithoutStrings = text.replace(/(?:--[^\n]*|\/\*[\s\S]*?\*\/|'[^']*'|"[^"]*"|`[^`]*`)/g, (m) => ' '.repeat(m.length))
  let idMatch: RegExpExecArray | null
  const checked = new Set<string>()
  while ((idMatch = idRegex.exec(codeWithoutStrings))) {
    const token = idMatch[0]
    if (token.length < 3) continue
    const upper = token.toUpperCase()
    if (SQL_KEYWORD_SET.has(upper)) continue
    if (checked.has(upper)) continue
    checked.add(upper)
    // 过滤看起来不像关键字的 token：全小写且长度<=3 基本不是关键字拼写（减少误报）
    const isAllUpper = token === token.toUpperCase()
    const firstLetterUpper = /^[A-Z]/.test(token)
    if (!isAllUpper && !firstLetterUpper && token.length <= 4) continue
    // 寻找最近的关键字
    let bestKw = ''
    let bestDist = Infinity
    for (const kw of SQL_KEYWORDS) {
      const d = levenshtein(upper, kw)
      if (d < bestDist) {
        bestDist = d
        bestKw = kw
      }
    }
    if (bestDist === 1) {
      // 计算 token 在第几行第几列
      const before = text.slice(0, idMatch.index)
      const lineNum = before.split('\n').length
      const lineStart = before.lastIndexOf('\n') + 1
      const col = idMatch.index - lineStart + 1
      issues.push({
        startLineNumber: lineNum,
        startColumn: col,
        endLineNumber: lineNum,
        endColumn: col + token.length,
        message: `疑似拼写错误："${token}"，是否想写 "${bestKw}"？`,
        severity: 'warning',
      })
    }
  }

  return issues
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = new Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = new Array(b.length + 1).fill(0)
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[b.length]
}

function applyMarkers(model: monaco.editor.ITextModel) {
  const issues = analyzeSqlSyntax(model.getValue())
  const markers: monaco.editor.IMarkerData[] = issues.map((it) => ({
    severity: it.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
    message: it.message,
    startLineNumber: it.startLineNumber,
    startColumn: it.startColumn,
    endLineNumber: it.endLineNumber,
    endColumn: it.endColumn,
  }))
  monaco.editor.setModelMarkers(model, 'sql-editor-enhanced', markers)
}

let markerDebounceTimer: ReturnType<typeof setTimeout> | null = null
function scheduleApplyMarkers(model: monaco.editor.ITextModel) {
  if (markerDebounceTimer) clearTimeout(markerDebounceTimer)
  markerDebounceTimer = setTimeout(() => {
    applyMarkers(model)
  }, 350)
}

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

// ======== AI SQL 分析：EXPLAIN 悬浮提示（简洁版）========
// 表头：只展示字段含义；单元格：只展示当前值的简短释义
// type 列：访问方式（性能从优到劣：system → const → eq_ref → ref → range → index → ALL）
const TYPE_TIPS: Record<string, string> = {
  system: '系统表，仅一行，最快，通常可忽略',
  const: '主键/唯一索引命中单行，等同于常量，极快',
  eq_ref: '唯一索引关联，外层每一行对应一行，性能优秀',
  ref: '非唯一索引扫描，返回匹配的多行，良好',
  fulltext: '全文索引扫描',
  ref_or_null: '类似 ref，额外查询 NULL 值的行',
  index_merge: '索引合并优化（同时使用多个索引）',
  unique_subquery: 'IN 子查询替换为唯一索引查找',
  index_subquery: 'IN 子查询替换为普通索引查找',
  range: '索引范围扫描（BETWEEN / > / < / IN）',
  index: '全索引扫描，比全表扫描快但仍有开销',
  all: '全表扫描，性能最差，强烈建议加索引',
};

// Extra 列常见取值的简短释义
const EXTRA_TIPS: Record<string, string> = {
  'Using where': 'WHERE 在读取行后过滤',
  'Using index': '覆盖索引，无需回表，性能好',
  'Using filesort': '需额外排序（不一定是文件排序）',
  'Using temporary': '使用临时表，常见 GROUP BY，性能差',
  'Impossible WHERE': 'WHERE 恒假，无结果返回',
  'Using join buffer': '使用连接缓存，建议加索引',
  'Using index condition': '索引条件下推（ICP）',
  'Using MRR': '多范围读取优化',
  'Backward index scan': '倒序扫描索引',
  'No tables used': '未访问任何表',
  'Select tables optimized away': '已通过索引/聚合跳过扫描',
  Distinct: '去重查询',
  'Full scan on NULL key': '子查询 NULL 键全扫描',
  'Range checked for each record': '每条外层记录都尝试范围查找',
  'Using sort_union': '索引合并 OR 组合',
  'Using union': '索引合并 UNION',
  'Using intersect': '索引合并 AND 组合',
};

// select_type 列
const SELECT_TYPE_TIPS: Record<string, string> = {
  SIMPLE: '简单 SELECT，无 UNION/子查询',
  PRIMARY: '最外层查询',
  UNION: 'UNION 中第二个及以后的 SELECT',
  'UNION RESULT': 'UNION 合并的结果集',
  SUBQUERY: '独立的子查询',
  DEPENDENT: '依赖外层查询的子查询',
  DEPENDENT_SUBQUERY: '依赖外层查询的子查询',
  'DEPENDENT UNION': 'UNION 中子查询依赖外层',
  DERIVED: '派生表/临时结果集',
  MATERIALIZED: '物化子查询',
  UNCACHEABLE: '不可缓存子查询',
  'UNCACHEABLE SUBQUERY': '结果不可缓存',
  'UNCACHEABLE UNION': 'UNION 中不可缓存子查询',
};

// 表头提示：字段级整体含义
const HEADER_TIPS: Record<string, string> = {
  id: '查询执行顺序标识，越大越先执行；相同从上到下',
  select_type: '查询类型（SIMPLE/PRIMARY/UNION/SUBQUERY/DERIVED/MATERIALIZED 等）',
  table: '当前访问的表/别名/派生表',
  partitions: '匹配的分区；未分区表为 NULL',
  type: '访问方式（system/const/eq_ref/ref/range/index/ALL，性能从好到差）',
  possible_keys: '可能用到的索引；为 NULL 代表无合适索引',
  key: '实际使用的索引；为 NULL 代表未走索引',
  key_len: '使用索引的字节数，越小越好；可反推用到联合索引前几列',
  ref: '与索引做等值比较的列或常量',
  rows: '估算需扫描的行数，越小越好',
  filtered: 'WHERE 过滤后剩余行的百分比（相对于 rows），越高越好',
  Extra: '执行时的附加信息（Using index/filesort/temporary 等）',
};

function headerTooltip(col: string): string {
  return HEADER_TIPS[col] || '';
}

function cellTooltip(col: string, value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value).trim();
  if (!str) return '';

  if (col === 'type') {
    const lower = str.toLowerCase();
    if (TYPE_TIPS[lower]) return TYPE_TIPS[lower];
    return '';
  }

  if (col === 'Extra') {
    const upper = str.toUpperCase();
    const matches = [];
    Object.keys(EXTRA_TIPS).forEach(function (k) {
      if (upper.indexOf(k.toUpperCase()) >= 0) matches.push(EXTRA_TIPS[k]);
    });
    return matches.join('；');
  }

  if (col === 'select_type') {
    const key = Object.keys(SELECT_TYPE_TIPS).find(function (k) {
      return str.toUpperCase().indexOf(k) >= 0;
    });
    if (key) return SELECT_TYPE_TIPS[key];
    return '';
  }

  if (col === 'rows') {
    const n = Number(str);
    if (!Number.isFinite(n)) return '';
    if (n >= 100000) return '扫描超过 10 万行，建议缩小范围或加索引';
    if (n >= 10000) return '扫描超过 1 万行，建议加索引';
    if (n >= 1000) return '千级扫描，可接受';
    return '扫描行数较少';
  }

  if (col === 'filtered') {
    const n = Number(str.replace('%', ''));
    if (!Number.isFinite(n)) return '';
    if (n < 10) return '过滤效率很差，WHERE 条件可能缺少索引';
    if (n < 30) return '过滤效率偏低，建议优化条件或索引';
    if (n < 70) return '过滤效率中等';
    return '过滤效率良好';
  }

  if (col === 'key') return '实际使用索引：' + str;
  if (col === 'possible_keys') return '候选索引：' + str;
  if (col === 'key_len') return '索引长度：' + str + ' 字节';
  if (col === 'ref') return '等值比较：' + str;
  if (col === 'table') return '访问表：' + str;
  if (col === 'id') return '查询顺序：' + str;
  if (col === 'partitions') return '匹配分区：' + str;

  return '';
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
      fontFamily: "'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace",
      fontLigatures: false,
      fontVariations: false,
      lineNumbers: 'on',
      automaticLayout: true,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      folding: true,
      tabSize: 2,
    })

    // --- 字体宽度测量修正 ---
    // JetBrains Mono 是按需/异步加载的（Google Fonts / 首次加载期间），
    // Monaco 在初始化时可能先测量到回退字体的字符宽度，
    // 字体真正加载完成后需要手动调用 remeasureFonts 让它重新测量，
    // 否则会出现"光标/选中位置落后 1~2 个字符"的视觉错位。
    function remeasureIfNeeded() {
      try {
        monaco.editor.remeasureFonts()
      } catch (e) {
        // 忽略 —— 老版本 Monaco 可能没有这个 API
      }
    }
    // 文档字体就绪后立即刷新一次
    if (typeof document !== 'undefined' && 'fonts' in document && document.fonts && typeof (document.fonts as any).ready?.then === 'function') {
      ;(document.fonts as any).ready.then(() => {
        remeasureIfNeeded()
        editor?.layout()
      }).catch(() => { /* ignore */ })
    }
    // 额外兜底：1 秒、3 秒后再各刷一次（覆盖字体中途切换、网络较慢等场景）
    const timers: number[] = []
    timers.push(window.setTimeout(remeasureIfNeeded, 1000))
    timers.push(window.setTimeout(remeasureIfNeeded, 3000))
    onBeforeUnmount(() => {
      timers.forEach((t) => window.clearTimeout(t))
    })

    // 注册 SQL 关键字/表/字段 IntelliSense 补全
    registerCompletionProvider()

    // 初次及内容变化后做语法检查，350ms 防抖
    const model = editor.getModel()
    if (model) {
      applyMarkers(model)
    }

    editor.onDidChangeModelContent(() => {
      emit('update:modelValue', editor?.getValue() || '')
      const m = editor?.getModel()
      if (m) scheduleApplyMarkers(m)
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute()
    })

    // 注册右键菜单项（同时出现在命令面板 F1）
    // 选中 SQL 时按选区操作，无选中时对整个编辑器内容操作
    editor.addAction({
      id: 'sql-execute',
      label: '执行 SQL',
      contextMenuGroupId: 'sql-actions',
      contextMenuOrder: 1,
      keybindings: [],
      run: () => handleExecute(),
    })
    editor.addAction({
      id: 'sql-format',
      label: '格式化 SQL',
      contextMenuGroupId: 'sql-actions',
      contextMenuOrder: 2,
      keybindings: [],
      run: () => handleFormat(),
    })
    editor.addAction({
      id: 'sql-explain',
      label: 'AI SQL 解释',
      contextMenuGroupId: 'sql-actions',
      contextMenuOrder: 3,
      keybindings: [],
      run: () => handleExplain(),
    })
    editor.addAction({
      id: 'sql-analyze',
      label: 'AI SQL 分析',
      contextMenuGroupId: 'sql-actions',
      contextMenuOrder: 4,
      keybindings: [],
      run: () => handleAnalyze(),
    })
  }
})

onBeforeUnmount(() => {
  if (editor) {
    const model = editor.getModel()
    if (model) monaco.editor.setModelMarkers(model, 'sql-editor-enhanced', [])
  }
  completionProvider?.dispose()
  if (markerDebounceTimer) clearTimeout(markerDebounceTimer)
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

// 获取"当前有效 SQL"：优先使用选中文本；无选中时回退到全部文本
function getActiveSql(): string | null {
  if (!editor) return null
  const selection = editor.getSelection()
  if (selection) {
    const selected = editor.getModel()?.getValueInRange(selection)?.trim()
    if (selected) return selected
  }
  return editor.getValue()?.trim() || null
}

function handleExecute() {
  const sql = getActiveSql()
  if (sql) {
    emit('execute', sql)
  }
}

function handleFormat() {
  if (!editor) return
  const model = editor.getModel()
  if (!model) return
  const selection = editor.getSelection()
  const selectedRange = selection && !selection.isEmpty() ? selection : null
  if (selectedRange) {
    const selected = model.getValueInRange(selectedRange)
    const formatted = formatSql(selected)
    editor.executeEdits('format-selection', [
      { range: selectedRange, text: formatted },
    ])
    // 重新选中格式化后的区域
    const lines = formatted.split(/\r?\n/)
    const newEndCol = lines[lines.length - 1].length + 1
    editor.setSelection({
      startLineNumber: selectedRange.startLineNumber,
      startColumn: 1,
      endLineNumber: selectedRange.startLineNumber + lines.length - 1,
      endColumn: newEndCol,
    })
  } else {
    const sql = editor.getValue()
    editor.setValue(formatSql(sql))
  }
}

async function handleExplain() {
  if (!editor) return
  const sql = getActiveSql()
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
    const lineBreak = sql.includes('\r\n') ? '\r\n' : '\n'
    const commentLine = `-- ${explanation}`
    // 如果作用在选中文本上，用 edit 在选区前插入一行解释；否则整体替换
    const model = editor.getModel()
    const selection = editor.getSelection()
    const hasSelection = selection && !selection.isEmpty()
    if (hasSelection && model) {
      const insertLine = selection!.startLineNumber
      const range: monaco.IRange = {
        startLineNumber: insertLine,
        startColumn: 1,
        endLineNumber: insertLine,
        endColumn: 1,
      }
      editor.executeEdits('explain-sql', [
        { range, text: commentLine + lineBreak },
      ])
    } else {
      const original = editor.getValue()
      const firstLineMatch = original.match(/^\s*--[^\r\n]*[\r\n]+/)
      const newContent = firstLineMatch
        ? commentLine + lineBreak + original.slice(firstLineMatch[0].length)
        : commentLine + lineBreak + original
      editor.setValue(newContent)
    }
    ElMessage.success('已添加首行解释')
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

// 去掉 SQL 顶部以 -- 开头的注释行（兼容行首空格、回车换行）
function stripLeadingCommentLines(sql: string): string {
  if (!sql) return sql
  const lines = sql.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (trimmed === '') {
      i++
      continue
    }
    if (trimmed.startsWith('--')) {
      i++
      continue
    }
    break
  }
  return lines.slice(i).join('\n').trim()
}

async function handleAnalyze() {
  const rawSql = getActiveSql()
  if (!rawSql) {
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

  const sql = stripLeadingCommentLines(rawSql)
  if (!sql) {
    ElMessage.warning('去掉注释后 SQL 为空，请重新输入')
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
    /* 禁用连字/合字/字距调整，保证字符宽度与列数严格对应，
       避免光标/选区/删除/粘贴错位
    */
    :deep(.monaco-editor),
    :deep(.monaco-editor-background),
    :deep(.monaco-mouse-cursor-text),
    :deep(.view-overlays),
    :deep(.view-lines),
    :deep(.margin),
    :deep(.view-line),
    :deep(.cursor-layer),
    :deep(.cursor) {
      font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace !important;
      font-variant-ligatures: none !important;
      font-feature-settings: "liga" 0, "calt" 0, "dlig" 0, "clig" 0 !important;
      font-kerning: none !important;
      letter-spacing: 0 !important;
      font-variation-settings: normal !important;
    }
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
  font-family: 'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace;
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
  font-family: 'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace;
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
    font-family: 'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace;
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
    font-family: 'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace;
  }

  .loading-hint {
    margin-top: 4px;
    font-size: 12px;
    color: #c0c4cc;
    font-family: 'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace;
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
    font-family: 'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace;
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
      font-family: 'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace;
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
      font-family: 'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace;
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
    font-family: 'JetBrains Mono', Consolas, Menlo, Monaco, 'Courier New', monospace;
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

.explain-header {
  cursor: help;
  font-weight: 600;
}

.analyze-empty {
  text-align: center;
  color: #909399;
  padding: 24px 0;
}
</style>
