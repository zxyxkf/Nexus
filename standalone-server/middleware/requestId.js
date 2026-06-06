/**
 * requestId 中间件 — 基于 AsyncLocalStorage 为每个请求生成唯一 ID
 * 注入 req.requestId，后续日志/链路追踪可用
 */
const { AsyncLocalStorage } = require('async_hooks');
const { v4: uuidv4 } = require('uuid');

const als = new AsyncLocalStorage();

function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  als.run(requestId, () => next());
}

function getRequestId() {
  return als.getStore() || 'no-request';
}

module.exports = { requestIdMiddleware, getRequestId };
