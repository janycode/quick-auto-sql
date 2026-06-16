<template>
  <div class="home-page">
    <div class="home-container">
      <header class="home-header">
        <div class="brand">
          <div class="logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="40" height="40">
              <defs>
                <linearGradient id="home-g1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#5b8def" />
                  <stop offset="100%" stop-color="#7b5bff" />
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#home-g1)" />
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

        <div class="header-actions">
          <el-button size="default" @click="goWorkspace">进入工作区</el-button>
          <el-button v-if="!isLoggedIn" type="primary" size="default" @click="goLogin">登录</el-button>
          <template v-else>
            <el-button size="default" @click="onLogout">退出登录</el-button>
          </template>
        </div>
      </header>

      <!-- ===== Section 1：Hero（保留原有内容） ===== -->
      <section class="hero">
        <div class="hero-left">
          <div class="hero-badge">
            <span class="dot" />
            为工程师打造 · 免登录即可预览
          </div>
          <h1 class="hero-title">
            让 SQL 写作
            <span class="highlight">更智能</span>
          </h1>
          <p class="hero-desc">
            基于大语言模型，通过自然语言描述自动生成可执行的 SQL；内置数据库连接管理、EXPLAIN
            性能分析与业务解释，让你把精力放回业务本身。
          </p>
          <div class="hero-actions">
            <el-button type="primary" size="large" round @click="goWorkspace">
              <el-icon style="margin-right:6px"><ArrowRight /></el-icon>
              立即开始
            </el-button>
            <el-button size="large" round @click="scrollTo('features')">了解功能</el-button>
          </div>

          <ul class="hero-features">
            <li>
              <span class="feature-icon icon-blue">
                <el-icon><Connection /></el-icon>
              </span>
              <div>
                <div class="feature-title">多数据库连接</div>
                <div class="feature-desc">支持 MySQL 多连接，密码采用 AES 加密存储。</div>
              </div>
            </li>
            <li>
              <span class="feature-icon icon-purple">
                <el-icon><MagicStick /></el-icon>
              </span>
              <div>
                <div class="feature-title">AI 生成 SQL</div>
                <div class="feature-desc">自然语言描述需求，流式生成可直接执行的 SQL。</div>
              </div>
            </li>
            <li>
              <span class="feature-icon icon-orange">
                <el-icon><DataAnalysis /></el-icon>
              </span>
              <div>
                <div class="feature-title">性能分析</div>
                <div class="feature-desc">集成 EXPLAIN 与 AI 建议，快速定位慢查询。</div>
              </div>
            </li>
            <li>
              <span class="feature-icon icon-green">
                <el-icon><Document /></el-icon>
              </span>
              <div>
                <div class="feature-title">SQL 业务解释</div>
                <div class="feature-desc">一键把 SQL 翻译成业务可读的中文描述。</div>
              </div>
            </li>
          </ul>
        </div>

        <div class="hero-right" aria-hidden="true">
          <div class="card-stack">
            <div class="card card-bg" />
            <div class="card card-front">
              <div class="card-toolbar">
                <span />
                <span />
                <span />
                <div class="card-title">workspace.sql</div>
              </div>
              <pre class="card-code"><code>-- 近 30 天每个用户的<br>-- 下单金额与订单数
SELECT
  user_id,
  COUNT(*)          AS order_count,
  SUM(amount)       AS total_amount
FROM orders
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY user_id
ORDER BY total_amount DESC
LIMIT 100;</code></pre>
              <div class="card-footer">
                <span class="pill pill-ok">执行成功 · 32 行</span>
                <span class="pill pill-time">耗时 48ms</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Section 2：数据指标 ===== -->
      <section class="stats-section">
        <div class="stat-item">
          <div class="stat-num">4<sup>+</sup></div>
          <div class="stat-label">核心能力模块</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">1<sup>s</sup></div>
          <div class="stat-label">平均生成响应</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">99<sup>%</sup></div>
          <div class="stat-label">生成 SQL 可执行率</div>
        </div>
        <div class="stat-item">
          <div class="stat-num">100<sup>ms</sup></div>
          <div class="stat-label">EXPLAIN 平均耗时</div>
        </div>
      </section>

      <!-- ===== Section 3：功能卡片列表 ===== -->
      <section id="features" class="section">
        <div class="section-head">
          <span class="section-tag">FEATURES</span>
          <h2 class="section-title">让每一条 SQL 都更<span class="gradient-text">高效</span></h2>
          <p class="section-sub">
            从连接数据库、描述需求、生成与执行 SQL，到性能分析与业务解释，一站式覆盖工程师日常高频场景。
          </p>
        </div>

        <div class="feature-grid">
          <div
            v-for="(item, idx) in featureList"
            :key="item.title"
            class="feature-card"
          >
            <div class="feature-card-header">
              <span class="feature-card-num">{{ String(idx + 1).padStart(2, '0') }}</span>
              <span class="feature-card-icon" :style="{ background: item.color }">
                <el-icon><component :is="item.icon" /></el-icon>
              </span>
            </div>
            <div class="feature-card-title">{{ item.title }}</div>
            <div class="feature-card-desc">{{ item.desc }}</div>
          </div>
        </div>
      </section>

      <!-- ===== Section 4：工作流程 ===== -->
      <section class="section section-flow">
        <div class="section-head center">
          <span class="section-tag">WORKFLOW</span>
          <h2 class="section-title">四步搞定复杂查询</h2>
          <p class="section-sub">
            无需复杂的 SQL 编写经验，用自然语言描述即可获得可执行的 SQL。
          </p>
        </div>

        <div class="flow-grid">
          <div v-for="(step, idx) in flowList" :key="step.title" class="flow-item">
            <div class="flow-index">{{ String(idx + 1).padStart(2, '0') }}</div>
            <div class="flow-title">{{ step.title }}</div>
            <div class="flow-desc">{{ step.desc }}</div>
            <div v-if="idx < flowList.length - 1" class="flow-arrow" aria-hidden="true">
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Section 5：代码对比（自然语言 → SQL） ===== -->
      <section class="section section-compare">
        <div class="compare-grid">
          <div class="compare-side">
            <div class="compare-tag compare-tag-text">自然语言描述</div>
            <div class="compare-panel">
              <p>
                我想看看过去 <b>30 天</b>
                里每个用户的下单数量和总金额，按金额倒序。
              </p>
              <p>只需要最近活跃的 <b>100 个</b> 用户。</p>
            </div>
          </div>

          <div class="compare-sep" aria-hidden="true">
            <div class="sep-circle">
              <el-icon><MagicStick /></el-icon>
            </div>
          </div>

          <div class="compare-side">
            <div class="compare-tag compare-tag-sql">自动生成的 SQL</div>
            <div class="compare-panel compare-panel-code">
              <pre><code>SELECT
  user_id,
  COUNT(*)        AS order_count,
  SUM(amount)     AS total_amount
FROM orders
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY user_id
ORDER BY total_amount DESC
LIMIT 100;</code></pre>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Section 6：FAQ ===== -->
      <section class="section section-faq">
        <div class="section-head center">
          <span class="section-tag">FAQ</span>
          <h2 class="section-title">你可能想知道</h2>
          <p class="section-sub">关于使用方式、数据安全与 AI 模型配置。</p>
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

      <!-- ===== Section 7：CTA ===== -->
      <section class="cta-section">
        <div class="cta-card">
          <div class="cta-left">
            <h2 class="cta-title">准备好把 SQL 交给 AI 了吗？</h2>
            <p class="cta-sub">注册账号，立即在工作区连接数据库并开始生成。</p>
          </div>
          <div class="cta-right">
            <el-button size="large" round :type="isLoggedIn ? 'default' : 'primary'" @click="goLogin">
              {{ isLoggedIn ? '进入工作区' : '登录 / 注册' }}
            </el-button>
            <el-button size="large" round plain @click="goWorkspace">直接体验</el-button>
          </div>
        </div>
      </section>

      <footer class="home-footer">
        <span>&copy; {{ year }} Quick Auto SQL · 面向工程师的 SQL 工作台</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import {
  ArrowRight,
  Connection,
  MagicStick,
  DataAnalysis,
  Document,
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const year = computed(() => new Date().getFullYear())
const isLoggedIn = computed(() => userStore.isLoggedIn)

const featureList = [
  {
    title: '数据库连接管理',
    desc: '支持多连接配置，密码 AES 加密本地保存，一键测试并切换。',
    icon: 'Connection',
    color: 'linear-gradient(135deg,#5b8def,#7b5bff)',
  },
  {
    title: '自然语言生成 SQL',
    desc: '由系统内置提示词驱动大语言模型，将自然语言描述自动转为 SQL，结果以 SSE 流式返回。',
    icon: 'MagicStick',
    color: 'linear-gradient(135deg,#7b5bff,#b55bff)',
  },
  {
    title: '执行与结果预览',
    desc: '在编辑器中执行 SQL，查看字段注释、行数与执行耗时。',
    icon: 'DataAnalysis',
    color: 'linear-gradient(135deg,#ff8a65,#ffb347)',
  },
  {
    title: '性能分析与建议',
    desc: '自动对 SQL 运行 EXPLAIN，并由 AI 给出索引与改写建议。',
    icon: 'DataAnalysis',
    color: 'linear-gradient(135deg,#43a047,#66bb6a)',
  },
  {
    title: 'SQL 业务解释',
    desc: '把复杂 SQL 翻译为自然语言描述，方便产品/运营同学理解。',
    icon: 'Document',
    color: 'linear-gradient(135deg,#5b8def,#43a047)',
  },
  {
    title: '多套 AI 配置切换',
    desc: '支持在 DeepSeek 等多套模型提供商间自由切换与激活。',
    icon: 'MagicStick',
    color: 'linear-gradient(135deg,#ff8a65,#7b5bff)',
  },
]

const flowList = [
  { title: '连接数据库', desc: '在设置中添加 MySQL 连接并保存，密码本地加密。' },
  { title: '选择表结构', desc: '工作区自动读取库/表/字段信息，作为 AI 上下文。' },
  { title: '描述需求', desc: '用自然语言说出你想查什么，不需要考虑语法细节。' },
  { title: '生成并执行', desc: 'AI 生成可执行 SQL，你可以预览、执行或改写后再发。' },
]

const faqList = [
  {
    q: '生成的 SQL 会被上传到哪里？',
    a: '默认情况下，SQL 与表结构信息仅在调用你自己的 AI 配置时发送给对应模型服务商；你可以在设置中随时替换为内网可访问的模型地址。',
  },
  {
    q: '支持哪些数据库？',
    a: '当前以 MySQL 为核心场景，兼容 MySQL 协议的其他数据库（如 MariaDB、TiDB）也可正常使用；后续可以按需扩展。',
  },
  {
    q: '是否需要账号才能试用？',
    a: '首页、登录与注册页不需要登录；功能区（工作区、AI 配置等）需登录后才能访问，以便对每个用户的数据做隔离。',
  },
]

function goWorkspace() {
  if (!isLoggedIn.value) {
    router.push({ path: '/login', query: { redirect: '/workspace' } })
  } else {
    router.push('/workspace')
  }
}

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

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<style scoped lang="scss">
.home-page {
  min-height: 100vh;
  width: 100%;
  background:
    radial-gradient(circle at 15% 15%, rgba(91, 141, 239, 0.16), transparent 45%),
    radial-gradient(circle at 85% 80%, rgba(123, 91, 255, 0.2), transparent 45%),
    linear-gradient(135deg, #f6f8fc 0%, #eef1f8 100%);
}

.home-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 56px;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 0;

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;

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

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

/* ===== Hero ===== */
.hero {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 48px;
  align-items: center;
  padding: 24px 0 8px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(91, 141, 239, 0.1);
  color: #3d66c9;
  font-size: 12.5px;
  font-weight: 500;
  margin-bottom: 16px;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #5b8def;
    box-shadow: 0 0 0 4px rgba(91, 141, 239, 0.2);
  }
}

.hero-title {
  font-size: 46px;
  line-height: 1.25;
  color: #1f2a44;
  margin: 0 0 16px;
  font-weight: 700;
  letter-spacing: 0.5px;

  .highlight {
    background: linear-gradient(120deg, #5b8def, #7b5bff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}

.hero-desc {
  font-size: 16px;
  line-height: 1.9;
  color: #5b6680;
  margin: 0 0 24px;
  max-width: 540px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 32px;
}

.hero-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px 24px;

  li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(91, 141, 239, 0.12);
    border-radius: 12px;
    backdrop-filter: blur(4px);
  }

  .feature-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 18px;
    flex-shrink: 0;
  }

  .icon-blue {
    background: linear-gradient(135deg, #5b8def, #7b5bff);
  }
  .icon-purple {
    background: linear-gradient(135deg, #7b5bff, #b55bff);
  }
  .icon-orange {
    background: linear-gradient(135deg, #ff8a65, #ffb347);
  }
  .icon-green {
    background: linear-gradient(135deg, #43a047, #66bb6a);
  }

  .feature-title {
    font-size: 14px;
    font-weight: 600;
    color: #1f2a44;
  }

  .feature-desc {
    font-size: 12.5px;
    color: #6b7590;
    margin-top: 2px;
    line-height: 1.5;
  }
}

.hero-right {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  min-height: 420px;
}

.card-stack {
  position: relative;
  width: 100%;
  max-width: 520px;
}

.card {
  border-radius: 16px;
}

.card-bg {
  position: absolute;
  inset: 32px -20px -32px 20px;
  background: linear-gradient(135deg, rgba(91, 141, 239, 0.3), rgba(123, 91, 255, 0.35));
  transform: rotate(-3deg);
  opacity: 0.7;
  z-index: 1;
  filter: blur(2px);
}

.card-front {
  position: relative;
  background: #ffffff;
  border: 1px solid #e3e8f5;
  z-index: 2;
  box-shadow:
    0 24px 60px rgba(60, 80, 150, 0.18),
    0 6px 16px rgba(60, 80, 150, 0.08);
  overflow: hidden;
}

.card-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f5f7fc;
  border-bottom: 1px solid #e3e8f5;

  span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ffb4b4;
  }

  span:nth-child(2) {
    background: #ffd48a;
  }

  span:nth-child(3) {
    background: #b0e9c4;
  }

  .card-title {
    margin-left: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    color: #6b7590;
  }
}

.card-code {
  margin: 0;
  padding: 20px 22px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  line-height: 1.85;
  color: #2b3350;
  background: #fbfcff;
  white-space: pre;
  overflow-x: auto;
}

.card-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e3e8f5;
  background: #fbfcff;

  .pill {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
  }
  .pill-ok {
    background: rgba(67, 160, 71, 0.12);
    color: #2e7d32;
  }
  .pill-time {
    background: rgba(91, 141, 239, 0.12);
    color: #3d66c9;
  }
}

/* ===== Stats ===== */
.stats-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(91, 141, 239, 0.12);
  border-radius: 16px;
  backdrop-filter: blur(4px);

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-item {
    text-align: center;
    padding: 16px 8px;
    border-right: 1px dashed rgba(91, 141, 239, 0.18);

    &:last-child {
      border-right: none;
    }
  }

  .stat-num {
    font-size: 36px;
    font-weight: 700;
    color: #1f2a44;
    line-height: 1;

    sup {
      font-size: 14px;
      color: #5b8def;
      margin-left: 2px;
      font-weight: 500;
    }
  }

  .stat-label {
    margin-top: 10px;
    font-size: 13px;
    color: #6b7590;
  }
}

/* ===== Generic Section ===== */
.section {
  padding: 24px 0;
}

.section-head {
  margin-bottom: 32px;
  max-width: 640px;

  &.center {
    margin-left: auto;
    margin-right: auto;
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

.gradient-text {
  background: linear-gradient(120deg, #5b8def, #7b5bff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* ===== Feature grid ===== */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;

  @media (max-width: 960px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.feature-card {
  position: relative;
  padding: 24px 22px 20px;
  background: #fff;
  border: 1px solid rgba(91, 141, 239, 0.12);
  border-radius: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 36px rgba(60, 80, 150, 0.14);
  }
}

.feature-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.feature-card-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
  font-weight: 600;
  color: #a9b2c3;
  letter-spacing: 1px;
}

.feature-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.feature-card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2a44;
  margin-bottom: 8px;
}

.feature-card-desc {
  font-size: 13px;
  line-height: 1.7;
  color: #6b7590;
}

/* ===== Workflow ===== */
.section-flow {
  padding: 16px 0;
}

.flow-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 960px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.flow-item {
  position: relative;
  padding: 24px 20px;
  background: #fff;
  border: 1px solid rgba(91, 141, 239, 0.12);
  border-radius: 16px;
}

.flow-index {
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
  font-weight: 700;
  color: #5b8def;
  background: rgba(91, 141, 239, 0.12);
  padding: 4px 10px;
  border-radius: 999px;
  margin-bottom: 14px;
}

.flow-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2a44;
  margin-bottom: 8px;
}

.flow-desc {
  font-size: 13px;
  line-height: 1.7;
  color: #6b7590;
}

.flow-arrow {
  position: absolute;
  top: 42px;
  right: -14px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid rgba(91, 141, 239, 0.2);
  color: #5b8def;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  box-shadow: 0 4px 12px rgba(91, 141, 239, 0.12);

  @media (max-width: 960px) {
    display: none;
  }
}

/* ===== Compare ===== */
.section-compare {
  padding: 16px 0;
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  gap: 20px;
  background: #fff;
  border: 1px solid rgba(91, 141, 239, 0.12);
  border-radius: 16px;
  padding: 28px;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
    padding: 20px;
  }
}

.compare-tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  margin-bottom: 12px;
}

.compare-tag-text {
  background: rgba(123, 91, 255, 0.12);
  color: #6a46c4;
}

.compare-tag-sql {
  background: rgba(67, 160, 71, 0.12);
  color: #2e7d32;
}

.compare-panel {
  padding: 16px 18px;
  background: #f7f9fc;
  border-radius: 12px;
  min-height: 210px;

  p {
    margin: 0 0 8px;
    font-size: 14px;
    line-height: 1.85;
    color: #424d68;

    b {
      color: #1f2a44;
      background: rgba(91, 141, 239, 0.12);
      padding: 1px 6px;
      border-radius: 4px;
    }
  }
}

.compare-panel-code {
  background: #0f1a33;
  color: #cdd5ea;

  pre {
    margin: 0;
    padding: 0;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    line-height: 1.85;
    white-space: pre;
  }
}

.compare-sep {
  display: flex;
  align-items: center;
  justify-content: center;

  .sep-circle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #5b8def, #7b5bff);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    box-shadow: 0 8px 20px rgba(91, 141, 239, 0.35);
  }
}

/* ===== FAQ ===== */
.section-faq {
  padding: 16px 0;
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

.home-footer {
  text-align: center;
  color: #8a93a8;
  font-size: 12.5px;
  padding: 12px 0 24px;
}
</style>
