const { PERMISSIONS, defaultPermissionsFor } = require('../../config/permissions');

describe('permission defaults', () => {
  it('uses dashboard permissions for admin and role dashboard entries', () => {
    expect(defaultPermissionsFor('sub_admin')).toEqual(expect.arrayContaining([
      'dashboard.design',
      'dashboard.operator',
      'dashboard.cs'
    ]));

    expect(defaultPermissionsFor('operator')).toEqual(expect.arrayContaining([
      'dashboard.design',
      'dashboard.operator'
    ]));
    expect(defaultPermissionsFor('designer')).toContain('dashboard.design');
    expect(defaultPermissionsFor('operator_assistant')).toContain('dashboard.operator');
    expect(defaultPermissionsFor('cs_agent')).toContain('dashboard.cs');
    expect(defaultPermissionsFor('basic_designer')).toContain('dashboard.cs');
  });

  it('registers payment tracking permissions without granting them to ordinary roles by default', () => {
    const codes = PERMISSIONS.map(item => item.code);
    expect(codes).toEqual(expect.arrayContaining([
      'payment.selection.view',
      'payment.records.view',
      'payment.open',
      'payment.manager_review',
      'payment.stage_reopen',
      'payment.delete'
    ]));
    expect(defaultPermissionsFor('operator')).not.toContain('payment.open');
    expect(defaultPermissionsFor('designer')).not.toContain('payment.selection.view');
    expect(defaultPermissionsFor('admin')).toContain('payment.delete');
  });
});
