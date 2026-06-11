<template>
  <div class="table-selector">
    <template v-if="tables.length > 0">
      <div
        v-for="table in tables"
        :key="table.table"
        class="table-item"
      >
        <span class="table-name">{{ table.table }}</span>
        <span v-if="table.comment" class="table-comment">{{ table.comment }}</span>
        <el-icon class="remove-icon" @click="emit('remove', table.table)">
          <Close />
        </el-icon>
      </div>
      <div v-if="tables.length > 3" class="warning-list">
        <div class="warning-item">
          <el-icon><Warning /></el-icon>
          <span>阿里巴巴嵩山版规范【强制】超过三个表禁止 join！</span>
        </div>
        <div v-if="tables.length > 4" class="warning-item">
          <el-icon><Warning /></el-icon>
          <span>你真的确定要关联这么多表吗？表数据量确认过吗？</span>
        </div>
        <div v-if="tables.length > 5" class="warning-item">
          <el-icon><Warning /></el-icon>
          <span>除非报表等低并发场景或误操作，否则强烈不建议！！！</span>
        </div>
      </div>
    </template>
    <span v-else class="placeholder">在左侧树中勾选表自动关联</span>
  </div>
</template>

<script setup lang="ts">
import { Close, Warning } from '@element-plus/icons-vue'

defineProps<{
  tables: { table: string; comment: string }[]
}>()

const emit = defineEmits<{
  'remove': [table: string]
}>()
</script>

<style scoped lang="scss">
.table-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 36px;
  padding: 8px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  background: #fff;

  .table-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: #ecf5ff;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.5;
  }

  .table-name {
    color: #409eff;
    font-weight: 500;
    flex-shrink: 0;
  }

  .table-comment {
    color: #909399;
    font-size: 12px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-icon {
    color: #c0c4cc;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.2s;

    &:hover {
      color: #f56c6c;
    }
  }

  .warning-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
    padding-top: 6px;
    border-top: 1px dashed #f56c6c;
  }

  .warning-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    color: #f56c6c;
    font-size: 12px;
    line-height: 1.6;

    .el-icon {
      flex-shrink: 0;
      margin-top: 2px;
    }
  }

  .placeholder {
    color: #c0c4cc;
    font-size: 13px;
    line-height: 24px;
  }
}
</style>
