/**
 * 集中配置管理 — 所有环境变量读取的唯一入口
 * 加载 dotenv，校验生产环境敏感配置，导出 frozen config
 */
const path = require('path');

// 加载环境变量文件（dotenv 幂等，重复调用无副作用）
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';

// 敏感配置默认值（仅用于未设环境变量且非生产环境时的兜底，方便本地开发）
const SENSITIVE_DEFAULTS = {
  JWT_SECRET: 'DDesign_Art_Manager_2024_Secure_JWT_Key!@#$%',
  DB_PASSWORD: 'DDesign@2024!Secure',
};

/**
 * 获取敏感配置值，生产环境下使用默认值则拒绝启动
 */
function requireSecret(key) {
  const value = process.env[key] || SENSITIVE_DEFAULTS[key];
  if (isProduction && value === SENSITIVE_DEFAULTS[key]) {
    console.error(`[FATAL] ${key} 使用了默认值，生产环境必须设置 ${key} 环境变量`);
    process.exit(1);
  }
  return value;
}

const config = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '18632'),
  HOST: process.env.HOST || '0.0.0.0',

  // JWT
  JWT_SECRET: requireSecret('JWT_SECRET'),
  JWT_ACCESS_EXPIRES_IN: '10m',
  JWT_REFRESH_EXPIRES_IN: '7d',

  // 数据库引擎
  USE_MYSQL: process.env.USE_MYSQL === '1',

  // MySQL 连接
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: parseInt(process.env.DB_PORT || '3306'),
  DB_USER: process.env.DB_USER || 'd_design',
  DB_PASSWORD: requireSecret('DB_PASSWORD'),
  DB_NAME: process.env.DB_NAME || 'd_design_art',

  // 目录
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'upload'),
  LOG_DIR: process.env.LOG_DIR || path.join(__dirname, '..', 'logs'),

  isProduction,
});

module.exports = config;
