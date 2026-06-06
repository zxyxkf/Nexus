/**
 * 任务管理模块路由入口
 * 子模块：task-crud / task-query / task-action / task-stats
 */

const express = require('express');
const router = express.Router();
const path = require('path');

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

// ==================== 业务路由（以下均需登录） ====================

router.use(requireAuth);
router.use(require('./task/task-crud'));
router.use(require('./task/task-query'));
router.use(require('./task/task-action'));
router.use(require('./task/task-stats'));

module.exports = router;
