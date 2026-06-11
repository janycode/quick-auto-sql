import axios from 'axios'
import { ElMessage } from 'element-plus'

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

request.interceptors.response.use(
  (response) => {
    const { data, config } = response
    if (data.code !== 0) {
      if (!config._silentError) {
        ElMessage.error(data.message || '请求失败')
      }
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  (error) => {
    const message = error.response?.data?.message || error.message || '网络错误'
    if (!error.config?._silentError) {
      ElMessage.error(message)
    }
    return Promise.reject(error)
  }
)

export default request
