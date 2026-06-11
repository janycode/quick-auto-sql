<template>
  <div class="editor-area">
    <div class="editor-toolbar">
      <el-select
        v-model="currentDatabase"
        placeholder="选择数据库"
        size="small"
        style="width: 180px"
        @change="handleDatabaseChange"
      >
        <el-option
          v-for="db in databases"
          :key="db.name"
          :label="db.name"
          :value="db.name"
        />
      </el-select>
      <el-button type="primary" size="small" :icon="CaretRight" @click="handleExecute" :loading="executing">
        执行
      </el-button>
      <el-button size="small" :icon="MagicStick" @click="handleFormat">
        格式化
      </el-button>
      <div style="flex: 1" />
      <el-button size="small" text @click="handleClear">
        清空
      </el-button>
    </div>
    <div class="editor-content" ref="editorContainer"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { CaretRight, MagicStick, Delete } from '@element-plus/icons-vue'
import * as monaco from 'monaco-editor'
import { formatSql } from '@/utils/sql-formatter'
import type { IDatabase } from '@/api/database'

const props = defineProps<{
  modelValue: string
  databases: IDatabase[]
  executing?: boolean
  selectedDatabase?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'execute': [sql: string]
  'database-change': [database: string]
}>()

const editorContainer = ref<HTMLElement>()
const currentDatabase = ref('')
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  // 初始化数据库选择器
  if (props.selectedDatabase) {
    currentDatabase.value = props.selectedDatabase
  }
  
  if (editorContainer.value) {
    editor = monaco.editor.create(editorContainer.value, {
      value: props.modelValue,
      language: 'sql',
      theme: 'vs',
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      automaticLayout: true,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      folding: true,
      tabSize: 2,
    })

    editor.onDidChangeModelContent(() => {
      emit('update:modelValue', editor?.getValue() || '')
    })

    // Ctrl+Enter 执行
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute()
    })
  }
})

onBeforeUnmount(() => {
  editor?.dispose()
})

watch(() => props.modelValue, (newVal) => {
  if (editor && editor.getValue() !== newVal) {
    editor.setValue(newVal)
  }
})

// 监听外部传入的数据库，自动同步到选择器
watch(() => props.selectedDatabase, (newDb) => {
  if (newDb && currentDatabase.value !== newDb) {
    currentDatabase.value = newDb
  }
})

function handleExecute() {
  const sql = editor?.getValue()?.trim()
  if (sql) {
    emit('execute', sql)
  }
}

function handleFormat() {
  if (editor) {
    const sql = editor.getValue()
    editor.setValue(formatSql(sql))
  }
}

function handleClear() {
  if (editor) {
    editor.setValue('')
  }
}

function handleDatabaseChange(db: string) {
  emit('database-change', db)
}

function setSql(sql: string) {
  if (editor) {
    editor.setValue(sql)
  }
}

defineExpose({ setSql })
</script>

<style scoped lang="scss">
.editor-area {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .editor-toolbar {
    padding: 8px 12px;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .editor-content {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
  }
}
</style>
