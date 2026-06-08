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
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  toastWindow = new BrowserWindow({
    width: 400,
    height: 140,
    x: sw - 420,
    y: sh - 160,
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

ipcMain.on('toast:show-window', () => {
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.showInactive()
  }
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
    mod.get(opts, (res) => {
      if (res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || 'application/octet-stream'
      }));
    }).on('error', reject);
  });
}

// ===== 文件拖拽缓存 =====
const dragFileCache = new Map(); // fileId → tempPath

function cacheDragFile(fileId, fileName, buffer) {
  const tempDir = path.join(app.getPath('temp'), 'nexus-drag');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // 处理重名
  let tempPath = path.join(tempDir, fileName);
  if (fs.existsSync(tempPath)) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    let counter = 1;
    while (fs.existsSync(tempPath)) {
      tempPath = path.join(tempDir, `${base}_(${counter})${ext}`);
      counter++;
    }
  }

  fs.writeFileSync(tempPath, buffer);
  dragFileCache.set(fileId, tempPath);
}

// 清理过期缓存文件（1小时后删除）
function cleanExpiredCache() {
  const tempDir = path.join(app.getPath('temp'), 'nexus-drag');
  if (!fs.existsSync(tempDir)) return;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  try {
    for (const name of fs.readdirSync(tempDir)) {
      const p = path.join(tempDir, name);
      const stat = fs.statSync(p);
      if (now - stat.mtimeMs > oneHour) {
        fs.unlinkSync(p);
        // 清理对应的 cache entry
        for (const [k, v] of dragFileCache) {
          if (v === p) dragFileCache.delete(k);
        }
      }
    }
  } catch (_) {}
}
setInterval(cleanExpiredCache, 30 * 60 * 1000); // 每30分钟清理一次

// ===== 图片预览（同时缓存文件用于拖拽） =====

ipcMain.handle('preview-image', async (event, { fileId, token, fileName }) => {
  const config = getServerConfig();
  const url = `${config.serverUrl}/api/task/preview/${fileId}`;
  const { buffer, contentType } = await httpGetBuffer(url, token);

  // 如果传了 fileName，写入临时目录供拖拽使用
  if (fileName) {
    cacheDragFile(fileId, fileName, buffer);
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
ipcMain.handle('prepare-file-drags', async (event, { items, token }) => {
  const config = getServerConfig();
  for (const { fileId, fileName } of items) {
    if (dragFileCache.has(fileId) && fs.existsSync(dragFileCache.get(fileId))) continue;
    try {
      const url = `${config.serverUrl}/api/task/download/${fileId}`;
      const { buffer } = await httpGetBuffer(url, token);
      cacheDragFile(fileId, fileName, buffer);
    } catch (e) {
      // 单个失败不影响其他
    }
  }
  return { success: true };
});

// 同步检查文件是否已缓存
ipcMain.on('is-file-cached', (event, fileId) => {
  const tempPath = dragFileCache.get(fileId);
  event.returnValue = !!(tempPath && fs.existsSync(tempPath));
});

// 同步触发原生文件拖拽（必须在文件已缓存后调用）
ipcMain.on('do-file-drag', (event, fileId) => {
  const tempPath = dragFileCache.get(fileId);
  if (!tempPath || !fs.existsSync(tempPath)) {
    event.returnValue = false;
    return;
  }
  try {
    mainWindow.webContents.startDrag({
      file: tempPath,
      icon: path.join(__dirname, '../build/icon.ico')
    });
    event.returnValue = true;
  } catch (err) {
    console.error('[Drag] startDrag 失败:', err.message);
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
