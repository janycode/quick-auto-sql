import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const TOKEN_STORAGE_KEY = 'quick-auto-sql-token'

export const authToken = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } catch {
      /* ignore */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  },
}

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 请求拦截：把 token 注入到 Authorization 头
request.interceptors.request.use((config) => {
  const token = authToken.get()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

// 扩展 AxiosRequestConfig 以支持 _silentError 属性
declare module 'axios' {
  interface AxiosRequestConfig {
    _silentError?: boolean
  }
}

// MySQL 不可用错误码（与后端 error-handler.ts 保持一致）
const MYSQL_UNAVAILABLE_CODE = 1001
// 蒙版弹窗的防抖：短时间内只弹一次，避免并发多个接口失败时刷屏
let mysqlUnavailableDialogShown = false
let mysqlUnavailableDialogLockUntil = 0
const MYSQL_UNAVAILABLE_DIALOG_LOCK_MS = 5000

// 常见 MySQL 错误的友好中文提示：匹配错误消息中的关键字即可
// 命中时优先展示友好文案，原始错误仅在控制台保留，便于排查
const FRIENDLY_MYSQL_RULES: Array<{ match: (msg: string) => boolean; text: string }> = [
  {
    match: (msg) => /you have an error in your sql syntax|sql syntax/i.test(msg),
    text: 'SQL 语法有误，请检查语句',
  },
  {
    match: (msg) => /table.*doesn'?t exist|unknown table/i.test(msg),
    text: '数据表不存在，请检查表名',
  },
  {
    match: (msg) => /unknown column|unknown column '.*' in/i.test(msg),
    text: '字段不存在，请检查字段名',
  },
  {
    match: (msg) => /duplicate entry|duplicate key/i.test(msg),
    text: '数据重复，唯一键冲突',
  },
  {
    match: (msg) => /no database selected/i.test(msg),
    text: '请先选择一个数据库',
  },
  {
    match: (msg) => /unknown database/i.test(msg),
    text: '数据库不存在，请检查数据库名',
  },
  {
    match: (msg) => /column count doesn'?t match/i.test(msg),
    text: '字段数量与值数量不一致',
  },
  {
    match: (msg) => /incorrect integer value|out of range|truncated/i.test(msg),
    text: '字段值类型或长度不匹配，请检查',
  },
  {
    match: (msg) => /cannot delete or update a parent row/i.test(msg),
    text: '存在外键约束，无法删除或修改相关数据',
  },
  {
    match: (msg) => /cannot add foreign key constraint/i.test(msg),
    text: '外键约束创建失败，请检查表结构与数据',
  },
  {
    match: (msg) => /access denied for user/i.test(msg),
    text: '数据库账号或密码错误，请检查连接配置',
  },
  {
    match: (msg) => /too many connections/i.test(msg),
    text: '数据库连接已满，请稍后重试',
  },
  {
    match: (msg) => /timeout|max_execution_time|lock wait timeout/i.test(msg),
    text: 'SQL 执行超时，请检查语句是否合理',
  },
  {
    match: (msg) => /connect.*mysql|econnrefused|mysql.*connect/i.test(msg),
    text: '数据库连接失败，请确认服务是否启动',
  },
]

function friendlyErrorMessage(raw: string): string {
  if (!raw) return '请求失败'
  const msg = String(raw)
  for (const rule of FRIENDLY_MYSQL_RULES) {
    if (rule.match(msg)) {
      return rule.text
    }
  }
  return msg
}

function shouldTriggerMysqlUnavailableDialog(config: any): boolean {
  if (config && config._silentError) return false
  const now = Date.now()
  if (mysqlUnavailableDialogShown && now < mysqlUnavailableDialogLockUntil) {
    return false
  }
  return true
}

function showMysqlUnavailableDialog() {
  if (mysqlUnavailableDialogShown && Date.now() < mysqlUnavailableDialogLockUntil) {
    return
  }
  mysqlUnavailableDialogShown = true
  mysqlUnavailableDialogLockUntil = Date.now() + MYSQL_UNAVAILABLE_DIALOG_LOCK_MS
  ElMessageBox.alert(
    '未发现可用的mysql服务，请启动服务后刷新重试',
    '数据库连接失败',
    {
      confirmButtonText: '我知道了',
      type: 'error',
      showClose: false,
      closeOnClickModal: false,
      closeOnPressEscape: false,
    }
  )
    .catch(() => {
      // 用户点击确认时不需要抛出，避免被外层再次 catch 为异常
    })
    .finally(() => {
      // 关闭后保留 lock，避免瞬间多请求再次弹窗
      setTimeout(() => {
        mysqlUnavailableDialogShown = false
      }, MYSQL_UNAVAILABLE_DIALOG_LOCK_MS)
    })
}

function handleUnauthorizedIfNeeded(response: { status?: number; data?: any }, silent?: boolean, loginLike?: boolean) {
  // 登录/注册请求不需要"未登录处理"（账号密码错误属于业务错
  if (loginLike) return false
  const status = response?.status
  const code = response?.data?.code
  const isUnauthorized = status === 401 || code === 401
  if (isUnauthorized) {
    authToken.clear()
    // 避免多个并发请求同时弹出提示和重复跳转
    const flagKey = '_quick_auto_sql_logging_out'
    if (!(window as any)[flagKey]) {
      ;(window as any)[flagKey] = true
      if (!silent) {
        ElMessageBox.alert('未登录或会话已失效，请重新登录', '登录状态', {
          confirmButtonText: '去登录',
          type: 'warning',
          showClose: false,
        })
          .catch(() => {})
          .finally(() => {
            ;(window as any)[flagKey] = false
            if (location.pathname !== '/login') {
              location.href = '/login'
            }
          })
      } else {
        ;(window as any)[flagKey] = false
        if (location.pathname !== '/login') {
          location.href = '/login'
        }
      }
    }
    return true
  }
  return false
}

request.interceptors.response.use(
  (response) => {
    const { data, config } = response
    if (data && data.code !== 0) {
      // 未登录优先处理；登录/注册请求不视为"会话失效"
      const url = typeof config.url === 'string' ? config.url : ''
      const loginLike = /\/auth\/(login|register)(\/|$|\?)/.test(url) ||
        /\/auth\/email\/(send-code|check)(\/|$|\?)/.test(url)
      if (!loginLike && handleUnauthorizedIfNeeded({ status: response.status, data }, config._silentError)) {
        return Promise.reject(new Error(data.message || '未登录'))
      }
      // MySQL 不可用：优先弹蒙版提示，不再使用普通 ElMessage
      if (data.code === MYSQL_UNAVAILABLE_CODE && shouldTriggerMysqlUnavailableDialog(config)) {
        showMysqlUnavailableDialog()
        return Promise.reject(new Error(data.message || '未发现可用的mysql服务，请启动服务后刷新重试'))
      }
      // 429 配额超限
      if (data.code === 429 && data.data?.upgradeHint) {
        window.dispatchEvent(new CustomEvent('quota-limit-exceeded', { detail: data.data }))
      }
      if (!config._silentError) {
        const display = friendlyErrorMessage(data.message || '请求失败')
        ElMessage.error(display)
      }
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  (error) => {
    // 401 等状态码错误走这里；登录/注册请求不视为"会话失效"
    const url = typeof error.config?.url === 'string' ? error.config.url : ''
    const loginLike = /\/auth\/(login|register)(\/|$|\?)/.test(url) ||
      /\/auth\/email\/(send-code|check)(\/|$|\?)/.test(url)
    if (!loginLike && handleUnauthorizedIfNeeded({ status: error.response?.status, data: error.response?.data }, error.config?._silentError)) {
      return Promise.reject(error)
    }

    // 处理服务不可用的情况（502/503/504/ECONNREFUSED）- 代理/后端未启动
    const status = error.response?.status
    const isServiceUnavailable =
      status === 502 || status === 503 || status === 504 ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'

    if (isServiceUnavailable) {
      if (!error.config?._silentError) {
        const hintMap: Record<number, string> = {
          502: '后端服务未启动或无响应，请先启动后端服务后再试',
          503: '后端服务暂不可用，请稍后再试',
          504: '后端服务响应超时，请稍后再试',
        }
        const hint = hintMap[status] || '网络连接失败，请检查后端服务是否正常启动'
        ElMessageBox.alert(hint, '服务不可用', {
          confirmButtonText: '我知道了',
          type: 'warning',
          showClose: false,
        }).catch(() => {})
      }
      return Promise.reject(error)
    }

    // 429 Too Many Requests: 被限流（含配额超限）
    if (status === 429) {
      if (!error.config?._silentError) {
        const data = error.response?.data
        const message = data?.message || '请求过于频繁，请稍后再试'
        const isQuotaExceeded = data?.data?.upgradeHint === true
        if (isQuotaExceeded) {
          ElMessage.warning(message)
          window.dispatchEvent(new CustomEvent('quota-limit-exceeded', { detail: data?.data }))
        } else {
          ElMessage.warning(message)
        }
      }
      return Promise.reject(error)
    }

    const data = error.response?.data
    const rawMessage = data?.message || error.message || '网络错误'

    // 兼容后端异常链路未走到 error-handler 的情况：
    // 通过响应体 message 做兜底识别，同样触发蒙版提示
    const dataCodeMatch = data && typeof data.code === 'number' && data.code === MYSQL_UNAVAILABLE_CODE
    const fallbackMatch =
      typeof rawMessage === 'string' &&
      rawMessage.length > 0 &&
      (rawMessage.includes('未发现可用的mysql服务') ||
        rawMessage.toLowerCase().includes('econnrefused') ||
        rawMessage.toLowerCase().includes('mysql') && rawMessage.toLowerCase().includes('connect'))

    if ((dataCodeMatch || fallbackMatch) && shouldTriggerMysqlUnavailableDialog(error.config)) {
      showMysqlUnavailableDialog()
      return Promise.reject(error)
    }

    if (!error.config?._silentError) {
      ElMessage.error(friendlyErrorMessage(rawMessage))
    }
    return Promise.reject(error)
  }
)

export default request
