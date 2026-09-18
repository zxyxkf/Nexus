const AppError = require('../../utils/AppError');
const repository = require('./repository');

const MAX_NAME_LENGTH = 200;
const MAX_SELECTIONS = 50;

function normalizeName(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError(400, '无效的链接优化项目ID');
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
  if (!name) throw new AppError(400, '链接优化项目名称不能为空');
  if (name.length > MAX_NAME_LENGTH) throw new AppError(400, `链接优化项目名称不能超过${MAX_NAME_LENGTH}个字符`);
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

function normalizeNames(value) {
  if (value === null || value === undefined || value === '') return [];
  if (!Array.isArray(value)) {
    const error = new AppError(400, '链接优化项目格式不正确');
    error.data = { errors: { linkOptimizationItems: error.message } };
    throw error;
  }
  const names = [...new Set(value.map(normalizeName).filter(Boolean))];
  if (names.length > MAX_SELECTIONS || names.some(name => name.length > MAX_NAME_LENGTH)) {
    const error = new AppError(400, '链接优化项目选择无效');
    error.data = { errors: { linkOptimizationItems: error.message } };
    throw error;
  }
  return names;
}

function parseStoredNames(value) {
  if (Array.isArray(value)) return normalizeNames(value);
  if (!value) return [];
  try {
    return normalizeNames(JSON.parse(value));
  } catch (_) {
    return [];
  }
}

function isDuplicate(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('unique') || message.includes('duplicate') || message.includes('payment_link_optimization_item.name');
}

async function listItems(options = {}) {
  return repository.listLinkOptimizationItems({ includeInactive: Boolean(options.includeInactive) });
}

async function createItem(payload = {}) {
  const data = normalizePayload(payload);
  if (await repository.findLinkOptimizationItemByName(data.name)) throw new AppError(400, '链接优化项目名称已存在');
  try {
    return await repository.insertLinkOptimizationItem(data);
  } catch (error) {
    if (isDuplicate(error)) throw new AppError(400, '链接优化项目名称已存在');
    throw error;
  }
}

async function updateItem(idValue, payload = {}) {
  const id = parseId(idValue);
  const existing = await repository.findLinkOptimizationItemById(id);
  if (!existing) throw new AppError(404, '链接优化项目不存在');
  const data = normalizePayload(payload, existing);
  const duplicate = await repository.findLinkOptimizationItemByName(data.name);
  if (duplicate && Number(duplicate.id) !== id) throw new AppError(400, '链接优化项目名称已存在');
  const updated = await repository.updateLinkOptimizationItem(id, data);
  return updated || repository.findLinkOptimizationItemById(id);
}

async function deleteItem(idValue) {
  const id = parseId(idValue);
  if (!(await repository.deleteLinkOptimizationItem(id))) throw new AppError(404, '链接优化项目不存在');
  return { id };
}

async function assertConfiguredItems(value, options = {}) {
  const names = normalizeNames(value);
  const historicalNames = new Set(normalizeNames(options.existingValues || []));
  for (const name of names) {
    if (historicalNames.has(name)) continue;
    const row = await repository.findLinkOptimizationItemByName(name);
    if (!row || Number(row.active) !== 1) {
      const error = new AppError(400, '链接优化项目无效，请选择已配置的启用项目');
      error.data = { errors: { linkOptimizationItems: error.message } };
      throw error;
    }
  }
  return names;
}

module.exports = {
  listItems,
  createItem,
  updateItem,
  deleteItem,
  normalizeNames,
  parseStoredNames,
  assertConfiguredItems
};
