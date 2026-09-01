import { defineStore } from 'pinia'
import { getToken, getRefreshToken, setRefreshToken, getUser, clearAuth, setAuth, onAuthChange } from '@/utils/auth'
import { loginApi, getUserListApi, getMyAvatarApi } from '@/api'
import request from '@/api/http'
import { withCache, invalidate } from './cache'
import { hasPermission as checkPermission } from '@/utils/permissions'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken() || '',
    userInfo: getUser() || null,
    permissions: getUser()?.permissions || [],
    avatarUrl: '',
    avatarLoaded: false,
    avatarLoading: false,
    avatarRequestVersion: 0
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
      const previousUserId = this.userInfo?.id
      if (previousUserId && previousUserId !== user?.id) this.clearAvatar()
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
        if (this.userInfo?.id && this.userInfo.id !== user?.id) this.clearAvatar()
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
      this.clearAvatar()
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
    },

    clearAvatar() {
      this.avatarRequestVersion += 1
      if (this.avatarUrl) URL.revokeObjectURL(this.avatarUrl)
      this.avatarUrl = ''
      this.avatarLoaded = false
      this.avatarLoading = false
      this._avatarLoadPromise = null
    },

    async loadAvatar(force = false) {
      if (this.avatarLoading && !force) return this._avatarLoadPromise
      if (this.avatarLoaded && !force) return

      const userId = this.userInfo?.id
      if (!userId) return
      const requestVersion = this.avatarRequestVersion + 1
      this.avatarRequestVersion = requestVersion
      this.avatarLoading = true

      const loadPromise = (async () => {
        let nextUrl = ''
        try {
          const blob = await getMyAvatarApi()
          nextUrl = blob instanceof Blob && blob.size > 0
            ? URL.createObjectURL(blob)
            : ''

          if (requestVersion !== this.avatarRequestVersion || this.userInfo?.id !== userId) {
            if (nextUrl) URL.revokeObjectURL(nextUrl)
            return
          }

          if (this.avatarUrl) URL.revokeObjectURL(this.avatarUrl)
          this.avatarUrl = nextUrl
          this.avatarLoaded = true
        } catch (_) {
          if (requestVersion === this.avatarRequestVersion && this.userInfo?.id === userId) {
            this.avatarLoaded = true
          }
        }
      })()

      this._avatarLoadPromise = loadPromise
      try {
        return await loadPromise
      } finally {
        if (requestVersion === this.avatarRequestVersion) this.avatarLoading = false
        if (this._avatarLoadPromise === loadPromise) this._avatarLoadPromise = null
      }
    }
  }
})
