<template>
  <AppHeader>
    <div class="app-body">
      <el-card class="config-card">
        <template #header>
          <div class="card-header">
            <el-icon><Setting /></el-icon>
            <span>AI 配置</span>
          </div>
        </template>

        <!-- 顶部：AI 配置列表 -->
        <div class="list-section">
          <div class="section-title">已添加的 AI 配置（{{ configStore.configs.length }}）</div>
          <div v-if="configStore.configs.length === 0" class="empty-tip">
            暂无配置，请在下方添加
          </div>
          <div v-else class="config-list">
            <div
              v-for="item in configStore.configs"
              :key="item.id"
              class="config-item"
              :class="{ 'is-active': configStore.activeId === item.id }"
            >
              <div class="config-info">
                <div class="config-url">
                  <span class="model-tag">{{ item.model }}</span>
                  <span class="url-text" :title="item.apiUrl">{{ item.apiUrl }}</span>
                </div>
                <div class="config-key">
                  API Key: {{ maskApiKey(item.apiKey) }}
                </div>
              </div>
              <div class="config-actions">
                <el-tag
                  v-if="configStore.activeId === item.id"
                  type="success"
                  size="small"
                  effect="dark"
                >
                  使用中
                </el-tag>
                <el-button
                  v-else
                  type="primary"
                  size="small"
                  :loading="activatingId === item.id"
                  @click="handleActivate(item.id)"
                >
                  使用
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  link
                  :icon="Delete"
                  :loading="deletingId === item.id"
                  @click="handleDelete(item.id)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 底部：添加配置 -->
        <el-divider />
        <div class="form-section">
          <div class="section-title">添加新配置</div>
          <el-form :model="form" label-width="110px" class="add-form">

            <!-- 服务商 tag 选择器（含自定义） -->
            <el-form-item label="服务商" required>
              <div class="provider-tags">
                <el-tag
                  v-for="p in providers"
                  :key="p.name"
                  :type="selectedProvider === p.name ? 'primary' : 'info'"
                  :effect="selectedProvider === p.name ? 'dark' : 'plain'"
                  size="large"
                  class="provider-tag"
                  :round="selectedProvider !== p.name"
                  @click="handleSelectProvider(p.name)"
                >
                  {{ p.displayName }}
                </el-tag>
                <el-tag
                  :type="selectedProvider === 'custom' ? 'primary' : 'info'"
                  :effect="selectedProvider === 'custom' ? 'dark' : 'plain'"
                  size="large"
                  class="provider-tag"
                  :round="selectedProvider !== 'custom'"
                  @click="handleSelectProvider('custom')"
                >
                  + 自定义
                </el-tag>
              </div>
            </el-form-item>

            <!-- 自定义服务商时：显示名称输入 -->
            <el-form-item v-if="selectedProvider === 'custom'" label="服务商名称" required>
              <el-input
                v-model="form.providerName"
                placeholder="输入服务商名称，如：自定义推理服务"
                clearable
              />
            </el-form-item>

            <el-form-item label="API Key" required>
              <el-input
                v-model="form.apiKey"
                placeholder="输入 API Key"
                show-password
                clearable
                @blur="handleApiKeyBlur"
              />
            </el-form-item>

            <el-form-item label="API URL" required>
              <el-input
                v-model="form.apiUrl"
                placeholder="聊天补全接口 URL"
                clearable
              />
            </el-form-item>

            <!-- 获取模型URL：内置服务商只读展示；自定义服务商需填写 -->
            <el-form-item label="获取模型URL" required>
              <el-input
                v-model="form.modelsUrl"
                :placeholder="selectedProvider === 'custom' ? '模型列表接口 URL' : '请选择服务商'"
                :disabled="selectedProvider !== 'custom' && selectedProvider !== ''"
                clearable
              />
            </el-form-item>

            <!-- 模型（不带必填星号） -->
            <el-form-item label="模型">
              <el-select
                v-model="form.model"
                style="width: 100%"
                placeholder="选择或输入模型"
                filterable
                allow-create
                default-first-option
                clearable
                v-loading="modelsLoading"
              >
                <el-option
                  v-for="m in availableModels"
                  :key="m"
                  :label="m"
                  :value="m"
                />
              </el-select>
              <div v-if="modelsError" class="model-tip error">
                <el-icon><WarningFilled /></el-icon>
                <span>{{ modelsError }}</span>
              </div>
              <div v-else-if="availableModels.length && selectedProvider" class="model-tip ok">
                <el-icon><Check /></el-icon>
                <span>已从官方接口加载 {{ availableModels.length }} 个模型</span>
              </div>
              <div v-else class="model-tip hint">
                <el-icon><InfoFilled /></el-icon>
                <span>选择服务商并输入 API Key 后自动拉取，也可手动输入模型名</span>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="adding"
                :disabled="!canSubmit"
                @click="handleAdd"
              >
                添加配置
              </el-button>
              <el-button @click="handleTest">测试连接</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-card>
    </div>
  </AppHeader>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, WarningFilled, Check, InfoFilled } from '@element-plus/icons-vue'
import type { IAiProvider } from '@/api/ai'
import * as aiApi from '@/api/ai'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useAiStore } from '@/stores/ai'

const aiStore = useAiStore()
const { configStore } = storeToRefs(aiStore)

const activatingId = ref('')
const deletingId = ref('')
const adding = ref(false)

// 服务商列表
const providers = ref<IAiProvider[]>([])
const selectedProvider = ref('')

// 表单（注意：providerName 仅在自定义时使用）
const form = ref({
  apiKey: '',
  apiUrl: '',
  modelsUrl: '',
  model: '',
  providerName: '',
})

// 动态模型下拉
const availableModels = ref<string[]>([])
const modelsLoading = ref(false)
const modelsError = ref('')

// 是否允许提交：除模型外其他必填
const canSubmit = computed(() => {
  const base = !!(form.value.apiKey && form.value.apiUrl && form.value.model)
  const customOk = selectedProvider.value !== 'custom' || !!form.value.modelsUrl
  const providerNameOk = selectedProvider.value !== 'custom' || !!form.value.providerName.trim()
  return base && customOk && providerNameOk && !!selectedProvider.value
})

function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '*'.repeat(key.length)
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

// 选择服务商：切换时保留 API Key，自动填充 URL，若 Key 已存在则自动拉模型
function handleSelectProvider(name: string) {
  if (selectedProvider.value === name) return
  selectedProvider.value = name
  availableModels.value = []
  modelsError.value = ''

  if (name === 'custom') {
    form.value.apiUrl = ''
    form.value.modelsUrl = ''
    form.value.model = ''
    form.value.providerName = ''
  } else {
    const p = providers.value.find(x => x.name === name)
    if (p) {
      form.value.apiUrl = p.chatUrl
      form.value.modelsUrl = p.modelsUrl
      form.value.model = p.defaultModel
      form.value.providerName = p.displayName
    }
  }
  // 若已经填了 API Key，切换到新服务商后自动拉一次模型
  if (form.value.apiKey.trim()) {
    fetchModels()
  }
}

// API Key 失焦：若服务商已选且 Key 非空 → 拉模型
function handleApiKeyBlur() {
  if (!selectedProvider.value) return
  if (!form.value.apiKey.trim()) return
  fetchModels()
}

// 拉模型：内置服务商用 modelsUrl；自定义服务商用 form.modelsUrl
async function fetchModels() {
  modelsLoading.value = true
  modelsError.value = ''
  try {
    const isCustom = selectedProvider.value === 'custom'
    const modelsUrlArg = isCustom ? form.value.modelsUrl.trim() || undefined : undefined
    const res = await aiApi.fetchAiModels(
      selectedProvider.value,
      form.value.apiKey.trim(),
      modelsUrlArg
    )
    const models = (res.data || []) as string[]
    if (models.length === 0) {
      modelsError.value = '官方接口返回了空列表'
      return
    }
    availableModels.value = models
    // 默认选中第一个
    form.value.model = models[0]
  } catch (err: any) {
    modelsError.value = err.message || '拉取模型失败'
  } finally {
    modelsLoading.value = false
  }
}

// 激活配置
async function handleActivate(id: string) {
  activatingId.value = id
  try {
    await aiStore.activateConfig(id)
    ElMessage.success('已切换为该配置')
  } finally {
    activatingId.value = ''
  }
}

// 删除配置
async function handleDelete(id: string) {
  try {
    await ElMessageBox.confirm(
      '确定要删除该配置吗？',
      '提示',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  deletingId.value = id
  try {
    await aiStore.deleteConfig(id)
    ElMessage.success('配置已删除')
  } finally {
    deletingId.value = ''
  }
}

// 添加配置
async function handleAdd() {
  if (!canSubmit.value) {
    ElMessage.warning('请完整填写必填项')
    return
  }
  adding.value = true
  try {
    await aiStore.addConfig({
      apiKey: form.value.apiKey.trim(),
      apiUrl: form.value.apiUrl.trim(),
      model: form.value.model.trim(),
    })
    ElMessage.success('配置已添加')
    // 保留服务商选中状态，只清空 Key，方便连续添加
    form.value.apiKey = ''
  } finally {
    adding.value = false
  }
}

// 测试连接
async function handleTest() {
  if (!form.value.apiKey) {
    ElMessage.warning('请先输入 API Key')
    return
  }
  if (!form.value.apiUrl) {
    ElMessage.warning('请先输入 API URL')
    return
  }
  try {
    const response = await fetch(form.value.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${form.value.apiKey}`,
      },
      body: JSON.stringify({
        model: form.value.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      }),
    })
    if (response.ok) {
      ElMessage.success('AI API 连接成功')
    } else {
      const text = await response.text()
      ElMessage.error(`连接失败: ${response.status} ${text}`)
    }
  } catch (error: any) {
    ElMessage.error(`连接失败: ${error.message}`)
  }
}

onMounted(async () => {
  await aiStore.fetchConfigList()
  try {
    const res = await aiApi.getAiProviders()
    providers.value = (res.data || []) as IAiProvider[]
  } catch {
    ElMessage.error('加载服务商列表失败')
  }
})
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
  width: 720px;
  max-width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.list-section {
  min-height: 60px;
}

.empty-tip {
  padding: 24px;
  text-align: center;
  color: #909399;
  font-size: 13px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px dashed #dcdfe6;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.08);
  }

  &.is-active {
    background: #f0f9ff;
    border-color: #67c23a;
  }
}

.config-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.config-url {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.model-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.url-text {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.config-key {
  font-size: 12px;
  color: #909399;
  font-family: 'JetBrains Mono', Consolas, 'Monaco', monospace;
}

.config-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.provider-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .provider-tag {
    cursor: pointer;
    font-size: 14px;
    padding: 6px 14px;
    height: auto;
    transition: all 0.2s;
  }
}

.model-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-top: 6px;

  &.hint { color: #909399; }
  &.ok { color: #67c23a; }
  &.error { color: #f56c6c; }
}

.form-section {
  .add-form {
    margin-top: 8px;
  }
}
</style>
