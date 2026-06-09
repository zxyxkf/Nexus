/**
 * 用户 Service — 业务逻辑层，不出现 SQL
 */
const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const userDao = require('../dao/user.dao');
const permissionService = require('./permission.service');

const VALID_ROLES = ['admin', 'sub_admin', 'operator', 'designer', 'cs_agent', 'basic_designer', 'operator_assistant'];
const DEFAULT_PASSWORD = '123456';

// ==================== 查询 ====================

async function getUserList(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 15));
  const { role, status: statusStr, keyword } = query;
  const status = statusStr !== undefined && statusStr !== '' ? parseInt(statusStr) : undefined;

  return userDao.getUserList({ page, pageSize, role, status, keyword });
}

async function getPermissionCatalog() {
  return permissionService.getPermissionCatalog();
}

async function getUserPermissions(userId) {
  if (!userId) throw new AppError(400, '用户ID不能为空');
  const user = await userDao.findFullById(userId);
  if (!user) throw new AppError(400, '用户不存在');
  const overrides = await permissionService.getUserOverrides(userId);
  return {
    defaults: require('../config/permissions').defaultPermissionsFor(user.role, user.is_team_lead),
    allow: overrides.filter(p => p.effect === 'allow').map(p => p.permission_code),
    deny: overrides.filter(p => p.effect === 'deny').map(p => p.permission_code),
    effective: await permissionService.getEffectivePermissions(user)
  };
}

async function saveUserPermissions(userId, permissions, deniedPermissions) {
  if (!userId) throw new AppError(400, '用户ID不能为空');
  await permissionService.saveUserPermissions(userId, permissions || [], deniedPermissions || []);
}

async function getDesignerList() {
  return userDao.getUsersByRole('designer');
}

async function getBasicDesignerList() {
  return userDao.getUsersByRole('basic_designer');
}

async function getOperatorAssistantList() {
  return userDao.getUsersByRole('operator_assistant');
}

async function getPublisherList(userRole, userStore) {
  if (userRole === 'operator_assistant') {
    return userDao.getPublishersByRole('operator');
  }
  if (userRole === 'operator') {
    return userDao.getPublishersByRoleAndStore('operator', userStore);
  }
  // 美工 → 运营发布人，基础美工 → 客服发布人
  if (userRole === 'designer') {
    return userDao.getPublishersByRole('operator');
  }
  if (userRole === 'basic_designer') {
    return userDao.getPublishersByRole('cs_agent');
  }
  return userDao.getPublishersByRole('cs_agent');
}

// ==================== 创建 ====================

async function createUser({ username, password, realName, role, store, isTeamLead, email, phone, remark }) {
  if (!username || !password || !realName || !role) {
    throw new AppError(400, '用户名、密码、姓名、角色不能为空');
  }
  if (!VALID_ROLES.includes(role)) {
    throw new AppError(400, '角色值无效');
  }
  if (role === 'operator' && !store) {
    throw new AppError(400, '运营角色必须选择店铺');
  }
  if (password.length < 6) {
    throw new AppError(400, '密码长度不能少于6位');
  }

  const existing = await userDao.findByUsername(username);
  if (existing) {
    throw new AppError(400, '用户名已存在');
  }

  const hashedPwd = bcrypt.hashSync(password, 10);
  await userDao.createUser({ username, hashedPwd, realName, role, store, isTeamLead, email, phone, remark });
}

// ==================== 更新 ====================

async function updateUser({ id, realName, role, store, isTeamLead, email, phone, remark, status }, currentUserId) {
  if (!id) throw new AppError(400, '用户ID不能为空');
  if (Number(id) === Number(currentUserId) && role) {
    throw new AppError(400, '不能修改自己的角色');
  }
  await userDao.updateUser({ id, realName, role, store, isTeamLead, email, phone, remark, status });
}

// ==================== 密码 ====================

async function resetPassword(id) {
  if (!id) throw new AppError(400, '用户ID不能为空');
  const hashedPwd = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
  await userDao.updatePassword(id, hashedPwd);
}

// ==================== 状态 ====================

async function toggleStatus(id, status, currentUserId) {
  if (!id) throw new AppError(400, '用户ID不能为空');
  if (Number(id) === Number(currentUserId)) {
    throw new AppError(400, '不能禁用自己');
  }
  await userDao.updateStatus(id, status);
}

// ==================== 删除 ====================

async function deleteUser(id, currentUserId) {
  if (!id) throw new AppError(400, '用户ID不能为空');
  if (Number(id) === Number(currentUserId)) {
    throw new AppError(400, '不能删除自己的账号');
  }

  await userDao.deleteUserRelatedData(id);
  await userDao.unlinkUserFromTasks(id);
  await userDao.deleteUserById(id);
}

module.exports = {
  getUserList,
  getPermissionCatalog,
  getUserPermissions,
  saveUserPermissions,
  getDesignerList,
  getBasicDesignerList,
  getOperatorAssistantList,
  getPublisherList,
  createUser,
  updateUser,
  resetPassword,
  toggleStatus,
  deleteUser,
};
