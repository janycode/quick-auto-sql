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
      <el-button :icon="Plus" circle size="small" @click="$emit('add-connection')" />
    </div>
    <div class="sidebar-content">
      <DbTree
        v-if="activeConnectionId"
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
import { Plus } from '@element-plus/icons-vue'
import { useConnectionStore } from '@/stores/connection'
import DbTree from '@/components/database/DbTree.vue'

const emit = defineEmits<{
  'add-connection': []
  'select-table': [database: string, table: string]
  'checked-tables-change': [tables: { database: string; table: string }[]]
}>()

const connectionStore = useConnectionStore()
const connections = computed(() => connectionStore.connections)
const activeConnectionId = ref('')

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

function handleSelectTable(database: string, table: string) {
  emit('select-table', database, table)
}

function handleCheckedTablesChange(tables: { database: string; table: string }[]) {
  emit('checked-tables-change', tables)
}
</script>
