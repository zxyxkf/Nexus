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
const { readImage, resolvePath } = require('../utils/share');
const { MIME_MAP } = require('../dao/task.dao');

// ==================== 文件预览/下载接口（URL token 认证） ====================

router.get('/preview/:fileId', optionalAuth, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT * FROM task_file WHERE id = ?`,
      [fileId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }

    const file = rows[0];
    const filePath = file.file_path;
    if (!filePath) {
      return res.status(404).json({ code: 404, msg: '文件路径为空' });
    }

    const ext = path.extname(file.file_name).toLowerCase();
    const contentType = MIME_MAP[ext];
    if (!contentType) {
      return res.status(404).json({ code: 404, msg: '不支持预览此文件类型' });
    }

    const result = readImage(filePath);
    if (!result) {
      return res.status(404).json({ code: 404, msg: '文件未找到' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(result.buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/download/:fileId', optionalAuth, async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT * FROM task_file WHERE id = ?`,
      [fileId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ code: 404, msg: '文件不存在' });
    }

    const file = rows[0];
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
      `SELECT id, task_no, title, publisher_id, designer_id, task_group FROM task_info WHERE id IN (${placeholders})`,
      ids
    );

    if (req.user.role !== 'admin' && req.user.role !== 'sub_admin') {
      const invalid = tasks.some(t => Number(t.publisher_id) !== Number(req.user.id) && Number(t.designer_id) !== Number(req.user.id));
      if (invalid) return res.status(403).json({ code: 403, msg: '无权下载所选任务文件' });
    }

    const taskIds = tasks.map(t => t.id);
    if (!taskIds.length) return res.status(404).json({ code: 404, msg: '任务不存在' });

    const filePlaceholders = taskIds.map(() => '?').join(',');
    const [files] = await pool.execute(
      `SELECT f.*, t.task_no
       FROM task_file f
       INNER JOIN task_info t ON f.task_id = t.id
       WHERE f.task_id IN (${filePlaceholders})
       ORDER BY t.task_no, f.file_category, f.create_time`,
      taskIds
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
    archive.on('error', err => next(err));
    archive.pipe(res);

    const usedNames = new Set();
    for (const { file, absolutePath } of existingFiles) {
      const folder = `${file.task_no}/${file.file_category === 'reference' ? '参考文件' : '作品文件'}`;
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
router.use(require('./task/task-crud'));
router.use(require('./task/task-query'));
router.use(require('./task/task-action'));
router.use(require('./task/task-stats'));

module.exports = router;
