<template>
  <div class="db-tree">
    <el-tree
      ref="treeRef"
      :data="treeData"
      :props="treeProps"
      lazy
      :load="loadNode"
      node-key="key"
      :default-expanded-keys="expandedKeys"
      show-checkbox
      @check="handleCheck"
      @node-click="handleNodeClick"
    >
      <template #default="{ node, data }">
        <span class="tree-node">
          <el-icon v-if="data.type === 'database'" :size="14"><Coin /></el-icon>
          <el-icon v-else-if="data.type === 'table'" :size="14"><Grid /></el-icon>
          <el-icon v-else-if="data.type === 'column'" :size="14"><Key v-if="data.isPrimary" /><Document v-else /></el-icon>
          <span style="margin-left: 4px">{{ node.label }}</span>
          <span v-if="data.comment" class="tree-comment">{{ data.comment }}</span>
        </span>
      </template>
    </el-tree>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Coin, Grid, Key, Document } from '@element-plus/icons-vue'
import { useDatabaseStore } from '@/stores/database'
import * as databaseApi from '@/api/database'

const props = defineProps<{
  connectionId: string
}>()

const emit = defineEmits<{
  'select-table': [database: string, table: string]
  'checked-tables-change': [tables: { database: string; table: string }[]]
}>()

const databaseStore = useDatabaseStore()
const treeRef = ref()
const treeData = ref<any[]>([])
const expandedKeys = ref<string[]>([])

const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: 'isLeaf',
}

onMounted(async () => {
  await loadDatabases()
})

async function loadDatabases() {
  const res = await databaseApi.getDatabases(props.connectionId)
  const dbs = res.data || []
  treeData.value = dbs.map((db: any) => ({
    key: `db_${db.name}`,
    label: db.name,
    type: 'database',
    database: db.name,
    isLeaf: false,
  }))
}

async function loadNode(node: any, resolve: Function) {
  if (node.level === 0) {
    resolve(treeData.value)
    return
  }

  const data = node.data
  if (data.type === 'database') {
    // 加载表列表
    const res = await databaseApi.getTables(props.connectionId, data.database)
    const tables = res.data || []
    resolve(tables.map((t: any) => ({
      key: `table_${data.database}_${t.name}`,
      label: t.name + (t.comment ? ` (${t.comment})` : ''),
      type: 'table',
      database: data.database,
      table: t.name,
      comment: t.comment,
      isLeaf: false,
    })))
  } else if (data.type === 'table') {
    // 加载字段列表
    const res = await databaseApi.getColumns(props.connectionId, data.database, data.table)
    const cols = res.data || []
    resolve(cols.map((c: any) => ({
      key: `col_${data.database}_${data.table}_${c.name}`,
      label: `${c.name} (${c.type})`,
      type: 'column',
      database: data.database,
      table: data.table,
      isPrimary: c.isPrimary,
      comment: c.comment,
      isLeaf: true,
    })))
  } else {
    resolve([])
  }
}

function handleNodeClick(data: any) {
  if (data.type === 'table') {
    emit('select-table', data.database, data.table)
  }
}

function handleCheck() {
  const checkedNodes = treeRef.value?.getCheckedNodes() || []
  const tables = checkedNodes
    .filter((n: any) => n.type === 'table')
    .map((n: any) => ({ database: n.database, table: n.table }))
  emit('checked-tables-change', tables)
}

// 暴露方法供外部获取选中的表
defineExpose({
  getCheckedTables: () => {
    const checkedNodes = treeRef.value?.getCheckedNodes() || []
    return checkedNodes
      .filter((n: any) => n.type === 'table')
      .map((n: any) => ({ database: n.database, table: n.table }))
  },
})
</script>

<style scoped lang="scss">
.db-tree {
  :deep(.el-tree-node__content) {
    height: 28px;
  }

  .tree-node {
    display: flex;
    align-items: center;
    font-size: 13px;
    gap: 2px;
  }

  .tree-comment {
    color: #909399;
    font-size: 12px;
    margin-left: 4px;
  }
}
</style>
