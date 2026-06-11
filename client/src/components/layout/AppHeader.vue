<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="logo">
        <el-icon :size="20"><Cpu /></el-icon>
        Quick Auto SQL
      </div>
      <div class="header-actions">
        <el-button
          :type="isWorkspace ? 'primary' : 'text'"
          :plain="!isWorkspace"
          size="small"
          @click="$router.push('/workspace')"
        >
          <el-icon><Monitor /></el-icon>
          工作区
        </el-button>
        <el-button
          :type="isAiSettings ? 'primary' : 'text'"
          :plain="!isAiSettings"
          size="small"
          @click="$router.push('/settings/ai')"
        >
          <el-icon><Setting /></el-icon>
          AI 配置
        </el-button>
        <el-button
          :type="isPromptSettings ? 'primary' : 'text'"
          :plain="!isPromptSettings"
          size="small"
          @click="$router.push('/settings/prompts')"
        >
          <el-icon><Edit /></el-icon>
          提示词配置
        </el-button>
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
import { useRoute } from 'vue-router'

const route = useRoute()
const isWorkspace = computed(() => route.path === '/workspace')
const isAiSettings = computed(() => route.path === '/settings/ai')
const isPromptSettings = computed(() => route.path === '/settings/prompts')
</script>
