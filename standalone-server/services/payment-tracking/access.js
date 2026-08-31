const AppError = require('../../utils/AppError');
const { ownsPermission } = require('../../middleware/auth');
const repository = require('./repository');

function isAdmin(user) {
  return user?.role === 'admin' || (user?.permissions || []).includes('*');
}

function canManageAllPaymentData(user) {
  return isAdmin(user) || (user?.permissions || []).includes('payment.manage.all');
}

function canViewAllPaymentData(user) {
  return canManageAllPaymentData(user)
    || user?.role === 'sub_admin'
    || ownsPermission(user, 'payment.view.all');
}

function canWritePaymentData(user) {
  return canManageAllPaymentData(user) || ownsPermission(user, 'payment.selection.view');
}

function canSetPaymentDecision(record, user) {
  return canManageAllPaymentData(user)
    || user?.role === 'sub_admin'
    || (Boolean(user?.isStoreManager) && Boolean(user?.store) && record?.store === user.store);
}

function canUseManagerReview(user) {
  return canManageAllPaymentData(user)
    || user?.role === 'sub_admin'
    || (Boolean(user?.isStoreManager) && Boolean(user?.store));
}

function canReviewStore(user, store) {
  return canManageAllPaymentData(user)
    || user?.role === 'sub_admin'
    || (Boolean(user?.isStoreManager) && Boolean(user?.store) && user.store === store);
}

async function assertNoPendingManagerReview(recordId, conn) {
  const request = await repository.findManagerReviewRequestByRecordId(recordId, { conn });
  if (request) throw new AppError(403, '待店长审核期间不能修改记录');
}

function hasPaymentPermission(user, permission) {
  return ownsPermission(user, permission)
    || (canManageAllPaymentData(user) && String(permission || '').startsWith('payment.'));
}

function assertPermission(user, permission) {
  if (!hasPaymentPermission(user, permission)) {
    throw new AppError(403, '权限不足，请联系管理员');
  }
}

function assertAnyPermission(user, permissions) {
  if (!permissions.some(permission => hasPaymentPermission(user, permission))) {
    throw new AppError(403, '权限不足，请联系管理员');
  }
}

function assertStoreAccess(record, user) {
  if (canViewAllPaymentData(user)) return;
  if (!user?.store || record.store !== user.store) {
    throw new AppError(403, '无权访问其他店铺的选品记录');
  }
}

function assertRecordViewPermission(record, user) {
  if (canViewAllPaymentData(user)) return;
  assertPermission(
    user,
    record.process_status === 'ended' ? 'payment.records.view' : 'payment.selection.view'
  );
}

function canManageOwnerRecord(record, user) {
  return canManageAllPaymentData(user)
    || Number(record.planner_id) === Number(user?.id)
    || ownsPermission(user, 'payment.stage_reopen');
}

function buildAllowedActions(record, user, options = {}) {
  const inProgress = record.process_status === 'in_progress';
  const ended = record.process_status === 'ended';
  const locked = Boolean(options.managerReviewPending || options.forceReadOnly);
  return {
    edit: !locked && inProgress && hasPaymentPermission(user, 'payment.selection.view'),
    advance: !locked && inProgress && hasPaymentPermission(user, 'payment.selection.view'),
    end: !locked && inProgress && canManageOwnerRecord(record, user),
    restore: !options.forceReadOnly && ended && canManageOwnerRecord(record, user),
    reopen: !locked && inProgress && hasPaymentPermission(user, 'payment.stage_reopen'),
    managerReview: !locked && inProgress && canWritePaymentData(user) && canSetPaymentDecision(record, user),
    delete: !options.forceReadOnly && hasPaymentPermission(user, 'payment.delete')
  };
}

module.exports = {
  isAdmin,
  canManageAllPaymentData,
  canViewAllPaymentData,
  canWritePaymentData,
  canSetPaymentDecision,
  canUseManagerReview,
  canReviewStore,
  assertNoPendingManagerReview,
  hasPaymentPermission,
  assertPermission,
  assertAnyPermission,
  assertStoreAccess,
  assertRecordViewPermission,
  canManageOwnerRecord,
  buildAllowedActions
};
