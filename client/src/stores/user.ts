import { defineStore } from 'pinia'
import {
  login as apiLogin,
  logout as apiLogout,
  getMe,
  register as apiRegister,
  getQuotaInfo as apiGetQuotaInfo,
  upgradePlan as apiUpgradePlan,
} from '@/api/auth'
import type { ILoginRequest, IRegisterRequest, PlanType, IQuotaInfo } from '@/api/auth'
import { authToken } from '@/utils/request'

type UserRole = 'admin' | 'editor' | 'viewer'

interface IUserState {
  token: string | null
  userId: string | null
  username: string | null
  role: UserRole
  ready: boolean
  plan: PlanType
  quota: IQuotaInfo | null
}

const USER_STORAGE_KEY = 'quick-auto-sql-user'

function readSavedUser(): { userId: string | null; username: string | null; role: UserRole } {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (raw) {
      const obj = JSON.parse(raw)
      return {
        userId: typeof obj?.userId === 'string' ? obj.userId : null,
        username: typeof obj?.username === 'string' ? obj.username : null,
        role: (obj?.role as UserRole) || 'viewer',
      }
    }
  } catch {
    /* ignore */
  }
  return { userId: null, username: null, role: 'viewer' }
}

function saveUserInfo(userId: string | null, username: string | null, role: UserRole = 'viewer') {
  try {
    if (userId && username) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ userId, username, role }))
    } else {
      localStorage.removeItem(USER_STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

function pickErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback
  const dataMessage = err?.response?.data?.message
  if (typeof dataMessage === 'string' && dataMessage) return dataMessage
  if (typeof err.message === 'string' && err.message) return err.message
  return fallback
}

export const useUserStore = defineStore('user', {
  state: (): IUserState => {
    const saved = readSavedUser()
    return {
      token: authToken.get(),
      userId: saved.userId,
      username: saved.username,
      role: saved.role,
      ready: false,
      plan: 'free',
      quota: null,
    }
  },
  getters: {
    isLoggedIn(state): boolean {
      return !!state.token
    },
    isAdmin(state): boolean {
      return state.role === 'admin'
    },
    isEditor(state): boolean {
      return state.role === 'admin' || state.role === 'editor'
    },
  },
  actions: {
    async login(payload: ILoginRequest): Promise<void> {
      let result: { code: number; data: ILoginResult; message?: string } | undefined
      try {
        result = await apiLogin(payload)
      } catch (err: any) {
        throw new Error(pickErrorMessage(err, '登录失败'))
      }
      if (!result || result.code !== 0) {
        throw new Error(result?.message || '登录失败')
      }
      if (result.data?.token) {
        authToken.set(result.data.token)
        this.token = result.data.token
        this.userId = result.data.userId ?? null
        this.username = result.data.username ?? null
        this.role = (result.data.role as UserRole) || 'viewer'
        this.plan = result.data.plan || 'free'
        this.quota = result.data.quota || null
        saveUserInfo(this.userId, this.username, this.role)
      }
    },
    async register(payload: IRegisterRequest): Promise<void> {
      let result: { code: number; data: ILoginResult; message?: string } | undefined
      try {
        result = await apiRegister(payload)
      } catch (err: any) {
        throw new Error(pickErrorMessage(err, '注册失败'))
      }
      if (!result || result.code !== 0) {
        throw new Error(result?.message || '注册失败')
      }
      if (result.data?.token) {
        authToken.set(result.data.token)
        this.token = result.data.token
        this.userId = result.data.userId ?? null
        this.username = result.data.username ?? null
        this.role = (result.data.role as UserRole) || 'editor'
        this.plan = result.data.plan || 'free'
        this.quota = result.data.quota || null
        saveUserInfo(this.userId, this.username, this.role)
      }
    },
    async logout(): Promise<void> {
      try {
        await apiLogout()
      } catch {
        /* ignore */
      }
      authToken.clear()
      this.token = null
      this.userId = null
      this.username = null
      this.role = 'viewer'
      this.plan = 'free'
      this.quota = null
      saveUserInfo(null, null)
    },
    async fetchMe(): Promise<boolean> {
      if (!this.token) {
        this.ready = true
        return false
      }
      try {
        const res = await getMe()
        if (res?.data) {
          this.userId = res.data.userId ?? this.userId
          this.username = res.data.username ?? this.username
          this.role = (res.data.role as UserRole) || this.role
          this.plan = res.data.plan || 'free'
          this.quota = res.data.quota || null
          saveUserInfo(this.userId, this.username, this.role)
          this.ready = true
          return true
        }
      } catch {
        authToken.clear()
        this.token = null
        this.userId = null
        this.username = null
        this.role = 'viewer'
        this.plan = 'free'
        this.quota = null
        saveUserInfo(null, null)
      }
      this.ready = true
      return false
    },
    async fetchQuota(): Promise<void> {
      try {
        const res = await apiGetQuotaInfo()
        if (res?.data) {
          this.plan = res.data.plan
          this.quota = res.data
        }
      } catch {
        /* ignore */
      }
    },
    async doUpgrade(plan: PlanType): Promise<void> {
      const res = await apiUpgradePlan(plan)
      if (res?.data) {
        this.plan = res.data.plan
        this.quota = res.data
      }
    },
    async doDowngrade(): Promise<void> {
      const res = await apiUpgradePlan('free')
      if (res?.data) {
        this.plan = res.data.plan
        this.quota = res.data
      }
    },
    markReady() {
      this.ready = true
    },
  },
})

interface ILoginResult {
  token: string
  userId: string
  username: string
  role?: string
  plan?: PlanType
  quota?: IQuotaInfo
}
