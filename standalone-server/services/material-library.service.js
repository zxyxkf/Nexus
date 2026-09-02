const fs = require('fs');
const path = require('path');
const AppError = require('../utils/AppError');
const dao = require('../dao/material-library.dao');
const { executeTransaction } = require('../config/database');
const { hasPermission } = require('../utils/task-permissions');
const { resolvePath } = require('../utils/share');
const { normalizeColor, inferColor, collectColors } = require('../utils/material-colors');

function assertAccess(user) {
  if (!hasPermission(user, 'material.library')) {
    throw new AppError(403, '无素材库权限');
  }
}

function assertReadAccess(user) {
  if (!hasPermission(user, 'material.library') && !hasPermission(user, 'task.create.cs')) {
    throw new AppError(403, '无素材库查看权限');
  }
}

function cleanName(value, label) {
  const name = String(value || '').trim();
  if (!name) throw new AppError(400, `${label}不能为空`);
  if (name.length > 200) throw new AppError(400, `${label}不能超过200个字符`);
  if (/[\\/]/.test(name)) throw new AppError(400, `${label}包含非法字符`);
  return name;
}

function publicImage(image) {
  return {
    ...image,
    previewUrl: `/api/material-library/images/${image.id}/preview`,
    downloadUrl: `/api/material-library/images/${image.id}/download`
  };
}

async function listProducts(user, keyword = '') {
  assertReadAccess(user);
  const rows = await dao.listProducts(String(keyword || '').trim());
  return rows.map(row => ({ ...row, previewUrl: row.preview_path ? `/api/material-library/images/${row.preview_path}/preview` : '' }));
}

async function createProduct(user, name) {
  assertAccess(user);
  return dao.createProduct(cleanName(name, '商品库名称'), user.id);
}

async function renameProduct(user, id, name) {
  assertAccess(user);
  if (!await dao.getProduct(id)) throw new AppError(404, '商品库不存在');
  return dao.renameProduct(id, cleanName(name, '商品库名称'));
}

async function deleteProduct(user, id) {
  assertAccess(user);
  const product = await dao.getProduct(id);
  if (!product) throw new AppError(404, '商品库不存在');
  const styles = await dao.listStyles(id);
  const files = [];
  for (const style of styles) files.push(...await dao.listImages(style.id));
  for (const image of files) removePhysicalFile(image.file_path);
  // SQLite deployments may not enable PRAGMA foreign_keys; remove child rows explicitly.
  for (const style of styles) {
    const images = await dao.listImages(style.id);
    for (const image of images) await dao.deleteImage(image.id);
    await dao.deleteStyle(style.id);
  }
  await dao.deleteProduct(id);
  return { id: Number(id) };
}

async function listStyles(user, productId, keyword = '') {
  assertReadAccess(user);
  if (!await dao.getProduct(productId)) throw new AppError(404, '商品库不存在');
  return dao.listStyles(productId, String(keyword || '').trim());
}

async function createStyle(user, productId, name) {
  assertAccess(user);
  if (!await dao.getProduct(productId)) throw new AppError(404, '商品库不存在');
  return dao.createStyle(productId, cleanName(name, '款式名称'), user.id);
}

async function renameStyle(user, id, name) {
  assertAccess(user);
  if (!await dao.getStyle(id)) throw new AppError(404, '款式不存在');
  return dao.renameStyle(id, cleanName(name, '款式名称'));
}

async function deleteStyle(user, id) {
  assertAccess(user);
  const style = await dao.getStyle(id);
  if (!style) throw new AppError(404, '款式不存在');
  const images = await dao.listImages(id);
  for (const image of images) removePhysicalFile(image.file_path);
  for (const image of images) await dao.deleteImage(image.id);
  await dao.deleteStyle(id);
  return { id: Number(id) };
}

async function listImages(user, styleId) {
  assertReadAccess(user);
  const style = await dao.getStyle(styleId);
  if (!style) throw new AppError(404, '款式不存在');
  const images = await dao.listImages(styleId);
  return {
    style,
    colors: collectColors(images),
    images: images.map(publicImage)
  };
}

function safeMaterialRelativePath(productId, styleId, date, filename) {
  const safeFile = path.basename(filename);
  if (!safeFile || safeFile !== filename) throw new AppError(400, '文件名不合法');
  return `material/${productId}/${styleId}/${date}/${safeFile}`;
}

function copyUsingOriginalName(sourcePath, productId, styleId, date, originalName) {
  const parsed = path.parse(originalName);
  for (let copyIndex = 1; copyIndex <= 10000; copyIndex++) {
    const filename = copyIndex === 1
      ? originalName
      : `${parsed.name} (${copyIndex})${parsed.ext}`;
    const relative = safeMaterialRelativePath(productId, styleId, date, filename);
    const absolute = resolvePath(relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    try {
      fs.copyFileSync(sourcePath, absolute, fs.constants.COPYFILE_EXCL);
      return relative;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new AppError(409, '同名图片过多，请先重命名后上传');
}

async function saveUploadedImages(user, styleId, files = []) {
  assertAccess(user);
  const style = await dao.getStyle(styleId);
  if (!style) throw new AppError(404, '款式不存在');
  if (!files.length) throw new AppError(400, '请选择图片');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let order = await dao.getNextSortOrder(styleId);
  const created = [];
  const copiedPaths = [];
  try {
    for (const file of files) {
      const originalName = String(file.originalname || '').trim();
      const relative = copyUsingOriginalName(file.path, style.product_id, styleId, date, originalName);
      copiedPaths.push(relative);
      const image = await dao.createImage({
        styleId,
        originalName,
        displayName: originalName,
        color: inferColor(originalName),
        colorSource: 'auto',
        sortOrder: order++,
        filePath: relative,
        fileSize: file.size,
        mimeType: file.mimetype,
        createdBy: user.id
      });
      created.push(publicImage(image));
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
  } catch (err) {
    for (const copiedPath of copiedPaths) removePhysicalFile(copiedPath);
    for (const file of files) { try { fs.unlinkSync(file.path); } catch (_) {} }
    throw err;
  }
  return created;
}

async function renameImage(user, id, displayName) {
  assertAccess(user);
  const image = await dao.getImage(id);
  if (!image) throw new AppError(404, '图片不存在');
  const name = cleanName(displayName, '图片名称');
  const color = image.color_source === 'manual' ? image.color : inferColor(name);
  return publicImage(await dao.renameImage(id, name, color, image.color_source === 'manual' ? 'manual' : 'auto'));
}

async function updateImageColor(user, id, color) {
  assertAccess(user);
  if (!await dao.getImage(id)) throw new AppError(404, '图片不存在');
  return publicImage(await dao.updateImageColor(id, normalizeColor(color)));
}

async function deleteImage(user, id) {
  assertAccess(user);
  const image = await dao.getImage(id);
  if (!image) throw new AppError(404, '图片不存在');
  removePhysicalFile(image.file_path);
  await dao.deleteImage(id);
  return { id: Number(id) };
}

async function reorderImages(user, styleId, imageIds = []) {
  assertAccess(user);
  const images = await dao.listImages(styleId);
  const existing = new Set(images.map(image => Number(image.id)));
  const requested = imageIds.map(Number);
  if (requested.length !== images.length || requested.some(id => !existing.has(id)) || new Set(requested).size !== requested.length) {
    throw new AppError(400, '图片排序数据无效');
  }
  await executeTransaction(async () => {
    for (let index = 0; index < requested.length; index++) await dao.setImageOrder(requested[index], index);
  });
  return listImages(user, styleId);
}

async function search(user, keyword) {
  assertReadAccess(user);
  const q = String(keyword || '').trim();
  if (!q) return { products: [], styles: [] };
  return dao.search(q);
}

function removePhysicalFile(filePath) {
  try {
    const absolute = resolvePath(filePath);
    if (absolute && fs.existsSync(absolute)) fs.unlinkSync(absolute);
  } catch (_) {}
}

function resolveImagePath(image) {
  const absolute = resolvePath(image.file_path);
  if (!absolute || !fs.existsSync(absolute)) throw new AppError(404, '图片文件不存在');
  return absolute;
}

module.exports = {
  listProducts, createProduct, renameProduct, deleteProduct,
  listStyles, createStyle, renameStyle, deleteStyle,
  listImages, saveUploadedImages, renameImage, updateImageColor,
  deleteImage, reorderImages, search, resolveImagePath
};
