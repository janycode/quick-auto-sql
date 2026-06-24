<script lang="ts" setup name="UpgradeDialog">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Connection, MagicStick, Check, Close } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { PLANS, type PlanItem } from '@/utils/plans'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const router = useRouter()
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const userStore = useUserStore()
const isYearly = ref(true)
const upgrading = ref(false)

const iconMap: Record<string, any> = {
  User,
  Connection,
  MagicStick,
}

// 默认选中：admin → 最高付费（enterprise），非 admin → 免费版（free）
const defaultPlanId = computed(() => (userStore.isAdmin ? 'enterprise' : 'free'))
const selectedPlan = ref<string>(userStore.plan || defaultPlanId.value)

// 弹窗打开时，根据当前用户角色设置默认
watch(
  visible,
  (val) => {
    if (val) {
      selectedPlan.value = userStore.plan || defaultPlanId.value
      isYearly.value = true
    }
  },
  { immediate: true }
)

function pickPlan(plan: PlanItem) {
  selectedPlan.value = plan.id
}

// 判断当前选中是否为付费套餐
function isPaidPlan(planId: string): boolean {
  return planId === 'pro' || planId === 'team' || planId === 'enterprise'
}

function formatQuotaText(used: number, limit: number): string {
  if (limit === -1 || limit === Infinity || limit <= 0) {
    return '∞/∞'
  }
  return `${used}/${limit}`
}

async function onConfirm() {
  const plan = PLANS.find((p) => p.id === selectedPlan.value)
  if (!plan) return

  // 免费版：直接切换，不进入支付流程
  if (plan.id === 'free') {
    if (userStore.plan === 'free') {
      ElMessage.info('当前已是免费版')
      return
    }
    try {
      upgrading.value = true
      await userStore.doDowngrade()
      ElMessage.success('已切换为免费版')
      visible.value = false
    } catch (e: any) {
      ElMessage.error(e?.message || '切换失败，请稍后重试')
    } finally {
      upgrading.value = false
    }
    return
  }

  // 已在当前付费套餐，无需重复
  if (plan.id === userStore.plan) {
    ElMessage.info(`你当前已是 ${plan.name}`)
    return
  }

  // 付费套餐：先跳转支付页面
  if (isPaidPlan(plan.id)) {
    visible.value = false
    router.push({
      path: '/payment',
      query: {
        plan: plan.id,
        billingCycle: isYearly.value ? 'yearly' : 'monthly',
        method: 'alipay',
      },
    })
    return
  }
}

async function onContactEnterprise() {
  try {
    await ElMessageBox.confirm(
      '将打开邮箱联系我们进行企业版定制部署，确定继续？',
      '企业版咨询',
      { confirmButtonText: '继续', cancelButtonText: '取消', type: 'info' }
    )
    window.open('mailto:yuan62387@qq.com?subject=Quick Auto SQL 企业版咨询', '_blank')
    visible.value = false
  } catch {
    /* 取消 */
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="订阅与套餐" width="820px" :close-on-click-modal="false">
    <div class="upgrade-root">
      <!-- 当前状态 -->
      <div class="status-bar">
        <div class="status-left">
          <span class="status-label">当前账号</span>
          <span class="status-name">{{ userStore.username || '未登录' }}</span>
          <el-tag size="small" type="primary" effect="plain" class="status-plan">
            {{ (PLANS.find((p) => p.id === userStore.plan)?.name) || '免费版' }}
          </el-tag>
          <el-tag v-if="userStore.isAdmin" size="small" type="danger" effect="plain" class="status-plan">
            管理员
          </el-tag>
        </div>
        <div class="status-right">
          <el-switch v-model="isYearly" active-text="年付" inactive-text="月付" />
        </div>
      </div>

      <!-- 当前额度概览 -->
      <div v-if="userStore.quota" class="quota-wrap">
        <div class="quota-title">我的额度概览</div>
        <div class="quota-grid">
          <div class="quota-item">
            <span class="q-label">AI 生成（自带 Key）</span>
            <span class="q-value">
              {{ formatQuotaText(userStore.quota.aiGenerateOwnKey.used, userStore.quota.aiGenerateOwnKey.limit) }}
            </span>
          </div>
          <div class="quota-item">
            <span class="q-label">AI 生成（平台提供）</span>
            <span class="q-value">
              {{ formatQuotaText(userStore.quota.aiGeneratePlatform.used, userStore.quota.aiGeneratePlatform.limit) }}
            </span>
          </div>
          <div class="quota-item">
            <span class="q-label">SQL 优化/分析</span>
            <span class="q-value">
              {{ formatQuotaText(userStore.quota.aiAnalyze.used, userStore.quota.aiAnalyze.limit) }}
            </span>
          </div>
          <div class="quota-item">
            <span class="q-label">SQL 执行</span>
            <span class="q-value">
              {{ formatQuotaText(userStore.quota.sqlExecute.used, userStore.quota.sqlExecute.limit) }}
            </span>
          </div>
          <div class="quota-item">
            <span class="q-label">历史保留</span>
            <span class="q-value">
              {{ formatQuotaText(userStore.quota.historyUsed, userStore.quota.historyLimit) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 套餐卡片 -->
      <div class="plan-grid">
        <div
          v-for="plan in PLANS"
          :key="plan.id"
          class="plan-card"
          :class="{ selected: selectedPlan === plan.id, recommended: plan.recommended }"
          @click="pickPlan(plan)"
        >
          <div v-if="plan.recommended" class="badge">推荐</div>
          <div class="plan-header">
            <div class="plan-icon" :style="{ background: plan.gradient }">
              <el-icon :size="18"><component :is="iconMap[plan.icon] || MagicStick" /></el-icon>
            </div>
            <div class="plan-title">{{ plan.name }}</div>
            <div class="plan-desc">{{ plan.desc }}</div>
          </div>
          <div class="plan-price">
            <template v-if="plan.id === 'enterprise'">
              <span class="price-text">按需报价</span>
            </template>
            <template v-else>
              <span class="price-prefix">¥</span>
              <span class="price-amount">
                {{ isYearly ? plan.yearlyPrice : plan.monthlyPrice }}
              </span>
              <span class="price-unit">/ 月</span>
              <div v-if="isYearly && plan.yearlyTotal > 0" class="price-sub">
                年费 ¥{{ plan.yearlyTotal }}
              </div>
            </template>
          </div>
          <ul class="plan-feats">
            <li v-for="(h, i) in plan.highlights.slice(0, 4)" :key="i">
              <el-icon :size="12" class="check"><Check /></el-icon>
              <span>{{ h }}</span>
            </li>
            <li v-if="plan.highlights.length > 4" class="more">等 {{ plan.highlights.length }} 项权益</li>
          </ul>
          <div class="plan-footer">
            <el-radio v-model="selectedPlan" :label="plan.id" size="small">选择</el-radio>
          </div>
        </div>
      </div>

      <!-- 功能对比（紧凑版） -->
      <div class="compare-wrap">
        <div class="compare-title">功能权益对比</div>
        <div class="compare-table">
          <div class="row head">
            <div class="cell col-feature">功能</div>
            <div class="cell">免费版</div>
            <div class="cell">基础版</div>
            <div class="cell highlight">专业版</div>
            <div class="cell">企业版</div>
          </div>
          <div v-for="(row, idx) in [
            { f: 'AI 生成（自带 Key）', v: ['30', '500', '不限', '不限'] },
            { f: 'AI 生成（平台提供）', v: ['10', '200', '1000', '不限'] },
            { f: 'SQL 优化/分析', v: ['10', '200', '不限', '不限'] },
            { f: '数据库连接数', v: ['2', '10', '50', '不限'] },
            { f: '查询执行', v: ['100/天', '不限', '不限', '不限'] },
            { f: '提示词自定义', v: [false, true, true, true] },
            { f: '团队协作 & 审计', v: [false, false, true, true] },
            { f: '私有化部署', v: [false, false, false, true] },
          ]" :key="idx" class="row">
            <div class="cell col-feature">{{ row.f }}</div>
            <template v-for="(val, vi) in row.v" :key="vi">
              <div class="cell" :class="{ highlight: vi === 2 }">
                <el-icon v-if="typeof val === 'boolean'" :size="14" :class="val ? 'ok' : 'no'">
                  <Check v-if="val" />
                  <Close v-else />
                </el-icon>
                <span v-else>{{ val }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>

    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <template v-if="selectedPlan === 'enterprise'">
        <el-button type="success" @click="onContactEnterprise">联系我们</el-button>
      </template>
      <el-button v-else-if="selectedPlan === 'free'" type="primary" :loading="upgrading" @click="onConfirm">
        切换到免费版
      </el-button>
      <el-button v-else type="primary" :loading="upgrading" @click="onConfirm">
        去支付 ¥ {{ (PLANS.find((p) => p.id === selectedPlan) && isYearly)
          ? (PLANS.find((p) => p.id === selectedPlan) as any)?.yearlyPrice
          : (PLANS.find((p) => p.id === selectedPlan) as any)?.monthlyPrice }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.upgrade-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(91, 141, 239, 0.08), rgba(123, 91, 255, 0.08));
  border-radius: 10px;
  border: 1px solid rgba(91, 141, 239, 0.15);

  .status-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .status-label {
    color: #8a93a8;
  }
  .status-name {
    color: #1f2a44;
    font-weight: 600;
  }
  .status-plan {
    margin-left: 4px;
  }
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 16px 14px;
  border: 1.5px solid rgba(91, 141, 239, 0.15);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(91, 141, 239, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(60, 80, 150, 0.08);
  }

  &.selected {
    border-color: #5b8def;
    box-shadow: 0 6px 24px rgba(91, 141, 239, 0.18);
  }

  &.recommended {
    border-color: #ffb347;
    background: linear-gradient(180deg, #fffaf0 0%, #fff 100%);
  }
}

.badge {
  position: absolute;
  top: -10px;
  right: 12px;
  padding: 2px 10px;
  background: linear-gradient(135deg, #ff8a65, #ffb347);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  .plan-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    flex-shrink: 0;
  }

  .plan-title {
    font-size: 15px;
    font-weight: 700;
    color: #1f2a44;
    line-height: 1.2;
  }

  .plan-desc {
    font-size: 11px;
    color: #8a93a8;
    line-height: 1.3;
    margin-top: 2px;
  }

  flex-wrap: wrap;
  > .plan-title,
  > .plan-desc {
    width: calc(100% - 40px);
  }
  > .plan-desc {
    margin-left: 40px;
    width: auto;
  }
}

.plan-price {
  display: flex;
  align-items: baseline;
  gap: 2px;
  padding: 8px 0;
  border-top: 1px dashed rgba(91, 141, 239, 0.12);
  border-bottom: 1px dashed rgba(91, 141, 239, 0.12);
  margin-bottom: 10px;

  .price-text {
    font-size: 18px;
    font-weight: 700;
    color: #1f2a44;
  }
  .price-prefix {
    font-size: 13px;
    color: #1f2a44;
    font-weight: 600;
  }
  .price-amount {
    font-size: 24px;
    font-weight: 700;
    color: #1f2a44;
  }
  .price-unit {
    font-size: 11px;
    color: #8a93a8;
    margin-left: 4px;
  }
  .price-sub {
    font-size: 11px;
    color: #a9b2c3;
    width: 100%;
    margin-top: 4px;
  }
  flex-wrap: wrap;
}

.plan-feats {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;

  li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12px;
    color: #424d68;
    line-height: 1.4;
  }

  .check {
    color: #43a047;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .more {
    color: #8a93a8;
    font-style: italic;
    font-size: 11px;
  }
}

.plan-footer {
  display: flex;
  justify-content: flex-end;
}

.compare-wrap {
  border: 1px solid rgba(91, 141, 239, 0.15);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.compare-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2a44;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(91, 141, 239, 0.06), rgba(123, 91, 255, 0.06));
  border-bottom: 1px solid rgba(91, 141, 239, 0.1);
}

.compare-table {
  .row {
    display: grid;
    grid-template-columns: 1.2fr repeat(4, 1fr);
    font-size: 12px;

    &.head {
      font-weight: 600;
      color: #1f2a44;
      background: #f8faff;

      .cell {
        padding: 8px 10px;
      }
    }

    &:not(.head) {
      border-top: 1px solid rgba(91, 141, 239, 0.06);

      .cell {
        padding: 6px 10px;
        color: #424d68;
      }
    }

    .cell {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;

      &.col-feature {
        justify-content: flex-start;
        color: #1f2a44;
        font-weight: 500;
      }

      &.highlight {
        background: rgba(91, 141, 239, 0.04);
        color: #5b8def;
        font-weight: 500;
      }

      .ok {
        color: #43a047;
      }
      .no {
        color: #d0d4dc;
      }
    }
  }
}

.quota-wrap {
  border: 1px solid rgba(91, 141, 239, 0.15);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.quota-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2a44;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(91, 141, 239, 0.06), rgba(123, 91, 255, 0.06));
  border-bottom: 1px solid rgba(91, 141, 239, 0.1);
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 10px;
  gap: 8px;
}

.quota-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 6px;
  border-radius: 8px;
  background: #f8faff;

  .q-label {
    font-size: 11px;
    color: #8a93a8;
    margin-bottom: 4px;
  }
  .q-value {
    font-size: 14px;
    font-weight: 700;
    color: #1f2a44;
  }
}
</style>
