/**
 * 任务管理模块路由入口
 * 子模块：task-crud / task-query / task-action / task-stats
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const { getPool } = require('../config/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { readImageStream, resolvePath } = require('../utils/share');
const { getImageThumbnail } = require('../utils/image-thumbnail');
const { MIME_MAP } = require('../dao/task.dao');
const taskService = require('../services/task.service');

// ==================== 文件预览/下载接口（URL token 认证） ====================

router.get('/preview/:fileId', optionalAuth, async (req, res, next) => {
  try {
    const file = await taskService.getTaskFileForUser(req.params.fileId, req.user);
    const filePath = file.file_path;
    if (!filePath) {
      return res.status(404).json({ code: 404, msg: '文件路径为空' });
    }

    const ext = path.extname(file.file_name).toLowerCase();
    const contentType = MIME_MAP[ext];
    if (!contentType) {
      return res.status(404).json({ code: 404, msg: '不支持预览此文件类型' });
    }

    const stream = readImageStream(filePath);
    if (!stream) {
      return res.status(404).json({ code: 404, msg: '文件未找到' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

router.get('/thumbnail/:fileId', optionalAuth, async (req, res, next) => {
  try {
    const file = await taskService.getTaskFileForUser(req.params.fileId, req.user);
    const filePath = file.file_path;
    if (!filePath) {
      return res.status(404).json({ code: 404, msg: '文件路径为空' });
    }

    const ext = path.extname(file.file_name).toLowerCase();
    const contentType = MIME_MAP[ext];
    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(404).json({ code: 404, msg: '此文件不是可预览图片' });
    }

    const absolutePath = resolvePath(filePath);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({ code: 404, msg: '文件未找到' });
    }

    try {
      const thumbnail = await getImageThumbnail(absolutePath);
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      return res.send(thumbnail);
    } catch (_) {
      const stream = fs.createReadStream(absolutePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      stream.on('error', next);
      return stream.pipe(res);
    }
  } catch (err) {
    next(err);
  }
});

router.get('/download/:fileId', optionalAuth, async (req, res, next) => {
  try {
    const file = await taskService.getTaskFileForUser(req.params.fileId, req.user);
    const filePath = file.file_path;
    if (!filePath) {
      return res.status(404).json({ code: 404, msg: '文件路径为空' });
    }

    const fs = require('fs');
    try {
      const absolutePath = resolvePath(filePath);
      if (!absolutePath || !fs.existsSync(absolutePath)) {
        return res.status(404).json({ code: 404, msg: '文件未找到' });
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      const stream = fs.createReadStream(absolutePath);
      stream.pipe(res);
    } catch (e) {
      return res.status(404).json({ code: 404, msg: '文件路径无效' });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/batch-download', requireAuth, async (req, res, next) => {
  try {
    const ids = String(req.query.taskIds || '')
      .split(',')
      .map(v => Number(v))
      .filter(Boolean)
      .slice(0, 200);
    if (!ids.length) return res.status(400).json({ code: 400, msg: '请选择任务' });

    const pool = getPool();
    const placeholders = ids.map(() => '?').join(',');
    const [tasks] = await pool.execute(
      `SELECT t.id, t.task_no, t.title, t.publisher_id, t.designer_id, t.task_group,
              t.status, t.handoff_status, COALESCE(u.store, '') AS publisher_store
       FROM task_info t
       LEFT JOIN sys_user u ON u.id = t.publisher_id
       WHERE t.id IN (${placeholders})`,
      ids
    );
    for (const task of tasks) await taskService.assertTaskViewAccess(task, req.user);

    const taskIds = tasks.map(t => t.id);
    if (!taskIds.length) return res.status(404).json({ code: 404, msg: '任务不存在' });

    const rawCategories = String(req.query.fileCategories || '').trim();
    const fileCategories = rawCategories
      ? [...new Set(rawCategories.split(',').map(value => value.trim()).filter(Boolean))]
      : [];
    const allowedCategories = {
      cs: new Set(['reference', 'style', 'work', 'original']),
      design: new Set(['reference', 'work']),
      operator: new Set(['reference', 'work'])
    };
    if (fileCategories.length) {
      const invalid = tasks.some(task => {
        const group = task.task_group || 'design';
        const allowed = allowedCategories[group] || allowedCategories.design;
        return fileCategories.some(category => !allowed.has(category));
      });
      if (invalid) {
        return res.status(400).json({ code: 400, msg: '所选文件类别与任务分区不匹配' });
      }
    }

    const filePlaceholders = taskIds.map(() => '?').join(',');
    const fileParams = [...taskIds];
    let fileWhere = `f.task_id IN (${filePlaceholders})`;
    if (fileCategories.length) {
      fileWhere += ` AND f.file_category IN (${fileCategories.map(() => '?').join(',')})`;
      fileParams.push(...fileCategories);
    }
    const [files] = await pool.execute(
      `SELECT f.*, t.task_no, t.task_group
       FROM task_file f
       INNER JOIN task_info t ON f.task_id = t.id
       WHERE ${fileWhere}
       ORDER BY t.task_no, f.file_category, f.create_time`,
      fileParams
    );
    if (!files.length) return res.json({ code: 404, msg: '所选任务没有可下载文件' });

    const existingFiles = files
      .map(file => ({ file, absolutePath: resolvePath(file.file_path) }))
      .filter(item => item.absolutePath && fs.existsSync(item.absolutePath));
    if (!existingFiles.length) return res.json({ code: 404, msg: '所选任务文件不存在或无法访问' });

    const archive = archiver('zip', { zlib: { level: 9 } });
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`任务文件_${dateStr}.zip`)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    archive.on('error', err => next(err));
    archive.pipe(res);

    const usedNames = new Set();
    for (const { file, absolutePath } of existingFiles) {
      const group = file.task_group || 'design';
      const categoryFolders = group === 'cs'
        ? { reference: '参考图', style: '款式图', work: '效果图', original: '原图', reject: '修改记录' }
        : { reference: '参考图', work: '作品' };
      const folder = `${file.task_no}/${categoryFolders[file.file_category] || '其他文件'}`;
      let entryName = `${folder}/${file.file_name}`;
      let idx = 1;
      while (usedNames.has(entryName)) {
        const ext = path.extname(file.file_name);
        const base = path.basename(file.file_name, ext);
        entryName = `${folder}/${base}_${idx}${ext}`;
        idx++;
      }
      usedNames.add(entryName);
      archive.file(absolutePath, { name: entryName });
    }
    await archive.finalize();
  } catch (err) {
    next(err);
  }
});

// ==================== 业务路由（以下均需登录） ====================

router.use(requireAuth);
router.use(require('./task/task-handoff'));
router.use(require('./task/task-style-snapshot'));
router.use(require('./task/task-batch-submit'));
router.use(require('./task/task-crud'));
router.use(require('./task/task-query'));
router.use(require('./task/task-action'));
router.use(require('./task/task-stats'));

module.exports = router;
