const STAGES = ['selection', 'preparation', 'testing', 'monitoring', 'breakout', 'summary'];

const NEXT_STAGE = {
  selection: 'preparation',
  preparation: 'testing',
  testing: 'monitoring',
  monitoring: 'breakout',
  breakout: 'summary',
  summary: null
};

const PERMISSIONS = {
  selection: 'payment.selection.view',
  records: 'payment.records.view',
  open: 'payment.open',
  managerReview: 'payment.manager_review',
  reopen: 'payment.stage_reopen',
  delete: 'payment.delete'
};

const POTENTIAL_STATUS = ['符合潜力款标准', '不符合'];
const UNQUALIFIED_ACTIONS = ['设控投产8', '直接关闭', '加入全店推广', '/'];

module.exports = {
  STAGES,
  NEXT_STAGE,
  PERMISSIONS,
  POTENTIAL_STATUS,
  UNQUALIFIED_ACTIONS
};
