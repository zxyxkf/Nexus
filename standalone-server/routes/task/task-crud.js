/**
 * 任务 CRUD — 路由层（仅 HTTP 参数提取 + 调用 Service）
 */
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const router = express.Router();
const { requireRole, requireAnyPermission } = require('../../middleware/auth');
const taskService = require('../../services/task.service');
const AppError = require('../../utils/AppError');
const { fixFilenameEncoding } = require('../../utils/upload');
const { getMaxFileSizeMB, getMaxFileCount } = require('../../utils/share');

const publishTempDir = path.join(os.tmpdir(), 'nexus-task-publish');
const MAX_STYLE_EDIT_BYTES = 512 * 1024 * 1024;

function cleanupPublishFiles(files) {
  for (const file of files || []) {
    try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
  }
}

function parseJson(value, label, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (_) {
    throw new AppError(400, `${label}格式无效`);
  }
}

function receivePublishFiles(req, res, next) {
  fs.mkdirSync(publishTempDir, { recursive: true });
  multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, publishTempDir),
      filename: (_req, file, cb) => {
        const extension = path.extname(fixFilenameEncoding(file.originalname)).toLowerCase();
        cb(null, `${uuidv4().replace(/-/g, '')}${extension}`);
      }
    }),
    limits: {
      fileSize: getMaxFileSizeMB() * 1024 * 1024,
      files: getMaxFileCount() + 200,
      fields: 10
    }
  }).any()(req, res, error => {
    if (!error) return next();
    cleanupPublishFiles(req.files);
    if (error instanceof multer.MulterError) return next(new AppError(400, '任务文件上传参数不正确'));
    return next(error);
  });
}

// 创建任务
router.post('/create', requireAnyPermission(['task.create.design', 'task.create.operator', 'task.create.cs'], 'operator', 'admin', 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.createTask(req.body, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

router.post('/publish', requireAnyPermission(['task.create.design', 'task.create.operator', 'task.create.cs'], 'operator', 'admin', 'cs_agent'), receivePublishFiles, async (req, res, next) => {
  try {
    const body = parseJson(req.body.taskPayload, '任务数据', {});
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError(400, '任务数据格式无效');
    const manifest = parseJson(req.body.styleManifest, '款式图片清单', []);
    if (!Array.isArray(manifest)) throw new AppError(400, '款式图片清单格式无效');

    const referenceFiles = (req.files || []).filter(file => file.fieldname === 'references');
    const styleFiles = (req.files || []).filter(file => file.fieldname !== 'references');
    if (referenceFiles.length > getMaxFileCount()) throw new AppError(400, `参考文件最多上传 ${getMaxFileCount()} 个`);
    const editedBytes = styleFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (editedBytes > MAX_STYLE_EDIT_BYTES) throw new AppError(400, '编辑后的款式图总大小不能超过 512MB');

    const originalNames = parseJson(req.body.referenceOriginalNames, '参考文件名', []);
    if (!Array.isArray(originalNames) || originalNames.length !== referenceFiles.length) {
      throw new AppError(400, '参考文件名与上传文件不匹配');
    }
    referenceFiles.forEach((file, index) => {
      const originalName = String(originalNames[index] || '').trim();
      if (!originalName || /[\\/\u0000\r\n]/.test(originalName)) throw new AppError(400, '参考文件名不合法');
      file.originalname = originalName;
    });

    const result = await taskService.publishTask(body, referenceFiles, {
      materialStyleId: req.body.materialStyleId,
      manifest,
      files: styleFiles
    }, req.user);
    res.json({ code: 0, ...result });
  } catch (error) {
    next(error);
  } finally {
    cleanupPublishFiles(req.files);
  }
});

router.post('/material-snapshot', requireAnyPermission(['task.create.cs'], 'cs_agent', 'admin'), async (req, res, next) => {
  try {
    const result = await taskService.snapshotMaterialImages(req.body.taskId, req.body.materialStyleId, req.body.materialImageIds, req.user);
    res.json({ code: 0, msg: '款式素材已保存', data: result });
  } catch (err) { next(err); }
});

// 任务详情
router.get('/detail', async (req, res, next) => {
  try {
    const data = await taskService.getTaskDetail(req.query.taskId, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 删除任务
router.post('/delete', requireRole('admin', 'sub_admin'), async (req, res, next) => {
  try {
    const result = await taskService.deleteTask(req.body.taskId, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 编辑草稿并重新发布
router.put('/update', requireAnyPermission(['task.create.design', 'task.create.operator', 'task.create.cs'], 'operator', 'admin', 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.updateTask(req.body, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 客服重开已完成基础美工任务
router.post('/reopen-finished-cs', requireAnyPermission(['task.create.cs'], 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.reopenFinishedCsTask(req.body, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 客服修改已完成基础美工任务编号
router.put('/cs-task-no', requireAnyPermission(['cs.task_no.update'], 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.updateCsTaskNo(req.body.taskId, req.body.taskNo, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 批量删除
router.post('/batch-delete', requireRole('admin', 'sub_admin'), async (req, res, next) => {
  try {
    const result = await taskService.batchDelete(req.body.taskIds);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 批量重新分配
router.post('/batch-reassign', requireRole('admin', 'sub_admin'), async (req, res, next) => {
  try {
    const { taskIds, designerId, designerName } = req.body;
    const result = await taskService.batchReassign(taskIds, designerId, designerName);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
