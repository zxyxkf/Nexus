const {
  calculateGrossMargin,
  calculateSearchShare,
  validateAdvance,
  deriveEndSnapshot
} = require('../../services/payment-tracking/rules');
const { NEXT_STAGE } = require('../../services/payment-tracking/constants');

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
      listing_date: '2026-08-28',
      listing_category: '女装',
      product_image_count: 0
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({ product_images: '至少上传一张产品主图' });
  });

  it('uses the confirmed four-stage graph', () => {
    expect(NEXT_STAGE).toEqual({
      selection: 'testing',
      testing: 'monitoring',
      monitoring: 'summary',
      summary: null
    });
  });

  it('requires payment confirmation and a qualified potential result in the second stage', () => {
    expect(validateAdvance('testing', { paid_enabled: 0, paid_at: null })).toEqual({
      ok: false,
      errors: { paid_enabled: '店长必须确认开启付费' }
    });
    expect(validateAdvance('testing', { paid_enabled: 1, paid_at: null }).errors).toEqual({
      paid_at: '请选择付费时间'
    });
    expect(validateAdvance('testing', {
      paid_enabled: 1,
      paid_at: '2026-09-01',
      potential_status: '不符合'
    }).errors).toEqual({ potential_status: '只有符合潜力款标准才能进入下一阶段' });
    expect(validateAdvance('testing', {
      paid_enabled: 1,
      paid_at: '2026-09-01',
      potential_status: '符合潜力款标准'
    }).ok).toBe(true);
  });

  it('only advances third-stage records marked for continued breakout', () => {
    expect(validateAdvance('monitoring', {}).errors).toEqual({ link_status: '请选择链接状态' });
    expect(validateAdvance('monitoring', { link_status: 'protect_roi' }).errors).toEqual({
      link_status: '只有持续打爆才能进入下一阶段'
    });
    expect(validateAdvance('monitoring', { link_status: 'keep_breaking' }).ok).toBe(true);
  });

  it('rejects the retired breakout stage and does not advance summary', () => {
    expect(validateAdvance('breakout', {}).errors).toEqual({ stage: '无效阶段' });
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

  it('derives link status, completed and manual endings without free-form input', () => {
    expect(deriveEndSnapshot('monitoring', {
      link_status: 'protect_roi'
    })).toEqual({
      endType: 'protect_roi',
      endReason: '链接状态：保投产'
    });
    expect(deriveEndSnapshot('summary', {})).toEqual({
      endType: 'completed',
      endReason: '流程完成'
    });
    expect(deriveEndSnapshot('selection', {})).toEqual({
      endType: 'manual',
      endReason: '主动结束流程'
    });
  });
});
