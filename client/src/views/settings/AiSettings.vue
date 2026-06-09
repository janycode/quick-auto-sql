<template>
  <AppHeader>
    <div class="app-body" style="justify-content: center; align-items: center; background: #f5f7fa">
      <el-card style="width: 500px">
        <template #header>
          <div style="display: flex; align-items: center; gap: 8px">
            <el-icon><Setting /></el-icon>
            AI 配置
          </div>
        </template>
        <el-form :model="form" label-width="100px">
          <el-form-item label="API Key">
            <el-input
              v-model="form.apiKey"
              placeholder="输入 DeepSeek API Key"
            />
          </el-form-item>
          <el-form-item label="API URL">
            <el-input v-model="form.apiUrl" placeholder="API 地址" />
          </el-form-item>
          <el-form-item label="模型">
            <el-select v-model="form.model" style="width: 100%">
              <el-option label="deepseek-chat" value="deepseek-chat" />
              <el-option label="deepseek-coder" value="deepseek-coder" />
              <el-option label="deepseek-reasoner" value="deepseek-reasoner" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSave">保存配置</el-button>
            <el-button @click="handleTest">测试连接</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </AppHeader>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useAiStore } from '@/stores/ai'

const aiStore = useAiStore()

const form = ref({
  apiKey: '',
  apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  model: 'deepseek-chat',
})

onMounted(async () => {
  await aiStore.fetchConfig()
  form.value = {
    apiKey: aiStore.config.apiKey || '',
    apiUrl: aiStore.config.apiUrl || 'https://api.deepseek.com/v1/chat/completions',
    model: aiStore.config.model || 'deepseek-chat',
  }
})

async function handleSave() {
  await aiStore.saveConfig(form.value)
  ElMessage.success('配置保存成功')
}

async function handleTest() {
  if (!form.value.apiKey) {
    ElMessage.warning('请先输入 API Key')
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
        model: form.value.model,
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
</script>
