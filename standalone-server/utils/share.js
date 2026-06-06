/**
 * 文件存储工具 — 按任务分组分离存储
 *
 * 路径格式: {group}/{type}/{date}/{filename}
 *   design/images/20260521/abc.jpg   → 运营+美工 图片
 *   cs/attachments/20260521/x.psd    → 客服+基础美工 附件
 *
 * 物理目录通过 sys_config 配置，env 变量可覆盖默认值
 */
const path = require('path');
const fs = require('fs');

// ========== 配置缓存 ==========

const UPLOAD_ROOT = path.join(__dirname, '..', 'upload');

// Docker 映射的宿主机目录（D:/Nexus_BOX → /app/host-uploads）
const HOST_UPLOAD_ROOT = 'D:/Nexus_BOX';

const DEFAULT_CONFIG = {
  design_images_dir: process.env.DESIGN_IMAGE_DIR || path.join(HOST_UPLOAD_ROOT, 'design', 'images'),
  design_attachments_dir: process.env.DESIGN_ATTACHMENT_DIR || path.join(HOST_UPLOAD_ROOT, 'design', 'attachments'),
  cs_images_dir: process.env.CS_IMAGE_DIR || path.join(HOST_UPLOAD_ROOT, 'cs', 'images'),
  cs_attachments_dir: process.env.CS_ATTACHMENT_DIR || path.join(HOST_UPLOAD_ROOT, 'cs', 'attachments'),
  operator_images_dir: process.env.OPERATOR_IMAGE_DIR || path.join(HOST_UPLOAD_ROOT, 'operator', 'images'),
  operator_attachments_dir: process.env.OPERATOR_ATTACHMENT_DIR || path.join(HOST_UPLOAD_ROOT, 'operator', 'attachments'),
};

let storageConfig = { ...DEFAULT_CONFIG };

// 上传限制缓存（从 sys_config 加载，admin 可动态修改）
let uploadLimits = {
  maxFileSizeMB: 50,   // upload.max_file_size_mb
  maxFileCount: 10,    // upload.max_file_count
};

// ========== 目录工具 ==========

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

// ========== 配置加载 ==========

/**
 * 从数据库加载存储目录配置，覆盖默认值
 * 应在服务器启动、DB 就绪后调用
 */
async function initStorageConfig(pool) {
  const keys = [
    'upload.design_images_dir',
    'upload.design_attachments_dir',
    'upload.cs_images_dir',
    'upload.cs_attachments_dir',
    'upload.operator_images_dir',
    'upload.operator_attachments_dir',
  ];
  const propMap = {
    'upload.design_images_dir': 'design_images_dir',
    'upload.design_attachments_dir': 'design_attachments_dir',
    'upload.cs_images_dir': 'cs_images_dir',
    'upload.cs_attachments_dir': 'cs_attachments_dir',
    'upload.operator_images_dir': 'operator_images_dir',
    'upload.operator_attachments_dir': 'operator_attachments_dir',
  };

  for (const key of keys) {
    try {
      const [rows] = await pool.execute(
        'SELECT config_value FROM sys_config WHERE config_key = ?',
        [key]
      );
      if (rows.length > 0 && rows[0].config_value) {
        storageConfig[propMap[key]] = rows[0].config_value;
      }
    } catch (_) {
      // 表可能还不存在，使用默认值
    }
  }

  // 加载上传限制配置
  const limitKeys = ['upload.max_file_size_mb', 'upload.max_file_count'];
  for (const key of limitKeys) {
    try {
      const [rows] = await pool.execute(
        'SELECT config_value FROM sys_config WHERE config_key = ?',
        [key]
      );
      if (rows.length > 0 && rows[0].config_value) {
        const val = parseInt(rows[0].config_value, 10);
        if (!Number.isNaN(val) && val > 0) {
          if (key === 'upload.max_file_size_mb') uploadLimits.maxFileSizeMB = val;
          else if (key === 'upload.max_file_count') uploadLimits.maxFileCount = val;
        }
      }
    } catch (_) { /* 表可能还不存在 */ }
  }

  // 确保所有目录存在
  for (const dir of Object.values(storageConfig)) {
    try { ensureDir(dir); } catch (_) {}
  }

  console.log('[Storage] 存储目录配置:', storageConfig);
  console.log('[Storage] 上传限制:', uploadLimits);
  return storageConfig;
}

/**
 * 获取指定分组的存储目录
 * @param {'design'|'cs'} group
 * @param {'images'|'attachments'} type
 */
function getStorageDir(group, type) {
  const key = `${group}_${type}_dir`;
  const dir = storageConfig[key] || DEFAULT_CONFIG[key];
  if (!dir) {
    throw new Error(`未配置存储目录: ${key}`);
  }
  ensureDir(dir);
  return dir;
}

// ========== 路径解析 ==========

/**
 * 将数据库相对路径解析为磁盘绝对路径
 *
 * 支持格式:
 *   design/images/20260521/x.jpg     → {design_images_dir}/20260521/x.jpg
 *   cs/attachments/20260521/x.psd    → {cs_attachments_dir}/20260521/x.psd
 *   images/20260521/x.jpg            → {design_images_dir}/20260521/x.jpg  (legacy)
 *   attachments/20260521/x.psd       → {design_attachments_dir}/20260521/x.psd  (legacy)
 */
function resolvePath(filePath) {
  if (!filePath) return null;

  // 去除旧版 share: 前缀（SMB 迁移遗留）
  let cleaned = filePath;
  if (cleaned.startsWith('share:')) {
    cleaned = cleaned.substring(6);
  }

  const normalized = path.normalize(cleaned).replace(/\\/g, '/');
  if (normalized.includes('..')) {
    throw new Error('非法的文件路径');
  }

  const parts = normalized.split('/');

  // 新格式: {group}/{type}/{date}/{filename}
  if (parts[0] === 'design' || parts[0] === 'cs' || parts[0] === 'operator') {
    const group = parts[0];
    const type = parts[1]; // 'images' or 'attachments'
    const rest = parts.slice(2).join('/');
    const baseDir = getStorageDir(group, type);
    return path.join(baseDir, rest);
  }

  // Legacy 格式: images/... 或 attachments/...
  if (parts[0] === 'images') {
    const baseDir = getStorageDir('design', 'images');
    return path.join(baseDir, ...parts.slice(1));
  }

  // Legacy 附件
  const baseDir = getStorageDir('design', 'attachments');
  return path.join(baseDir, ...parts.slice(1));
}

// ========== 图片存取 ==========

function saveImage(group, dateStr, filename, buffer) {
  const baseDir = getStorageDir(group, 'images');
  const dir = path.join(baseDir, dateStr);
  ensureDir(dir);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);
  return `${group}/images/${dateStr}/${filename}`;
}

function readImage(filePath) {
  const fullPath = resolvePath(filePath);
  if (!fullPath || !fs.existsSync(fullPath)) return null;
  const buffer = fs.readFileSync(fullPath);
  const ext = path.extname(filePath).toLowerCase();
  return { buffer, ext };
}

function readImageStream(filePath) {
  const fullPath = resolvePath(filePath);
  if (!fullPath || !fs.existsSync(fullPath)) return null;
  return fs.createReadStream(fullPath);
}

// ========== 附件存取 ==========

/**
 * 保存附件到分组目录
 * @returns {string} 相对路径，如 "design/attachments/20260521/x.psd"
 */
function saveAttachment(group, dateStr, filename, sourcePath) {
  const baseDir = getStorageDir(group, 'attachments');
  const dir = path.join(baseDir, dateStr);
  ensureDir(dir);
  const destPath = path.join(dir, filename);
  fs.copyFileSync(sourcePath, destPath);
  return `${group}/attachments/${dateStr}/${filename}`;
}

/**
 * 获取上传文件大小上限（MB）
 */
function getMaxFileSizeMB() {
  return uploadLimits.maxFileSizeMB;
}

/**
 * 获取单次上传最多文件数
 */
function getMaxFileCount() {
  return uploadLimits.maxFileCount;
}

module.exports = {
  initStorageConfig,
  getStorageDir,
  resolvePath,
  saveImage,
  saveAttachment,
  getMaxFileSizeMB,
  getMaxFileCount,
  readImage,
  readImageStream,
  UPLOAD_ROOT,
};
