const AppError = require('../../utils/AppError');
const repository = require('./repository');

const MAX_NAME_LENGTH = 200;

function normalizeName(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(400, '无效的推广方式ID');
  return id;
}

function normalizeSortOrder(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0) throw new AppError(400, '排序必须为非负整数');
  return result;
}

function normalizeActive(value, fallback = 1) {
  if (value === null || value === undefined || value === '') return fallback;
  if ([true, 1, '1'].includes(value)) return 1;
  if ([false, 0, '0'].includes(value)) return 0;
  throw new AppError(400, '启用状态参数无效');
}

function normalizePayload(payload = {}, existing = null) {
  const name = normalizeName(Object.prototype.hasOwnProperty.call(payload, 'name') ? payload.name : existing?.name);
  if (!name) throw new AppError(400, '推广方式名称不能为空');
  if (name.length > MAX_NAME_LENGTH) throw new AppError(400, `推广方式名称不能超过${MAX_NAME_LENGTH}个字符`);
  const sortValue = Object.prototype.hasOwnProperty.call(payload, 'sortOrder')
    ? payload.sortOrder
    : payload.sort_order;
  const activeValue = Object.prototype.hasOwnProperty.call(payload, 'active') ? payload.active : undefined;
  return {
    name,
    sortOrder: normalizeSortOrder(sortValue, Number(existing?.sort_order ?? 0)),
    active: normalizeActive(activeValue, Number(existing?.active ?? 1)) === 1
  };
}

function isDuplicate(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('unique') || message.includes('duplicate') || message.includes('payment_promotion_method.name');
}

async function listMethods(options = {}) {
  return repository.listPromotionMethods({ includeInactive: Boolean(options.includeInactive) });
}

async function createMethod(payload = {}) {
  const data = normalizePayload(payload);
  if (await repository.findPromotionMethodByName(data.name)) throw new AppError(400, '推广方式名称已存在');
  try {
    return await repository.insertPromotionMethod(data);
  } catch (error) {
    if (isDuplicate(error)) throw new AppError(400, '推广方式名称已存在');
    throw error;
  }
}

async function updateMethod(idValue, payload = {}) {
  const id = parseId(idValue);
  const existing = await repository.findPromotionMethodById(id);
  if (!existing) throw new AppError(404, '推广方式不存在');
  const data = normalizePayload(payload, existing);
  const duplicate = await repository.findPromotionMethodByName(data.name);
  if (duplicate && Number(duplicate.id) !== id) throw new AppError(400, '推广方式名称已存在');
  const updated = await repository.updatePromotionMethod(id, data);
  return updated || repository.findPromotionMethodById(id);
}

async function deleteMethod(idValue) {
  const id = parseId(idValue);
  if (!(await repository.deletePromotionMethod(id))) throw new AppError(404, '推广方式不存在');
  return { id };
}

async function assertConfiguredPromotionMethod(value, options = {}) {
  const name = normalizeName(value);
  if (!name) return '';
  if (name === normalizeName(options.existingValue)) return name;
  const row = await repository.findPromotionMethodByName(name);
  if (!row || Number(row.active) !== 1) {
    const error = new AppError(400, '推广方式无效，请选择已配置的方式');
    error.data = { errors: { promotionMethod: error.message } };
    throw error;
  }
  return name;
}

module.exports = {
  normalizeName,
  listMethods,
  createMethod,
  updateMethod,
  deleteMethod,
  assertConfiguredPromotionMethod
};
