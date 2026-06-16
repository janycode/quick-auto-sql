import { defineStore } from 'pinia'
import { login as apiLogin, logout as apiLogout, getMe, register as apiRegister } from '@/api/auth'
import type { ILoginRequest, IRegisterRequest } from '@/api/auth'
import { authToken } from '@/utils/request'

interface IUserState {
  token: string | null
  userId: string | null
  username: string | null
  ready: boolean
}

const USER_STORAGE_KEY = 'quick-auto-sql-user'

function readSavedUser(): { userId: string | null; username: string | null } {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (raw) {
      const obj = JSON.parse(raw)
      return {
        userId: typeof obj?.userId === 'string' ? obj.userId : null,
        username: typeof obj?.username === 'string' ? obj.username : null,
      }
    }
  } catch {
    /* ignore */
  }
  return { userId: null, username: null }
}

function saveUserInfo(userId: string | null, username: string | null) {
  try {
    if (userId && username) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ userId, username }))
    } else {
      localStorage.removeItem(USER_STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

export const useUserStore = defineStore('user', {
  state: (): IUserState => {
    const saved = readSavedUser()
    return {
      token: authToken.get(),
      userId: saved.userId,
      username: saved.username,
      ready: false,
    }
  },
  getters: {
    isLoggedIn(state): boolean {
      return !!state.token
    },
    isAdmin(state): boolean {
      return !!state.username && state.username.toLowerCase() === 'admin'
    },
  },
  actions: {
    async login(payload: ILoginRequest): Promise<void> {
      const result = await apiLogin(payload)
      if (result?.data?.token) {
        authToken.set(result.data.token)
        this.token = result.data.token
        this.userId = result.data.userId ?? null
        this.username = result.data.username ?? null
        saveUserInfo(this.userId, this.username)
      }
    },
    async register(payload: IRegisterRequest): Promise<void> {
      const result = await apiRegister(payload)
      if (result?.data?.token) {
        authToken.set(result.data.token)
        this.token = result.data.token
        this.userId = result.data.userId ?? null
        this.username = result.data.username ?? null
        saveUserInfo(this.userId, this.username)
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
          saveUserInfo(this.userId, this.username)
          this.ready = true
          return true
        }
      } catch {
        authToken.clear()
        this.token = null
        this.userId = null
        this.username = null
        saveUserInfo(null, null)
      }
      this.ready = true
      return false
    },
    markReady() {
      this.ready = true
    },
  },
})
