<template>
  <AppHeader>
    <div class="app-body">
      <el-card class="profile-card">
        <template #header>
          <div class="card-header">
            <el-icon><User /></el-icon>
            <span>个人中心</span>
          </div>
        </template>

        <div class="profile-section">
          <div class="avatar-section">
            <el-avatar :size="80" :src="avatarUrl">
              <el-icon :size="40"><User /></el-icon>
            </el-avatar>
            <div class="avatar-info">
              <div class="nickname-text">{{ displayName }}</div>
              <div class="role-tag">
                <el-tag :type="roleTagType" size="small">{{ roleLabel }}</el-tag>
              </div>
            </div>
          </div>

          <el-form
            ref="profileFormRef"
            :model="profileForm"
            :rules="profileRules"
            label-width="100px"
            class="profile-form"
          >
            <el-form-item label="账号邮箱">
              <el-input :value="profile?.email" disabled />
            </el-form-item>
            <el-form-item label="昵称" prop="nickname">
              <el-input
                v-model="profileForm.nickname"
                placeholder="请输入昵称"
                maxlength="50"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="个人简介" prop="bio">
              <el-input
                v-model="profileForm.bio"
                type="textarea"
                :rows="3"
                placeholder="介绍一下自己吧"
                maxlength="200"
                show-word-limit
                resize="none"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="savingProfile" @click="handleSaveProfile">
                保存资料
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-card>

      <el-card class="password-card">
        <template #header>
          <div class="card-header">
            <el-icon><Lock /></el-icon>
            <span>修改密码</span>
          </div>
        </template>

        <el-form
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordRules"
          label-width="100px"
          class="password-form"
        >
          <el-form-item label="原密码" prop="oldPassword">
            <el-input
              v-model="passwordForm.oldPassword"
              type="password"
              placeholder="请输入原密码"
              show-password
            />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input
              v-model="passwordForm.newPassword"
              type="password"
              placeholder="至少 8 位，包含字母和数字/符号"
              show-password
            />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input
              v-model="passwordForm.confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              show-password
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="changingPassword" @click="handleChangePassword">
              修改密码
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </AppHeader>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { getProfile, updateProfile, changePassword, type IUserProfile } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import AppHeader from '@/components/layout/AppHeader.vue'

const userStore = useUserStore()

const profile = ref<IUserProfile | null>(null)
const loading = ref(false)
const savingProfile = ref(false)
const changingPassword = ref(false)

const profileFormRef = ref<FormInstance>()
const passwordFormRef = ref<FormInstance>()

const profileForm = ref({
  nickname: '',
  bio: '',
})

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const displayName = computed(() => {
  if (profile.value?.nickname) return profile.value.nickname
  if (profile.value?.email) return profile.value.email.split('@')[0]
  if (profile.value?.username) return profile.value.username
  return '用户'
})

const avatarUrl = computed(() => {
  if (profile.value?.avatar) return profile.value.avatar
  const name = encodeURIComponent(displayName.value)
  return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&bold=true`
})

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    admin: '管理员',
    editor: '编辑者',
    viewer: '访客',
  }
  return map[profile.value?.role || 'viewer'] || '访客'
})

const roleTagType = computed(() => {
  const map: Record<string, 'danger' | 'primary' | 'info' | 'success' | 'warning'> = {
    admin: 'danger',
    editor: 'primary',
    viewer: 'info',
  }
  return map[profile.value?.role || 'viewer'] || 'info'
})

const profileRules: FormRules = {
  nickname: [
    { max: 50, message: '昵称长度不能超过 50 个字符', trigger: 'blur' },
  ],
  bio: [
    { max: 200, message: '个人简介长度不能超过 200 个字符', trigger: 'blur' },
  ],
}

const validateConfirmPassword = (_rule: any, value: string, callback: any) => {
  if (value !== passwordForm.value.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules: FormRules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '密码长度至少 8 位', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (!/[A-Za-z]/.test(value)) {
          callback(new Error('密码必须包含英文字母'))
          return
        }
        if (!/[0-9]/.test(value) && !/[^A-Za-z0-9]/.test(value)) {
          callback(new Error('密码必须包含至少一个数字或特殊符号'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

async function fetchProfile() {
  loading.value = true
  try {
    const res = await getProfile()
    if (res?.code === 0 && res.data) {
      profile.value = res.data
      profileForm.value.nickname = res.data.nickname || ''
      profileForm.value.bio = res.data.bio || ''
    }
  } catch {
    /* ignore */
  } finally {
    loading.value = false
  }
}

async function handleSaveProfile() {
  if (!profileFormRef.value) return
  try {
    await profileFormRef.value.validate()
  } catch {
    return
  }
  savingProfile.value = true
  try {
    const res = await updateProfile({
      nickname: profileForm.value.nickname || undefined,
      bio: profileForm.value.bio || undefined,
    })
    if (res?.code === 0 && res.data) {
      profile.value = res.data
      ElMessage.success('资料保存成功')
    }
  } catch {
    ElMessage.error('保存失败，请稍后重试')
  } finally {
    savingProfile.value = false
  }
}

async function handleChangePassword() {
  if (!passwordFormRef.value) return
  try {
    await passwordFormRef.value.validate()
  } catch {
    return
  }
  changingPassword.value = true
  try {
    const res = await changePassword(
      passwordForm.value.oldPassword,
      passwordForm.value.newPassword,
    )
    if (res?.code === 0) {
      ElMessage.success('密码修改成功')
      passwordForm.value = {
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      }
    }
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || '密码修改失败'
    ElMessage.error(msg)
  } finally {
    changingPassword.value = false
  }
}

onMounted(() => {
  fetchProfile()
})
</script>

<style scoped lang="scss">
.app-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 0 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 24px;

  .avatar-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nickname-text {
    font-size: 20px;
    font-weight: 600;
  }
}

.profile-form,
.password-form {
  max-width: 480px;
}
</style>
