import { defineStore } from 'pinia'
import { getToken, getRefreshToken, setRefreshToken, getUser, clearAuth, setAuth, onAuthChange } from '@/utils/auth'
import { loginApi, getUserListApi } from '@/api'
import request from '@/api/http'
import { withCache, invalidate } from './cache'
import { hasPermission as checkPermission } from '@/utils/permissions'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken() || '',
    userInfo: getUser() || null,
    permissions: getUser()?.permissions || []
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    role: (state) => state.userInfo?.role || '',
    username: (state) => state.userInfo?.username || '',
    realName: (state) => state.userInfo?.realName || '',
    // 角色判断
    isAdmin: (state) => state.userInfo?.role === 'admin' || state.userInfo?.role === 'sub_admin',
    isSuperAdmin: (state) => state.userInfo?.role === 'admin',
    isSubAdmin: (state) => state.userInfo?.role === 'sub_admin',
    isOperator: (state) => state.userInfo?.role === 'operator',
    isCsAgent: (state) => state.userInfo?.role === 'cs_agent',
    isDesigner: (state) => state.userInfo?.role === 'designer',
    isBasicDesigner: (state) => state.userInfo?.role === 'basic_designer',
    isBasicDesignerLead: (state) => state.userInfo?.role === 'basic_designer' && !!state.userInfo?.isTeamLead,
    isOperatorAssistant: (state) => state.userInfo?.role === 'operator_assistant',
    isStoreManager: (state) => ['admin', 'sub_admin'].includes(state.userInfo?.role) || !!state.userInfo?.isStoreManager,
    hasPermission: (state) => (permission) => {
      if (!permission) return true
      return checkPermission(permission, state.userInfo)
    }
  },

  actions: {
    applyAuth(token, user) {
      this.token = token || ''
      this.userInfo = user || null
      this.permissions = user?.permissions || []
      if (token && user) setAuth(token, user)
    },

    initFromStorage() {
      const token = getToken()
      const user = getUser()
      if (token && user) {
        this.applyAuth(token, user)
      } else {
        this.token = token || ''
        this.userInfo = null
        this.permissions = []
      }
    },

    bindAuthStorage() {
      if (this._unbindAuthStorage) return
      this._unbindAuthStorage = onAuthChange(() => {
        const token = getToken()
        const user = getUser()
        this.token = token || ''
        this.userInfo = user || null
        this.permissions = user?.permissions || []
      })
    },

    async login(loginData) {
      const res = await loginApi(loginData)
      if (res.code === 0) {
        this.applyAuth(res.data.token, res.data.user)
        if (res.data.refreshToken) {
          setRefreshToken(res.data.refreshToken)
        }
      }
      return res
    },

    async logout() {
      const rt = getRefreshToken()
      // 先通知后端删除当前设备的 refreshToken（不影响其他设备）
      if (rt) {
        try { await request.post('/api/auth/logout', { refreshToken: rt }) } catch (_) {}
      }
      // 再清本机
      this.token = ''
      this.userInfo = null
      this.permissions = []
      clearAuth()
      invalidate(this, 'userList')
    },

    // 带缓存的用户列表查询
    async getUserList(params = {}, force = false) {
      if (force) invalidate(this, 'userList')
      return withCache(this, 'userList', () => getUserListApi(params), 2 * 60 * 1000)
    },

    invalidateUserList() {
      invalidate(this, 'userList')
    }
  }
})
