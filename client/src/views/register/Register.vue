<template>
  <div class="login-page">
    <div class="login-card" role="form" aria-label="注册">
      <div class="brand" role="button" tabindex="0" @click="router.push('/')" @keyup.enter.space.prevent="router.push('/')">
        <div class="logo" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="56" height="56">
            <defs>
              <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#5b8def" />
                <stop offset="100%" stop-color="#7b5bff" />
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#g2)" />
            <path
              d="M18 36c0-6 5-10 14-10s14 4 14 10-5 10-14 10"
              stroke="#fff"
              stroke-width="3"
              fill="none"
              stroke-linecap="round"
            />
            <circle cx="32" cy="26" r="3" fill="#fff" />
          </svg>
        </div>
        <div class="brand-text">
          <div class="title">Quick Auto SQL</div>
          <div class="subtitle">注册账号，开始使用智能 SQL 工作台</div>
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
        <el-form-item label="邮箱" prop="email">
          <el-input
            v-model="form.email"
            placeholder="请输入邮箱"
            clearable
            :prefix-icon="Message"
            autocomplete="email"
          />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-tooltip
            placement="top"
            content="至少 8 位，需包含英文字母和数字或特殊符号"
            :show-after="300"
          >
            <el-input
              v-model="form.password"
              type="password"
              placeholder="至少 8 位，字母 + 数字/符号"
              show-password
              :prefix-icon="Lock"
              autocomplete="new-password"
            />
          </el-tooltip>
        </el-form-item>

        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            show-password
            :prefix-icon="Lock"
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="邮箱验证码" prop="code">
          <div class="code-row">
            <el-input
              v-model="form.code"
              placeholder="6 位数字验证码"
              :prefix-icon="Key"
              maxlength="6"
              inputmode="numeric"
            />
            <el-button
              :disabled="codeSending || countdown > 0 || !isEmailValid"
              :loading="codeSending"
              class="code-btn"
              @click="onSendCode"
            >
              {{ countdown > 0 ? `${countdown}s 后重试` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>

        <el-alert
          v-if="previewUrl"
          title="邮件预览链接（测试账号模式）"
          type="info"
          :closable="false"
          show-icon
        >
          <template #default>
            验证码已真实发送，请点击下方链接在新窗口查看：
            <a :href="previewUrl" target="_blank" rel="noopener">{{ previewUrl }}</a>
          </template>
        </el-alert>

        <el-form-item>
          <el-button
            type="primary"
            class="submit-btn"
            :loading="loading"
            @click="onSubmit"
          >
            注 册
          </el-button>
        </el-form-item>
      </el-form>

      <div class="switch-row">
        已有账号？
        <el-link type="primary" :underline="false" @click="router.push('/login')">去登录</el-link>
      </div>

      <div class="footer">
        <span>&copy; {{ year }} Quick Auto SQL</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type FormItemRule } from 'element-plus'
import { Message, Lock, Key } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { sendEmailCode } from '@/api/auth'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const codeSending = ref(false)
const countdown = ref(0)
const previewUrl = ref<string | null>(null)
let countdownTimer: number | null = null

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
})

const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

const isEmailValid = computed(() => emailRegex.test(form.email.trim()))

const validatePassword: FormItemRule['validator'] = (_rule, value, callback) => {
  const v = value as string | undefined
  if (!v) return callback(new Error('请输入密码'))
  if (v.length < 8) return callback(new Error('密码长度至少 8 位'))
  if (v.length > 128) return callback(new Error('密码长度不能超过 128 位'))
  if (!/[A-Za-z]/.test(v)) return callback(new Error('密码必须包含英文字母'))
  if (!/[0-9]/.test(v) && !/[^A-Za-z0-9]/.test(v)) {
    return callback(new Error('密码必须包含至少一个数字或特殊符号'))
  }
  return callback()
}

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { pattern: emailRegex, message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [{ validator: validatePassword, trigger: 'blur' }],
  confirmPassword: [
    {
      validator: (_rule, value, callback) => {
        if (!value) return callback(new Error('请再次输入密码'))
        if (value !== form.password) return callback(new Error('两次输入的密码不一致'))
        return callback()
      },
      trigger: 'blur',
    },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
  ],
}

const year = computed(() => new Date().getFullYear())

function startCountdown(seconds = 60) {
  stopCountdown()
  countdown.value = seconds
  countdownTimer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      stopCountdown()
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
  countdown.value = 0
}

async function onSendCode() {
  if (!isEmailValid.value) {
    ElMessage.warning('请先输入正确的邮箱')
    return
  }
  codeSending.value = true
  previewUrl.value = null
  try {
    const result = await sendEmailCode({ email: form.email.trim() })

    // Ethereal 测试账号模式（SMTP_HOST=test）：展示预览链接，便于本地演示
    if (result?.data?.previewUrl) {
      previewUrl.value = result.data.previewUrl
      ElMessage.success('验证码已发送，请查看下方链接中的邮件获取验证码')
    } else {
      // 真实生产环境：邮件已发出
      ElMessage.success('验证码已发送，请注意查收邮件（可能在垃圾邮件文件夹）')
    }
    startCountdown(60)
  } catch (err: any) {
    console.warn('send code failed', err)
  } finally {
    codeSending.value = false
  }
}

async function onSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    await userStore.register({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      code: form.code.trim(),
    })
    ElMessage.success('注册成功，已为你登录')
    router.replace('/workspace')
  } catch (err: any) {
    console.warn('register failed', err)
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  stopCountdown()
})
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
  width: 440px;
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
  margin-bottom: 20px;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.85;
  }

  &:focus-visible {
    outline: 2px solid #5b8def;
    outline-offset: 4px;
    border-radius: 8px;
  }
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

.code-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.code-row :deep(.el-input) {
  flex: 1;
}

.code-btn {
  min-width: 130px;
  white-space: nowrap;
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
