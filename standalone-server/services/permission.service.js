const { execute } = require('../config/database');
const { PERMISSIONS, defaultPermissionsFor, expandPermissions } = require('../config/permissions');
const AppError = require('../utils/AppError');

const LEGACY_BOARD_PERMISSIONS = {
  'board.design': 'dashboard.design',
  'board.operator': 'dashboard.operator',
  'board.cs': 'dashboard.cs'
};

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

    await execute(
      `UPDATE sys_permission SET name = ?, type = ?, permission_group = ?, description = ? WHERE code = ?`,
      [p.name, p.type, p.group || '', p.description || '', p.code]
    ).catch(() => {});
  }
  await migrateLegacyBoardPermissions();
}

async function migrateLegacyBoardPermissions() {
  for (const [legacyCode, currentCode] of Object.entries(LEGACY_BOARD_PERMISSIONS)) {
    await execute(
      `INSERT IGNORE INTO sys_user_permission (user_id, permission_code, effect)
       SELECT user_id, ?, effect FROM sys_user_permission WHERE permission_code = ?`,
      [currentCode, legacyCode]
    ).catch(async () => {
      await execute(
        `INSERT OR IGNORE INTO sys_user_permission (user_id, permission_code, effect)
         SELECT user_id, ?, effect FROM sys_user_permission WHERE permission_code = ?`,
        [currentCode, legacyCode]
      ).catch(() => {});
    });
  }

  const legacyCodes = Object.keys(LEGACY_BOARD_PERMISSIONS);
  const placeholders = legacyCodes.map(() => '?').join(',');
  await execute(`DELETE FROM sys_user_permission WHERE permission_code IN (${placeholders})`, legacyCodes).catch(() => {});
  await execute(`DELETE FROM sys_permission WHERE code IN (${placeholders})`, legacyCodes).catch(() => {});
}

async function getPermissionCatalog() {
  await seedPermissions().catch(() => {});
  const [rows] = await execute(
    `SELECT code, name, type, permission_group AS permissionGroup, description
     FROM sys_permission ORDER BY permission_group ASC, type DESC, code ASC`
  );
  const configured = PERMISSIONS.map(p => ({
    code: p.code,
    name: p.name,
    type: p.type,
    permissionGroup: p.group || '',
    description: p.description || ''
  }));
  if (!rows.length) return configured;

  const byCode = new Map(rows.map(row => [row.code, row]));
  for (const p of configured) {
    if (!byCode.has(p.code)) byCode.set(p.code, p);
  }
  return [...byCode.values()].sort((a, b) => {
    const groupDiff = String(a.permissionGroup || '').localeCompare(String(b.permissionGroup || ''), 'zh-Hans-CN');
    if (groupDiff !== 0) return groupDiff;
    const typeDiff = String(b.type || '').localeCompare(String(a.type || ''), 'zh-Hans-CN');
    if (typeDiff !== 0) return typeDiff;
    return String(a.code || '').localeCompare(String(b.code || ''));
  });
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
    if (row.effect === 'allow') set.add(row.permission_code);
  }
  for (const row of overrides) {
    if (user.role === 'admin' && row.permission_code === 'admin.users' && row.effect === 'deny') continue;
    if (row.effect === 'deny') set.delete(row.permission_code);
  }
  if (user.role === 'admin') set.add('admin.users');
  return expandPermissions([...set]);
}

async function saveUserPermissions(userId, permissions = [], deniedPermissions = []) {
  const allowSet = new Set(permissions);
  const denySet = new Set(deniedPermissions);
  const validCodes = new Set(PERMISSIONS.map(p => p.code));
  const invalidCodes = [...allowSet, ...denySet].filter(code => !validCodes.has(code));
  if (invalidCodes.length > 0) {
    throw new AppError(400, `未知权限码: ${invalidCodes.join(', ')}`);
  }

  const [users] = await execute(`SELECT role FROM sys_user WHERE id = ?`, [userId]);
  const isAdmin = users[0]?.role === 'admin';
  if (isAdmin) {
    allowSet.add('admin.users');
    denySet.delete('admin.users');
  }

  await execute(`DELETE FROM sys_user_permission WHERE user_id = ?`, [userId]);

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
