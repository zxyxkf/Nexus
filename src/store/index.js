import { defineStore } from 'pinia'
import { getToken, setToken, getRefreshToken, setRefreshToken, getUser, setUser, clearAuth } from '@/utils/auth'
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
    isOperatorAssistant: (state) => state.userInfo?.role === 'operator_assistant'
    ,
    hasPermission: (state) => (permission) => {
      if (!permission) return true
      return checkPermission(permission, state.userInfo)
    }
  },

  actions: {
    initFromStorage() {
      const token = getToken()
      const user = getUser()
      if (token && user) {
        this.token = token
        this.userInfo = user
        this.permissions = user.permissions || []
      }
    },

    async login(loginData) {
      const res = await loginApi(loginData)
      if (res.code === 0) {
        this.token = res.data.token
        this.userInfo = res.data.user
        this.permissions = res.data.user?.permissions || []
        setToken(res.data.token)
        if (res.data.refreshToken) {
          setRefreshToken(res.data.refreshToken)
        }
        setUser(res.data.user)
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
