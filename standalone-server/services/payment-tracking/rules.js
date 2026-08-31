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
  } else if (stageCode === 'testing') {
    if (Number(data.paid_enabled) !== 1) {
      errors.paid_enabled = '店长必须确认开启付费';
    } else if (isBlank(data.paid_at)) {
      errors.paid_at = '请选择付费时间';
    } else if (data.potential_status !== '符合潜力款标准') {
      errors.potential_status = '只有符合潜力款标准才能进入下一阶段';
    }
  } else if (stageCode === 'monitoring') {
    if (isBlank(data.link_status)) {
      errors.link_status = '请选择链接状态';
    } else if (data.link_status !== 'keep_breaking') {
      errors.link_status = '只有持续打爆才能进入下一阶段';
    }
  } else if (stageCode === 'breakout' && ![0, 1].includes(Number(data.strong_lift_qualified))) {
    errors.strong_lift_qualified = '请选择是否符合强拉升标准';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

function validateEnd(stageCode, data = {}) {
  const errors = {};
  if (stageCode !== 'monitoring') return { ok: true, errors };
  if (isBlank(data.link_status)) {
    errors.link_status = '请选择链接状态';
  } else if (data.link_status !== 'protect_roi') {
    errors.link_status = '持续打爆应进入下一阶段';
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

  if (stageCode === 'monitoring' && data.link_status === 'protect_roi') {
    return {
      endType: 'protect_roi',
      endReason: '链接状态：保投产'
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
  validateEnd,
  deriveEndSnapshot
};
