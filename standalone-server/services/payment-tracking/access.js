const AppError = require('../../utils/AppError');
const { ownsPermission } = require('../../middleware/auth');

function isAdmin(user) {
  return user?.role === 'admin' || (user?.permissions || []).includes('*');
}

function assertPermission(user, permission) {
  if (!ownsPermission(user, permission)) {
    throw new AppError(403, '权限不足，请联系管理员');
  }
}

function assertAnyPermission(user, permissions) {
  if (!permissions.some(permission => ownsPermission(user, permission))) {
    throw new AppError(403, '权限不足，请联系管理员');
  }
}

function assertStoreAccess(record, user) {
  if (isAdmin(user)) return;
  if (!user?.store || record.store !== user.store) {
    throw new AppError(403, '无权访问其他店铺的选品记录');
  }
}

function canManageOwnerRecord(record, user) {
  return isAdmin(user)
    || Number(record.planner_id) === Number(user?.id)
    || ownsPermission(user, 'payment.stage_reopen');
}

function buildAllowedActions(record, user) {
  const inProgress = record.process_status === 'in_progress';
  const ended = record.process_status === 'ended';
  return {
    edit: inProgress && ownsPermission(user, 'payment.selection.view'),
    advance: inProgress && ownsPermission(user, 'payment.selection.view'),
    end: inProgress && canManageOwnerRecord(record, user),
    restore: ended && canManageOwnerRecord(record, user),
    reopen: inProgress && (isAdmin(user) || ownsPermission(user, 'payment.stage_reopen')),
    managerReview: inProgress && (isAdmin(user) || ownsPermission(user, 'payment.manager_review')),
    delete: isAdmin(user) || ownsPermission(user, 'payment.delete')
  };
}

module.exports = {
  isAdmin,
  assertPermission,
  assertAnyPermission,
  assertStoreAccess,
  canManageOwnerRecord,
  buildAllowedActions
};
