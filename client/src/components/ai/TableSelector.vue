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
    </template>
    <span v-else class="placeholder">在左侧树中勾选表自动关联</span>
  </div>
</template>

<script setup lang="ts">
import { Close } from '@element-plus/icons-vue'

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

  .placeholder {
    color: #c0c4cc;
    font-size: 13px;
    line-height: 24px;
  }
}
</style>
