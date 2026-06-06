/**
 * 内网共享文件夹工具 — 仅用于图片附件
 * 凭据不暴露在任何前端界面
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// 共享文件夹配置（仅后端可见）
const SHARED_HOST = '\\\\192.168.101.51\\数据库';
const SHARED_IMAGE_DIR = path.join(SHARED_HOST, '图片附件');
const SHARED_USER = 'share';
const SHARED_PASS = 'cmjy%123$photo';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

/**
 * 挂载网络共享（服务启动时调用一次）
 */
function mountSharedFolder() {
  try {
    // 先尝试断开已有连接（忽略错误）
    try { execSync(`net use ${SHARED_HOST} /delete /y 2>nul`, { timeout: 5000 }); } catch (_) {}
    // 建立认证连接
    execSync(`net use ${SHARED_HOST} /user:${SHARED_USER} "${SHARED_PASS}" /persistent:yes`, { timeout: 10000 });
    console.log('[SharedFolder] 网络共享已挂载:', SHARED_IMAGE_DIR);
    return true;
  } catch (err) {
    console.error('[SharedFolder] 挂载失败:', err.message);
    return false;
  }
}

/**
 * 将图片保存到共享文件夹
 * @param {string} localPath - multer 保存的本地临时路径
 * @param {string} fileName - 文件名（含扩展名）
 * @returns {string} 共享文件夹中的相对路径
 */
function saveImageToShared(localPath, fileName) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const targetDir = path.join(SHARED_IMAGE_DIR, dateStr);

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const destPath = path.join(targetDir, fileName);
    fs.copyFileSync(localPath, destPath);
    // 删除本地临时文件
    try { fs.unlinkSync(localPath); } catch (_) {}

    // 返回相对于共享文件夹根目录的路径
    return `shared/${dateStr}/${fileName}`;
  } catch (err) {
    console.error('[SharedFolder] 保存图片失败:', err.message);
    throw err;
  }
}

/**
 * 从共享文件夹读取文件流
 * @param {string} relativePath - 数据库中存储的相对路径 (如 shared/20260512/abc.jpg)
 * @returns {ReadStream}
 */
function getImageReadStream(relativePath) {
  const cleanPath = relativePath.replace(/^shared\//, '');
  const fullPath = path.join(SHARED_IMAGE_DIR, cleanPath);

  // 安全检查
  const normalized = path.normalize(fullPath);
  if (!normalized.startsWith(SHARED_IMAGE_DIR)) {
    throw new Error('非法的文件路径');
  }

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return fs.createReadStream(fullPath);
}

module.exports = {
  mountSharedFolder,
  saveImageToShared,
  getImageReadStream,
  isImageFile,
  SHARED_IMAGE_DIR,
  SHARED_HOST
};
