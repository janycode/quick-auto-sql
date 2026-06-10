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
        <span>耗时: {{ result.executionTime }}ms</span>
        <div style="flex: 1" />
        <el-button size="small" text @click="handleResizeReset">重置高度</el-button>
        <el-button size="small" text @click="handleExport">导出 CSV</el-button>
        <el-button size="small" :type="showComments ? 'primary' : 'default'" @click="toggleShowComments">
          列备注
        </el-button>
      </div>
      <div class="result-table-wrapper" v-show="ready">
        <el-table
          :key="`table-${showComments}`"
          :data="result.rows"
          stripe
          border
          size="small"
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
            width="130"
            show-overflow-tooltip
            :header-cell-class-name="getColumnComment(col) ? 'has-comment' : ''"
          >
            <template #header>
              <el-tooltip
                v-if="getColumnComment(col)"
                :content="getColumnComment(col)"
                placement="top"
                :show-after="100"
                popper-class="column-comment-tooltip"
                effect="dark"
              >
                <span class="column-header-text" :class="{ 'first-col-header': colIndex === 0 }">{{ getColumnLabel(col) }}</span>
              </el-tooltip>
              <span v-else class="column-header-text" :class="{ 'first-col-header': colIndex === 0 }">{{ getColumnLabel(col) }}</span>
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
import { ref, onMounted, onUnmounted } from 'vue'
import type { IQueryResult } from '@/api/query'

const props = defineProps<{
  result: IQueryResult | null
}>()

const resultAreaRef = ref<HTMLElement>()
const resultHeight = ref(400)
const showComments = ref(false)
const ready = ref(false)
const DEFAULT_HEIGHT = 400
const MIN_HEIGHT = 120
const MAX_HEIGHT = 1200

function removeNewlines(str: string): string {
  return str.replace(/[\r\n]+/g, ' ').trim();
}

function getColumnLabel(col: string): string {
  if (showComments.value && props.result?.columnComments[col]) {
    return removeNewlines(props.result.columnComments[col]);
  }
  return removeNewlines(col);
}

function getColumnComment(col: string): string {
  const comment = props.result?.columnComments[col];
  if (!comment) return '';
  return removeNewlines(comment);
}

/**
 * 格式化单元格值，支持各种 MySQL 字段类型
 * - null/undefined: 空字符串
 * - Date: YYYY-MM-DD HH:mm:ss
 * - Buffer: 尝试 UTF-8 解码，失败则显示 hex
 * - 对象/数组: JSON 序列化（压缩空白）
 * - BigInt: 转字符串
 * - 其他: String()
 */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Date 类型（MySQL 的 DATETIME/TIMESTAMP 在 mysql2 驱动中默认是 Date 对象）
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  // Buffer 类型（BLOB、BINARY、VARBINARY 等）
  if (typeof Buffer !== 'undefined' && value instanceof Buffer) {
    // 优先尝试 UTF-8 解码
    const text = value.toString('utf-8');
    // 如果是可打印字符（无 \0），当作字符串显示
    if (!text.includes('\u0000') && /^[\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]*$/.test(text)) {
      return text;
    }
    // 否则显示十六进制（限制长度避免过长）
    const hex = value.toString('hex');
    return hex.length > 64 ? hex.slice(0, 64) + '...' : hex;
  }

  // BigInt 类型
  if (typeof value === 'bigint') {
    return value.toString();
  }

  // 数组类型
  if (Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Array]';
    }
  }

  // 普通对象（MySQL JSON 字段、geometry 等）
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }

  return removeNewlines(String(value));
}

function toggleShowComments() {
  showComments.value = !showComments.value
}

/**
 * 拖动调整高度
 * 核心优化：拖动过程中直接操作 DOM 元素的 style.height，绕过 Vue 响应式，
 * 拖动结束后才同步到响应式变量和 localStorage，实现极致跟手体验
 */
function handleResizeStart(e: MouseEvent) {
  if (!resultAreaRef.value) return

  const el = resultAreaRef.value
  const startY = e.clientY
  const startHeight = el.offsetHeight // 使用实时 DOM 高度作为基准
  let currentHeight = startHeight

  // 拖动时直接写 DOM，零延迟
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
    // 拖动结束再同步到响应式变量
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

function handleExport() {
  if (!props.result || !props.result.rows.length) return

  const headers = props.result.columns.map(col => getColumnLabel(col));
  const rows = props.result.rows.map(row =>
    props.result!.columns.map(col => {
      const val = formatCellValue(row[col]);
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(',')
  );
  const csv = [headers, ...rows].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `query_result_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
  border-top: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  /* 移除所有过渡动画 */
  transition: none !important;
  animation: none !important;

  /* 强制覆盖 element-plus 表格内部动画 */
  :deep(*) {
    transition: none !important;
    animation: none !important;
  }

  .resize-handle {
    height: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
    cursor: ns-resize;
    flex-shrink: 0;
    border-bottom: 1px solid #e4e7ed;
    position: relative;
    user-select: none;
    /* 扩大可点击区域但保持小尺寸外观 */
    padding: 6px 0;
    box-sizing: content-box;
    background-clip: content-box;

    &:hover {
      background: #e6f7ff;
      background-clip: content-box;
    }

    &:active {
      background: #409eff;
      background-clip: content-box;
    }

    &:hover .resize-icon .resize-dot,
    &:active .resize-icon .resize-dot {
      background: #409eff;
    }

    .resize-icon {
      display: flex;
      gap: 5px;
      align-items: center;
      justify-content: center;
      pointer-events: none;

      .resize-dot {
        width: 4px;
        height: 4px;
        background: #c0c4cc;
        border-radius: 50%;
      }
    }

    /* 整条横线都可以拖动 */
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      cursor: ns-resize;
    }
  }

  .result-toolbar {
    padding: 8px 12px;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: #606266;
    flex-shrink: 0;
  }

  .result-table-wrapper {
    flex: 1;
    min-height: 0;
    overflow: auto;

    :deep(.el-table) {
      font-size: 11px;
      width: max-content;
      min-width: 100%;
    }

    :deep(.el-table__header) {
      font-weight: 600;
      min-height: 25px;
    }

    :deep(.el-table__header .el-table__cell) {
      min-height: 28px;
      white-space: nowrap;
    }

    :deep(.el-table__header .cell) {
      display: inline-block;
      vertical-align: middle;
      line-height: normal;
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
      background-color: #fafafa;
    }

    :deep(.el-table__row:hover) {
      background-color: #ecf5ff !important;
    }
  }

  .result-empty-inner {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* 列头文字样式 - 有注释时显示帮助光标 */
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
/* 字段注释 tooltip 样式 - 全局生效，因为 tooltip 是渲染到 body 的 */
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
