const {
  calculateGrossMargin,
  calculateSearchShare,
  validateAdvance,
  deriveEndSnapshot
} = require('../../services/payment-tracking/rules');

describe('payment tracking calculations', () => {
  it('calculates ratios to four decimal places', () => {
    expect(calculateGrossMargin(24, 75)).toBe(0.68);
    expect(calculateSearchShare(32, 180)).toBe(0.1778);
  });

  it('handles empty and invalid ratio inputs', () => {
    expect(calculateGrossMargin('', '')).toBeNull();
    expect(() => calculateGrossMargin(10, 0)).toThrow('售价必须大于0');
    expect(() => calculateGrossMargin(-1, 10)).toThrow('成本不能为负数');
    expect(calculateSearchShare(0, 0)).toBeNull();
  });
});

describe('payment tracking stage advancement', () => {
  it('requires the selection core fields and a product image', () => {
    const result = validateAdvance('selection', {
      selection_date: '2026-08-27',
      style_number: 'NK-1001',
      cost: 24,
      sale_price: 75,
      product_id: '123456',
      selection_method: '方式五：跟款',
      sku_le_200: 1,
      listing_date: '2026-08-28',
      listing_category: '女装',
      product_image_count: 0
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({ product_images: '至少上传一张产品主图' });
  });

  it('requires the manager to enable paid promotion with a date', () => {
    expect(validateAdvance('preparation', { paid_enabled: 0, paid_at: null })).toEqual({
      ok: false,
      errors: { paid_enabled: '店长必须确认开启付费' }
    });
    expect(validateAdvance('preparation', { paid_enabled: 1, paid_at: null }).errors).toEqual({
      paid_at: '请选择付费时间'
    });
    expect(validateAdvance('preparation', { paid_enabled: 1, paid_at: '2026-09-01' }).ok).toBe(true);
  });

  it('only advances testing records that meet the potential standard', () => {
    expect(validateAdvance('testing', { potential_status: '不符合' }).ok).toBe(false);
    expect(validateAdvance('testing', { potential_status: '符合潜力款标准' }).ok).toBe(true);
  });

  it('blocks abandoned monitoring records and requires their existing reason fields', () => {
    expect(validateAdvance('monitoring', { abandoned: 1 }).errors).toEqual({
      abandon_reason: '请填写放弃原因',
      abandon_at: '请选择放弃时间',
      abandoned: '潜力款后放弃不能进入下一阶段'
    });
    expect(validateAdvance('monitoring', { abandoned: 0 }).ok).toBe(true);
  });

  it('requires a breakout decision but allows either decision to advance', () => {
    expect(validateAdvance('breakout', {}).ok).toBe(false);
    expect(validateAdvance('breakout', { strong_lift_qualified: 1 }).ok).toBe(true);
    expect(validateAdvance('breakout', { strong_lift_qualified: 0 }).ok).toBe(true);
    expect(validateAdvance('summary', {}).ok).toBe(false);
  });
});

describe('payment tracking end snapshots', () => {
  it('derives an unqualified ending from testing fields', () => {
    expect(deriveEndSnapshot('testing', {
      potential_status: '不符合',
      unqualified_action: '直接关闭'
    })).toEqual({
      endType: 'unqualified',
      endReason: '未达潜力款 · 后续操作：直接关闭'
    });
    expect(deriveEndSnapshot('testing', { potential_status: '不符合' }).endReason).toBe('未达潜力款');
  });

  it('derives abandoned, completed and manual endings without free-form input', () => {
    expect(deriveEndSnapshot('monitoring', {
      abandoned: 1,
      abandon_reason: '费比持续偏高'
    })).toEqual({
      endType: 'abandoned',
      endReason: '潜力款后放弃 · 原因：费比持续偏高'
    });
    expect(deriveEndSnapshot('summary', {})).toEqual({
      endType: 'completed',
      endReason: '流程完成'
    });
    expect(deriveEndSnapshot('preparation', {})).toEqual({
      endType: 'manual',
      endReason: '主动结束流程'
    });
  });
});
