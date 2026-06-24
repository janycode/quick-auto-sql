<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import type { PlanType } from '@/api/auth'
import {
  createPayOrder,
  getPayOrderStatus,
  confirmPayOrder,
  cancelPayOrder,
  type PayMethod,
  type PayOrderStatus,
  type IPayOrderResult,
} from '@/api/pay'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 解析路由参数
const plan = ref<PlanType>((route.query.plan as PlanType) || 'pro')
const billingCycle = ref<'monthly' | 'yearly'>(
  (route.query.billingCycle as 'monthly' | 'yearly') || 'yearly'
)
const method = ref<PayMethod>((route.query.method as PayMethod) || 'alipay')

// 当前订单
const order = ref<IPayOrderResult | null>(null)
const orderStatus = ref<PayOrderStatus>('pending')
const loading = ref(false)
const confirming = ref(false)
const remainingSeconds = ref(0)
const countdownTimer = ref<number | null>(null)
const pollTimer = ref<number | null>(null)

const planNameMap: Record<string, string> = {
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
}
const methodNameMap: Record<PayMethod, string> = {
  alipay: '支付宝',
  wechat: '微信支付',
}

// 不允许 free 套餐进入支付页
watch(
  () => plan.value,
  (p) => {
    if ((p as string) === 'free') {
      ElMessage.error('免费版无需支付')
      router.replace('/workspace')
    }
  },
  { immediate: true }
)

async function createOrder() {
  try {
    loading.value = true
    const res = await createPayOrder({
      plan: plan.value,
      billingCycle: billingCycle.value,
      method: method.value,
    })
    if (res?.data) {
      order.value = res.data
      orderStatus.value = res.data.status
      remainingSeconds.value = res.data.expireSeconds ?? 900
      startCountdown()
      startPoll()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '订单创建失败')
  } finally {
    loading.value = false
  }
}

function startCountdown() {
  stopCountdown()
  countdownTimer.value = window.setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value -= 1
    } else {
      stopCountdown()
      orderStatus.value = 'cancelled'
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer.value !== null) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
}

function startPoll() {
  stopPoll()
  pollTimer.value = window.setInterval(async () => {
    if (!order.value) return
    try {
      const res = await getPayOrderStatus(order.value.orderId)
      if (res?.data) {
        orderStatus.value = res.data.status
        if (res.data.status === 'paid') {
          stopPoll()
          stopCountdown()
          ElMessage.success('支付成功，套餐已升级')
          // 刷新用户状态
          try {
            await userStore.fetchMe()
          } catch {
            /* ignore */
          }
          setTimeout(() => router.push('/workspace'), 800)
        }
      }
    } catch {
      /* 静默轮询 */
    }
  }, 2000)
}

function stopPoll() {
  if (pollTimer.value !== null) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

async function onConfirmPaid() {
  if (!order.value || confirming.value) return
  try {
    confirming.value = true
    const res = await confirmPayOrder(order.value.orderId)
    if (res?.data) {
      orderStatus.value = 'paid'
      stopPoll()
      stopCountdown()
      ElMessage.success('支付成功，套餐已升级')
      try {
        await userStore.fetchMe()
      } catch {
        /* ignore */
      }
      setTimeout(() => router.push('/workspace'), 800)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '确认失败')
  } finally {
    confirming.value = false
  }
}

async function onCancel() {
  if (!order.value) {
    router.back()
    return
  }
  try {
    await cancelPayOrder(order.value.orderId)
    ElMessage.info('已取消订单')
  } catch {
    /* ignore */
  }
  stopPoll()
  stopCountdown()
  router.back()
}

function onSwitchMethod(newMethod: PayMethod) {
  if (orderStatus.value === 'paid') return
  method.value = newMethod
  createOrder()
}

function onSwitchCycle(cycle: 'monthly' | 'yearly') {
  if (orderStatus.value === 'paid') return
  billingCycle.value = cycle
  createOrder()
}

const countdownText = computed(() => {
  const s = Math.max(0, remainingSeconds.value)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
})

onMounted(() => {
  if (!userStore.isLoggedIn) {
    router.replace({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  createOrder()
})

onBeforeUnmount(() => {
  stopCountdown()
  stopPoll()
})
</script>

<template>
  <div class="pay-page">
    <div class="pay-card">
      <div class="pay-header">
        <div class="pay-title">{{ planNameMap[plan] || plan }} · {{ billingCycle === 'yearly' ? '年付' : '月付' }}</div>
        <div class="pay-sub">使用以下方式完成支付，开通后自动生效</div>
      </div>

      <div class="pay-methods">
        <button
          class="method-btn"
          :class="{ active: method === 'alipay' }"
          @click="onSwitchMethod('alipay')"
        >
          <span class="method-icon alipay">支</span>
          <span class="method-name">支付宝</span>
        </button>
        <button
          class="method-btn"
          :class="{ active: method === 'wechat' }"
          @click="onSwitchMethod('wechat')"
        >
          <span class="method-icon wechat">微</span>
          <span class="method-name">微信支付</span>
        </button>
      </div>

      <div class="billing-toggle">
        <button
          :class="{ active: billingCycle === 'monthly' }"
          @click="onSwitchCycle('monthly')"
        >月付</button>
        <button
          :class="{ active: billingCycle === 'yearly' }"
          @click="onSwitchCycle('yearly')"
        >年付（8.5折）</button>
      </div>

      <div class="pay-qr" v-loading="loading">
        <template v-if="order && orderStatus !== 'paid'">
          <div class="qr-box">
            <!-- 模拟二维码：使用 qrCodeUrl 展示，前端也可以替换为真实图片 -->
            <img :src="order.qrCodeUrl" alt="QR Code" class="qr-img" />
          </div>
          <div class="qr-tips">
            <div class="qr-amount">¥ {{ order.amount.toFixed(2) }}</div>
            <div class="qr-hint">
              请在 {{ countdownText }} 内使用
              <b>{{ methodNameMap[method] }}</b>
              扫描二维码完成支付
            </div>
          </div>
          <div class="qr-order">
            订单号：{{ order.orderId }}
          </div>
        </template>

        <div v-else-if="orderStatus === 'paid'" class="paid-done">
          <div class="paid-check">✓</div>
          <div class="paid-text">支付成功，正在跳转…</div>
        </div>

        <div v-else class="loading-box">
          <el-icon :size="40" class="loading-icon"><Loading /></el-icon>
          <div>订单加载中…</div>
        </div>
      </div>

      <div class="pay-footer">
        <button class="btn-secondary" @click="onCancel">取消</button>
        <button
          class="btn-primary"
          :disabled="!order || orderStatus !== 'pending' || confirming"
          @click="onConfirmPaid"
        >
          {{ confirming ? '处理中…' : '我已支付' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pay-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fb 0%, #eef2f8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.pay-card {
  width: 100%;
  max-width: 460px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(60, 80, 150, 0.1);
  padding: 32px 28px;
}

.pay-header {
  text-align: center;
  margin-bottom: 20px;
}
.pay-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2a44;
  margin-bottom: 4px;
}
.pay-sub {
  font-size: 13px;
  color: #8a93a8;
}

.pay-methods {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.method-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 0;
  background: #f6f8fc;
  border: 1.5px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  color: #424d68;
  transition: all 0.2s ease;

  &.active {
    background: #fff;
    border-color: #5b8def;
    color: #1f2a44;
    font-weight: 600;
    box-shadow: 0 2px 10px rgba(91, 141, 239, 0.15);
  }
}
.method-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 700;

  &.alipay {
    background: #1677ff;
  }
  &.wechat {
    background: #22c55e;
  }
}

.billing-toggle {
  display: flex;
  gap: 6px;
  background: #f1f4fb;
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 20px;

  button {
    flex: 1;
    padding: 8px 0;
    border: none;
    background: transparent;
    font-size: 13px;
    color: #6b7590;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;

    &.active {
      background: #fff;
      color: #1f2a44;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    }
  }
}

.pay-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 12px;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
  border-radius: 12px;
  border: 1px solid rgba(91, 141, 239, 0.1);
}

.qr-box {
  padding: 12px;
  background: #fff;
  border: 1px solid rgba(91, 141, 239, 0.15);
  border-radius: 12px;
  margin-bottom: 16px;
}

.qr-img {
  width: 200px;
  height: 200px;
  display: block;
}

.qr-tips {
  text-align: center;
  margin-bottom: 12px;

  .qr-amount {
    font-size: 28px;
    font-weight: 700;
    color: #ff6b35;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .qr-hint {
    font-size: 12.5px;
    color: #6b7590;

    b {
      color: #1f2a44;
      font-weight: 600;
    }
  }
}

.qr-order {
  font-size: 11.5px;
  color: #a9b2c3;
  letter-spacing: 1px;
}

.paid-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 30px 0;
}
.paid-check {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #43a047;
  color: #fff;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.paid-text {
  font-size: 15px;
  color: #1f2a44;
  font-weight: 600;
}

.loading-box {
  padding: 40px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #8a93a8;
  font-size: 13px;
}

.pay-footer {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 12px 0;
  font-size: 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 600;
}

.btn-primary {
  background: linear-gradient(135deg, #5b8def, #7b5bff);
  color: #fff;

  &:hover {
    box-shadow: 0 6px 16px rgba(91, 141, 239, 0.3);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-secondary {
  background: #f1f4fb;
  color: #424d68;

  &:hover {
    background: #e8edf7;
  }
}
</style>
