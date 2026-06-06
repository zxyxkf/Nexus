/**
 * HTTP 访问日志 — morgan + 按天滚动文件 + 控制台
 */
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const rfs = require('rotating-file-stream');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 按天滚动的文件流
const accessLogStream = rfs.createStream('access.log', {
  interval: '1d',
  path: LOG_DIR,
  maxFiles: 30,
  compress: false
});

// 精简格式（适合内网工具）
const logFormat = ':remote-addr - :method :url :status :res[content-length] - :response-time ms';

module.exports = {
  /** Morgan 中间件：同时输出到控制台和文件 */
  middleware: [
    morgan(logFormat, { stream: accessLogStream }),
    morgan(logFormat)
  ],
  LOG_DIR
};
