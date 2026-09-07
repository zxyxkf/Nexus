/**
 * Nexus
 * 职责：窗口管理、IPC通信、系统托盘
 * 后端：连接独立部署的服务端
 */

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Notification, screen } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { autoUpdater } = require('electron-updater');

// 禁止Electron安全警告
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// ===== 启动日志 =====
const STARTUP_LOG = path.join(process.env.TEMP || '/tmp', 'nexus-startup.log');
function startupLog(msg) {
  try {
    fs.appendFileSync(STARTUP_LOG, `[${new Date().toISOString()}] PID=${process.pid} ${msg}\n`);
  } catch (_) {}
}

// 确保没有僵尸进程占用单实例锁
if (process.platform === 'win32') {
  try {
    execSync(`taskkill /F /IM Nexus.exe /FI "PID ne ${process.pid}" 2>nul`, { timeout: 3000, stdio: 'ignore' });
    execSync('ping 127.0.0.1 -n 3 >nul', { timeout: 4000, stdio: 'ignore' });
  } catch (_) { /* 无其他实例运行 */ }
}

// ===== 单实例锁 =====
startupLog('尝试获取单实例锁...');
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  startupLog('FATAL: requestSingleInstanceLock 返回 false');
  dialog.showErrorBox('Nexus 启动失败', 'Nexus 已经在运行中，请检查任务栏或系统托盘。\n如果确认没有运行，请在任务管理器中结束所有 Nexus.exe 进程后重试。');
  app.exit(0);
} else {
  startupLog('单实例锁获取成功');
  app.on('second-instance', () => {
    startupLog('second-instance 事件触发');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Windows 原生通知必须设置 AppUserModelId
if (process.platform === 'win32') {
  app.setAppUserModelId('com.nexus.app')
}

let mainWindow = null;
let toastWindow = null;
let isUpdating = false;
let isQuitting = false;
let lastToastSoundAt = 0;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const TOAST_WINDOW_WIDTH = 400;
const TOAST_WINDOW_MIN_HEIGHT = 140;
const TOAST_WINDOW_MAX_HEIGHT = 430;
const TOAST_MARGIN = 20;

// ===== 服务器配置管理 =====
const CONFIG_FILE = path.join(app.getPath('userData'), 'server-config.json');
const DEFAULT_SERVER = 'http://192.168.101.78:18632';

function getServerConfig() {
  try {
    const fs = require('fs');
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (_) {}
  return { serverUrl: DEFAULT_SERVER };
}

function saveServerConfig(config) {
  try {
    const fs = require('fs');
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (_) { return false; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'Nexus',
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    show: false,
    backgroundColor: '#f5f7fa'
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Always load from built dist files
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  mainWindow.on('close', () => {
    isQuitting = true;
    if (toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.destroy();
      toastWindow = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createToastWindow() {
  const initialBounds = getToastWindowBounds(TOAST_WINDOW_MIN_HEIGHT)
  toastWindow = new BrowserWindow({
    width: TOAST_WINDOW_WIDTH,
    height: TOAST_WINDOW_MIN_HEIGHT,
    x: initialBounds.x,
    y: initialBounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'toast-preload.js'),
      contextIsolation: false
    }
  })
  toastWindow.loadFile(path.join(__dirname, 'toast.html'))
  toastWindow.on('close', (e) => {
    if (!isQuitting && !isUpdating) {
      e.preventDefault()
      toastWindow.hide()
    }
  })
}

function getToastDisplay() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return screen.getDisplayMatching(mainWindow.getBounds())
  }
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

function getToastWindowBounds(height = TOAST_WINDOW_MIN_HEIGHT) {
  const display = getToastDisplay()
  const workArea = display.workArea || display.bounds
  const safeHeight = Math.max(TOAST_WINDOW_MIN_HEIGHT, Math.min(TOAST_WINDOW_MAX_HEIGHT, Number(height) || TOAST_WINDOW_MIN_HEIGHT))
  return {
    width: TOAST_WINDOW_WIDTH,
    height: safeHeight,
    x: workArea.x + workArea.width - TOAST_WINDOW_WIDTH - TOAST_MARGIN,
    y: workArea.y + workArea.height - safeHeight - TOAST_MARGIN
  }
}

function positionToastWindow(height) {
  if (!toastWindow || toastWindow.isDestroyed()) return
  toastWindow.setBounds(getToastWindowBounds(height), false)
}

function sendToastToWindow(data) {
  if (!toastWindow || toastWindow.isDestroyed()) {
    createToastWindow()
  }

  const send = () => {
    if (toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.webContents.send('toast:show', data)
    }
  }

  if (toastWindow.webContents.isLoading()) {
    toastWindow.webContents.once('did-finish-load', send)
  } else {
    send()
  }
}

function playToastSound() {
  const now = Date.now()
  if (now - lastToastSoundAt < 1200) return
  lastToastSoundAt = now
  try {
    shell.beep()
  } catch (_) {}
}

// ===== IPC 通信 =====
ipcMain.on('flash-frame', () => {
  if (mainWindow) mainWindow.flashFrame(true)
})

ipcMain.on('desktop-notification', (event, { title, body, type }) => {
  if (!mainWindow) return
  try {
    const notif = new Notification({ title, body })
    notif.on('click', () => {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    })
    notif.show()
  } catch (err) {
    // 静默失败不影响应用运行
  }
})

// ===== Toast 独立窗口 =====
ipcMain.on('show-toast', (event, data) => {
  sendToastToWindow(data)
  playToastSound()
})

ipcMain.on('toast:show-window', (event, data = {}) => {
  if (toastWindow && !toastWindow.isDestroyed()) {
    positionToastWindow(data.height || toastWindow.getBounds().height)
    toastWindow.showInactive()
  }
})

ipcMain.on('toast:resize-window', (event, data = {}) => {
  positionToastWindow(data.height)
})

ipcMain.on('toast:hide-window', () => {
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.hide()
  }
})

ipcMain.on('toast:click', (event, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('toast:clicked', data)
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

ipcMain.handle('get-server-config', () => {
  return getServerConfig();
});

ipcMain.handle('set-server-config', (event, config) => {
  return saveServerConfig(config);
});

ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    isDev,
    dataPath: app.getPath('userData'),
    serverConfig: getServerConfig()
  };
});

ipcMain.handle('open-file-dialog', async (event, options) => {
  return await dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('open-file-location', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ===== HTTP 请求工具 =====

function httpGetBuffer(url, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: { 'Authorization': `Bearer ${token}` }
    };
    const request = mod.get(opts, (res) => {
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', reject);
      res.on('aborted', () => reject(new Error('拖拽文件下载中断')));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || 'application/octet-stream'
      }));
    });
    request.setTimeout(120000, () => {
      request.destroy(new Error('拖拽文件下载超时'));
    });
    request.on('error', reject);
  });
}

// ===== 图片预览（同时缓存文件用于拖拽） =====

// Persistent cache metadata and bounded preparation queue.
const dragFileCache = new Map(); // fileId:fileName -> tempPath
const dragFileNameCache = new Map(); // fileId:fileName -> sanitized fileName
const dragFileMetaCache = new Map();
const dragCacheTtlMs = 60 * 60 * 1000;
const dragReservedPaths = new Set();
const dragPreparePending = [];
const dragPrepareJobs = new Map();
let dragPrepareActive = 0;
let dragPrepareNormalActive = 0;

function getDragCacheDir() {
  return path.join(app.getPath('temp'), 'nexus-drag');
}

function getDragIconPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'drag-icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(__dirname, 'drag-icon.ico'),
    path.join(__dirname, '../build/icon.ico')
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

function getDragManifestPath() {
  return path.join(getDragCacheDir(), 'manifest.json');
}

function normalizeDragFileId(fileId) {
  return String(fileId ?? '');
}

function sanitizeDragFileName(fileName, fileId) {
  const fallback = `file-${String(fileId || 'download').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  let safeName = path.basename(String(fileName || '')).trim()
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '');
  if (!safeName || safeName === '.' || safeName === '..') safeName = fallback;
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(safeName)) safeName = `_${safeName}`;
  return safeName;
}

function normalizeDragServerUrl(serverUrl = getServerConfig().serverUrl) {
  return String(serverUrl || '').replace(/\/+$/, '');
}

function getDragAuthScope(token) {
  if (!token) return '';
  const parts = String(token).split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const stableIdentity = payload.sub ?? payload.user_id ?? payload.userId ?? payload.id ?? payload.username;
      if (stableIdentity != null && String(stableIdentity).trim()) return `user:${String(stableIdentity).trim()}`;
    } catch (_) {}
  }
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function normalizeDragCacheKey(fileId, fileName = '', downloadPath = '', serverUrl = getServerConfig().serverUrl, authScope = '') {
  const id = normalizeDragFileId(fileId);
  const server = normalizeDragServerUrl(serverUrl);
  if (!fileName) return `${server}:${authScope}:${id}`;
  const resolvedDownloadPath = downloadPath ? resolveDragDownloadPath(id, downloadPath) : '';
  return `${server}:${authScope}:${id}:${sanitizeDragFileName(fileName, id)}:${resolvedDownloadPath}`;
}

function isDragCachePath(pathName) {
  const root = path.resolve(getDragCacheDir()) + path.sep;
  return path.resolve(pathName).startsWith(root);
}

function findCachedDragEntry(fileId, fileName = '', downloadPath = '', token = '') {
  const authScope = getDragAuthScope(token);
  if (!authScope) return '';
  const id = normalizeDragFileId(fileId);
  const serverUrl = normalizeDragServerUrl();
  const safeFileName = fileName ? sanitizeDragFileName(fileName, id) : '';
  const resolvedDownloadPath = downloadPath ? resolveDragDownloadPath(id, downloadPath) : '';

  if (fileName && downloadPath) {
    const exactKey = normalizeDragCacheKey(id, fileName, resolvedDownloadPath, serverUrl, authScope);
    const exactMetadata = dragFileMetaCache.get(exactKey);
    const exactPath = dragFileCache.get(exactKey);
    if (exactMetadata && exactPath && fs.existsSync(exactPath)) {
      return { key: exactKey, metadata: exactMetadata, tempPath: exactPath };
    }
  }

  const candidates = [];
  for (const [key, metadata] of dragFileMetaCache) {
    if (metadata.serverUrl !== serverUrl || metadata.authScope !== authScope || metadata.fileId !== id) continue;
    if (resolvedDownloadPath && metadata.downloadPath !== resolvedDownloadPath) continue;
    if (safeFileName && metadata.fileName !== safeFileName) candidates.push({ key, metadata, tempPath: dragFileCache.get(key) });
    else candidates.unshift({ key, metadata, tempPath: dragFileCache.get(key) });
  }
  return candidates.find(entry => entry.tempPath && fs.existsSync(entry.tempPath)) || '';
}

function getCachedDragPath(fileId, fileName = '', downloadPath = '', token = '') {
  return findCachedDragEntry(fileId, fileName, downloadPath, token)?.tempPath || '';
}

function persistDragManifest() {
  const tempDir = getDragCacheDir();
  try {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const manifestPath = getDragManifestPath();
    const tempManifestPath = `${manifestPath}.tmp`;
    fs.writeFileSync(tempManifestPath, JSON.stringify({
      version: 1,
      entries: Array.from(dragFileMetaCache.values())
    }, null, 2), 'utf8');
    try {
      fs.renameSync(tempManifestPath, manifestPath);
    } catch (_) {
      fs.rmSync(manifestPath, { force: true });
      fs.renameSync(tempManifestPath, manifestPath);
    }
  } catch (err) {
    startupLog(`拖拽缓存清单写入失败: ${err.message}`);
  }
}

function loadDragManifest() {
  try {
    const manifestPath = getDragManifestPath();
    if (!fs.existsSync(manifestPath)) return { entries: [], corrupted: false };
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) {
      return { entries: [], corrupted: true };
    }
    return { entries: parsed.entries, corrupted: false };
  } catch (err) {
    startupLog(`拖拽缓存清单读取失败: ${err.message}`);
    return { entries: [], corrupted: true };
  }
}

function restoreDragCache() {
  const tempDir = getDragCacheDir();
  if (!fs.existsSync(tempDir)) return;
  const now = Date.now();
  const currentServerUrl = normalizeDragServerUrl();
  const manifest = loadDragManifest();
  let changed = manifest.corrupted;
  dragFileCache.clear();
  dragFileNameCache.clear();
  dragFileMetaCache.clear();
  for (const entry of manifest.entries) {
    const fileId = normalizeDragFileId(entry?.fileId);
    const safeFileName = sanitizeDragFileName(entry?.fileName, fileId);
    const tempPath = path.resolve(String(entry?.tempPath || ''));
    const updatedAt = Number(entry?.updatedAt || 0);
    const serverUrl = typeof entry?.serverUrl === 'string' ? normalizeDragServerUrl(entry.serverUrl) : '';
    const authScope = typeof entry?.authScope === 'string' ? entry.authScope : '';
    const valid = fileId && entry?.fileName && authScope && serverUrl === currentServerUrl && isDragCachePath(tempPath) &&
      fs.existsSync(tempPath) && updatedAt > 0 && now - updatedAt <= dragCacheTtlMs;
    if (!valid) {
      if (tempPath && isDragCachePath(tempPath) && fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
      changed = true;
      continue;
    }
    let stat;
    try {
      stat = fs.statSync(tempPath);
    } catch (_) {
      changed = true;
      continue;
    }
    if (entry.size != null && Number(entry.size) !== stat.size) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
      changed = true;
      continue;
    }
    const downloadPath = resolveDragDownloadPath(fileId, entry.downloadPath);
    const cacheKey = normalizeDragCacheKey(fileId, safeFileName, downloadPath, serverUrl, authScope);
    dragFileCache.set(cacheKey, tempPath);
    dragFileNameCache.set(cacheKey, safeFileName);
    dragFileMetaCache.set(cacheKey, {
      fileId,
      fileName: safeFileName,
      downloadPath,
      serverUrl,
      authScope,
      tempPath,
      size: stat.size,
      updatedAt
    });
  }
  if (changed) persistDragManifest();
}

function chooseDragTempPath(cacheKey, safeFileName) {
  const existingPath = dragFileCache.get(cacheKey);
  if (existingPath && isDragCachePath(existingPath)) return existingPath;
  const tempDir = getDragCacheDir();
  let tempPath = path.join(tempDir, safeFileName);
  const usedPaths = () => Array.from(dragFileCache.values()).includes(tempPath) || dragReservedPaths.has(tempPath);
  if (fs.existsSync(tempPath) || usedPaths()) {
    const ext = path.extname(safeFileName);
    const base = path.basename(safeFileName, ext);
    let counter = 1;
    while (fs.existsSync(tempPath) || usedPaths()) {
      tempPath = path.join(tempDir, `${base}_(${counter})${ext}`);
      counter += 1;
    }
  }
  dragReservedPaths.add(tempPath);
  return tempPath;
}

function cacheDragFile(fileId, fileName, buffer, downloadPath = '', token = '') {
  const tempDir = getDragCacheDir();
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const safeFileName = sanitizeDragFileName(fileName, fileId);
  const resolvedDownloadPath = resolveDragDownloadPath(fileId, downloadPath);
  const serverUrl = normalizeDragServerUrl();
  const authScope = getDragAuthScope(token);
  if (!authScope) return;
  const cacheKey = normalizeDragCacheKey(fileId, safeFileName, resolvedDownloadPath, serverUrl, authScope);
  const tempPath = chooseDragTempPath(cacheKey, safeFileName);
  try {
    fs.writeFileSync(tempPath, buffer);
  } catch (err) {
    try { fs.rmSync(tempPath, { force: true }); } catch (_) {}
    throw err;
  } finally {
    dragReservedPaths.delete(tempPath);
  }
  dragFileCache.set(cacheKey, tempPath);
  dragFileNameCache.set(cacheKey, safeFileName);
  dragFileMetaCache.set(cacheKey, {
    fileId: normalizeDragFileId(fileId),
    fileName: safeFileName,
    downloadPath: resolvedDownloadPath,
    serverUrl,
    authScope,
    tempPath,
    size: buffer.length,
    updatedAt: Date.now()
  });
  persistDragManifest();
}

function removeCachedDragFile(fileId, fileName = '', downloadPath = '', cacheServerUrl = getServerConfig().serverUrl, cacheAuthScope = '', shouldPersist = true) {
  const id = normalizeDragFileId(fileId);
  const serverUrl = normalizeDragServerUrl(cacheServerUrl);
  const requestedKey = fileName && downloadPath && cacheAuthScope
    ? normalizeDragCacheKey(id, fileName, downloadPath, serverUrl, cacheAuthScope)
    : '';
  const safeFileName = fileName ? sanitizeDragFileName(fileName, id) : '';
  const keys = Array.from(dragFileMetaCache.entries()).filter(([key, metadata]) => {
    if (requestedKey) return key === requestedKey;
    if (metadata.serverUrl !== serverUrl || metadata.authScope !== cacheAuthScope || metadata.fileId !== id) return false;
    return !safeFileName || metadata.fileName === safeFileName;
  }).map(([key]) => key);
  for (const cacheKey of keys) {
    const cachedPath = dragFileCache.get(cacheKey);
    if (cachedPath && fs.existsSync(cachedPath)) {
      try { fs.unlinkSync(cachedPath); } catch (_) {}
    }
    dragFileCache.delete(cacheKey);
    dragFileNameCache.delete(cacheKey);
    dragFileMetaCache.delete(cacheKey);
  }
  if (keys.length && shouldPersist) persistDragManifest();
}

function cleanExpiredCache() {
  const tempDir = getDragCacheDir();
  if (!fs.existsSync(tempDir)) return;
  const now = Date.now();
  let changed = false;
  for (const metadata of Array.from(dragFileMetaCache.values())) {
    if (now - Number(metadata.updatedAt || 0) <= dragCacheTtlMs && fs.existsSync(metadata.tempPath)) continue;
    removeCachedDragFile(metadata.fileId, metadata.fileName, metadata.downloadPath, metadata.serverUrl, metadata.authScope, false);
    changed = true;
  }
  try {
    for (const name of fs.readdirSync(tempDir)) {
      if (name === 'manifest.json') continue;
      const filePath = path.join(tempDir, name);
      const stat = fs.statSync(filePath);
      if (name === 'manifest.json.tmp') {
        if (now - stat.mtimeMs > 60 * 1000) fs.unlinkSync(filePath);
        continue;
      }
      if (stat.isFile() && now - stat.mtimeMs > dragCacheTtlMs && !Array.from(dragFileCache.values()).includes(filePath)) {
        fs.unlinkSync(filePath);
        changed = true;
      }
    }
  } catch (_) {}
  if (changed) persistDragManifest();
}
setInterval(cleanExpiredCache, 30 * 60 * 1000);

function isDragFileCached(fileId, fileName = '', downloadPath = '', token = '') {
  const entry = findCachedDragEntry(fileId, fileName, downloadPath, token);
  if (!entry || Date.now() - Number(entry.metadata.updatedAt || 0) > dragCacheTtlMs) return false;
  return true;
}

function drainDragPrepareQueue() {
  dragPreparePending.sort((a, b) => (a.priority === b.priority ? a.order - b.order : a.priority === 'high' ? -1 : 1));
  while (dragPrepareActive < 3 && dragPreparePending.length) {
    const highPriorityIndex = dragPreparePending.findIndex(job => job.priority === 'high');
    const nextIndex = highPriorityIndex >= 0 ? highPriorityIndex : 0;
    if (highPriorityIndex < 0 && dragPrepareNormalActive >= 2) break;
    const job = dragPreparePending.splice(nextIndex, 1)[0];
    dragPrepareActive += 1;
    if (job.priority !== 'high') dragPrepareNormalActive += 1;
    Promise.resolve().then(async () => {
      if (isDragFileCached(job.fileId, job.fileName, job.downloadPath, job.token)) return true;
      removeCachedDragFile(job.fileId, job.fileName, job.downloadPath, getServerConfig().serverUrl, job.authScope);
      const config = getServerConfig();
      const url = `${config.serverUrl}${resolveDragDownloadPath(job.fileId, job.downloadPath)}`;
      const { buffer } = await httpGetBuffer(url, job.token);
      cacheDragFile(job.fileId, job.fileName, buffer, job.downloadPath, job.token);
      return true;
    }).catch(() => false).then(result => job.resolve(result)).finally(() => {
      dragPrepareActive -= 1;
      if (job.priority !== 'high') dragPrepareNormalActive -= 1;
      if (dragPrepareJobs.get(job.key) === job) dragPrepareJobs.delete(job.key);
      drainDragPrepareQueue();
    });
  }
}

function enqueueDragPreparation(item, token) {
  const fileId = normalizeDragFileId(item.fileId);
  const fileName = sanitizeDragFileName(item.fileName, fileId);
  const downloadPath = resolveDragDownloadPath(fileId, item.downloadPath);
  const authScope = getDragAuthScope(token);
  if (!authScope) return Promise.resolve(false);
  const key = normalizeDragCacheKey(fileId, fileName, downloadPath, getServerConfig().serverUrl, authScope);
  if (isDragFileCached(fileId, fileName, downloadPath, token)) return Promise.resolve(true);
  const existing = dragPrepareJobs.get(key);
  if (existing) {
    if (item.priority === 'high') existing.priority = 'high';
    drainDragPrepareQueue();
    return existing.promise;
  }
  let resolveJob;
  const promise = new Promise(resolve => { resolveJob = resolve; });
  const job = {
    key, fileId, fileName,
    downloadPath,
    token, authScope,
    priority: item.priority === 'high' ? 'high' : 'normal',
    order: Date.now() + Math.random(),
    promise,
    resolve: resolveJob
  };
  dragPrepareJobs.set(key, job);
  dragPreparePending.push(job);
  drainDragPrepareQueue();
  return promise;
}

ipcMain.handle('preview-image', async (event, { fileId, token, fileName }) => {
  const config = getServerConfig();
  const url = `${config.serverUrl}/api/task/preview/${fileId}`;
  const { buffer, contentType } = await httpGetBuffer(url, token);

  // 如果传了 fileName，写入临时目录供拖拽使用
  if (fileName) {
    cacheDragFile(fileId, fileName, buffer, `/api/task/download/${encodeURIComponent(fileId)}`, token);
  }

  const base64 = buffer.toString('base64');
  return `data:${contentType};base64,${base64}`;
});

// ===== 文件下载（保存对话框） =====

ipcMain.handle('download-file', async (event, { fileId, fileName, token }) => {
  const config = getServerConfig();
  const url = `${config.serverUrl}/api/task/download/${fileId}`;

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: fileName,
    filters: [{ name: '所有文件', extensions: ['*'] }]
  });
  if (canceled || !filePath) return { success: false };

  const { buffer } = await httpGetBuffer(url, token);
  fs.writeFileSync(filePath, buffer);
  return { success: true, filePath };
});

// ===== 文件拖拽到桌面 =====

// 批量预下载文件到缓存（打开详情时调用，异步不阻塞 UI）
function resolveDragDownloadPath(fileId, downloadPath) {
  const requestedPath = String(downloadPath || '');
  if (/^\/api\/material-library\/images\/\d+\/download$/.test(requestedPath)) {
    return requestedPath;
  }
  return `/api/task/download/${encodeURIComponent(fileId)}`;
}

ipcMain.handle('prepare-file-drags', async (event, { items = [], token }) => {
  const uniqueItems = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.fileId || !item?.fileName) continue;
    const key = normalizeDragCacheKey(
      item.fileId,
      item.fileName,
      item.downloadPath,
      getServerConfig().serverUrl,
      getDragAuthScope(token)
    );
    const previous = uniqueItems.get(key);
    if (!previous || item.priority === 'high') {
      uniqueItems.set(key, { ...item, priority: item.priority || 'normal' });
    }
  }
  await Promise.all(Array.from(uniqueItems.values()).map(item => enqueueDragPreparation(item, token)));
  return { success: true };
});

// 同步检查文件是否已缓存
ipcMain.on('is-file-cached', (event, request) => {
  const fileId = request && typeof request === 'object' ? request.fileId : request;
  const fileName = request && typeof request === 'object' ? request.fileName : '';
  const downloadPath = request && typeof request === 'object' ? request.downloadPath : '';
  const token = request && typeof request === 'object' ? request.token : '';
  event.returnValue = isDragFileCached(fileId, fileName, downloadPath, token);
});

// 同步触发原生文件拖拽（必须在文件已缓存后调用）
ipcMain.on('do-file-drag', (event, request) => {
  const fileId = request && typeof request === 'object' ? request.fileId : request;
  const fileName = request && typeof request === 'object' ? request.fileName : '';
  const downloadPath = request && typeof request === 'object' ? request.downloadPath : '';
  const token = request && typeof request === 'object' ? request.token : '';
  const tempPath = getCachedDragPath(fileId, fileName, downloadPath, token);
  if (!tempPath || !fs.existsSync(tempPath)) {
    startupLog(`拖拽缓存未命中: fileId=${fileId} fileName=${fileName} downloadPath=${downloadPath}`);
    event.returnValue = false;
    return;
  }
  try {
    const dragItem = { file: tempPath };
    const iconPath = getDragIconPath();
    if (iconPath) dragItem.icon = iconPath;
    mainWindow.webContents.startDrag(dragItem);
    event.returnValue = true;
  } catch (err) {
    console.error('[Drag] startDrag 失败:', err.message);
    startupLog(`拖拽启动失败: ${err.message}`);
    event.returnValue = false;
  }
});

// ===== 中文菜单 =====
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '恢复', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 Nexus', click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info', title: '关于 Nexus',
            message: 'Nexus',
            detail: `版本: ${app.getVersion()}\n企业版`
          })
        }}
      ]
    }
  ];

  // macOS 特殊处理
  if (process.platform === 'darwin') {
    template.unshift({
      label: 'Nexus',
      submenu: [
        { label: '关于 Nexus', role: 'about' },
        { type: 'separator' },
        { label: '退出', accelerator: 'Cmd+Q', click: () => app.quit() }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ===== 自动更新 =====

function setupAutoUpdater() {
  // 仅在打包版本中启用自动更新（开发模式跳过）
  if (isDev) {
    startupLog('自动更新：开发模式，跳过');
    return;
  }

  const config = getServerConfig();
  const feedUrl = `${config.serverUrl}/releases`;
  autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl });
  startupLog(`更新源: ${feedUrl}`);

  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    startupLog('正在检查更新...');
  });

  autoUpdater.on('update-available', (info) => {
    startupLog(`发现新版本: ${info.version}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:available', info);
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `Nexus ${info.version} 可用`,
        detail: '是否立即下载更新？',
        buttons: ['立即下载', '稍后提醒'],
        defaultId: 0,
        cancelId: 1
      }).then(({ response }) => {
        if (response === 0) {
          try {
            autoUpdater.downloadUpdate().catch((err) => {
              startupLog(`下载启动失败: ${err.message}`);
            });
          } catch (err) {
            startupLog(`downloadUpdate() 异常: ${err.message}`);
          }
        }
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    startupLog('当前已是最新版本');
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:progress', progress);
    }
  });

  autoUpdater.on('update-downloaded', () => {
    startupLog('更新下载完成，提示用户重启');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:downloaded');
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '更新已就绪',
        message: '新版本已下载完成',
        detail: '点击"立即重启"以安装更新，应用将在重启后自动升级。',
        buttons: ['立即重启', '稍后'],
        defaultId: 0,
        cancelId: 1
      }).then(({ response }) => {
        if (response === 0) {
          isUpdating = true;
          // 关闭所有窗口，防止安装器无法替换文件
          if (toastWindow && !toastWindow.isDestroyed()) {
            toastWindow.destroy();
            toastWindow = null;
          }
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.destroy();
            mainWindow = null;
          }
          // 延迟确保窗口完全销毁后再安装
          setTimeout(() => {
            autoUpdater.quitAndInstall(false, true);
          }, 500);
        }
      });
    }
  });

  autoUpdater.on('error', (err) => {
    startupLog(`更新失败: ${err.message}\n${err.stack || ''}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:error', err.message);
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: '更新失败',
        message: '下载更新时发生错误',
        detail: err.message,
        buttons: ['确定']
      });
    }
  });

  // 启动后 5s 开始检查更新
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      startupLog(`更新检查异常: ${err.message}`);
    });
  }, 5000);
}

// ===== 应用生命周期 =====
app.whenReady().then(() => {
  restoreDragCache();
  createMenu();
  createWindow();
  createToastWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (isUpdating) return; // 更新期间不触发 quit，由 quitAndInstall 接管
  isQuitting = true;
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.destroy()
    toastWindow = null
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
