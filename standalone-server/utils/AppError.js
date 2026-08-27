/**
 * 统一业务错误类
 * Service 层抛出，全局错误中间件统一捕获并返回 JSON
 */
class AppError extends Error {
  constructor(code, msg, data) {
    super(msg);
    this.code = code;
    this.data = data;
    this.name = 'AppError';
  }
}

module.exports = AppError;
