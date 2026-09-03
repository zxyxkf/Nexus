const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const router = express.Router();

const { requireAuth, requirePermission, optionalAuth } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const service = require('../services/material-library.service');
const { fixFilenameEncoding } = require('../utils/upload');
const { getImage } = require('../dao/material-library.dao');

const tempDir = path.join(os.tmpdir(), 'nexus-material-library');
fs.mkdirSync(tempDir, { recursive: true });
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tempDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
});

function imageFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif', '.ico', '.avif', '.heic'];
  cb(null, allowed.includes(ext));
}

function receiveImages(req, res, next) {
  const middleware = multer({
    storage: uploadStorage,
    fileFilter: imageFileFilter
  }).array('files');

  middleware(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      return next(new AppError(400, '图片上传参数不正确'));
    }
    return next(error);
  });
}

router.get('/images/:imageId/preview', optionalAuth, async (req, res, next) => {
  try {
    const image = await getImage(Number(req.params.imageId));
    if (!image) return res.status(404).json({ code: 404, msg: '图片不存在' });
    const filePath = service.resolveImagePath(image);
    res.setHeader('Content-Type', image.mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

router.get('/images/:imageId/download', optionalAuth, async (req, res, next) => {
  try {
    const image = await getImage(Number(req.params.imageId));
    if (!image) return res.status(404).json({ code: 404, msg: '图片不存在' });
    const filePath = service.resolveImagePath(image);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(image.display_name || image.original_name)}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

router.use(requireAuth);

function send(res, data, msg = '操作成功') {
  res.json({ code: 0, msg, data });
}

function idParam(req, key) {
  const id = Number(req.params[key]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/products', async (req, res, next) => {
  try { send(res, await service.listProducts(req.user, req.query.keyword)); } catch (err) { next(err); }
});

router.post('/products', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try { send(res, await service.createProduct(req.user, req.body.name), '商品库创建成功'); } catch (err) { next(err); }
});

router.put('/products/:productId', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try {
    const id = idParam(req, 'productId');
    if (!id) return res.status(400).json({ code: 400, msg: '商品库 ID 无效' });
    send(res, await service.renameProduct(req.user, id, req.body.name), '商品库重命名成功');
  } catch (err) { next(err); }
});

router.delete('/products/:productId', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try {
    const id = idParam(req, 'productId');
    if (!id) return res.status(400).json({ code: 400, msg: '商品库 ID 无效' });
    send(res, await service.deleteProduct(req.user, id), '商品库删除成功');
  } catch (err) { next(err); }
});

router.get('/products/:productId/styles', async (req, res, next) => {
  try {
    const id = idParam(req, 'productId');
    if (!id) return res.status(400).json({ code: 400, msg: '商品库 ID 无效' });
    send(res, await service.listStyles(req.user, id, req.query.keyword));
  } catch (err) { next(err); }
});

router.post('/products/:productId/styles', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try {
    const id = idParam(req, 'productId');
    if (!id) return res.status(400).json({ code: 400, msg: '商品库 ID 无效' });
    send(res, await service.createStyle(req.user, id, req.body.name), '款式创建成功');
  } catch (err) { next(err); }
});

router.put('/styles/:styleId', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try {
    const id = idParam(req, 'styleId');
    if (!id) return res.status(400).json({ code: 400, msg: '款式 ID 无效' });
    send(res, await service.renameStyle(req.user, id, req.body.name), '款式重命名成功');
  } catch (err) { next(err); }
});

router.delete('/styles/:styleId', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try {
    const id = idParam(req, 'styleId');
    if (!id) return res.status(400).json({ code: 400, msg: '款式 ID 无效' });
    send(res, await service.deleteStyle(req.user, id), '款式删除成功');
  } catch (err) { next(err); }
});

router.get('/styles/:styleId/images', async (req, res, next) => {
  try {
    const id = idParam(req, 'styleId');
    if (!id) return res.status(400).json({ code: 400, msg: '款式 ID 无效' });
    send(res, await service.listImages(req.user, id));
  } catch (err) { next(err); }
});

router.post('/styles/:styleId/images', requirePermission('material.library', 'admin'), receiveImages, async (req, res, next) => {
  try {
    const id = idParam(req, 'styleId');
    if (!id) return res.status(400).json({ code: 400, msg: '款式 ID 无效' });
    for (const file of req.files || []) file.originalname = fixFilenameEncoding(file.originalname);
    send(res, await service.saveUploadedImages(req.user, id, req.files || []), '图片上传成功');
  } catch (err) {
    for (const file of req.files || []) { try { fs.unlinkSync(file.path); } catch (_) {} }
    next(err);
  }
});

router.put('/images/reorder', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try {
    const styleId = Number(req.body.styleId);
    if (!styleId || !Array.isArray(req.body.imageIds)) return res.status(400).json({ code: 400, msg: '排序参数无效' });
    send(res, await service.reorderImages(req.user, styleId, req.body.imageIds), '图片排序已保存');
  } catch (err) { next(err); }
});

router.put('/images/:imageId', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try {
    const id = idParam(req, 'imageId');
    if (!id) return res.status(400).json({ code: 400, msg: '图片 ID 无效' });
    send(res, await service.renameImage(req.user, id, req.body.displayName), '图片重命名成功');
  } catch (err) { next(err); }
});

router.put('/images/:imageId/color', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try {
    const id = idParam(req, 'imageId');
    if (!id) return res.status(400).json({ code: 400, msg: '图片 ID 无效' });
    send(res, await service.updateImageColor(req.user, id, req.body.color), '图片颜色已更新');
  } catch (err) { next(err); }
});

router.delete('/images/:imageId', requirePermission('material.library', 'admin'), async (req, res, next) => {
  try {
    const id = idParam(req, 'imageId');
    if (!id) return res.status(400).json({ code: 400, msg: '图片 ID 无效' });
    send(res, await service.deleteImage(req.user, id), '图片删除成功');
  } catch (err) { next(err); }
});

router.get('/search', async (req, res, next) => {
  try { send(res, await service.search(req.user, req.query.q)); } catch (err) { next(err); }
});

module.exports = router;
