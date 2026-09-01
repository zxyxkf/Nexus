/**
 * 用户管理模块路由 - 仅 admin 可操作
 * Route 层只做参数校验和响应格式化，业务逻辑委托给 Service 层
 */

const express = require('express');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();

const { requireAuth, requireRole, requireAnyPermission } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const userService = require('../services/user.service');
const avatarService = require('../services/avatar.service');

// 所有接口需要登录
router.use(requireAuth);

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const accepted = ['image/jpeg', 'image/png', 'image/webp']
      .includes(String(file.mimetype || '').toLowerCase());
    callback(
      accepted ? null : new AppError(400, '只允许上传 JPG、PNG 或 WebP 图片'),
      accepted
    );
  }
}).single('avatar');

function receiveAvatar(req, res, next) {
  uploadAvatar(req, res, error => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? '头像文件不能超过 5 MB'
        : '头像上传参数不正确';
      return next(new AppError(400, message));
    }
    return next(error);
  });
}

router.get('/avatar', async (req, res, next) => {
  try {
    const avatar = await avatarService.getAvatar(req.user.id);
    res.setHeader('Cache-Control', 'private, no-store');
    if (!avatar) return res.status(204).end();
    res.setHeader('Content-Type', avatar.mimeType);
    const stream = fs.createReadStream(avatar.filePath);
    stream.on('error', next);
    return stream.pipe(res);
  } catch (error) {
    return next(error);
  }
});

router.post('/avatar', receiveAvatar, async (req, res, next) => {
  try {
    const data = await avatarService.replaceAvatar(req.user.id, req.file);
    return res.json({ code: 0, msg: '头像已更新', data });
  } catch (error) {
    return next(error);
  }
});

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
router.get('/designers', requireAnyPermission(['operator.publish.design', 'operator.tasks.design', 'admin.tasks.design'], 'admin', 'sub_admin', 'operator'), async (req, res, next) => {
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
 * GET /api/user/task-publishers - 获取指定全量任务分区的实际发布人列表
 */
router.get('/task-publishers', requireAnyPermission(['admin.tasks.design', 'admin.tasks.operator', 'admin.tasks.cs'], 'admin', 'sub_admin'), async (req, res, next) => {
  try {
    const rows = await userService.getTaskPublisherList(req.query.taskGroup, req.user);
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/task-designers - 获取指定全量任务分区的接单人列表
 */
router.get('/task-designers', requireAnyPermission(['admin.tasks.design', 'admin.tasks.operator', 'admin.tasks.cs'], 'admin', 'sub_admin'), async (req, res, next) => {
  try {
    const rows = await userService.getTaskDesignerList(req.query.taskGroup, req.user);
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/user/basic-designers - 获取基础美工列表
 */
router.get('/basic-designers', requireAnyPermission(['cs.publish.basic', 'cs.tasks.basic', 'basic.tasks.cs', 'admin.tasks.cs', 'score.review.basic', 'score.records.basic'], 'admin', 'sub_admin', 'cs_agent', 'basic_designer'), async (req, res, next) => {
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
router.get('/operator-assistants', requireAnyPermission(['operator.publish.assistant', 'operator.tasks.assistant', 'admin.tasks.operator'], 'admin', 'sub_admin', 'operator'), async (req, res, next) => {
  try {
    const rows = await userService.getOperatorAssistantList();
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
