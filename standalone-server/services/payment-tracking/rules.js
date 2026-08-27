const { STAGES, NEXT_STAGE } = require('./constants');

function roundRatio(value) {
  return Math.round(value * 10000) / 10000;
}

function calculateGrossMargin(cost, salePrice) {
  if (salePrice === null || salePrice === undefined || salePrice === '') return null;
  const sale = Number(salePrice);
  const normalizedCost = Number(cost);
  if (!Number.isFinite(sale) || sale <= 0) throw new Error('售价必须大于0');
  if (!Number.isFinite(normalizedCost) || normalizedCost < 0) throw new Error('成本不能为负数');
  return roundRatio((sale - normalizedCost) / sale);
}

function calculateSearchShare(searchVisitors, overallVisitors) {
  const total = Number(overallVisitors);
  const search = Number(searchVisitors);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(search)) return null;
  return roundRatio(search / total);
}

function isBlank(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function validateSelection(data, errors) {
  const required = {
    selection_date: '请选择选品日期',
    style_number: '请填写货号',
    product_id: '请填写产品ID',
    selection_method: '请选择选品方式',
    listing_date: '请选择上架日期',
    listing_category: '请填写上架类目'
  };
  for (const [field, message] of Object.entries(required)) {
    if (isBlank(data[field])) errors[field] = message;
  }

  if (isBlank(data.cost) || !Number.isFinite(Number(data.cost)) || Number(data.cost) < 0) {
    errors.cost = '成本必须为非负数';
  }
  if (isBlank(data.sale_price) || !Number.isFinite(Number(data.sale_price)) || Number(data.sale_price) <= 0) {
    errors.sale_price = '售价必须大于0';
  }
  if (![0, 1].includes(Number(data.sku_le_200))) {
    errors.sku_le_200 = '请选择SKU数是否不超过200';
  }
  if (Number(data.product_image_count || 0) < 1) {
    errors.product_images = '至少上传一张产品主图';
  }
}

function validateAdvance(stageCode, data = {}) {
  const errors = {};

  if (!STAGES.includes(stageCode)) {
    errors.stage = '无效阶段';
  } else if (!NEXT_STAGE[stageCode]) {
    errors.stage = '当前阶段没有下一阶段';
  } else if (stageCode === 'selection') {
    validateSelection(data, errors);
  } else if (stageCode === 'preparation') {
    if (Number(data.paid_enabled) !== 1) {
      errors.paid_enabled = '店长必须确认开启付费';
    } else if (isBlank(data.paid_at)) {
      errors.paid_at = '请选择付费时间';
    }
  } else if (stageCode === 'testing') {
    if (data.potential_status !== '符合潜力款标准') {
      errors.potential_status = '只有符合潜力款标准才能进入下一阶段';
    }
  } else if (stageCode === 'monitoring' && Number(data.abandoned) === 1) {
    if (isBlank(data.abandon_reason)) errors.abandon_reason = '请填写放弃原因';
    if (isBlank(data.abandon_at)) errors.abandon_at = '请选择放弃时间';
    errors.abandoned = '潜力款后放弃不能进入下一阶段';
  } else if (stageCode === 'breakout' && ![0, 1].includes(Number(data.strong_lift_qualified))) {
    errors.strong_lift_qualified = '请选择是否符合强拉升标准';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

function deriveEndSnapshot(stageCode, data = {}) {
  if (stageCode === 'testing' && data.potential_status === '不符合') {
    const action = typeof data.unqualified_action === 'string' ? data.unqualified_action.trim() : '';
    return {
      endType: 'unqualified',
      endReason: action ? `未达潜力款 · 后续操作：${action}` : '未达潜力款'
    };
  }

  if (stageCode === 'monitoring' && Number(data.abandoned) === 1) {
    const reason = typeof data.abandon_reason === 'string' ? data.abandon_reason.trim() : '';
    return {
      endType: 'abandoned',
      endReason: reason ? `潜力款后放弃 · 原因：${reason}` : '潜力款后放弃'
    };
  }

  if (stageCode === 'summary') {
    return { endType: 'completed', endReason: '流程完成' };
  }

  return { endType: 'manual', endReason: '主动结束流程' };
}

module.exports = {
  roundRatio,
  calculateGrossMargin,
  calculateSearchShare,
  validateAdvance,
  deriveEndSnapshot
};
