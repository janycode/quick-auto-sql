<template>
  <div class="result-area" v-if="result" :style="{ height: resultHeight + 'px' }">
    <!-- 拖拽调整条 -->
    <div class="resize-handle" @mousedown.prevent="handleResizeStart">
      <div class="resize-indicator"></div>
    </div>
    <div class="result-toolbar">
      <span>查询结果: {{ result.rowCount }} 行</span>
      <span>耗时: {{ result.executionTime }}ms</span>
      <div style="flex: 1" />
      <el-button size="small" text @click="handleExport">导出 CSV</el-button>
    </div>
    <div class="result-table">
      <el-table
        :data="result.rows"
        stripe
        border
        size="small"
        height="100%"
      >
        <el-table-column
          v-for="col in result.columns"
          :key="col"
          :prop="col"
          :label="col"
          min-width="120"
          show-overflow-tooltip
        />
      </el-table>
    </div>
  </div>
  <div v-else class="result-empty">
    <el-empty description="执行 SQL 查询查看结果" :image-size="40" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IQueryResult } from '@/api/query'

const props = defineProps<{
  result: IQueryResult | null
}>()

const resultHeight = ref(300)
const MIN_HEIGHT = 120
const MAX_HEIGHT = 800

function handleResizeStart(e: MouseEvent) {
  const startY = e.clientY
  const startHeight = resultHeight.value

  const onMouseMove = (ev: MouseEvent) => {
    const delta = startY - ev.clientY
    const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + delta))
    resultHeight.value = newHeight
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function handleExport() {
  if (!props.result || !props.result.rows.length) return

  const headers = props.result.columns.join(',')
  const rows = props.result.rows.map(row =>
    props.result!.columns.map(col => {
      const val = String(row[col] ?? '')
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
    }).join(',')
  )
  const csv = [headers, ...rows].join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `query_result_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.result-area {
  border-top: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: relative;

  .resize-handle {
    height: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: ns-resize;
    flex-shrink: 0;
    background: #fafafa;
    border-bottom: 1px solid #e4e7ed;
    transition: background 0.2s;

    &:hover {
      background: #ecf5ff;
    }

    .resize-indicator {
      width: 40px;
      height: 3px;
      border-radius: 2px;
      background: #c0c4cc;
      transition: background 0.2s;
    }

    &:hover .resize-indicator {
      background: #409eff;
    }
  }

  .result-toolbar {
    padding: 8px 12px;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: #606266;
    flex-shrink: 0;
  }

  .result-table {
    flex: 1;
    overflow: hidden;
  }
}

.result-empty {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #e4e7ed;
  flex-shrink: 0;
}
</style>
