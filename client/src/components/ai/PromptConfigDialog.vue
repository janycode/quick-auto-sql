<template>
  <el-dialog
    v-model="visible"
    title="提示词配置"
    width="820px"
    :close-on-click-modal="false"
    append-to-body
    @opened="onOpened"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
      title="提示词中可使用占位符：${schema}（表结构）、${question}（用户需求）；SQL性能分析使用 ${sql}、${explain}"
    />
    <el-tabs v-model="activeTab">
      <el-tab-pane label="SQL 生成提示词" name="generate_sql">
        <div class="prompt-meta">
          <span>最近更新：{{ formatTime(prompts?.generate_sql?.updatedAt) }}</span>
        </div>
        <el-input
          v-model="generateDraft"
          type="textarea"
          :autosize="{ minRows: 14, maxRows: 20 }"
          placeholder="SQL 生成提示词"
        />
        <div class="prompt-actions">
          <el-button size="small" @click="handleReset('generate_sql')">重置为默认</el-button>
          <el-button type="primary" size="small" :loading="saving.generate_sql" @click="handleSave('generate_sql')">
            保存
          </el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane label="SQL 性能分析提示词" name="analyze_sql">
        <div class="prompt-meta">
          <span>最近更新：{{ formatTime(prompts?.analyze_sql?.updatedAt) }}</span>
        </div>
        <el-input
          v-model="analyzeDraft"
          type="textarea"
          :autosize="{ minRows: 14, maxRows: 20 }"
          placeholder="SQL 性能分析提示词"
        />
        <div class="prompt-actions">
          <el-button size="small" @click="handleReset('analyze_sql')">重置为默认</el-button>
          <el-button type="primary" size="small" :loading="saving.analyze_sql" @click="handleSave('analyze_sql')">
            保存
          </el-button>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { useAiStore } from '@/stores/ai'
import type { PromptTemplateType } from '@/api/ai'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const aiStore = useAiStore()

const visible = ref(props.modelValue)
const activeTab = ref<PromptTemplateType>('generate_sql')

const generateDraft = ref('')
const analyzeDraft = ref('')
const saving = ref<Record<PromptTemplateType, boolean>>({ generate_sql: false, analyze_sql: false })

watch(
  () => props.modelValue,
  (val) => (visible.value = val)
)
watch(visible, (val) => emit('update:modelValue', val))

const prompts = ref<Record<PromptTemplateType, { prompt: string; updatedAt: string }> | null>(null)

async function onOpened() {
  try {
    const data = await aiStore.fetchPromptTemplates(true)
    if (data) {
      prompts.value = data as any
      generateDraft.value = data.generate_sql?.prompt || ''
      analyzeDraft.value = data.analyze_sql?.prompt || ''
    }
  } catch {
    ElMessage.error('加载提示词失败')
  }
}

function formatTime(t?: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'
}

async function handleSave(type: PromptTemplateType) {
  const draft = type === 'generate_sql' ? generateDraft.value : analyzeDraft.value
  if (!draft || !draft.trim()) {
    ElMessage.warning('提示词不能为空')
    return
  }
  try {
    saving.value[type] = true
    const updated = await aiStore.updatePromptTemplate(type, draft)
    if (updated && prompts.value) {
      prompts.value[type] = updated as any
    }
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value[type] = false
  }
}

async function handleReset(type: PromptTemplateType) {
  try {
    saving.value[type] = true
    const reset = await aiStore.resetPromptTemplate(type)
    if (reset && prompts.value) {
      prompts.value[type] = reset as any
      if (type === 'generate_sql') generateDraft.value = reset.prompt
      else analyzeDraft.value = reset.prompt
    }
    ElMessage.success('已重置为默认提示词')
  } catch {
    ElMessage.error('重置失败')
  } finally {
    saving.value[type] = false
  }
}
</script>

<style scoped lang="scss">
.prompt-meta {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}
.prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>
