const { defaultPermissionsFor } = require('../../config/permissions');

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
});
