<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="logo" @click="$router.push('/')">
        <el-icon :size="20"><Cpu /></el-icon>
        Quick Auto SQL
      </div>
      <nav class="nav-links">
        <a
          :class="{ active: isWorkspace }"
          @click.prevent="$router.push('/workspace')"
        >工作台</a>
        <a
          :class="{ active: isPricing }"
          @click.prevent="$router.push('/pricing')"
        >定价</a>
      </nav>
      <div class="header-actions">
        <el-button
          :type="isAiSettings ? 'primary' : 'default'"
          :link="!isAiSettings"
          size="small"
          @click="$router.push('/settings/ai')"
        >
          <el-icon><Setting /></el-icon>
          AI 配置
        </el-button>
        <el-button
          v-if="isAdmin"
          :type="isPromptSettings ? 'primary' : 'default'"
          :link="!isPromptSettings"
          size="small"
          @click="$router.push('/settings/prompts')"
        >
          <el-icon><Edit /></el-icon>
          提示词配置
        </el-button>
        <el-button
          :type="isFeedbackAdmin ? 'primary' : 'default'"
          :link="!isFeedbackAdmin"
          size="small"
          class="feedback-nav-btn"
          @click="$router.push('/settings/feedback')"
        >
          <el-icon><ChatDotRound /></el-icon>
          <span class="feedback-nav-text">{{ isAdmin ? '处理反馈' : '我的反馈' }}</span>
          <sup v-if="isAdmin && pendingCount > 0" class="feedback-badge">{{ pendingCount > 99 ? '99+' : pendingCount }}</sup>
        </el-button>
        <el-tooltip :content="themeTooltip" placement="bottom">
          <el-button size="small" link @click="themeStore.toggleTheme()">
            <el-icon :size="16">
              <Sunny v-if="themeStore.mode === 'dark'" />
              <Moon v-else-if="themeStore.mode === 'light'" />
              <Monitor v-else />
            </el-icon>
          </el-button>
        </el-tooltip>
        <QuotaBar @showUpgrade="showUpgradeDialog = true" />
        <el-dropdown trigger="click" @command="onDropdownCommand" class="user-dropdown">
          <div class="user-info">
            <el-avatar :size="30" :src="avatarUrl">
              <el-icon :size="18"><User /></el-icon>
            </el-avatar>
            <span class="username">{{ username || '未登录' }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>
                <el-icon><User /></el-icon>{{ username || '未登录' }}
              </el-dropdown-item>
              <el-dropdown-item command="profile">
                <el-icon><Setting /></el-icon>个人中心
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <el-icon><SwitchButton /></el-icon>退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>
    <div class="app-body">
      <slot />
    </div>
    <UpgradeDialog v-model="showUpgradeDialog" />
    <footer class="app-footer">
      <div class="footer-motto">没有天生学霸，皆为厚积薄发。</div>
      <div class="footer-copyright">
        Jerry(姜源) · <a href="mailto:yuan62387@qq.com">yuan62387@qq.com</a> ·
        <a href="https://janycode.github.io" target="_blank" rel="noopener">janycode.github.io</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, SwitchButton, Sunny, Moon, Monitor, ChatDotRound, Setting } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { getFeedbackPendingCount } from '@/api/feedback'
import QuotaBar from '@/components/quota/QuotaBar.vue'
import UpgradeDialog from '@/components/quota/UpgradeDialog.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const themeStore = useThemeStore()

const showUpgradeDialog = ref(false)
const pendingCount = ref(0)

const isWorkspace = computed(() => route.path === '/workspace')
const isAiSettings = computed(() => route.path === '/settings/ai')
const isFeedbackAdmin = computed(() => route.path === '/settings/feedback')
const isPromptSettings = computed(() => route.path === '/settings/prompts')
const isPricing = computed(() => route.path === '/pricing')
const username = computed(() => userStore.username)
const isAdmin = computed(() => userStore.isAdmin)

const avatarUrl = computed(() => {
  const name = encodeURIComponent(username.value || 'U')
  return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&bold=true`
})

const themeTooltip = computed(() => {
  const map = { light: '切换为深色模式', dark: '切换为跟随系统', system: '切换为浅色模式' }
  return map[themeStore.mode] || '切换主题'
})

async function onDropdownCommand(cmd: string) {
  if (cmd === 'profile') {
    router.push('/settings/profile')
    return
  }
  if (cmd === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
      await userStore.logout()
      ElMessage.success('已退出登录')
      router.replace('/')
    } catch {
      /* 取消 */
    }
  }
}

async function fetchPendingCount() {
  if (!userStore.isAdmin) {
    pendingCount.value = 0
    return
  }
  try {
    const res = await getFeedbackPendingCount()
    if (res?.data) {
      pendingCount.value = res.data.count
    }
  } catch {
    /* ignore */
  }
}

watch(
  () => userStore.isAdmin,
  () => {
    fetchPendingCount()
  },
)

watch(
  () => route.path,
  () => {
    if (userStore.isAdmin) {
      fetchPendingCount()
    }
  },
)

onMounted(() => {
  if (userStore.isAdmin) {
    fetchPendingCount()
  }
})

defineExpose({
  refreshPendingCount: fetchPendingCount,
})
</script>

<style scoped lang="scss">
.logo {
  cursor: pointer;
  user-select: none;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: 16px;

  a {
    font-size: 14px;
    color: #c0c4cc;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.2s;

    &:hover {
      color: #409eff;
    }

    &.active {
      color: #409eff;
      font-weight: 500;
    }
  }
}

.user-dropdown {
  margin-left: 8px;

  .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .username {
      font-size: 13px;
      color: #c0c4cc;
    }
  }
}

.header-actions {
  :deep(.el-button--link) {
    color: #c0c4cc;

    &:hover {
      color: #409eff;
    }
  }

  :deep(.el-button.is-link.el-button--default) {
    color: #c0c4cc;

    &:hover {
      color: #409eff;
    }
  }

  :deep(.quota-bar) {
    .plan-label,
    .text {
      color: #c0c4cc !important;
    }
  }
}

.feedback-nav-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  .feedback-nav-text {
    line-height: 1;
  }

  .feedback-badge {
    position: relative;
    top: -4px;
    margin-left: 2px;
    font-size: 12px;
    font-weight: 700;
    color: #f56c6c;
    line-height: 1;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  &:deep(.el-icon) {
    vertical-align: middle;
  }
}
</style>
