/**
 * 系统配置缓存 Store
 * 缓存 config 列表（TTL 5 分钟），更新后自动失效
 */

import { defineStore } from 'pinia'
import { getConfigListApi } from '@/api'
import { withCache, invalidate } from './cache'

export const useConfigStore = defineStore('config', {
  state: () => ({}),

  actions: {
    async getConfigList(params = {}, force = false) {
      if (force) invalidate(this, 'configList')
      return withCache(this, 'configList', () => getConfigListApi(params))
    },

    invalidateConfig() {
      invalidate(this, 'configList')
    }
  }
})
