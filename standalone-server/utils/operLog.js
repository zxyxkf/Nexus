/**
 * 操作日志记录工具
 * 所有关键操作自动记录，支持异步写入
 */

const { getPool } = require('../config/database');

/**
 * 记录操作日志
 * @param {Object} logInfo - 日志信息
 * @param {number} logInfo.userId - 用户ID
 * @param {string} logInfo.username - 用户名
 * @param {string} logInfo.role - 用户角色
 * @param {string} logInfo.operation - 操作类型
 * @param {string} logInfo.module - 操作模块
 * @param {string} logInfo.method - 请求方法
 * @param {string} logInfo.requestUrl - 请求URL
 * @param {string} logInfo.requestParams - 请求参数(JSON字符串)
 * @param {number} logInfo.resultCode - 结果码
 * @param {string} logInfo.resultMsg - 结果消息
 * @param {string} logInfo.ipAddr - IP地址
 * @param {number} logInfo.costTime - 耗时(毫秒)
 */
async function writeOperLog(logInfo) {
  try {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO sys_oper_log (user_id, username, role, operation, module, method, request_url, request_params, result_code, result_msg, error_msg, ip_addr, cost_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logInfo.userId || null,
        logInfo.username || '',
        logInfo.role || '',
        logInfo.operation || '',
        logInfo.module || '',
        logInfo.method || '',
        logInfo.requestUrl || '',
        logInfo.requestParams || '',
        logInfo.resultCode || 0,
        logInfo.resultMsg || '',
        logInfo.errorMsg || (logInfo.resultCode !== 0 ? logInfo.resultMsg || '' : ''),
        logInfo.ipAddr || '127.0.0.1',
        logInfo.costTime || 0
      ]
    );
  } catch (err) {
    // 日志写入失败不影响主流程，只打印警告
    console.error('[OperLog] 写入失败:', err.message);
  }
}

/**
 * 创建日志中间件 - 自动记录请求日志
 */
function createLogMiddleware(operation, module) {
  return async (req, res, next) => {
    const startTime = Date.now();

    // 保存原始json方法
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      const costTime = Date.now() - startTime;

      const resultCode = body && body.code !== undefined ? body.code : 0;
      // 报错信息：优先取 body.error（原始错误），否则失败时取 body.msg
      let errorMsg = body && body.error ? body.error : '';
      if (!errorMsg && resultCode !== 0 && body && body.msg) {
        errorMsg = body.msg;
      }

      // 异步记录日志，不阻塞响应
      const logInfo = {
        userId: req.user ? req.user.id : null,
        username: req.user ? req.user.username : 'anonymous',
        role: req.user ? req.user.role : '',
        operation,
        module,
        method: req.method,
        requestUrl: req.originalUrl,
        requestParams: JSON.stringify({
          body: req.body,
          query: req.query,
          params: req.params
        }),
        resultCode,
        resultMsg: body && body.msg ? body.msg : '',
        errorMsg,
        ipAddr: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        costTime
      };

      writeOperLog(logInfo).catch(console.error);

      return originalJson(body);
    };

    next();
  };
}

module.exports = {
  writeOperLog,
  createLogMiddleware
};
