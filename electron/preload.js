/**
 * Nexus - Preload 脚本
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
  getServerConfig: () => ipcRenderer.invoke('get-server-config'),
  setServerConfig: (config) => ipcRenderer.invoke('set-server-config', config),
  previewImage: (params) => ipcRenderer.invoke('preview-image', params),
  downloadFile: (params) => ipcRenderer.invoke('download-file', params),
  prepareFileDrags: (params) => ipcRenderer.invoke('prepare-file-drags', params),
  isFileCached: (fileId) => ipcRenderer.sendSync('is-file-cached', fileId),
  doFileDrag: (fileId) => ipcRenderer.sendSync('do-file-drag', fileId),
  flashFrame: () => ipcRenderer.send('flash-frame'),
  showDesktopNotification: (opts) => ipcRenderer.send('desktop-notification', opts),
  showToast: (opts) => ipcRenderer.send('show-toast', opts),
  onToastClick: (cb) => ipcRenderer.on('toast:clicked', (event, data) => cb(data)),
  testNotification: () => ipcRenderer.send('desktop-notification', { title: 'Nexus', body: '桌面通知功能正常！' }),
  platform: process.platform,
  onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_event, info) => cb(info)),
  onUpdateProgress: (cb) => ipcRenderer.on('update:progress', (_event, progress) => cb(progress)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_event) => cb()),
  onUpdateError: (cb) => ipcRenderer.on('update:error', (_event, msg) => cb(msg))
});
