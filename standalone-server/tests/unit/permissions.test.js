const { defaultPermissionsFor } = require('../../config/permissions');

describe('permission defaults', () => {
  it('separates admin dashboards from role data boards', () => {
    expect(defaultPermissionsFor('sub_admin')).toEqual(expect.arrayContaining([
      'dashboard.design',
      'dashboard.operator',
      'dashboard.cs'
    ]));
    expect(defaultPermissionsFor('sub_admin')).not.toEqual(expect.arrayContaining([
      'board.design',
      'board.operator',
      'board.cs'
    ]));

    expect(defaultPermissionsFor('designer')).toContain('board.design');
    expect(defaultPermissionsFor('designer')).not.toContain('dashboard.design');
    expect(defaultPermissionsFor('operator_assistant')).toContain('board.operator');
    expect(defaultPermissionsFor('operator_assistant')).not.toContain('dashboard.operator');
    expect(defaultPermissionsFor('basic_designer')).toContain('board.cs');
    expect(defaultPermissionsFor('basic_designer')).not.toContain('dashboard.cs');
  });
});
