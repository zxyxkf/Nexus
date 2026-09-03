const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { executeTransaction } = require('../config/database');
const taskDao = require('../dao/task.dao');
const AppError = require('../utils/AppError');
const { fixFilenameEncoding } = require('../utils/upload');
const { resolvePath, saveImage } = require('../utils/share');

const MAX_MANIFEST_ITEMS = 200;

function normalizeManifest(manifest) {
  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new AppError(400, '请选择款式图片');
  }
  if (manifest.length > MAX_MANIFEST_ITEMS) {
    throw new AppError(400, `单个任务最多保存${MAX_MANIFEST_ITEMS}张款式图片`);
  }

  const imageIds = new Set();
  const positions = new Set();
  const editedFields = new Set();
  const normalized = manifest.map(item => {
    const materialImageId = Number(item?.materialImageId);
    const position = Number(item?.position);
    const editedField = String(item?.editedField || '').trim();
    if (!Number.isInteger(materialImageId) || materialImageId <= 0) {
      throw new AppError(400, '款式图片ID无效');
    }
    if (!Number.isInteger(position) || position < 0) {
      throw new AppError(400, '款式图片顺序无效');
    }
    if (editedField.length > 100) throw new AppError(400, '编辑图片字段名无效');
    if (imageIds.has(materialImageId)) throw new AppError(400, '不能重复选择同一张款式图片');
    if (positions.has(position)) throw new AppError(400, '款式图片顺序不能重复');
    if (editedField && editedFields.has(editedField)) throw new AppError(400, '编辑图片字段名不能重复');
    imageIds.add(materialImageId);
    positions.add(position);
    if (editedField) editedFields.add(editedField);
    return { materialImageId, position, editedField };
  });

  return normalized.sort((left, right) => left.position - right.position);
}

function indexEditedFiles(files, manifest) {
  const expected = new Set(manifest.map(item => item.editedField).filter(Boolean));
  const byField = new Map();
  for (const file of files || []) {
    if (!expected.has(file.fieldname)) throw new AppError(400, '包含未声明的编辑图片');
    if (byField.has(file.fieldname)) throw new AppError(400, '同一编辑图片不能重复上传');
    if (file.mimetype !== 'image/png') throw new AppError(400, '编辑后的款式图必须为PNG图片');
    byField.set(file.fieldname, file);
  }
  for (const field of expected) {
    if (!byField.has(field)) throw new AppError(400, '缺少编辑后的款式图片');
  }
  return byField;
}

function safeDisplayName(value, fallback) {
  const fixed = fixFilenameEncoding(String(value || '').trim());
  const name = path.basename(fixed || fallback);
  return name && name !== '.' && name !== '..' ? name : fallback;
}

function removePhysicalFile(filePath) {
  try {
    const absolute = resolvePath(filePath);
    if (absolute && fs.existsSync(absolute)) fs.unlinkSync(absolute);
  } catch (_) {}
}

async function saveTaskStyleSnapshots({ taskId, materialStyleId, manifest, files, user }) {
  const normalizedTaskId = Number(taskId);
  const normalizedStyleId = Number(materialStyleId);
  if (!Number.isInteger(normalizedTaskId) || normalizedTaskId <= 0) throw new AppError(400, '任务ID无效');
  if (!Number.isInteger(normalizedStyleId) || normalizedStyleId <= 0) throw new AppError(400, '款式ID无效');
  if (user?.role !== 'cs_agent' && user?.role !== 'admin') throw new AppError(403, '仅客服可关联款式素材');

  const orderedManifest = normalizeManifest(manifest);
  const editedFiles = indexEditedFiles(files, orderedManifest);
  const writtenPaths = [];
  let replacedPaths = [];
  let publisherId = null;

  try {
    await executeTransaction(async conn => {
      const task = await taskDao.getTaskForUpdate(conn, normalizedTaskId);
      if (!task || task.task_group !== 'cs') throw new AppError(400, '仅客服任务支持款式素材');
      if (Number(task.publisher_id) !== Number(user.id) && user.role !== 'admin') {
        throw new AppError(403, '无权操作此任务');
      }
      publisherId = task.publisher_id;

      const [styles] = await conn.execute('SELECT id FROM material_style WHERE id = ?', [normalizedStyleId]);
      if (!styles.length) throw new AppError(404, '款式不存在');

      const imageIds = orderedManifest.map(item => item.materialImageId);
      const placeholders = imageIds.map(() => '?').join(',');
      const [images] = await conn.execute(
        `SELECT * FROM material_image WHERE id IN (${placeholders})`,
        imageIds
      );
      if (images.length !== imageIds.length) throw new AppError(404, '部分款式图片不存在');
      const imagesById = new Map(images.map(image => [Number(image.id), image]));
      if (images.some(image => Number(image.style_id) !== normalizedStyleId)) {
        throw new AppError(400, '所选素材图片与款式不匹配');
      }

      const [oldFiles] = await conn.execute(
        "SELECT file_path FROM task_file WHERE task_id = ? AND file_category = 'style'",
        [normalizedTaskId]
      );
      replacedPaths = oldFiles.map(file => file.file_path).filter(Boolean);
      await conn.execute(
        "DELETE FROM task_file WHERE task_id = ? AND file_category = 'style'",
        [normalizedTaskId]
      );

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      for (const item of orderedManifest) {
        const materialImage = imagesById.get(item.materialImageId);
        const editedFile = item.editedField ? editedFiles.get(item.editedField) : null;
        let buffer;
        let fileName;
        let mimeType;
        let extension;

        if (editedFile) {
          buffer = editedFile.buffer;
          fileName = safeDisplayName(editedFile.originalname, `material-${item.materialImageId}-效果图.png`);
          mimeType = 'image/png';
          extension = '.png';
        } else {
          const sourcePath = resolvePath(materialImage.file_path);
          if (!sourcePath || !fs.existsSync(sourcePath)) {
            throw new AppError(404, `素材图片不存在：${materialImage.display_name || materialImage.original_name}`);
          }
          buffer = fs.readFileSync(sourcePath);
          fileName = safeDisplayName(
            materialImage.display_name || materialImage.original_name,
            `material-${item.materialImageId}.jpg`
          );
          mimeType = materialImage.mime_type || 'application/octet-stream';
          extension = path.extname(materialImage.original_name || materialImage.display_name || sourcePath).toLowerCase() || '.jpg';
        }

        const storedName = `style-${String(item.position).padStart(3, '0')}-${uuidv4().replace(/-/g, '')}${extension}`;
        const filePath = saveImage('cs', dateStr, storedName, buffer);
        writtenPaths.push(filePath);
        await taskDao.insertFileRecord(conn, {
          taskId: normalizedTaskId,
          fileName,
          filePath,
          fileSize: buffer.length,
          fileType: 'image',
          mimeType,
          uploaderId: user.id,
          fileCategory: 'style'
        });
      }
    });
  } catch (error) {
    writtenPaths.forEach(removePhysicalFile);
    throw error;
  }

  replacedPaths.forEach(removePhysicalFile);
  if (global.io) {
    if (publisherId) global.io.to(`user:${publisherId}`).emit('task:update');
    global.io.to('group:cs').emit('task:update');
  }
  return {
    copied: orderedManifest.length,
    edited: orderedManifest.filter(item => item.editedField).length
  };
}

module.exports = { saveTaskStyleSnapshots, normalizeManifest };
