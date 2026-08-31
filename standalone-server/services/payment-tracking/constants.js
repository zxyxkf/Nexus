const STAGES = ['selection', 'testing', 'monitoring', 'summary'];

const NEXT_STAGE = {
  selection: 'testing',
  testing: 'monitoring',
  monitoring: 'summary',
  summary: null
};

const PERMISSIONS = {
  selection: 'payment.selection.view',
  records: 'payment.records.view',
  viewAll: 'payment.view.all',
  manageAll: 'payment.manage.all',
  open: 'payment.open',
  reopen: 'payment.stage_reopen',
  delete: 'payment.delete'
};

const POTENTIAL_STATUS = ['符合潜力款标准', '不符合'];
const UNQUALIFIED_ACTIONS = ['设控投产8', '直接关闭', '加入全店推广', '/'];
const LINK_STATUS = ['protect_roi', 'keep_breaking'];

module.exports = {
  STAGES,
  NEXT_STAGE,
  PERMISSIONS,
  POTENTIAL_STATUS,
  UNQUALIFIED_ACTIONS,
  LINK_STATUS
};
