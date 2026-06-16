<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="logo">
        <el-icon :size="20"><Cpu /></el-icon>
        Quick Auto SQL
      </div>
      <div class="header-actions">
        <el-button
          :type="isWorkspace ? 'primary' : 'default'"
          :link="!isWorkspace"
          size="small"
          @click="$router.push('/workspace')"
        >
          <el-icon><Monitor /></el-icon>
          工作区
        </el-button>
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
        <el-dropdown trigger="click" @command="onDropdownCommand" class="user-dropdown">
          <div class="user-info">
            <el-avatar :size="30" :icon="User" />
            <span class="username">{{ username || '未登录' }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>
                <el-icon><User /></el-icon>{{ username || '未登录' }}
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
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, SwitchButton } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isWorkspace = computed(() => route.path === '/workspace')
const isAiSettings = computed(() => route.path === '/settings/ai')
const isPromptSettings = computed(() => route.path === '/settings/prompts')
const username = computed(() => userStore.username)
const isAdmin = computed(() => userStore.isAdmin)

async function onDropdownCommand(cmd: string) {
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
</script>

<style scoped lang="scss">
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
      background: rgba(0, 0, 0, 0.04);
    }

    .username {
      font-size: 13px;
      color: #3a4566;
    }
  }
}
</style>
