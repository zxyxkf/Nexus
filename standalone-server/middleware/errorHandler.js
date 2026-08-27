/**
 * 全局错误处理中间件
 * - AppError → 返回 { code, msg } JSON
 * - 其他错误 → 记录日志，返回 500
 */
const AppError = require('../utils/AppError');

function errorHandler(err, req, res, _next) {
  // 业务错误
  if (err instanceof AppError) {
    return res.json({ code: err.code, msg: err.message, ...(err.data ? { data: err.data } : {}) });
  }

  // 兼容事务回调中 throw { status, msg } 的旧写法（逐步替换）
  if (err && typeof err === 'object' && !(err instanceof Error) && err.status) {
    return res.json({ code: err.status, msg: err.msg || err.message });
  }

  // 未预期的系统错误
  console.error('[Error]', err.stack || err.message || err);
  res.status(500).json({ code: 500, msg: '服务器内部错误' });
}

module.exports = errorHandler;
