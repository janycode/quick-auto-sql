import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { useUserStore } from '@/stores/user'

// 白名单：即使未登录也能访问的页面
const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/health'])

function isPublicRoute(to: RouteLocationNormalized): boolean {
  if (to.meta?.public === true) return true
  return PUBLIC_PATHS.has(to.path)
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('@/views/home/Home.vue'),
      meta: { public: true, title: '首页' },
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/Login.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/register/Register.vue'),
      meta: { public: true, title: '注册' },
    },
    {
      path: '/workspace',
      name: 'Workspace',
      component: () => import('@/views/workspace/Workspace.vue'),
      meta: { title: '工作区' },
    },
    {
      path: '/settings/ai',
      name: 'AiSettings',
      component: () => import('@/views/settings/AiSettings.vue'),
      meta: { title: 'AI 配置' },
    },
    {
      path: '/pricing',
      name: 'Pricing',
      component: () => import('@/views/pricing/Pricing.vue'),
      meta: { public: true, title: '定价' },
    },
    {
      path: '/settings/prompts',
      name: 'PromptSettings',
      component: () => import('@/views/settings/PromptSettings.vue'),
      meta: { title: '提示词配置', adminOnly: true },
    },
    {
      path: '/settings/feedback',
      name: 'FeedbackAdmin',
      component: () => import('@/views/settings/FeedbackAdmin.vue'),
      meta: { title: '反馈管理' },
    },
    {
      path: '/settings/profile',
      name: 'Profile',
      component: () => import('@/views/settings/Profile.vue'),
      meta: { title: '个人中心' },
    },
    {
      path: '/payment',
      name: 'Payment',
      component: () => import('@/views/payment/Payment.vue'),
      meta: { title: '支付' },
    },
  ],
})

let initAuthChecked = false

async function ensureAuthReady(): Promise<boolean> {
  const userStore = useUserStore()
  if (initAuthChecked) {
    return userStore.isLoggedIn
  }
  // 首次进入时，如果存在本地 token，则到后端校验一次，确认登录态有效
  if (userStore.token) {
    const ok = await userStore.fetchMe()
    initAuthChecked = true
    return ok
  }
  userStore.markReady()
  initAuthChecked = true
  return false
}

router.beforeEach(async (to) => {
  const loggedIn = await ensureAuthReady()
  const userStore = useUserStore()

  // 登录/注册页：已登录则跳工作区，未登录放行
  if (to.path === '/login' || to.path === '/register') {
    return loggedIn ? '/workspace' : true
  }

  // 公开页面（首页、静态页面等）：直接放行
  if (isPublicRoute(to)) {
    return true
  }

  // 业务页面：未登录重定向到登录页
  if (!loggedIn) {
    return {
      path: '/login',
      query: { redirect: to.fullPath && to.fullPath !== '/' ? to.fullPath : '/workspace' },
    }
  }

  // admin 专属页面：非 admin 重定向到工作区
  if (to.meta?.adminOnly === true && !userStore.isAdmin) {
    return '/workspace'
  }

  return true
})

router.afterEach((to) => {
  const title = (to.meta?.title as string) || 'Quick Auto SQL'
  try {
    document.title = `${title} · Quick Auto SQL`
  } catch {
    /* ignore */
  }
})

export default router
