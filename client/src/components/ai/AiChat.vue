<template>
  <div class="ai-panel">
    <div class="ai-panel-header">
      <el-icon><ChatDotRound /></el-icon>
      AI SQL 助手
    </div>
    <div class="ai-panel-body">
      <!-- 已选表 -->
      <div style="margin-bottom: 12px">
        <div style="font-size: 13px; color: #606266; margin-bottom: 6px">
          关联表:
          <span v-if="selectedTables.length > 0" style="color: #909399; font-size: 12px">
            (在左侧树中勾选表自动关联)
          </span>
        </div>
        <TableSelector
          :tables="selectedTables.map(t => t.table)"
          @remove="removeTable"
        />
      </div>

      <!-- AI 输出区域 -->
      <div v-if="generatedSql || generating" class="ai-output">
        <div v-if="generating && !generatedSql" style="color: #909399; font-size: 13px">
          <el-icon class="is-loading"><Loading /></el-icon>
          正在生成 SQL...
        </div>
        <div v-else class="ai-sql-output">
          <pre>{{ generatedSql }}</pre>
        </div>
        <el-button
          v-if="generatedSql && !generating"
          type="primary"
          size="small"
          style="margin-top: 8px; width: 100%"
          @click="handleUseSql"
        >
          使用此 SQL
        </el-button>
      </div>
    </div>
    <div class="ai-panel-footer">
      <el-input
        v-model="question"
        type="textarea"
        :autosize="{ minRows: 2, maxRows: 5 }"
        placeholder="输入自然语言描述，如：查询所有用户的订单数量"
        :disabled="generating"
        resize="none"
      />
      <el-button
        type="primary"
        :icon="Promotion"
        :loading="generating"
        style="margin-top: 8px; width: 100%"
        @click="handleGenerate"
      >
        生成 SQL
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ChatDotRound, Promotion, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import TableSelector from './TableSelector.vue'
import { useAiStore } from '@/stores/ai'
import { useConnectionStore } from '@/stores/connection'
import { useDatabaseStore } from '@/stores/database'
import { fetchSSE } from '@/utils/sse'
import { formatSql } from '@/utils/sql-formatter'

interface ISelectedTable {
  database: string
  table: string
}

const emit = defineEmits<{
  'use-sql': [sql: string]
}>()

const aiStore = useAiStore()
const connectionStore = useConnectionStore()
const databaseStore = useDatabaseStore()

// 组件挂载时加载 AI 配置
onMounted(() => {
  aiStore.fetchConfig()
})

const question = ref('')
const selectedTables = ref<ISelectedTable[]>([])
const generating = ref(false)
const generatedSql = ref('')
const rawSql = ref('') // 原始未格式化的 SQL
let abortController: AbortController | null = null

// 格式化后的 SQL 用于展示
const formattedSql = computed(() => {
  if (!rawSql.value) return ''
  return formatSql(rawSql.value)
})

// 由 Workspace 调用，自动同步左侧树勾选的表
function setCheckedTables(tables: ISelectedTable[]) {
  selectedTables.value = tables
}

function removeTable(tableName: string) {
  selectedTables.value = selectedTables.value.filter(t => t.table !== tableName)
}

async function handleGenerate() {
  if (!question.value.trim()) {
    ElMessage.warning('请输入自然语言描述')
    return
  }
  if (selectedTables.value.length === 0) {
    ElMessage.warning('请至少在左侧树中勾选一个表')
    return
  }
  if (!connectionStore.activeConnection) {
    ElMessage.warning('请先选择数据库连接')
    return
  }
  if (!aiStore.config.apiKey) {
    ElMessage.warning('请先配置 AI API Key')
    return
  }

  // 使用第一个选中表所在的数据库
  const database = selectedTables.value[0].database
  if (!database) {
    ElMessage.warning('请先选择数据库')
    return
  }

  generating.value = true
  generatedSql.value = ''
  rawSql.value = ''

  const tableNames = selectedTables.value.map(t => t.table)

  abortController = fetchSSE('/api/ai/generate', {
    connectionId: connectionStore.activeConnection.id,
    database,
    tables: tableNames,
    question: question.value,
  }, {
    onMessage: (data) => {
      if (data.type === 'thinking') {
        // 思考中
      } else if (data.type === 'sql') {
        rawSql.value += data.content
        generatedSql.value += data.content
      } else if (data.type === 'error') {
        ElMessage.error(data.content)
      } else if (data.type === 'done') {
        // 流式完成后格式化 SQL
        generatedSql.value = formatSql(rawSql.value)
        generating.value = false
      }
    },
    onError: (error) => {
      ElMessage.error(error.message)
      generating.value = false
    },
    onComplete: () => {
      generating.value = false
    },
  })
}

function handleUseSql() {
  if (generatedSql.value) {
    // 使用格式化后的 SQL
    emit('use-sql', generatedSql.value)
  }
}

defineExpose({ setCheckedTables })
</script>

<style scoped lang="scss">
.ai-panel {
  width: 380px;
  border-left: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: #fafafa;

  .ai-panel-header {
    padding: 12px 16px;
    border-bottom: 1px solid #e4e7ed;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ai-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .ai-panel-footer {
    padding: 12px;
    border-top: 1px solid #e4e7ed;
  }
}

.ai-output {
  margin-top: 12px;

  .ai-sql-output {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 12px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
