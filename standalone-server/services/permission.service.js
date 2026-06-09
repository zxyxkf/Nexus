const { execute } = require('../config/database');
const { PERMISSIONS, defaultPermissionsFor, expandPermissions } = require('../config/permissions');

async function seedPermissions() {
  for (const p of PERMISSIONS) {
    await execute(
      `INSERT IGNORE INTO sys_permission (code, name, type, permission_group, description)
       VALUES (?, ?, ?, ?, ?)`,
      [p.code, p.name, p.type, p.group || '', p.description || '']
    ).catch(async () => {
      await execute(
        `INSERT OR IGNORE INTO sys_permission (code, name, type, permission_group, description)
         VALUES (?, ?, ?, ?, ?)`,
        [p.code, p.name, p.type, p.group || '', p.description || '']
      ).catch(() => {});
    });
  }
}

async function getPermissionCatalog() {
  const [rows] = await execute(
    `SELECT code, name, type, permission_group AS permissionGroup, description
     FROM sys_permission ORDER BY permission_group ASC, type DESC, code ASC`
  );
  return rows.length ? rows : PERMISSIONS.map(p => ({
    code: p.code,
    name: p.name,
    type: p.type,
    permissionGroup: p.group || '',
    description: p.description || ''
  }));
}

async function getUserOverrides(userId) {
  const [rows] = await execute(
    `SELECT permission_code, effect FROM sys_user_permission WHERE user_id = ?`,
    [userId]
  );
  return rows;
}

async function getEffectivePermissions(user) {
  const set = new Set(defaultPermissionsFor(user.role, user.is_team_lead ?? user.isTeamLead));

  const overrides = await getUserOverrides(user.id);
  for (const row of overrides) {
    if (user.role === 'admin' && row.permission_code === 'admin.users' && row.effect === 'deny') continue;
    if (row.effect === 'deny') set.delete(row.permission_code);
    else set.add(row.permission_code);
  }
  if (user.role === 'admin') set.add('admin.users');
  return expandPermissions([...set]);
}

async function saveUserPermissions(userId, permissions = [], deniedPermissions = []) {
  await execute(`DELETE FROM sys_user_permission WHERE user_id = ?`, [userId]);

  const [users] = await execute(`SELECT role FROM sys_user WHERE id = ?`, [userId]);
  const isAdmin = users[0]?.role === 'admin';
  const allowSet = new Set(permissions);
  const denySet = new Set(deniedPermissions);
  if (isAdmin) {
    allowSet.add('admin.users');
    denySet.delete('admin.users');
  }

  const rows = [
    ...[...allowSet].map(code => [userId, code, 'allow']),
    ...[...denySet].map(code => [userId, code, 'deny'])
  ];
  for (const row of rows) {
    await execute(
      `INSERT INTO sys_user_permission (user_id, permission_code, effect) VALUES (?, ?, ?)`,
      row
    );
  }
}

module.exports = {
  seedPermissions,
  getPermissionCatalog,
  getEffectivePermissions,
  saveUserPermissions,
  getUserOverrides
};
