<template>
  <div class="login-page">
    <div class="login-card" role="form" aria-label="登录">
      <div class="brand">
        <div class="logo" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="56" height="56">
            <defs>
              <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#5b8def" />
                <stop offset="100%" stop-color="#7b5bff" />
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#g1)" />
            <path d="M18 36c0-6 5-10 14-10s14 4 14 10-5 10-14 10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" />
            <circle cx="32" cy="26" r="3" fill="#fff" />
          </svg>
        </div>
        <div class="brand-text">
          <div class="title">Quick Auto SQL</div>
          <div class="subtitle">智能 SQL 生成与数据库管理工具</div>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        size="large"
        @keyup.enter="onSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            clearable
            :prefix-icon="User"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            :prefix-icon="Lock"
            autocomplete="current-password"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            class="submit-btn"
            :loading="loading"
            @click="onSubmit"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="switch-row">
        还没有账号？
        <el-link type="primary" :underline="false" @click="router.push('/register')">去注册</el-link>
      </div>

      <div class="footer">
        <span>&copy; {{ year }} Quick Auto SQL</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const year = computed(() => new Date().getFullYear())

async function onSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    await userStore.login({ username: form.username, password: form.password })
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/workspace'
    const safeRedirect = /^\/[A-Za-z0-9_\-\/]*$/.test(redirect) ? redirect : '/workspace'
    router.replace(safeRedirect)
  } catch (err: any) {
    // ElMessage 已经在 request 拦截器中处理过
    console.warn('login failed', err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.login-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 20% 20%, rgba(91, 141, 239, 0.18), transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(123, 91, 255, 0.2), transparent 50%),
    linear-gradient(135deg, #f5f7fb 0%, #eef1f7 100%);
}

.login-page::before,
.login-page::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.45;
  pointer-events: none;
}

.login-page::before {
  width: 420px;
  height: 420px;
  left: -120px;
  top: -80px;
  background: radial-gradient(circle, #5b8def, transparent 70%);
}

.login-page::after {
  width: 520px;
  height: 520px;
  right: -160px;
  bottom: -140px;
  background: radial-gradient(circle, #7b5bff, transparent 70%);
}

.login-card {
  position: relative;
  z-index: 2;
  width: 420px;
  max-width: 92vw;
  padding: 40px 40px 24px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow:
    0 20px 60px rgba(60, 80, 150, 0.18),
    0 4px 12px rgba(60, 80, 150, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
}

.logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(91, 141, 239, 0.35);
}

.title {
  font-size: 22px;
  font-weight: 600;
  color: #1f2a44;
  letter-spacing: 0.5px;
}

.subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #7a8599;
}

.tip-row {
  margin: -4px 0 8px;
  font-size: 12px;
  color: #9aa3b5;
  display: flex;
  justify-content: flex-end;
}

.hint {
  padding: 2px 8px;
  border-radius: 4px;
  background: #f4f6fb;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  letter-spacing: 4px;
}

.switch-row {
  margin-top: 8px;
  text-align: center;
  color: #6b7590;
  font-size: 13px;
}

.footer {
  margin-top: 16px;
  text-align: center;
  color: #a9b2c3;
  font-size: 12px;
}
</style>
