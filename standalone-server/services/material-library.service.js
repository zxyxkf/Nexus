const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');
const dao = require('../dao/material-library.dao');
const { executeTransaction, getPool } = require('../config/database');
const { hasPermission } = require('../utils/task-permissions');
const { resolvePath, getMaterialLibraryDir, initStorageConfig } = require('../utils/share');
const { normalizeColor, inferColor, collectColors } = require('../utils/material-colors');
const { withLock } = require('../utils/mutex');

const MATERIAL_STORAGE_LOCK = 'material-library-storage';

function withMaterialStorageLock(fn) {
  return withLock(MATERIAL_STORAGE_LOCK, fn);
}

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

function withInferredColor(image) {
  const storedColor = normalizeColor(image.color);
  // A manually cleared color is intentional and must remain empty.
  if (image.color_source === 'manual' || storedColor) {
    return { ...image, color: storedColor };
  }
  return {
    ...image,
    color: inferColor(image.display_name || image.original_name)
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
  return withMaterialStorageLock(async () => {
    const filePaths = [];
    await executeTransaction(async conn => {
      const product = await dao.getProduct(id, conn);
      if (!product) throw new AppError(404, '商品库不存在');
      const styles = await dao.listStyles(id, '', conn);
      // SQLite deployments may not enable PRAGMA foreign_keys; remove child rows explicitly.
      for (const style of styles) {
        const images = await dao.listImages(style.id, '', conn);
        filePaths.push(...images.map(image => image.file_path).filter(Boolean));
        for (const image of images) await dao.deleteImage(image.id, conn);
        await dao.deleteStyle(style.id, conn);
      }
      await dao.deleteProduct(id, conn);
    });
    filePaths.forEach(removePhysicalFile);
    return { id: Number(id) };
  });
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
  return withMaterialStorageLock(async () => {
    const filePaths = [];
    await executeTransaction(async conn => {
      const style = await dao.getStyle(id, conn);
      if (!style) throw new AppError(404, '款式不存在');
      const images = await dao.listImages(id, '', conn);
      filePaths.push(...images.map(image => image.file_path).filter(Boolean));
      for (const image of images) await dao.deleteImage(image.id, conn);
      await dao.deleteStyle(id, conn);
    });
    filePaths.forEach(removePhysicalFile);
    return { id: Number(id) };
  });
}

async function listImages(user, styleId) {
  assertReadAccess(user);
  const style = await dao.getStyle(styleId);
  if (!style) throw new AppError(404, '款式不存在');
  const images = (await dao.listImages(styleId)).map(withInferredColor);
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

function safeMaterialFilename(name, fallback = 'material-image.bin') {
  let value = String(name || '').trim();
  // Preserve Unicode names while replacing characters Windows cannot store.
  value = value.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '');
  if (!value || value === '.' || value === '..') value = fallback;
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(value)) value = `_${value}`;
  return value;
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
  if (!files.length) throw new AppError(400, '请选择图片');
  return withMaterialStorageLock(async () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const created = [];
    const copiedPaths = [];
    try {
      await executeTransaction(async conn => {
        const style = await dao.getStyle(styleId, conn);
        if (!style) throw new AppError(404, '款式不存在');
        let order = await dao.getNextSortOrder(styleId, conn);
        for (const file of files) {
          const originalName = safeMaterialFilename(file.originalname, `material-image-${order}.bin`);
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
          }, conn);
          created.push(publicImage(image));
        }
      });
      return created;
    } catch (err) {
      copiedPaths.forEach(removePhysicalFile);
      throw err;
    } finally {
      for (const file of files) {
        try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
      }
    }
  });
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
  return withMaterialStorageLock(async () => {
    let filePath = '';
    await executeTransaction(async conn => {
      const image = await dao.getImage(id, conn);
      if (!image) throw new AppError(404, '图片不存在');
      filePath = image.file_path || '';
      await dao.deleteImage(id, conn);
    });
    removePhysicalFile(filePath);
    return { id: Number(id) };
  });
}

async function reorderImages(user, styleId, imageIds = []) {
  assertAccess(user);
  const images = await dao.listImages(styleId);
  const existing = new Set(images.map(image => Number(image.id)));
  const requested = imageIds.map(Number);
  if (requested.length !== images.length || requested.some(id => !existing.has(id)) || new Set(requested).size !== requested.length) {
    throw new AppError(400, '图片排序数据无效');
  }
  await executeTransaction(async conn => {
    for (let index = 0; index < requested.length; index++) {
      await dao.setImageOrder(requested[index], index, conn);
    }
  });
  return listImages(user, styleId);
}

function resolveMaterialPath(rootValue, relativePath) {
  const root = path.resolve(rootValue);
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts[0] !== 'material' || parts.slice(1).includes('..')) {
    throw new AppError(400, '素材文件路径无效');
  }
  const fullPath = path.resolve(root, ...parts.slice(1));
  if (fullPath === root || !fullPath.startsWith(root + path.sep)) {
    throw new AppError(400, '素材文件路径无效');
  }
  return fullPath;
}

function validateMaterialRoot(value) {
  const target = String(value || '').trim();
  if (!target || !path.isAbsolute(target)) {
    throw new AppError(400, '素材库存储目录必须是绝对路径');
  }
  const resolved = path.resolve(target);
  const probe = path.join(resolved, `.material-write-${uuidv4()}.tmp`);
  try {
    fs.mkdirSync(resolved, { recursive: true });
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch (error) {
    try { if (fs.existsSync(probe)) fs.unlinkSync(probe); } catch (_) {}
    throw new AppError(400, `素材库存储目录不可写：${error.message}`);
  }
  return resolved;
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function filesHaveSameContent(sourcePath, destinationPath) {
  if (fs.statSync(sourcePath).size !== fs.statSync(destinationPath).size) return false;
  const [sourceHash, destinationHash] = await Promise.all([
    hashFile(sourcePath),
    hashFile(destinationPath)
  ]);
  return sourceHash === destinationHash;
}

async function copyMaterialStorage(oldRootValue, newRootValue) {
  const oldRoot = path.resolve(String(oldRootValue || getMaterialLibraryDir()));
  const newRoot = validateMaterialRoot(newRootValue);
  if (oldRoot === newRoot) return { newRoot, copiedFiles: [] };

  const [images] = await getPool().execute(
    "SELECT file_path FROM material_image WHERE file_path IS NOT NULL AND file_path <> ''"
  );
  const copiedFiles = [];
  try {
    for (const image of images) {
      const sourcePath = resolveMaterialPath(oldRoot, image.file_path);
      if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
        throw new AppError(400, `现有素材文件不存在：${image.file_path}`);
      }
      const destinationPath = resolveMaterialPath(newRoot, image.file_path);
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      if (fs.existsSync(destinationPath)) {
        if (!await filesHaveSameContent(sourcePath, destinationPath)) {
          throw new AppError(400, `新目录存在同名且内容不同的文件：${image.file_path}`);
        }
        continue;
      }
      fs.copyFileSync(sourcePath, destinationPath, fs.constants.COPYFILE_EXCL);
      copiedFiles.push(destinationPath);
    }
  } catch (error) {
    for (const filePath of copiedFiles.reverse()) {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
    }
    if (error instanceof AppError) throw error;
    throw new AppError(400, `素材库目录迁移失败：${error.message}`);
  }
  return { newRoot, copiedFiles };
}

async function updateMaterialStorageConfig(configId, newRootValue) {
  return withMaterialStorageLock(async () => {
    const pool = getPool();
    const [configs] = await pool.execute(
      "SELECT config_value FROM sys_config WHERE id = ? AND config_key = 'upload.material_library_dir'",
      [configId]
    );
    if (!configs.length) throw new AppError(400, '素材库存储目录配置不存在');

    const previousValue = configs[0].config_value;
    const relocation = await copyMaterialStorage(previousValue, newRootValue);
    let configUpdated = false;
    let canCleanCopiedFiles = true;
    try {
      await pool.execute('UPDATE sys_config SET config_value = ? WHERE id = ?', [relocation.newRoot, configId]);
      configUpdated = true;
      await initStorageConfig(pool);
      return relocation.newRoot;
    } catch (error) {
      if (configUpdated) {
        try {
          await pool.execute('UPDATE sys_config SET config_value = ? WHERE id = ?', [previousValue, configId]);
          await initStorageConfig(pool);
        } catch (rollbackError) {
          canCleanCopiedFiles = false;
          console.error('[MaterialLibrary] 素材目录配置回滚失败:', rollbackError.message);
        }
      }
      if (canCleanCopiedFiles) {
        for (const filePath of relocation.copiedFiles.reverse()) {
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
        }
      }
      throw error;
    }
  });
}

async function search(user, keyword) {
  assertReadAccess(user);
  const q = String(keyword || '').trim();
  if (!q) return { products: [], styles: [] };
  return dao.search(q);
}

async function getReadableImage(user, imageId) {
  assertReadAccess(user);
  const image = await dao.getImage(imageId);
  if (!image) throw new AppError(404, '图片不存在');
  return image;
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
  deleteImage, reorderImages, search, getReadableImage, resolveImagePath,
  updateMaterialStorageConfig, withMaterialStorageLock
};
