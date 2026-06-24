<template>
  <div class="result-area" ref="resultAreaRef" :style="{ height: resultHeight + 'px' }">
    <div class="resize-handle" @mousedown.prevent="handleResizeStart">
      <div class="resize-icon">
        <div class="resize-dot"></div>
        <div class="resize-dot"></div>
        <div class="resize-dot"></div>
      </div>
    </div>

    <template v-if="result">
      <div class="result-toolbar">
        <span>查询结果: {{ result.rowCount }} 行</span>
        <span v-if="hasFilter">（筛选后 {{ sortedFilteredRows.length }} 行）</span>
        <span>耗时: {{ result.executionTime }}ms</span>
        <div style="flex: 1" />
        <el-input
          v-if="result.rows.length > 0"
          v-model="filterText"
          placeholder="筛选行..."
          size="small"
          clearable
          style="width: 180px"
          :prefix-icon="Search"
        />
        <el-button size="small" link @click="handleResizeReset">重置高度</el-button>
        <el-dropdown trigger="click" size="small">
          <el-button size="small" link>
            导出 <el-icon style="margin-left: 2px"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleExportXlsx">导出 .xlsx</el-dropdown-item>
              <el-dropdown-item @click="handleExportCsv">导出 .csv</el-dropdown-item>
              <el-dropdown-item @click="handleExportJson">导出 .json</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" :type="showComments ? 'primary' : 'default'" @click="toggleShowComments">
          列备注
        </el-button>
      </div>
      <div class="result-table-wrapper" v-show="ready">
        <el-table
          :key="`table-${showComments}`"
          :data="sortedFilteredRows"
          stripe
          border
          size="small"
          height="100%"
          @sort-change="handleSortChange"
        >
          <el-table-column
            type="index"
            label="#"
            width="50"
            align="center"
          />
          <el-table-column
            v-for="(col, colIndex) in result.columns"
            :key="`col-${col}-${showComments}`"
            :prop="col"
            :label="getColumnLabel(col)"
            :sortable="'custom'"
            :sort-orders="['ascending', 'descending', null]"
            width="130"
            show-overflow-tooltip
            :header-cell-class-name="getColumnComment(col) ? 'has-comment' : ''"
          >
            <template #header>
              <el-tooltip
                :content="showComments ? getColumnComment(col) : removeNewlines(col)"
                placement="top"
                :show-after="100"
                popper-class="column-comment-tooltip"
                effect="dark"
              >
                <span class="column-header-text" :class="{ 'first-col-header': colIndex === 0 }">{{ getColumnLabel(col) }}</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">
              <span :style="{ fontWeight: colIndex === 0 ? 600 : 'normal' }">
                {{ formatCellValue(row[col]) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <div v-else class="result-empty-inner">
      <el-empty description="执行 SQL 查询查看结果" :image-size="40" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Search, ArrowDown } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import type { IQueryResult } from '@/api/query'

declare const Buffer: any

const props = defineProps<{
  result: IQueryResult | null
}>()

const resultAreaRef = ref<HTMLElement>()
const resultHeight = ref(400)
const showComments = ref(false)
const ready = ref(false)
const filterText = ref('')
const sortColumn = ref('')
const sortDirection = ref<'ascending' | 'descending' | ''>('')
const DEFAULT_HEIGHT = 400
const MIN_HEIGHT = 120
const MAX_HEIGHT = 1200

const hasFilter = computed(() => {
  return !!filterText.value.trim() || !!sortColumn.value
})

const sortedFilteredRows = computed(() => {
  if (!props.result) return []
  let rows = [...props.result.rows]

  // 筛选
  const kw = filterText.value.trim().toLowerCase()
  if (kw) {
    rows = rows.filter(row => {
      return props.result!.columns.some(col => {
        const val = row[col]
        if (val === null || val === undefined) return false
        return String(val).toLowerCase().includes(kw)
      })
    })
  }

  // 排序
  if (sortColumn.value && sortDirection.value) {
    const col = sortColumn.value
    const dir = sortDirection.value === 'ascending' ? 1 : -1
    rows.sort((a, b) => {
      const va = a[col]
      const vb = b[col]
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb)) * dir
    })
  }

  return rows
})

function handleSortChange({ prop, order }: { prop: string | null; order: 'ascending' | 'descending' | null }) {
  sortColumn.value = prop || ''
  sortDirection.value = order || ''
}

function removeNewlines(str: string): string {
  return str.replace(/[\r\n]+/g, ' ').trim();
}

function getColumnLabel(col: string): string {
  if (showComments.value && props.result?.columnComments[col]) {
    const fullComment = removeNewlines(props.result.columnComments[col]);
    const enColon = fullComment.indexOf(':');
    const cnColon = fullComment.indexOf('\uff1a');
    const candidates = [enColon, cnColon].filter(i => i >= 0);
    const colonIndex = candidates.length > 0 ? Math.min(...candidates) : -1;
    if (colonIndex > 0) {
      return fullComment.substring(0, colonIndex).trim();
    }
    return fullComment;
  }
  return removeNewlines(col);
}

function getColumnComment(col: string): string {
  const comment = props.result?.columnComments[col];
  if (!comment) return '';
  return removeNewlines(comment);
}

function formatBufferBytes(buf: { toString: (encoding?: string) => string; length: number }): string {
  if (buf.length === 0) return '';
  if (buf.length === 1) {
    return buf.toString('utf-8').charCodeAt(0).toString();
  }
  const text = buf.toString('utf-8');
  if (!text.includes('\u0000') && /^[\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]*$/.test(text)) {
    return text;
  }
  const hex = buf.toString('hex');
  return hex.length > 64 ? hex.slice(0, 64) + '...' : hex;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  if (typeof Buffer !== 'undefined' && value instanceof Buffer) {
    return formatBufferBytes(value as any);
  }

  if (value && typeof value === 'object' && (value as any).type === 'Buffer' && Array.isArray((value as any).data)) {
    const bytes = (value as any).data as number[];
    if (bytes.length === 0) return '';
    if (typeof Buffer !== 'undefined') return formatBufferBytes(Buffer.from(bytes));
    if (bytes.length === 1) return bytes[0].toString();
    try {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
      if (!text.includes('\u0000') && /^[\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]*$/.test(text)) return text;
    } catch {}
    const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex.length > 64 ? hex.slice(0, 64) + '...' : hex;
  }

  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) { try { return JSON.stringify(value); } catch { return '[Array]'; } }
  if (typeof value === 'object') { try { return JSON.stringify(value); } catch { return '[Object]'; } }
  return removeNewlines(String(value));
}

function toggleShowComments() {
  showComments.value = !showComments.value
}

function handleResizeStart(e: MouseEvent) {
  if (!resultAreaRef.value) return
  const el = resultAreaRef.value
  const startY = e.clientY
  const startHeight = el.offsetHeight
  let currentHeight = startHeight

  const onMouseMove = (ev: MouseEvent) => {
    const delta = startY - ev.clientY
    const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + delta))
    if (newHeight !== currentHeight) {
      currentHeight = newHeight
      el.style.height = newHeight + 'px'
    }
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    resultHeight.value = currentHeight
    localStorage.setItem('queryResultHeight', String(currentHeight))
  }

  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function handleResizeReset() {
  resultHeight.value = DEFAULT_HEIGHT
  localStorage.setItem('queryResultHeight', String(DEFAULT_HEIGHT))
}

function downloadFile(content: string | ArrayBuffer | Blob, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function handleExportCsv() {
  if (!props.result || !props.result.rows.length) return

  const headers = props.result.columns.map(col => getColumnLabel(col));
  const rows = sortedFilteredRows.value.map(row =>
    props.result!.columns.map(col => {
      const val = formatCellValue(row[col]);
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(',')
  );
  const csv = [headers, ...rows].join('\n');
  downloadFile('\uFEFF' + csv, `query_result_${Date.now()}.csv`, 'text/csv;charset=utf-8;')
}

function handleExportJson() {
  if (!props.result || !props.result.rows.length) return

  const exportData = sortedFilteredRows.value.map(row => {
    const obj: Record<string, unknown> = {}
    for (const col of props.result!.columns) {
      obj[col] = row[col]
    }
    return obj
  })
  const json = JSON.stringify(exportData, null, 2)
  downloadFile(json, `query_result_${Date.now()}.json`, 'application/json;charset=utf-8;')
}

function handleExportXlsx() {
  if (!props.result || !props.result.rows.length) return

  const headers = props.result.columns.map(col => getColumnLabel(col));
  const rows = sortedFilteredRows.value.map(row =>
    props.result!.columns.map(col => formatCellValue(row[col]))
  );
  const aoa = [headers, ...rows];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Query Result');

  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadFile(wbout, `query_result_${Date.now()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

// 重置排序和筛选当结果变化时
watch(() => props.result, () => {
  filterText.value = ''
  sortColumn.value = ''
  sortDirection.value = ''
})

onMounted(() => {
  const savedHeight = localStorage.getItem('queryResultHeight')
  if (savedHeight) {
    const h = parseInt(savedHeight)
    if (resultAreaRef.value) {
      resultAreaRef.value.style.height = h + 'px'
    }
    resultHeight.value = h
  }
  ready.value = true
})

onUnmounted(() => {
  localStorage.setItem('queryResultHeight', String(resultHeight.value))
})
</script>

<style scoped lang="scss">
.result-area {
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  transition: none !important;
  animation: none !important;

  :deep(*) {
    transition: none !important;
    animation: none !important;
  }

  .resize-handle {
    height: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    cursor: ns-resize;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border-color);
    user-select: none;
    transition: none !important;
    animation: none !important;

    &:hover { background: #e6f7ff; }
    &:active { background: #409eff; }
    &:hover .resize-icon .resize-dot,
    &:active .resize-icon .resize-dot { background: #409eff; }

    .resize-icon {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: center;
      pointer-events: none;

      .resize-dot {
        width: 4px;
        height: 4px;
        background: var(--scrollbar-thumb);
        border-radius: 50%;
      }
    }
  }

  .result-toolbar {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .result-table-wrapper {
    flex: 1;
    min-height: 0;

    :deep(.el-table) {
      font-size: 11px;
    }

    :deep(.el-table__header) {
      font-weight: 600;
      min-height: 25px;
    }

    :deep(.el-table__header .el-table__cell) {
      min-height: 28px;
      white-space: nowrap;
      overflow: visible;
    }

    :deep(.el-table__header .cell) {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      line-height: normal;
      gap: 4px;
    }

    :deep(.el-table__row) {
      height: 24px;
    }

    :deep(.el-table__cell) {
      padding: 0 5px;
      font-size: 11px;
      white-space: nowrap;
    }

    :deep(.first-col-header) {
      font-weight: 700;
    }

    :deep(.el-table .cell.el-tooltip) {
      min-width: 110px;
    }

    :deep(.el-table--striped .el-table__row:nth-child(2n)) {
      background-color: var(--table-stripe);
    }

    :deep(.el-table__row:hover) {
      background-color: var(--table-hover) !important;
    }

    :deep(.caret-wrapper) {
      height: 10px !important;
      min-height: 0 !important;
      display: inline-flex !important;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin-left: auto;
      flex-shrink: 0;
      padding: 0 !important;
      border: none !important;
      background: transparent !important;
      box-sizing: content-box !important;
      line-height: 0;
      cursor: pointer;
      overflow: visible;
    }

    :deep(.sort-caret) {
      border-width: 3px;
    }

    :deep(.sort-caret.ascending) {
      margin-bottom: -2px;
    }

    :deep(.sort-caret.descending) {
      margin-top: -2px;
    }
  }

  .result-empty-inner {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :deep(.column-header-text) {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(th.has-comment .column-header-text) {
    cursor: help;
    border-bottom: 1px dashed #909399;
  }

  :deep(th.has-comment) {
    position: relative;
  }
}
</style>

<style lang="scss">
.column-comment-tooltip {
  max-width: 360px !important;
  white-space: normal !important;
  word-break: break-word !important;
  line-height: 1.5 !important;
  padding: 8px 12px !important;
  font-size: 12px !important;
}

.column-comment-tooltip .el-popper__arrow {
  display: none !important;
}
</style>
