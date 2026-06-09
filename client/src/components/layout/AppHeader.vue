<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="logo">
        <el-icon :size="20"><Cpu /></el-icon>
        Quick Auto SQL
      </div>
      <div class="header-actions">
        <el-button text bg size="small" @click="$router.push('/workspace')">
          <el-icon><Monitor /></el-icon>
          工作区
        </el-button>
        <el-button text bg size="small" @click="$router.push('/settings/ai')">
          <el-icon><Setting /></el-icon>
          AI 配置
        </el-button>
      </div>
    </header>
    <div class="app-body">
      <slot />
    </div>
  </div>
</template>
