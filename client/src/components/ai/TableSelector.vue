<template>
  <div class="table-selector">
    <template v-if="tables.length > 0">
      <el-tag
        v-for="table in tables"
        :key="table"
        closable
        class="table-tag"
        type="primary"
        @close="emit('remove', table)"
      >
        {{ table }}
      </el-tag>
    </template>
    <span v-else class="placeholder">在左侧树中勾选表自动关联</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tables: string[]
}>()

const emit = defineEmits<{
  'remove': [table: string]
}>()
</script>

<style scoped lang="scss">
.table-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 36px;
  padding: 8px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  background: #fff;

  .table-tag {
    cursor: default;
  }

  .placeholder {
    color: #c0c4cc;
    font-size: 13px;
    line-height: 24px;
  }
}
</style>
