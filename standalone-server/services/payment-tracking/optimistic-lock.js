const AppError = require('../../utils/AppError');

function conflictError() {
  return new AppError(409, '记录已被其他人更新，请刷新后重试');
}

function requireVersion(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) throw new AppError(400, '缺少有效版本号');
  return version;
}

function assertVersion(record, version) {
  if (Number(record.version) !== Number(version)) throw conflictError();
}

module.exports = { conflictError, requireVersion, assertVersion };
