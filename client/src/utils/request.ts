import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
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

request.interceptors.response.use(
  (response) => {
    const { data, config } = response
    if (data && data.code !== 0) {
      // MySQL 不可用：优先弹蒙版提示，不再使用普通 ElMessage
      if (data.code === MYSQL_UNAVAILABLE_CODE && shouldTriggerMysqlUnavailableDialog(config)) {
        showMysqlUnavailableDialog()
        return Promise.reject(new Error(data.message || '未发现可用的mysql服务，请启动服务后刷新重试'))
      }
      if (!config._silentError) {
        ElMessage.error(data.message || '请求失败')
      }
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  (error) => {
    const data = error.response?.data
    const message = data?.message || error.message || '网络错误'

    // 兼容后端异常链路未走到 error-handler 的情况：
    // 通过响应体 message 做兜底识别，同样触发蒙版提示
    const dataCodeMatch = data && typeof data.code === 'number' && data.code === MYSQL_UNAVAILABLE_CODE
    const fallbackMatch =
      typeof message === 'string' &&
      message.length > 0 &&
      (message.includes('未发现可用的mysql服务') ||
        message.toLowerCase().includes('econnrefused') ||
        message.toLowerCase().includes('mysql') && message.toLowerCase().includes('connect'))

    if ((dataCodeMatch || fallbackMatch) && shouldTriggerMysqlUnavailableDialog(error.config)) {
      showMysqlUnavailableDialog()
      return Promise.reject(error)
    }

    if (!error.config?._silentError) {
      ElMessage.error(message)
    }
    return Promise.reject(error)
  }
)

export default request
