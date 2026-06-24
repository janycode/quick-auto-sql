<template>
  <div class="home-page">
    <div class="home-container">
      <header class="home-header">
        <div class="brand" @click="$router.push('/')">
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

        <nav class="nav-links">
          <a :class="{ active: isHome }" @click.prevent="$router.push('/')">首页</a>
          <a :class="{ active: isPricing }" @click.prevent="goPricing">定价</a>
        </nav>

        <div class="header-actions">
          <el-button v-if="!isLoggedIn" type="primary" size="default" @click="goLogin">登录</el-button>
          <template v-else>
            <span class="welcome-label">欢迎，</span>
            <span class="account-label">{{ username }}</span>
            <el-button size="default" type="primary" @click="$router.push('/workspace')">进入工作区</el-button>
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

      <!-- ===== Section 7：关于 / 项目说明 ===== -->
      <section class="section section-about">
        <div class="about-grid">
          <div class="about-main">
            <span class="section-tag">ABOUT</span>
            <h2 class="section-title">关于 <span class="gradient-text">Quick Auto SQL</span></h2>
            <p class="section-sub">
              当前版本仅支持 <b>MySQL</b> 以及兼容 MySQL 语法的数据库（如 MariaDB、TiDB）；工具由
              <b>个人独立开发</b>，后续将逐步适配更多数据库与更多大语言模型。
            </p>
            <p class="section-sub">
              如果觉得好用，欢迎多多关注与支持；遇到任何问题、建议或想法，都非常欢迎到
              <b>「反馈」</b> 区域留言，我会认真查阅每一条反馈。感谢支持 🎉
            </p>

            <div class="about-actions">
              <el-button type="primary" round @click="goWorkspace">
                <el-icon style="margin-right:6px"><MagicStick /></el-icon>
                开始使用
              </el-button>
              <el-button round plain @click="onFeedback">
                <el-icon style="margin-right:6px"><ChatDotRound /></el-icon>
                提交反馈
              </el-button>
            </div>
          </div>

          <div class="about-side">
            <div v-for="(item, idx) in aboutList" :key="item.title" class="about-item">
              <div class="about-icon" :style="{ background: item.color }">
                <el-icon><component :is="item.icon" /></el-icon>
              </div>
              <div class="about-body">
                <div class="about-title">{{ item.title }}</div>
                <div class="about-desc">{{ item.desc }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Section 8：CTA ===== -->
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

      <!-- ===== 反馈对话框 ===== -->
      <el-dialog
        v-model="feedbackVisible"
        title="提交反馈"
        width="560px"
        :close-on-click-modal="false"
        destroy-on-close
        class="feedback-dialog"
      >
        <el-form
          ref="feedbackFormRef"
          :model="feedbackForm"
          :rules="feedbackRules"
          label-position="top"
          label-width="0"
        >
          <el-form-item label="问题类型" prop="type">
            <el-radio-group v-model="feedbackForm.type" class="feedback-radio-group">
              <el-radio
                v-for="item in feedbackTypeOptions"
                :key="item.value"
                :label="item.value"
                class="feedback-radio"
              >
                <span class="radio-title">{{ item.label }}</span>
                <span class="radio-desc">{{ item.desc }}</span>
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="详细描述" prop="description">
            <el-input
              v-model="feedbackForm.description"
              type="textarea"
              :autosize="{ minRows: 5, maxRows: 10 }"
              maxlength="1000"
              show-word-limit
              placeholder="请尽可能详细地描述问题、使用场景与你的想法"
            />
          </el-form-item>

          <el-form-item label="联系方式（邮箱）">
            <el-input
              v-model="feedbackForm.email"
              placeholder="name@example.com（选填，便于后续沟通与回复）"
              clearable
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="feedbackVisible = false">取消</el-button>
          <el-button type="primary" :loading="feedbackSubmitting" @click="submitFeedback">
            提交反馈
          </el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessageBox, ElMessage } from 'element-plus'
import {
  ArrowRight,
  Connection,
  MagicStick,
  DataAnalysis,
  Document,
  ChatDotRound,
  Cpu,
  User,
  TrendCharts,
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { submitFeedback as apiSubmitFeedback, type FeedbackType } from '@/api/feedback'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const year = computed(() => new Date().getFullYear())
const isLoggedIn = computed(() => userStore.isLoggedIn)
const username = computed(() => userStore.username)
const isHome = computed(() => route.path === '/')
const isPricing = computed(() => route.path === '/pricing')

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

const aboutList = [
  {
    title: '当前支持的数据库',
    desc: 'MySQL 及其他兼容 MySQL 语法的数据库（如 MariaDB、TiDB）。',
    icon: 'Cpu',
    color: 'linear-gradient(135deg,#5b8def,#7b5bff)',
  },
  {
    title: '个人独立开发',
    desc: '由个人开发者持续维护，关注使用体验与细节打磨，更贴近一线工程师的实际需求。',
    icon: 'User',
    color: 'linear-gradient(135deg,#7b5bff,#b55bff)',
  },
  {
    title: '未来规划',
    desc: '后续将逐步支持更多数据库（PostgreSQL、SQL Server 等）以及接入更多主流大语言模型。',
    icon: 'TrendCharts',
    color: 'linear-gradient(135deg,#ff8a65,#ffb347)',
  },
  {
    title: '期待你的反馈',
    desc: '无论你有问题、建议或想法，都欢迎到「反馈」区域告诉我，我会认真查阅每一条。',
    icon: 'ChatDotRound',
    color: 'linear-gradient(135deg,#43a047,#66bb6a)',
  },
]

/* ===== 反馈表单 ===== */
const feedbackVisible = ref(false)
const feedbackSubmitting = ref(false)
const feedbackFormRef = ref<FormInstance>()

const feedbackTypeOptions = [
  { value: 'bug', label: '功能异常', desc: '功能故障或不可用' },
  { value: 'suggestion', label: '产品建议', desc: '功能用得不爽想提建议' },
  { value: 'security', label: '安全问题', desc: '密码、数据、隐私等' },
  { value: 'other', label: '其他问题', desc: '其他类型的问题与想法' },
]

function emptyFeedbackForm() {
  return { type: '', description: '', email: '' }
}

const feedbackForm = reactive(emptyFeedbackForm())

const feedbackRules: FormRules = {
  type: [
    { required: true, message: '请选择问题类型', trigger: 'change' },
  ],
  description: [
    { required: true, message: '请填写详细描述', trigger: 'blur' },
    { min: 5, max: 1000, message: '长度在 5 到 1000 个字符之间', trigger: 'blur' },
  ],
  email: [
    {
      type: 'email',
      message: '请输入合法的邮箱地址',
      trigger: 'blur',
    },
  ],
}

function onFeedback() {
  Object.assign(feedbackForm, emptyFeedbackForm())
  feedbackFormRef.value?.clearValidate?.()
  feedbackVisible.value = true
}

async function submitFeedback() {
  const form = feedbackFormRef.value
  if (!form) return
  try {
    const valid = await form.validate().catch(() => false)
    if (!valid) return
  } catch {
    return
  }

  feedbackSubmitting.value = true
  try {
    const res = await apiSubmitFeedback({
      type: feedbackForm.type as FeedbackType,
      description: feedbackForm.description,
      email: feedbackForm.email || undefined,
    })
    if (res?.code === 0) {
      ElMessage.success('感谢你的反馈，我已收到！')
      feedbackVisible.value = false
    }
  } finally {
    feedbackSubmitting.value = false
  }
}

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

function goPricing() {
  router.push('/pricing')
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
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", Roboto, "Helvetica Neue", Arial,
    sans-serif;
  color: #1f2a44;
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

    .welcome-label {
      font-size: 13px;
      color: #8a93a8;
      font-weight: 400;
    }

    .account-label {
      font-size: 13.5px;
      color: #1f2a44;
      font-weight: 500;
      padding: 0 4px;
    }
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
    font-size: 12.5px;
    color: #6b7590;
  }
}

.card-code {
  margin: 0;
  padding: 20px 22px;
  font-family: "JetBrains Mono", "SF Mono", "Menlo", "Monaco",
    ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  line-height: 1.85;
  color: #2b3350;
  background: #fbfcff;
  white-space: pre;
  overflow-x: auto;

  code {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    background: transparent;
    padding: 0;
  }
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
  font-size: 14px;
  font-weight: 700;
  color: #5b8def;
  background: rgba(91, 141, 239, 0.12);
  padding: 4px 10px;
  border-radius: 999px;
  margin-bottom: 14px;
  letter-spacing: 0.5px;
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
    font-family: "JetBrains Mono", "SF Mono", "Menlo", "Monaco",
      ui-monospace, SFMono-Regular, Menlo, monospace;
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

/* ===== About 项目说明 ===== */
.section-about {
  padding: 16px 0;
}

.about-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 32px;
  padding: 32px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(91, 141, 239, 0.15);
  border-radius: 20px;
  backdrop-filter: blur(4px);

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    padding: 24px;
    gap: 24px;
  }
}

.about-main {
  .section-tag,
  .section-title,
  .section-sub {
    max-width: 620px;
  }

  .section-sub {
    margin-top: 8px;
    margin-bottom: 12px;

    b {
      color: #1f2a44;
      background: rgba(91, 141, 239, 0.12);
      padding: 1px 6px;
      border-radius: 4px;
    }
  }
}

.about-actions {
  display: flex;
  gap: 12px;
  margin-top: 22px;
  flex-wrap: wrap;
}

.about-side {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-content: start;
}

.about-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px;
  background: linear-gradient(135deg, #ffffff 0%, #f7f9fc 100%);
  border: 1px solid rgba(91, 141, 239, 0.12);
  border-radius: 14px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(60, 80, 150, 0.12);
  }
}

.about-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.about-body {
  flex: 1;
  min-width: 0;
}

.about-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2a44;
  margin-bottom: 4px;
}

.about-desc {
  font-size: 13px;
  line-height: 1.7;
  color: #6b7590;
}

/* ===== 反馈对话框 ===== */
.feedback-dialog {
  :deep(.el-dialog__body) {
    padding-top: 8px;
    padding-bottom: 8px;
  }

  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .feedback-radio-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: 100%;
  }

  .feedback-radio {
    display: flex;
    align-items: flex-start;
    padding: 14px 16px;
    border: 1px solid #dcdfe6;
    border-radius: 10px;
    margin-right: 0;
    transition: all 0.25s ease;
    cursor: pointer;
    background: #fff;
    box-sizing: border-box;
    height: auto !important;
    min-height: 56px;

    &.is-checked {
      border-color: #5b8def;
      background: linear-gradient(135deg, rgba(91, 141, 239, 0.08), rgba(123, 91, 255, 0.06));
      box-shadow: 0 2px 8px rgba(91, 141, 239, 0.12);
    }

    &:hover {
      border-color: #5b8def;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(91, 141, 239, 0.1);
    }

    :deep(.el-radio__input) {
      margin-top: 2px;
      flex-shrink: 0;
    }

    :deep(.el-radio__label) {
      display: flex;
      flex-direction: column;
      padding-left: 8px;
      line-height: 1.4;
      flex: 1;
      min-width: 0;
      white-space: normal;
    }

    .radio-title {
      font-size: 14px;
      font-weight: 600;
      color: #1f2a44;
      line-height: 1.4;
      display: block;
    }

    .radio-desc {
      margin-top: 4px;
      font-size: 12.5px;
      color: #6b7590;
      line-height: 1.5;
      display: block;
      white-space: normal;
    }
  }
}
</style>
