const AppError = require('../../utils/AppError');
const repository = require('./repository');

const MAX_CATEGORY_NAME_LENGTH = 200;

function normalizeName(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(400, '无效的上架类目ID');
  }
  return id;
}

function normalizeSortOrder(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const sortOrder = Number(value);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new AppError(400, '排序必须为非负整数');
  }
  return sortOrder;
}

function normalizeActive(value, fallback = 1) {
  if (value === null || value === undefined || value === '') return fallback;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  throw new AppError(400, '启用状态参数无效');
}

function normalizeCategoryPayload(payload = {}, existing = null) {
  const hasName = Object.prototype.hasOwnProperty.call(payload, 'name');
  const name = normalizeName(hasName ? payload.name : existing?.name);
  if (!name) throw new AppError(400, '上架类目名称不能为空');
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    throw new AppError(400, `上架类目名称不能超过${MAX_CATEGORY_NAME_LENGTH}个字符`);
  }

  const sortValue = Object.prototype.hasOwnProperty.call(payload, 'sortOrder')
    ? payload.sortOrder
    : Object.prototype.hasOwnProperty.call(payload, 'sort_order')
      ? payload.sort_order
      : undefined;
  const fallbackSort = Number(existing?.sort_order ?? existing?.sortOrder ?? 0);
  const sortOrder = normalizeSortOrder(sortValue, Number.isFinite(fallbackSort) ? fallbackSort : 0);

  let activeValue;
  if (Object.prototype.hasOwnProperty.call(payload, 'active')) activeValue = payload.active;
  else if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) activeValue = payload.isActive;
  const fallbackActive = Number(existing?.active ?? 1) === 1 ? 1 : 0;
  const active = normalizeActive(activeValue, fallbackActive);
  // repository accepts a boolean `false` as the disabled sentinel.
  return { name, sortOrder, active: active === 1 };
}

function isDuplicateError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('unique')
    || message.includes('duplicate')
    || message.includes('payment_listing_category.name');
}

async function listCategories(options = {}) {
  return repository.listListingCategories({ includeInactive: Boolean(options.includeInactive) });
}

async function createCategory(payload = {}) {
  const data = normalizeCategoryPayload(payload);
  const existing = await repository.findListingCategoryByName(data.name);
  if (existing) throw new AppError(400, '上架类目名称已存在');

  try {
    return await repository.insertListingCategory(data);
  } catch (error) {
    if (isDuplicateError(error)) throw new AppError(400, '上架类目名称已存在');
    throw error;
  }
}

async function updateCategory(idValue, payload = {}) {
  const id = parseId(idValue);
  const existing = await repository.findListingCategoryById(id);
  if (!existing) throw new AppError(404, '上架类目不存在');
  const data = normalizeCategoryPayload(payload, existing);
  const duplicate = await repository.findListingCategoryByName(data.name);
  if (duplicate && Number(duplicate.id) !== id) {
    throw new AppError(400, '上架类目名称已存在');
  }

  try {
    const updated = await repository.updateListingCategory(id, data);
    if (updated) return updated;
    // UPDATE may report zero affected rows when the submitted values are
    // unchanged. Treat that as a successful no-op while still detecting a
    // genuinely missing row.
    const current = await repository.findListingCategoryById(id);
    if (!current) throw new AppError(404, '上架类目不存在');
    return current;
  } catch (error) {
    if (isDuplicateError(error)) throw new AppError(400, '上架类目名称已存在');
    throw error;
  }
}

async function deleteCategory(idValue) {
  const id = parseId(idValue);
  const deleted = await repository.deleteListingCategory(id);
  if (!deleted) throw new AppError(404, '上架类目不存在');
  return { id };
}

/**
 * Validate a value submitted for a selection record.
 * Existing historical values remain editable so deleting a configured option
 * never makes an old record impossible to save.
 */
async function assertConfiguredListingCategory(value, options = {}) {
  const name = normalizeName(value);
  if (!name) return name;

  const historicalValue = normalizeName(options.existingValue);
  if (historicalValue && historicalValue === name) return name;

  const category = await repository.findListingCategoryByName(name);
  if (!category || Number(category.active) !== 1) {
    const error = new AppError(400, '上架类目无效，请选择已配置的类目');
    error.data = { errors: { listingCategory: error.message } };
    throw error;
  }
  return name;
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  normalizeName,
  assertConfiguredListingCategory,
  validateListingCategory: assertConfiguredListingCategory
};
