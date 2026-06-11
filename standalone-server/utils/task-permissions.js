const TASK_GROUP_PERMISSIONS = {
  design: 'admin.tasks.design',
  operator: 'admin.tasks.operator',
  cs: 'admin.tasks.cs'
};

const ALL_TASK_GROUPS = Object.keys(TASK_GROUP_PERMISSIONS);

function normalizeTaskGroup(taskGroup) {
  return taskGroup || 'design';
}

function hasPermission(user, permission) {
  const permissions = user?.permissions || [];
  return user?.role === 'admin' || permissions.includes('*') || permissions.includes(permission);
}

function fullTaskPermissionForGroup(taskGroup) {
  return TASK_GROUP_PERMISSIONS[normalizeTaskGroup(taskGroup)];
}

function canViewAllTaskGroup(user, taskGroup) {
  const permission = fullTaskPermissionForGroup(taskGroup);
  return !!permission && hasPermission(user, permission);
}

function canViewByAllTasksPermission(task, user) {
  return !!task && canViewAllTaskGroup(user, task.task_group);
}

function allowedAllTaskGroups(user) {
  if (user?.role === 'admin' || (user?.permissions || []).includes('*')) {
    return [...ALL_TASK_GROUPS];
  }
  return ALL_TASK_GROUPS.filter(group => canViewAllTaskGroup(user, group));
}

function taskGroupSqlExpr(alias = 't') {
  return `COALESCE(NULLIF(${alias}.task_group, ''), 'design')`;
}

module.exports = {
  TASK_GROUP_PERMISSIONS,
  ALL_TASK_GROUPS,
  normalizeTaskGroup,
  hasPermission,
  fullTaskPermissionForGroup,
  canViewAllTaskGroup,
  canViewByAllTasksPermission,
  allowedAllTaskGroups,
  taskGroupSqlExpr
};
