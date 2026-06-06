/**
 * 文件上传处理工具
 * 格式校验、大小校验、路径安全、防越权、防覆盖、防跨目录
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const { getPool } = require('../config/database');
const { resolvePath, getStorageDir, getMaxFileSizeMB, getMaxFileCount } = require('./share');

// ========== 上传根目录检测 ==========
let UPLOAD_ROOT;

try {
  if (process.resourcesPath && process.resourcesPath !== __dirname) {
    // Electron 打包模式：上传目录在 resourcesPath 下
    UPLOAD_ROOT = path.join(process.resourcesPath, 'upload');
  } else {
    // 独立服务器模式：standalone-server/upload/（与 share.js 的 resolvePath 保持一致）
    UPLOAD_ROOT = path.join(__dirname, '..', 'upload');
  }
} catch (_) {
  UPLOAD_ROOT = path.join(__dirname, '..', 'upload');
}

// 兜底创建
try { fs.mkdirSync(UPLOAD_ROOT, { recursive: true }); } catch (_) {}

if (!fs.existsSync(UPLOAD_ROOT)) {
  UPLOAD_ROOT = path.join(os.tmpdir(), 'd-design-upload');
  try { fs.mkdirSync(UPLOAD_ROOT, { recursive: true }); } catch (_) {}
}

const IMAGE_DIR = path.join(UPLOAD_ROOT, 'images');
const ATTACHMENT_DIR = path.join(UPLOAD_ROOT, 'attachments');

// 分段创建目录（避免 ENOTDIR 错误）
function safeMkdir(dirPath) {
  const parts = dirPath.replace(/\\/g, '/').split('/');
  let current = '';
  for (const part of parts) {
    if (!part) continue;
    current = current ? `${current}/${part}` : part;
    try {
      if (!fs.existsSync(current)) {
        fs.mkdirSync(current);
      }
    } catch (_) {
      // 忽略已存在等错误
    }
  }
}

try {
  safeMkdir(IMAGE_DIR);
  safeMkdir(ATTACHMENT_DIR);
  console.log('[Upload] 上传目录就绪:', UPLOAD_ROOT);
} catch (err) {
  console.error('[Upload] 创建上传目录失败:', err.message);
  // 最终 fallback 到系统 tmp
  UPLOAD_ROOT = path.join(os.tmpdir(), 'd-design-upload');
  safeMkdir(path.join(UPLOAD_ROOT, 'images'));
  safeMkdir(path.join(UPLOAD_ROOT, 'attachments'));
}

// 图片扩展名（用于判断存储目标：共享文件夹 / 本地）
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif', '.ico', '.avif', '.heic'];

/**
 * 获取指定分组的附件存储目录
 * @param {'design'|'cs'} group
 */
function getAttachmentDir(group) {
  return getStorageDir(group, 'attachments');
}

/**
 * 修复 multer/busboy 中文件名编码问题
 * Node.js HTTP 解析器将 Content-Disposition 中的 UTF-8 字节按 Latin-1 解析，
 * 导致中文文件名变乱码。此函数将 Latin-1 错误映射还原为正确的 UTF-8。
 */
function fixFilenameEncoding(name) {
  if (!name) return name
  const bytes = Buffer.from(name, 'latin1')
  const utf8 = bytes.toString('utf8')
  return (!utf8.includes('�') && utf8 !== name) ? utf8 : name
}

// 默认最大文件大小 (50MB) — 作为兜底默认值，实际运行时使用 share.getMaxFileSizeMB()
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * 创建multer上传中间件
 * @param {string} fileType - 文件类型 'image' 或 'attachment'
 * @returns {Function} multer中间件
 */
function createUploadMiddleware() {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const subDir = path.join(ATTACHMENT_DIR, dateStr);
      try { safeMkdir(subDir); } catch (_) {}
      cb(null, subDir);
    },
    filename: (req, file, cb) => {
      file.originalname = fixFilenameEncoding(file.originalname);
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4().replace(/-/g, '')}${ext}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      return cb(new Error('文件名不合法'), false);
    }
    cb(null, true);
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: getMaxFileSizeMB() * 1024 * 1024, files: getMaxFileCount() }
  });
}

/**
 * 获取上传文件的相对路径（用于数据库存储）
 */
function getRelativePath(absolutePath) {
  return path.relative(UPLOAD_ROOT, absolutePath).replace(/\\/g, '/');
}

/**
 * 获取上传文件的绝对路径
 */
function getAbsolutePath(relativePath) {
  const normalized = path.normalize(relativePath).replace(/\\/g, '/');
  if (normalized.includes('..')) {
    throw new Error('非法的文件路径');
  }
  return path.join(UPLOAD_ROOT, normalized);
}

/**
 * 保存文件记录到数据库
 */
async function saveFileRecord(taskId, fileInfo, uploaderId, fileCategory = 'work') {
  const { originalname: rawName, path: filePath, size, mimetype } = fileInfo;
  const originalname = fixFilenameEncoding(rawName);
  const ext = path.extname(originalname).toLowerCase();
  const fileType = IMAGE_EXTS.includes(ext) ? 'image' : 'attachment';
  const relativePath = getRelativePath(filePath);

  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO task_file (task_id, file_name, file_path, file_size, file_type, mime_type, uploader_id, file_category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [taskId, originalname, relativePath, size, fileType, mimetype || '', uploaderId, fileCategory]
  );

  return result.insertId;
}

/**
 * 删除文件（物理删除 + 数据库记录）
 */
async function deleteFile(fileId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM task_file WHERE id = ?`,
    [fileId]
  );

  if (rows.length === 0) return false;

  const file = rows[0];
  const absolutePath = resolvePath(file.file_path);

  try {
    if (absolutePath && fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (err) {
    console.error('[Upload] 删除文件失败:', err.message);
  }

  await pool.execute(`DELETE FROM task_file WHERE id = ?`, [fileId]);
  return true;
}

/**
 * 生成文件访问URL
 */
function getFileUrl(relativePath) {
  return `/upload/${relativePath.replace(/\\/g, '/')}`;
}

module.exports = {
  createUploadMiddleware,
  saveFileRecord,
  deleteFile,
  getFileUrl,
  getRelativePath,
  getAbsolutePath,
  getAttachmentDir,
  fixFilenameEncoding,
  UPLOAD_ROOT,
  IMAGE_DIR,
  ATTACHMENT_DIR,
  IMAGE_EXTS,
  MAX_FILE_SIZE
};
