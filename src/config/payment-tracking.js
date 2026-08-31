export const PAYMENT_STAGES = [
  { code: 'selection', label: '信息及选品' },
  { code: 'testing', label: '第二阶段' },
  { code: 'monitoring', label: '第三阶段' },
  { code: 'summary', label: '总结阶段' }
]

export const SELECTION_METHODS = [
  '方式一：通过类目飙升热搜词选品',
  '方式二：搜索分析长尾词',
  '方式三：通过趋势热点选款',
  '方式四: 聊天自检',
  '方式五：跟款',
  '方式六：应季新品',
  '方式七：爆款视觉裂变'
]

export const UNQUALIFIED_ACTIONS = ['设控投产8', '直接关闭', '加入全店推广', '/']
export const LIFECYCLE_OPTIONS = ['大爆款', '小爆款', '强动销', '次动销', '盈利款', '放弃款']
export const YES_NO_OPTIONS = [
  { label: '是', value: true },
  { label: '否', value: false }
]

export const PAYMENT_STAGE_BY_CODE = Object.fromEntries(PAYMENT_STAGES.map(stage => [stage.code, stage]))
