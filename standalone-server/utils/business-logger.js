/**
 * 业务日志 — winston 实例，JSON 格式 + 按天轮转 + 30 天保留
 * 使用方式: const logger = require('../utils/business-logger')
 *           logger.info('描述', { userId, taskId, ... })
 */
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { getRequestId } = require('../middleware/requestId');

const LOG_DIR = path.join(__dirname, '..', 'logs');

const requestIdFormat = winston.format((info) => {
  info.requestId = getRequestId();
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    requestIdFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'nexus-server' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
          const metaStr = Object.keys(meta).length > 1
            ? ' ' + JSON.stringify(meta)
            : '';
          return `${timestamp} [${requestId}] ${level}: ${message}${metaStr}`;
        })
      )
    }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '50m',
      zippedArchive: true,
    }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '50m',
      zippedArchive: true,
    }),
  ],
});

module.exports = logger;
