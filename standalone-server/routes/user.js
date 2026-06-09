/**
 * 用户管理模块路由 - 仅 admin 可操作
 * Route 层只做参数校验和响应格式化，业务逻辑委托给 Service 层
 */

const express = require('express');
const router = express.Router();

const { requireAuth, requireRole } = require('../middleware/auth');
const userService = require('../services/user.service');

// 所有接口需要登录
router.use(requireAuth);

/**
 * GET /api/user/list - 分页获取用户列表（admin / sub_admin 可访问）
 */
router.get('/list', requireRole('admin', 'sub_admin'), async (req, res, next) => {
  try {
    const data = await userService.getUserList(req.query);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) {
    next(err);
  }
});

router.get('/permissions/catalog', requireRole('admin'), async (req, res, next) => {
  try {
    const data = await userService.getPermissionCatalog();
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) {
    next(err);
  }
});

router.get('/permissions/:userId', requireRole('admin'), async (req, res, next) => {
  try {
    const data = await userService.getUserPermissions(req.params.userId);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) {
    next(err);
  }
});

router.post('/permissions/save', requireRole('admin'), async (req, res, next) => {
  try {
    const data = await userService.saveUserPermissions(req.body.userId, req.body.permissions, req.body.deniedPermissions);
    res.json({ code: 0, msg: '权限已保存，用户重新登录后生效', data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/user/create - 新增用户（仅超级管理员）
 */
router.post('/create', requireRole('admin'), async (req, res, next) => {
  try {
    await userService.createUser(req.body);
    res.json({ code: 0, msg: '创建成功' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/user/update - 更新用户信息（仅超级管理员）
 */
router.put('/update', requireRole('admin'), async (req, res, next) => {
  try {
    await userService.updateUser(req.body, req.user.id);
    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/user/reset-password - 重置密码
 */
router.post('/reset-password', requireRole('admin'), async (req, res, next) => {
  try {
    await userService.resetPassword(req.body.id);
    res.json({ code: 0, msg: '密码已重置为: 123456' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/user/toggle-status - 启用/禁用用户
 */
router.post('/toggle-status', requireRole('admin'), async (req, res, next) => {
  try {
    await userService.toggleStatus(req.body.id, req.body.status, req.user.id);
    res.json({ code: 0, msg: req.body.status === 1 ? '账号已启用' : '账号已禁用' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/user/delete - 删除用户（仅超级管理员）
 */
router.post('/delete', requireRole('admin'), async (req, res, next) => {
  try {
    await userService.deleteUser(req.body.id, req.user.id);

    // 操作日志
    const { writeOperLog } = require('../utils/operLog');
    writeOperLog({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      operation: 'delete_user', module: '用户管理', method: 'POST',
      requestUrl: '/api/user/delete', requestParams: JSON.stringify({ deletedUserId: req.body.id }),
      resultCode: 0, resultMsg: '删除成功', ipAddr: req.ip || '127.0.0.1', costTime: 0
    }).catch(() => {});

    res.json({ code: 0, msg: '用户已删除' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/designers - 获取美工列表（用于指派任务）
 */
router.get('/designers', requireRole('admin', 'sub_admin', 'operator'), async (req, res, next) => {
  try {
    const rows = await userService.getDesignerList();
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/publishers - 获取发布人列表
 */
router.get('/publishers', requireRole('admin', 'sub_admin', 'cs_agent', 'basic_designer', 'operator_assistant', 'operator', 'designer'), async (req, res, next) => {
  try {
    const rows = await userService.getPublisherList(req.user.role, req.user.store);
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/basic-designers - 获取基础美工列表
 */
router.get('/basic-designers', requireRole('admin', 'sub_admin', 'cs_agent', 'basic_designer'), async (req, res, next) => {
  try {
    const rows = await userService.getBasicDesignerList();
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/operator-assistants - 获取运营助理列表
 */
router.get('/operator-assistants', requireRole('admin', 'sub_admin', 'operator'), async (req, res, next) => {
  try {
    const rows = await userService.getOperatorAssistantList();
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
