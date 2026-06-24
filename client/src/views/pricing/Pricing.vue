<template>
  <div class="pricing-page">
    <div class="pricing-container">
      <header class="pricing-header">
        <div class="brand" @click="$router.push('/')">
          <div class="logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="40" height="40">
              <defs>
                <linearGradient id="pricing-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#5b8def" />
                  <stop offset="100%" stop-color="#7b5bff" />
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#pricing-g1)" />
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
          <div class="brand-title">Quick Auto SQL</div>
        </div>

        <nav class="nav-links">
          <a :class="{ active: isHome }" @click.prevent="$router.push('/')">首页</a>
          <a :class="{ active: isPricing }" @click.prevent="$router.push('/pricing')">定价</a>
        </nav>

        <div class="header-actions">
          <el-button v-if="!isLoggedIn" type="primary" @click="goLogin">登录</el-button>
          <template v-else>
            <span class="account-label">{{ username }}</span>
            <el-button @click="onLogout">退出登录</el-button>
          </template>
        </div>
      </header>

      <section class="pricing-hero">
        <div class="section-head center">
          <span class="section-tag">PRICING</span>
          <h1 class="pricing-title">
            选择适合你的
            <span class="highlight">方案</span>
          </h1>
          <p class="pricing-sub">从免费版开始体验，按需升级获取更多能力。年付享 8.5 折优惠。</p>
        </div>

        <div class="billing-toggle">
          <span :class="{ active: !isYearly }">月付</span>
          <el-switch
            v-model="isYearly"
            active-text=""
            inactive-text=""
            style="--el-switch-on-color: #5b8def"
          />
          <span :class="{ active: isYearly }">
            年付
            <el-tag size="small" type="success" effect="dark" round>省 15%</el-tag>
          </span>
        </div>
      </section>

      <section class="plans-section">
        <div class="plans-grid">
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="plan-card"
            :class="{ recommended: plan.recommended, enterprise: plan.id === 'enterprise' }"
          >
            <div v-if="plan.recommended" class="plan-badge">最受欢迎</div>
            <div class="plan-icon" :style="{ background: plan.gradient }">
              <el-icon :size="24"><component :is="plan.icon" /></el-icon>
            </div>
            <div class="plan-name">{{ plan.name }}</div>
            <div class="plan-desc">{{ plan.desc }}</div>
            <div class="plan-price">
              <template v-if="plan.id === 'enterprise'">
                <span class="price-contact">按需报价</span>
              </template>
              <template v-else>
                <span class="price-currency">¥</span>
                <span class="price-amount">{{ isYearly ? plan.yearlyPrice : plan.monthlyPrice }}</span>
                <span class="price-period">/ 月</span>
              </template>
            </div>
            <div v-if="plan.id !== 'enterprise' && isYearly" class="price-annual">
              年费 ¥{{ plan.yearlyTotal }}，平均 ¥{{ plan.yearlyPrice }}/月
            </div>
            <ul class="plan-highlights">
              <li v-for="h in plan.highlights" :key="h">
                <el-icon class="check-icon" :size="16"><Check /></el-icon>
                {{ h }}
              </li>
            </ul>
            <el-button
              :type="plan.recommended ? 'primary' : 'default'"
              :plain="!plan.recommended"
              size="large"
              round
              class="plan-btn"
              @click="onPlanClick(plan)"
            >
              {{ plan.cta }}
            </el-button>
          </div>
        </div>
      </section>

      <section class="section comparison-section">
        <div class="section-head center">
          <span class="section-tag">COMPARISON</span>
          <h2 class="section-title">功能权益对比</h2>
          <p class="section-sub">详细了解每个版本包含的功能。</p>
        </div>

        <div class="comparison-table-wrapper">
          <table class="comparison-table">
            <thead>
              <tr>
                <th class="col-feature">功能</th>
                <th v-for="tier in tiers" :key="tier.id" :class="{ highlight: tier.recommended }">
                  {{ tier.name }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in comparisonRows" :key="row.feature">
                <td class="col-feature">{{ row.feature }}</td>
                <td
                  v-for="(tier, ti) in tiers"
                  :key="tier.id"
                  :class="{ highlight: tier.recommended }"
                >
                  <template v-if="typeof row.values[ti] === 'boolean'">
                    <el-icon v-if="row.values[ti]" class="val-check" :size="16"><Check /></el-icon>
                    <el-icon v-else class="val-cross" :size="16"><Close /></el-icon>
                  </template>
                  <template v-else>
                    {{ row.values[ti] }}
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="section packs-section">
        <div class="section-head center">
          <span class="section-tag">ADD-ON PACKS</span>
          <h2 class="section-title">AI 生成加油包</h2>
          <p class="section-sub">订阅之外，按需购买额外的 AI 生成次数。加油包永不过期。</p>
        </div>
        <div class="packs-grid">
          <div v-for="pack in packs" :key="pack.name" class="pack-card">
            <div class="pack-name">{{ pack.name }}</div>
            <div class="pack-price">¥{{ pack.price }}</div>
            <div class="pack-count">{{ pack.count }} 次 AI 生成</div>
            <div class="pack-unit">约 ¥{{ pack.unit }} / 次</div>
          </div>
        </div>
      </section>

      <section class="section faq-section">
        <div class="section-head center">
          <span class="section-tag">FAQ</span>
          <h2 class="section-title">常见问题</h2>
        </div>
        <el-collapse class="faq-collapse" accordion>
          <el-collapse-item
            v-for="(faq, idx) in faqList"
            :key="idx"
            :name="idx"
            :title="faq.q"
          >
            <div class="faq-content">{{ faq.a }}</div>
          </el-collapse-item>
        </el-collapse>
      </section>

      <section class="cta-section">
        <div class="cta-card">
          <div class="cta-left">
            <h2 class="cta-title">准备好提升你的 SQL 效率了吗？</h2>
            <p class="cta-sub">注册即可获得 20 次免费 AI 生成额度。</p>
          </div>
          <div class="cta-right">
            <el-button size="large" round :type="isLoggedIn ? 'default' : 'primary'" @click="goLogin">
              {{ isLoggedIn ? '进入工作区' : '免费注册' }}
            </el-button>
          </div>
        </div>
      </section>

      <footer class="pricing-footer">
        <span>&copy; {{ year }} Quick Auto SQL · 面向工程师的 SQL 工作台</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Check, Close, User, Connection, MagicStick } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const year = computed(() => new Date().getFullYear())
const isLoggedIn = computed(() => userStore.isLoggedIn)
const username = computed(() => userStore.username)
const isHome = computed(() => route.path === '/')
const isPricing = computed(() => route.path === '/pricing')
const isYearly = ref(true)

const plans = computed(() => [
  {
    id: 'free',
    name: '免费版',
    desc: '体验核心功能，无需付费',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyTotal: 0,
    gradient: 'linear-gradient(135deg, #a9b2c3, #8a93a8)',
    icon: 'User',
    recommended: false,
    cta: '免费使用',
    highlights: [
      'AI 生成 SQL（自带 Key）30 次/月',
      'AI 生成 SQL（平台提供）10 次/月',
      'SQL 优化/分析 10 次/月',
      '2 个数据库连接',
      '3 个多 Tab',
    ],
  },
  {
    id: 'basic',
    name: '基础版',
    desc: '个人开发者的最佳选择',
    monthlyPrice: 15,
    yearlyPrice: 11.5,
    yearlyTotal: 138,
    gradient: 'linear-gradient(135deg, #5b8def, #7b5bff)',
    icon: 'MagicStick',
    recommended: false,
    cta: '选择基础版',
    highlights: [
      'AI 生成 SQL（自带 Key）500 次/月',
      'AI 生成 SQL（平台提供）200 次/月',
      'SQL 优化/分析 200 次/月',
      '10 个数据库连接',
      '不限查询执行次数',
      '提示词自定义',
    ],
  },
  {
    id: 'pro',
    name: '专业版',
    desc: '高频使用与小团队的首选',
    monthlyPrice: 39,
    yearlyPrice: 29.8,
    yearlyTotal: 358,
    gradient: 'linear-gradient(135deg, #ff8a65, #ffb347)',
    icon: 'MagicStick',
    recommended: true,
    cta: '选择专业版',
    highlights: [
      'AI 生成 SQL（自带 Key）不限',
      'AI 生成 SQL（平台提供）1000 次/月',
      'SQL 优化/分析 不限',
      '50 个数据库连接',
      '不限查询执行与结果行数',
      '团队协作 & 操作审计',
      '优先客服支持',
    ],
  },
  {
    id: 'enterprise',
    name: '企业版',
    desc: '团队协作与私有化部署',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyTotal: 0,
    gradient: 'linear-gradient(135deg, #1f2a44, #2c3a60)',
    icon: 'Connection',
    recommended: false,
    cta: '联系我们',
    highlights: [
      '专业版全部功能',
      'AI 生成不限次数 / 按量',
      '数据库连接不限',
      '私有化部署',
      'SLA 保障',
      '定制开发与集成',
    ],
  },
])

const tiers = [
  { id: 'free', name: '免费版', recommended: false },
  { id: 'basic', name: '基础版', recommended: false },
  { id: 'pro', name: '专业版', recommended: true },
  { id: 'enterprise', name: '企业版', recommended: false },
]

const comparisonRows = [
  {
    feature: 'AI 生成 SQL（自带 Key）',
    values: ['30 次/月', '500 次/月', '不限', '不限'],
  },
  {
    feature: 'AI 生成 SQL（平台提供）',
    values: ['10 次/月', '200 次/月', '1000 次/月', '不限 / 按量'],
  },
  {
    feature: 'SQL 优化/分析',
    values: ['10 次/月', '200 次/月', '不限', '不限'],
  },
  {
    feature: '数据库连接数',
    values: ['2', '10', '50', '不限'],
  },
  {
    feature: '查询执行',
    values: ['100 次/天', '不限', '不限', '不限'],
  },
  {
    feature: '查询结果行数上限',
    values: ['1,000 行', '10,000 行', '不限', '不限'],
  },
  {
    feature: '执行历史保留',
    values: ['7 天', '90 天', '365 天', '不限'],
  },
  {
    feature: 'AI 配置',
    values: ['1 套', '5 套', '不限', '不限'],
  },
  {
    feature: '多 Tab',
    values: ['3 个', '10 个', '不限', '不限'],
  },
  {
    feature: '提示词自定义',
    values: [false, true, true, true],
  },
  {
    feature: '团队协作',
    values: [false, false, true, true],
  },
  {
    feature: '操作审计日志',
    values: [false, false, true, true],
  },
  {
    feature: '优先客服',
    values: [false, false, true, true],
  },
  {
    feature: '私有化部署',
    values: [false, false, false, true],
  },
  {
    feature: 'SLA 保障',
    values: [false, false, false, true],
  },
]

const packs = [
  { name: '基础加油包', price: 5, count: 100, unit: '0.05' },
  { name: '高级加油包', price: 25, count: 600, unit: '0.04' },
]

const faqList = [
  {
    q: '免费版和付费版有什么区别？',
    a: '免费版提供有限的 AI 生成次数（每月 10 次）和基础功能，足够体验核心能力。付费版大幅增加 AI 生成次数、数据库连接数，并解锁高级功能。',
  },
  {
    q: '年付和月付有什么区别？',
    a: '年付享受 8.5 折优惠，例如基础版月付 ¥15，年付仅 ¥138（平均 ¥11.5/月），相当于节省 2 个月费用。',
  },
  {
    q: '加油包会过期吗？',
    a: '不会。加油包购买后永久有效，用完再买，无使用期限。',
  },
  {
    q: '可以随时升级或降级吗？',
    a: '可以。升级立即生效，降级在当前订阅周期结束后生效。',
  },
  {
    q: '企业版如何定价？',
    a: '企业版根据团队规模和部署方式按需报价。5 人以下团队 ¥2,500/年起，支持私有化部署。请联系我们的销售团队获取详细方案。',
  },
]

function goLogin() {
  router.push({ path: '/login', query: { redirect: '/workspace' } })
}

async function onLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await userStore.logout()
    ElMessage.success('已退出登录')
  } catch {
    /* 取消 */
  }
}

function onPlanClick(plan: any) {
  if (plan.id === 'enterprise') {
    window.open('mailto:yuan62387@qq.com?subject=Quick Auto SQL 企业版咨询', '_blank')
  } else if (plan.id === 'free') {
    goLogin()
  } else {
    goLogin()
  }
}
</script>

<style scoped lang="scss">
.pricing-page {
  min-height: 100vh;
  width: 100%;
  background:
    radial-gradient(circle at 15% 15%, rgba(91, 141, 239, 0.16), transparent 45%),
    radial-gradient(circle at 85% 80%, rgba(123, 91, 255, 0.2), transparent 45%),
    linear-gradient(135deg, #f6f8fc 0%, #eef1f8 100%);
}

.pricing-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 56px;
}

.pricing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 0;

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;

    .logo {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 6px 16px rgba(91, 141, 239, 0.35);
    }

    .brand-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2a44;
      letter-spacing: 0.5px;
    }
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-left: 16px;

    a {
      font-size: 14px;
      color: #5b6680;
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

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;

    .account-label {
      font-size: 13.5px;
      color: #1f2a44;
      font-weight: 500;
      padding: 0 4px;
    }
  }
}

/* ===== Hero ===== */
.pricing-hero {
  text-align: center;
  padding: 24px 0 0;
}

.section-head {
  &.center {
    text-align: center;
  }
}

.section-tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  color: #5b8def;
  letter-spacing: 2px;
  margin-bottom: 12px;
}

.pricing-title {
  font-size: 42px;
  line-height: 1.25;
  color: #1f2a44;
  margin: 0 0 12px;
  font-weight: 700;

  .highlight {
    background: linear-gradient(120deg, #5b8def, #7b5bff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}

.pricing-sub {
  font-size: 16px;
  line-height: 1.8;
  color: #6b7590;
  margin: 0 0 28px;
}

.billing-toggle {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 6px 20px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(91, 141, 239, 0.15);
  border-radius: 999px;
  font-size: 14px;
  color: #6b7590;

  .active {
    color: #1f2a44;
    font-weight: 600;
  }
}

/* ===== Plans ===== */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;

  @media (max-width: 1080px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.plan-card {
  position: relative;
  padding: 28px 24px 24px;
  background: #fff;
  border: 1px solid rgba(91, 141, 239, 0.12);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 48px rgba(60, 80, 150, 0.14);
  }

  &.recommended {
    border-color: #5b8def;
    box-shadow: 0 8px 32px rgba(91, 141, 239, 0.2);
  }
}

.plan-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  background: linear-gradient(135deg, #5b8def, #7b5bff);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  white-space: nowrap;
}

.plan-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-bottom: 16px;
}

.plan-name {
  font-size: 18px;
  font-weight: 700;
  color: #1f2a44;
  margin-bottom: 4px;
}

.plan-desc {
  font-size: 13px;
  color: #6b7590;
  margin-bottom: 20px;
}

.plan-price {
  display: flex;
  align-items: baseline;
  gap: 2px;
  margin-bottom: 4px;

  .price-currency {
    font-size: 20px;
    font-weight: 600;
    color: #1f2a44;
  }

  .price-amount {
    font-size: 40px;
    font-weight: 700;
    color: #1f2a44;
    line-height: 1;
  }

  .price-period {
    font-size: 14px;
    color: #6b7590;
    margin-left: 2px;
  }

  .price-contact {
    font-size: 28px;
    font-weight: 700;
    color: #1f2a44;
  }
}

.price-annual {
  font-size: 12px;
  color: #8a93a8;
  margin-bottom: 20px;
}

.plan-highlights {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #424d68;
    line-height: 1.5;
  }

  .check-icon {
    color: #43a047;
    flex-shrink: 0;
  }
}

.plan-btn {
  width: 100%;
}

/* ===== Comparison Table ===== */
.comparison-table-wrapper {
  overflow-x: auto;
  border-radius: 16px;
  border: 1px solid rgba(91, 141, 239, 0.12);
  background: #fff;
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;

  th,
  td {
    padding: 14px 20px;
    text-align: center;
    border-bottom: 1px solid rgba(91, 141, 239, 0.08);
  }

  thead th {
    font-weight: 600;
    color: #1f2a44;
    background: #f8faff;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  th.highlight {
    color: #5b8def;
    background: rgba(91, 141, 239, 0.06);
  }

  td.highlight {
    background: rgba(91, 141, 239, 0.03);
  }

  .col-feature {
    text-align: left;
    font-weight: 500;
    color: #1f2a44;
    min-width: 200px;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover {
    background: rgba(91, 141, 239, 0.02);
  }

  .val-check {
    color: #43a047;
  }

  .val-cross {
    color: #ccc;
  }
}

/* ===== Packs ===== */
.packs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  max-width: 640px;
  margin: 0 auto;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.pack-card {
  padding: 28px 24px;
  background: #fff;
  border: 1px solid rgba(91, 141, 239, 0.12);
  border-radius: 16px;
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 36px rgba(60, 80, 150, 0.12);
  }

  .pack-name {
    font-size: 16px;
    font-weight: 600;
    color: #1f2a44;
    margin-bottom: 8px;
  }

  .pack-price {
    font-size: 36px;
    font-weight: 700;
    color: #5b8def;
    margin-bottom: 4px;
  }

  .pack-count {
    font-size: 14px;
    color: #6b7590;
    margin-bottom: 4px;
  }

  .pack-unit {
    font-size: 12px;
    color: #a9b2c3;
  }
}

/* ===== FAQ ===== */
.faq-section {
  padding: 16px 0;
}

.section-title {
  font-size: 30px;
  line-height: 1.4;
  color: #1f2a44;
  margin: 0 0 12px;
  font-weight: 700;
}

.section-sub {
  font-size: 15px;
  line-height: 1.8;
  color: #6b7590;
  margin: 0;
}

.faq-collapse {
  --el-collapse-border-color: rgba(91, 141, 239, 0.15);
  background: #fff;
  border: 1px solid rgba(91, 141, 239, 0.12);
  border-radius: 16px;
  padding: 8px 8px;
  max-width: 900px;
  margin: 0 auto;
}

.faq-content {
  font-size: 14px;
  line-height: 1.85;
  color: #5b6680;
}

/* ===== CTA ===== */
.cta-section {
  padding: 8px 0 16px;
}

.cta-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 36px 40px;
  border-radius: 20px;
  background:
    radial-gradient(circle at 0% 0%, rgba(91, 141, 239, 0.25), transparent 55%),
    radial-gradient(circle at 100% 100%, rgba(123, 91, 255, 0.25), transparent 55%),
    linear-gradient(135deg, #1f2a44, #2c3a60);
  color: #fff;

  @media (max-width: 720px) {
    flex-direction: column;
    text-align: center;
    padding: 28px;
  }

  .cta-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 6px;
  }

  .cta-sub {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.75);
    margin: 0;
  }

  .cta-right {
    display: flex;
    gap: 12px;
  }
}

/* ===== Footer ===== */
.pricing-footer {
  text-align: center;
  color: #8a93a8;
  font-size: 12.5px;
  padding: 12px 0 24px;
}

.section {
  padding: 24px 0;
}
</style>
