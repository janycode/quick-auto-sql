<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import type { PlanType } from '@/api/auth'
import { PLANS } from '@/utils/plans'

const emit = defineEmits<{
  (e: 'showUpgrade'): void
}>()

const userStore = useUserStore()

const planLabel: Record<string, string> = {}
PLANS.forEach(plan => {
  planLabel[plan.id] = plan.name
})

const displayedPlanLabel = computed(() => {
  if (userStore.isAdmin) return '企业版'
  return planLabel[userStore.plan as PlanType] || '免费版'
})

const aiQuota = computed(() => userStore.quota?.aiGeneratePlatform)

const isFree = computed(() => userStore.plan === 'free')

// limit <= 0 表示无限，使用 ∞
const isUnlimited = computed(() => {
  if (!aiQuota.value) return false
  const limit = aiQuota.value.limit
  return limit === -1 || limit === Infinity || limit <= 0
})

const percentage = computed(() => {
  if (!aiQuota.value) return 0
  if (isUnlimited.value) return 100
  const limit = aiQuota.value.limit
  if (limit <= 0) return 0
  return Math.min(100, Math.round((aiQuota.value.used / limit) * 100))
})

const usageText = computed(() => {
  if (!aiQuota.value) return ''
  if (userStore.isAdmin) return '∞/∞'
  if (isUnlimited.value) return '∞'
  return `${aiQuota.value.used}/${aiQuota.value.limit}`
})
</script>

<template>
  <div class="quota-bar" @click="emit('showUpgrade')">
    <el-icon class="icon"><Star /></el-icon>
    <span class="plan-label">{{ displayedPlanLabel }}</span>
    <!-- 进度条：始终展示；无限时显示为满格样式 -->
    <el-progress
      v-if="aiQuota"
      :percentage="percentage"
      :show-text="false"
      class="progress"
      :stroke-width="6"
      :color="isUnlimited ? '#43a047' : (percentage >= 80 ? '#f56c6c' : '#409eff')"
    />
    <span v-if="aiQuota" class="text">{{ usageText }}</span>
    <el-tag v-if="isFree" type="warning" size="small" class="tag">升级</el-tag>
    <el-tag v-else type="success" size="small" class="tag">{{ displayedPlanLabel }}</el-tag>
  </div>
</template>

<style scoped lang="scss">
.quota-bar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background: var(--el-color-primary-light-9);
  }
  .icon {
    color: var(--el-color-warning);
    font-size: 14px;
  }
  .plan-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }
  .progress {
    width: 80px;
  }
  .text {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    min-width: 32px;
    text-align: right;
  }
  .tag {
    margin-left: 4px;
  }
}
</style>
