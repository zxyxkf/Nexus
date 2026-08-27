const PERMISSIONS = [
  { code: 'operator.publish.design', name: '发布美工任务', type: 'page', group: '运营美工' },
  { code: 'operator.tasks.design', name: '我的任务', type: 'page', group: '运营美工' },
  { code: 'operator.review.design', name: '作品审核', type: 'page', group: '运营美工' },
  { code: 'operator.publish.assistant', name: '发布运营任务', type: 'page', group: '运营助理' },
  { code: 'operator.tasks.assistant', name: '我的运营任务', type: 'page', group: '运营助理' },
  { code: 'operator.review.assistant', name: '任务审核', type: 'page', group: '运营助理' },
  { code: 'cs.publish.basic', name: '客服发布任务', type: 'page', group: '客服基础美工' },
  { code: 'cs.tasks.basic', name: '客服我的任务', type: 'page', group: '客服基础美工' },
  { code: 'cs.review.basic', name: '客服作品审核', type: 'page', group: '客服基础美工' },
  { code: 'designer.hall.design', name: '美工任务大厅', type: 'page', group: '美工设计师' },
  { code: 'designer.tasks.design', name: '美工任务记录', type: 'page', group: '美工设计师' },
  { code: 'basic.hall.cs', name: '基础美工任务大厅', type: 'page', group: '基础美工' },
  { code: 'basic.tasks.cs', name: '基础美工任务记录', type: 'page', group: '基础美工' },
  { code: 'assistant.hall.operator', name: '运营助理任务大厅', type: 'page', group: '运营助理' },
  { code: 'assistant.tasks.operator', name: '运营助理任务记录', type: 'page', group: '运营助理' },
  { code: 'stats.personal', name: '个人统计', type: 'page', group: '数据' },
  { code: 'dashboard.design', name: '高级美工仪表盘', type: 'page', group: '数据' },
  { code: 'dashboard.operator', name: '运营助理仪表盘', type: 'page', group: '数据' },
  { code: 'dashboard.cs', name: '基础美工仪表盘', type: 'page', group: '数据' },
  { code: 'admin.users', name: '用户管理', type: 'page', group: '系统管理' },
  { code: 'admin.tasks.design', name: '运营美工全量任务', type: 'page', group: '全量任务' },
  { code: 'admin.tasks.operator', name: '运营助理全量任务', type: 'page', group: '全量任务' },
  { code: 'admin.tasks.cs', name: '客服基础美工全量任务', type: 'page', group: '全量任务' },
  { code: 'admin.logs', name: '操作日志', type: 'page', group: '系统管理' },
  { code: 'admin.config', name: '系统配置', type: 'page', group: '系统管理' },
  { code: 'score.review.basic', name: '基础美工分值审核', type: 'page', group: '分值管理' },
  { code: 'score.records.basic', name: '基础美工审核记录', type: 'page', group: '分值管理' },
  { code: 'notification.center', name: '通知中心', type: 'page', group: '通用' },
  { code: 'payment.selection.view', name: '选品收集', type: 'page', group: '打款跟踪' },
  { code: 'payment.records.view', name: '打款记录', type: 'page', group: '打款跟踪' },

  { code: 'task.create.design', name: '创建美工任务', type: 'action', group: '任务操作' },
  { code: 'task.create.operator', name: '创建运营助理任务', type: 'action', group: '任务操作' },
  { code: 'task.create.cs', name: '创建客服任务', type: 'action', group: '任务操作' },
  { code: 'cs.task_no.update', name: '修改基础美工任务编号', type: 'action', group: '客服基础美工' },
  { code: 'task.review.own', name: '审核自己发布的任务', type: 'action', group: '任务操作' },
  { code: 'task.review.store', name: '审核同店铺任务', type: 'action', group: '任务操作' },
  { code: 'task.review.all', name: '审核全部任务', type: 'action', group: '任务操作' },
  { code: 'task.view.own', name: '查看自己任务', type: 'action', group: '任务数据' },
  { code: 'task.view.store', name: '查看同店铺任务', type: 'action', group: '任务数据' },
  { code: 'task.view.all', name: '查看全部任务', type: 'action', group: '任务数据' },
  { code: 'task.upload.work', name: '上传作品/凭证', type: 'action', group: '任务操作' },
  { code: 'task.download.file', name: '下载任务文件', type: 'action', group: '任务操作' },
  { code: 'task.export', name: '导出任务报表', type: 'action', group: '导出' },
  { code: 'dashboard.export', name: '导出仪表盘报表', type: 'action', group: '导出' },
  { code: 'payment.open', name: '开启打款', type: 'action', group: '打款跟踪' },
  { code: 'payment.manager_review', name: '店长审核准备工作', type: 'action', group: '打款跟踪' },
  { code: 'payment.stage_reopen', name: '阶段重开与流程恢复', type: 'action', group: '打款跟踪' },
  { code: 'payment.delete', name: '删除选品记录', type: 'action', group: '打款跟踪' }
];

const ROLE_DEFAULTS = {
  admin: PERMISSIONS.map(p => p.code),
  sub_admin: [
    'dashboard.design', 'dashboard.operator', 'dashboard.cs',
    'admin.tasks.design', 'admin.tasks.operator', 'admin.tasks.cs',
    'score.review.basic', 'score.records.basic',
    'task.view.all', 'task.download.file', 'task.export', 'dashboard.export', 'notification.center'
  ],
  operator: [
    'operator.publish.design', 'operator.tasks.design', 'operator.review.design',
    'operator.publish.assistant', 'operator.tasks.assistant', 'operator.review.assistant',
    'stats.personal', 'dashboard.design', 'dashboard.operator',
    'task.create.design', 'task.create.operator', 'task.review.own',
    'task.view.store', 'task.download.file', 'notification.center'
  ],
  cs_agent: [
    'cs.publish.basic', 'cs.tasks.basic', 'cs.review.basic',
    'stats.personal', 'dashboard.cs',
    'task.create.cs', 'cs.task_no.update', 'task.review.own', 'task.view.own', 'task.download.file', 'notification.center'
  ],
  designer: [
    'designer.hall.design', 'designer.tasks.design', 'stats.personal', 'dashboard.design',
    'task.upload.work', 'task.view.own', 'task.download.file', 'notification.center'
  ],
  basic_designer: [
    'basic.hall.cs', 'basic.tasks.cs', 'stats.personal', 'dashboard.cs',
    'task.upload.work', 'task.view.own', 'task.download.file', 'notification.center'
  ],
  operator_assistant: [
    'assistant.hall.operator', 'assistant.tasks.operator', 'stats.personal', 'dashboard.operator',
    'task.upload.work', 'task.view.own', 'task.download.file', 'notification.center'
  ]
};

const TEAM_LEAD_EXTRA = ['score.review.basic', 'score.records.basic'];

const PERMISSION_IMPLICATIONS = {
  'task.create.design': ['operator.publish.design'],
  'task.create.operator': ['operator.publish.assistant'],
  'task.create.cs': ['cs.publish.basic'],
  'operator.publish.design': ['task.create.design', 'task.view.store', 'task.download.file'],
  'operator.tasks.design': ['task.view.store', 'task.download.file'],
  'operator.review.design': ['task.review.own', 'task.view.store', 'task.download.file'],
  'operator.publish.assistant': ['task.create.operator', 'task.view.store', 'task.download.file'],
  'operator.tasks.assistant': ['task.view.store', 'task.download.file'],
  'operator.review.assistant': ['task.review.own', 'task.view.store', 'task.download.file'],
  'cs.publish.basic': ['task.create.cs', 'task.view.own', 'task.download.file'],
  'cs.tasks.basic': ['task.view.own', 'task.download.file'],
  'cs.review.basic': ['task.review.own', 'task.view.own', 'task.download.file'],
  'designer.hall.design': ['task.view.own', 'task.download.file'],
  'designer.tasks.design': ['task.upload.work', 'task.view.own', 'task.download.file'],
  'basic.hall.cs': ['task.view.own', 'task.download.file'],
  'basic.tasks.cs': ['task.upload.work', 'task.view.own', 'task.download.file'],
  'assistant.hall.operator': ['task.view.own', 'task.download.file'],
  'assistant.tasks.operator': ['task.upload.work', 'task.view.own', 'task.download.file'],
  'admin.tasks.design': ['task.download.file', 'task.export'],
  'admin.tasks.operator': ['task.download.file', 'task.export'],
  'admin.tasks.cs': ['task.download.file', 'task.export'],
  'dashboard.design': ['dashboard.export'],
  'dashboard.operator': ['dashboard.export'],
  'dashboard.cs': ['dashboard.export']
};

function expandPermissions(codes = []) {
  const set = new Set(codes);
  let changed = true;
  while (changed) {
    changed = false;
    for (const code of [...set]) {
      for (const implied of PERMISSION_IMPLICATIONS[code] || []) {
        if (!set.has(implied)) {
          set.add(implied);
          changed = true;
        }
      }
    }
  }
  return [...set];
}

function defaultPermissionsFor(role, isTeamLead = 0) {
  const set = new Set(ROLE_DEFAULTS[role] || []);
  if (role === 'basic_designer' && Number(isTeamLead)) TEAM_LEAD_EXTRA.forEach(p => set.add(p));
  return expandPermissions([...set]);
}

module.exports = { PERMISSIONS, ROLE_DEFAULTS, PERMISSION_IMPLICATIONS, expandPermissions, defaultPermissionsFor };
