<template>
  <div class="app-sidebar">
    <div class="sidebar-header">
      <el-select
        v-model="activeConnectionId"
        placeholder="选择连接"
        style="width: 100%"
        @change="handleConnectionChange"
      >
        <el-option
          v-for="conn in connections"
          :key="conn.id"
          :label="conn.name"
          :value="conn.id"
        />
      </el-select>
      <el-button :icon="Refresh" circle size="small" @click="handleRefresh" title="刷新" />
      <el-button :icon="Plus" circle size="small" @click="$emit('add-connection')" title="添加连接" />
    </div>
    <div class="sidebar-content">
      <DbTree
        v-if="activeConnectionId"
        ref="dbTreeRef"
        :connection-id="activeConnectionId"
        @select-table="handleSelectTable"
        @checked-tables-change="handleCheckedTablesChange"
      />
      <el-empty v-else description="请先选择或创建连接" :image-size="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { useConnectionStore } from '@/stores/connection'
import DbTree from '@/components/database/DbTree.vue'

const emit = defineEmits<{
  'add-connection': []
  'select-table': [database: string, table: string]
  'checked-tables-change': [tables: { database: string; table: string; comment: string }[]]
}>()

const connectionStore = useConnectionStore()
const connections = computed(() => connectionStore.connections)
const activeConnectionId = ref('')
const dbTreeRef = ref()

// 监听 store 中的 activeConnection，同步到 select
watch(() => connectionStore.activeConnection, (conn) => {
  if (conn && activeConnectionId.value !== conn.id) {
    activeConnectionId.value = conn.id
  }
}, { immediate: true })

function handleConnectionChange(id: string) {
  const conn = connections.value.find(c => c.id === id)
  if (conn) connectionStore.setActiveConnection(conn)
}

function handleRefresh() {
  if (dbTreeRef.value?.refresh) {
    dbTreeRef.value.refresh()
  }
}

function handleSelectTable(database: string, table: string) {
  emit('select-table', database, table)
}

function handleCheckedTablesChange(tables: { database: string; table: string; comment: string }[]) {
  emit('checked-tables-change', tables)
}

defineExpose({
  clearCheckedTables: () => dbTreeRef.value?.clearChecked(),
})
</script>

<style scoped lang="scss">
.app-sidebar {
  width: 280px;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  background: #fff;

  .sidebar-header {
    padding: 8px;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.el-button--small.is-circle) {
      margin-left: 5px;
    }
  }

  .sidebar-content {
    flex: 1;
    overflow: auto;
    padding: 8px;
  }
}
</style>
