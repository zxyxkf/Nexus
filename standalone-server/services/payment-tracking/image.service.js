const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../../utils/AppError');
const { executeTransaction } = require('../../config/database');
const {
  getPaymentTrackingImageDir,
  resolvePath: resolveTaskFilePath
} = require('../../utils/share');
const repository = require('./repository');
const recordService = require('./record.service');
const { PERMISSIONS } = require('./constants');
const {
  assertPermission,
  assertAnyPermission,
  assertStoreAccess,
  assertRecordViewPermission
} = require('./access');
const { conflictError, requireVersion, assertVersion } = require('./optimistic-lock');

const IMAGE_CATEGORIES = ['product_main', 'detail_screenshot', 'competitor'];
const MIME_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp'
};

function normalizeRelativePath(value) {
  return value.replace(/\\/g, '/');
}

function resolveStoredImagePath(image) {
  const root = path.resolve(image.storage_root);
  const fullPath = path.resolve(root, image.relative_path);
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new AppError(400, '非法图片路径');
  }
  return fullPath;
}

function createRelativePath(recordId, extension) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return normalizeRelativePath(path.join(
    date,
    String(recordId),
    `${uuidv4().replace(/-/g, '')}${extension}`
  ));
}

function validateCategory(category) {
  if (!IMAGE_CATEGORIES.includes(category)) throw new AppError(400, '无效的图片分类');
}

function extensionForMime(mimeType) {
  const extension = MIME_EXTENSIONS[String(mimeType || '').toLowerCase()];
  if (!extension) throw new AppError(400, '只允许上传图片');
  return extension;
}

function cleanupWrittenFiles(paths) {
  for (const filePath of [...paths].reverse()) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) {}
  }
}

async function loadEditableRecord(conn, recordId, user) {
  assertPermission(user, PERMISSIONS.selection);
  const record = await repository.findRecordById(recordId, { conn, forUpdate: true });
  if (!record) throw new AppError(404, '选品记录不存在');
  assertStoreAccess(record, user);
  if (record.process_status !== 'in_progress') throw new AppError(400, '流程已结束，请先恢复流程');
  const selectionStage = await repository.findStage(record.id, 'selection', conn);
  if (!selectionStage) throw new AppError(403, '信息及选品阶段尚未进入');
  if (record.current_stage !== 'selection' && !Number(selectionStage.is_reopened)) {
    throw new AppError(403, '信息及选品阶段未重开，当前不可修改图片');
  }
  return record;
}

async function uploadImages(recordId, category, files, versionValue, user) {
  validateCategory(category);
  const version = requireVersion(versionValue);
  if (!Array.isArray(files) || !files.length) throw new AppError(400, '请选择要上传的图片');
  for (const file of files) extensionForMime(file.mimetype);

  const writtenPaths = [];
  try {
    await executeTransaction(async conn => {
      const record = await loadEditableRecord(conn, recordId, user);
      assertVersion(record, version);
      const storageRoot = path.resolve(getPaymentTrackingImageDir());
      let sortOrder = await repository.getNextImageSortOrder(record.id, category, conn);

      for (const file of files) {
        const relativePath = createRelativePath(record.id, extensionForMime(file.mimetype));
        const fullPath = resolveStoredImagePath({ storage_root: storageRoot, relative_path: relativePath });
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, file.buffer);
        writtenPaths.push(fullPath);
        await repository.insertImage(conn, {
          recordId: record.id,
          category,
          storageRoot,
          relativePath,
          originalName: file.originalname || '',
          mimeType: file.mimetype,
          fileSize: file.size,
          sortOrder,
          uploaderId: user.id
        });
        sortOrder += 1;
      }

      const updated = await repository.updateRecordWithVersion(conn, record.id, version);
      if (!updated) throw conflictError();
    });
  } catch (error) {
    cleanupWrittenFiles(writtenPaths);
    throw error;
  }

  return recordService.getRecord(recordId, user, { skipViewPermission: true });
}

async function reorderImages(recordId, imageIds, versionValue, user) {
  const version = requireVersion(versionValue);
  const ids = Array.isArray(imageIds) ? imageIds.map(Number) : [];
  if (!ids.length || ids.some(id => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
    throw new AppError(400, '图片顺序参数不正确');
  }

  await executeTransaction(async conn => {
    const record = await loadEditableRecord(conn, recordId, user);
    assertVersion(record, version);
    const selected = [];
    for (const imageId of ids) {
      const image = await repository.findImageById(imageId, conn);
      if (!image || Number(image.record_id) !== Number(record.id)) {
        throw new AppError(400, '图片不属于当前选品记录');
      }
      selected.push(image);
    }
    const category = selected[0].category;
    if (selected.some(image => image.category !== category)) {
      throw new AppError(400, '不同分类的图片不能混合排序');
    }
    const categoryImages = await repository.listImages(record.id, category, conn);
    if (categoryImages.length !== ids.length) throw new AppError(400, '请提交该分类的完整图片顺序');

    for (let index = 0; index < ids.length; index += 1) {
      await repository.updateImageOrder(conn, ids[index], index);
    }
    const updated = await repository.updateRecordWithVersion(conn, record.id, version);
    if (!updated) throw conflictError();
  });

  return recordService.getRecord(recordId, user, { skipViewPermission: true });
}

async function deleteImage(recordId, imageId, versionValue, user) {
  const version = requireVersion(versionValue);
  await executeTransaction(async conn => {
    const record = await loadEditableRecord(conn, recordId, user);
    assertVersion(record, version);
    const image = await repository.findImageById(imageId, conn);
    if (!image || Number(image.record_id) !== Number(record.id)) {
      throw new AppError(404, '图片不存在');
    }
    await repository.softDeleteImage(image.id, conn);
    const updated = await repository.updateRecordWithVersion(conn, record.id, version);
    if (!updated) throw conflictError();
  });

  return recordService.getRecord(recordId, user, { skipViewPermission: true });
}

async function getPreview(imageId, user) {
  assertAnyPermission(user, [PERMISSIONS.selection, PERMISSIONS.records]);
  const image = await repository.findImageById(imageId);
  if (!image) throw new AppError(404, '图片不存在');
  const record = await repository.findRecordById(image.record_id);
  if (!record) throw new AppError(404, '选品记录不存在');
  assertStoreAccess(record, user);
  assertRecordViewPermission(record, user);
  const filePath = resolveStoredImagePath(image);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new AppError(404, '图片文件不存在');
  }
  return { filePath, mimeType: image.mime_type || 'application/octet-stream' };
}

function validateTaskImageFiles(files) {
  return files.map(file => {
    const mimeType = String(file.mime_type || '').toLowerCase();
    const extension = extensionForMime(mimeType);
    const sourcePath = resolveTaskFilePath(file.file_path);
    if (!sourcePath || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      throw new AppError(400, `任务图片不存在：${file.file_name || file.id}`);
    }
    fs.accessSync(sourcePath, fs.constants.R_OK);
    return { file, mimeType, extension, sourcePath };
  });
}

async function copyTaskImages(conn, options) {
  const sources = validateTaskImageFiles(options.files || []);
  if (!sources.length) throw new AppError(400, '任务没有可复制的作品图片');
  const storageRoot = path.resolve(getPaymentTrackingImageDir());
  let sortOrder = await repository.getNextImageSortOrder(options.recordId, 'product_main', conn);

  for (const source of sources) {
    const relativePath = createRelativePath(options.recordId, source.extension);
    const fullPath = resolveStoredImagePath({ storage_root: storageRoot, relative_path: relativePath });
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.copyFileSync(source.sourcePath, fullPath);
    options.writtenPaths.push(fullPath);
    await repository.insertImage(conn, {
      recordId: options.recordId,
      category: 'product_main',
      storageRoot,
      relativePath,
      originalName: source.file.file_name || '',
      mimeType: source.mimeType,
      fileSize: source.file.file_size || fs.statSync(source.sourcePath).size,
      sortOrder,
      sourceTaskFileId: source.file.id,
      uploaderId: options.uploaderId
    });
    sortOrder += 1;
  }
}

module.exports = {
  IMAGE_CATEGORIES,
  MIME_EXTENSIONS,
  resolveStoredImagePath,
  createRelativePath,
  cleanupWrittenFiles,
  uploadImages,
  reorderImages,
  deleteImage,
  getPreview,
  copyTaskImages,
  validateTaskImageFiles
};
