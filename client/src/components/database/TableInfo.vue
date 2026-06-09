<template>
  <div class="table-info">
    <el-descriptions :title="tableName" :column="1" border size="small">
      <el-descriptions-item v-for="col in columns" :key="col.name" :label="col.name">
        <el-tag :type="col.isPrimary ? 'danger' : 'info'" size="small" style="margin-right: 8px">
          {{ col.type }}
        </el-tag>
        <el-tag v-if="col.isPrimary" type="danger" size="small">主键</el-tag>
        <el-tag v-if="col.autoIncrement" size="small">自增</el-tag>
        <el-tag v-if="!col.nullable" type="warning" size="small">NOT NULL</el-tag>
        <span v-if="col.comment" style="margin-left: 8px; color: #909399">{{ col.comment }}</span>
      </el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup lang="ts">
import type { IColumn } from '@/api/database'

defineProps<{
  tableName: string
  columns: IColumn[]
}>()
</script>

<style scoped lang="scss">
.table-info {
  padding: 12px;
}
</style>
