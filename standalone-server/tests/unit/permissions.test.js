const { PERMISSIONS, defaultPermissionsFor, expandPermissions } = require('../../config/permissions');

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
      'payment.view.all',
      'payment.open',
      'payment.stage_reopen',
      'payment.delete'
    ]));
    expect(defaultPermissionsFor('operator')).not.toContain('payment.open');
    expect(defaultPermissionsFor('designer')).not.toContain('payment.selection.view');
    expect(defaultPermissionsFor('admin')).toContain('payment.delete');
  });

  it('registers the global payment manager permission and expands it to payment actions', () => {
    expect(PERMISSIONS).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'payment.manage.all',
        name: '管理全部店铺打款数据'
      })
    ]));
    expect(defaultPermissionsFor('operator')).not.toContain('payment.manage.all');
    expect(defaultPermissionsFor('sub_admin')).not.toContain('payment.manage.all');
    expect(defaultPermissionsFor('admin')).toEqual(expect.arrayContaining([
      'payment.manage.all',
      'payment.view.all',
      'payment.selection.view',
      'payment.records.view',
      'payment.open',
      'payment.stage_reopen',
      'payment.delete'
    ]));
  });

  it('grants sub-admins read-only all-store payment access and retires the old manager permission', () => {
    const codes = PERMISSIONS.map(item => item.code);
    expect(codes).toContain('payment.view.all');
    expect(codes).not.toContain('payment.manager_review');
    expect(defaultPermissionsFor('sub_admin')).toContain('payment.view.all');
    expect(defaultPermissionsFor('sub_admin')).not.toContain('payment.manage.all');
    expect(defaultPermissionsFor('sub_admin')).not.toContain('payment.selection.view');
    expect(expandPermissions(['payment.manage.all'])).toContain('payment.view.all');
  });
});
