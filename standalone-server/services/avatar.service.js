const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');
const { getPool, executeTransaction } = require('../config/database');
const { getUserAvatarDir } = require('../utils/share');

const AVATAR_SIZE = 512;
const MAX_SOURCE_DIMENSION = 12000;

function resolveAvatarPath(rootValue, relativePath) {
  const root = path.resolve(rootValue);
  const relative = String(relativePath || '').replace(/\\/g, '/');
  if (!relative || path.isAbsolute(relative) || relative.split('/').includes('..')) {
    throw new AppError(400, '头像文件路径无效');
  }
  const fullPath = path.resolve(root, relative);
  if (fullPath === root || !fullPath.startsWith(root + path.sep)) {
    throw new AppError(400, '头像文件路径无效');
  }
  return fullPath;
}

function removeFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (error) {
    console.warn('[Avatar] 清理头像文件失败:', error.message);
  }
}

async function normalizeAvatar(buffer) {
  try {
    const metadata = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_SOURCE_DIMENSION * MAX_SOURCE_DIMENSION
    }).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
      throw new AppError(400, '只允许上传 JPG、PNG 或 WebP 图片');
    }
    if (!metadata.width || !metadata.height
      || metadata.width > MAX_SOURCE_DIMENSION
      || metadata.height > MAX_SOURCE_DIMENSION) {
      throw new AppError(400, '头像像素尺寸不能超过 12000 x 12000');
    }
    return await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_SOURCE_DIMENSION * MAX_SOURCE_DIMENSION
    })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 88 })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, '头像图片无法读取或内容已损坏');
  }
}

async function getAvatar(userId) {
  const [rows] = await getPool().execute(
    'SELECT avatar_path FROM sys_user WHERE id = ?',
    [userId]
  );
  const relativePath = rows[0]?.avatar_path || '';
  if (!relativePath) return null;
  const filePath = resolveAvatarPath(getUserAvatarDir(), relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return { filePath, mimeType: 'image/webp' };
}

async function replaceAvatar(userId, file) {
  if (!file?.buffer?.length) throw new AppError(400, '请选择头像图片');
  const output = await normalizeAvatar(file.buffer);
  const root = path.resolve(getUserAvatarDir());
  fs.mkdirSync(root, { recursive: true });

  const filename = `user-${Number(userId)}-${uuidv4().replace(/-/g, '')}.webp`;
  const finalPath = resolveAvatarPath(root, filename);
  const temporaryPath = `${finalPath}.tmp`;
  let previousPath = '';

  try {
    fs.writeFileSync(temporaryPath, output);
    fs.renameSync(temporaryPath, finalPath);

    await executeTransaction(async conn => {
      const [rows] = await conn.execute(
        'SELECT avatar_path FROM sys_user WHERE id = ?',
        [userId]
      );
      if (!rows.length) throw new AppError(404, '用户不存在');
      previousPath = rows[0].avatar_path || '';
      await conn.execute(
        'UPDATE sys_user SET avatar_path = ? WHERE id = ?',
        [filename, userId]
      );
    });
  } catch (error) {
    removeFile(temporaryPath);
    removeFile(finalPath);
    throw error;
  }

  if (previousPath && previousPath !== filename) {
    removeFile(resolveAvatarPath(root, previousPath));
  }
  return { hasAvatar: true };
}

module.exports = {
  getAvatar,
  replaceAvatar
};
