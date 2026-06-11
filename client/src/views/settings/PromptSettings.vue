<template>
  <AppHeader>
    <div class="app-body">
      <el-card class="config-card">
        <template #header>
          <div class="card-header">
            <el-icon><Edit /></el-icon>
            <span>提示词配置</span>
          </div>
        </template>

        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 16px"
          :title="'提示词中可使用占位符：${schema}（表结构）、${question}（用户需求）；SQL性能分析使用 ${sql}、${explain}；SQL 解释使用 ${sql}'"
        />

        <el-tabs v-model="activeTab" class="prompt-tabs">
          <el-tab-pane label="SQL 生成提示词" name="generate_sql">
            <div class="prompt-meta">
              <span>最近更新：{{ formatTime(prompts?.generate_sql?.updatedAt) }}</span>
              <span>占位符：${schema}、${question}</span>
            </div>
            <el-input
              v-model="generateDraft"
              type="textarea"
              :autosize="{ minRows: 18, maxRows: 28 }"
              placeholder="请输入 SQL 生成提示词"
            />
            <div class="prompt-actions">
              <el-button size="small" :loading="resetting.generate_sql" @click="handleReset('generate_sql')">
                重置为默认
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="saving.generate_sql"
                :disabled="!generateDraft.trim()"
                @click="handleSave('generate_sql')"
              >
                保存
              </el-button>
            </div>
          </el-tab-pane>

          <el-tab-pane label="SQL 性能分析提示词" name="analyze_sql">
            <div class="prompt-meta">
              <span>最近更新：{{ formatTime(prompts?.analyze_sql?.updatedAt) }}</span>
              <span>占位符：${sql}、${explain}</span>
            </div>
            <el-input
              v-model="analyzeDraft"
              type="textarea"
              :autosize="{ minRows: 18, maxRows: 28 }"
              placeholder="请输入 SQL 性能分析提示词"
            />
            <div class="prompt-actions">
              <el-button size="small" :loading="resetting.analyze_sql" @click="handleReset('analyze_sql')">
                重置为默认
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="saving.analyze_sql"
                :disabled="!analyzeDraft.trim()"
                @click="handleSave('analyze_sql')"
              >
                保存
              </el-button>
            </div>
          </el-tab-pane>

          <el-tab-pane label="SQL 解释提示词" name="explain_sql">
            <div class="prompt-meta">
              <span>最近更新：{{ formatTime(prompts?.explain_sql?.updatedAt) }}</span>
              <span>占位符：${sql}</span>
            </div>
            <el-input
              v-model="explainDraft"
              type="textarea"
              :autosize="{ minRows: 18, maxRows: 28 }"
              placeholder="请输入 SQL 解释提示词"
            />
            <div class="prompt-actions">
              <el-button size="small" :loading="resetting.explain_sql" @click="handleReset('explain_sql')">
                重置为默认
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="saving.explain_sql"
                :disabled="!explainDraft.trim()"
                @click="handleSave('explain_sql')"
              >
                保存
              </el-button>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>
  </AppHeader>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Edit } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useAiStore } from '@/stores/ai'
import type { IPromptTemplate, PromptTemplateType } from '@/api/ai'

const aiStore = useAiStore()

const activeTab = ref<PromptTemplateType>('generate_sql')
const generateDraft = ref('')
const analyzeDraft = ref('')
const explainDraft = ref('')
const loading = ref(false)
const saving = ref<Record<PromptTemplateType, boolean>>({ generate_sql: false, analyze_sql: false, explain_sql: false })
const resetting = ref<Record<PromptTemplateType, boolean>>({ generate_sql: false, analyze_sql: false, explain_sql: false })

const prompts = computed(() => aiStore.promptTemplates as Record<PromptTemplateType, IPromptTemplate> | null)

async function loadPrompts(force = false) {
  loading.value = true
  try {
    const data = await aiStore.fetchPromptTemplates(force)
    if (data) {
      generateDraft.value = data.generate_sql?.prompt || ''
      analyzeDraft.value = data.analyze_sql?.prompt || ''
      explainDraft.value = data.explain_sql?.prompt || ''
    }
  } catch {
    ElMessage.error('加载提示词失败')
  } finally {
    loading.value = false
  }
}

function formatTime(t?: string) {
  return t ? dayjs(t).format('YYYY-MM-DD HH:mm:ss') : '-'
}

async function handleSave(type: PromptTemplateType) {
  let draft = ''
  if (type === 'generate_sql') draft = generateDraft.value
  else if (type === 'analyze_sql') draft = analyzeDraft.value
  else draft = explainDraft.value
  if (!draft || !draft.trim()) {
    ElMessage.warning('提示词不能为空')
    return
  }
  try {
    saving.value[type] = true
    await aiStore.updatePromptTemplate(type, draft)
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value[type] = false
  }
}

async function handleReset(type: PromptTemplateType) {
  try {
    resetting.value[type] = true
    const reset = await aiStore.resetPromptTemplate(type)
    if (reset) {
      if (type === 'generate_sql') generateDraft.value = reset.prompt
      else if (type === 'analyze_sql') analyzeDraft.value = reset.prompt
      else explainDraft.value = reset.prompt
    }
    ElMessage.success('已重置为默认提示词')
  } catch {
    ElMessage.error('重置失败')
  } finally {
    resetting.value[type] = false
  }
}

onMounted(() => loadPrompts(true))
</script>

<style scoped lang="scss">
.app-body {
  justify-content: center;
  align-items: flex-start;
  background: #f5f7fa;
  padding: 24px;
  overflow-y: auto;
}

.config-card {
  width: 820px;
  max-width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.prompt-tabs {
  :deep(.el-tabs__item) {
    font-size: 14px;
  }
}

.prompt-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #909399;
  margin-bottom: 10px;
}

.prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
