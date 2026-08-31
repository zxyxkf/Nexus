const { setupApp } = require('./helpers/setup');

let execute;

beforeAll(async () => {
  await setupApp();
  ({ execute } = require('../../config/database'));
});

it('creates every payment tracking table and unique index', async () => {
  const expected = [
    'payment_selection_record',
    'payment_selection_image',
    'payment_selection_stage',
    'payment_selection_preparation',
    'payment_selection_testing',
    'payment_selection_monitoring',
    'payment_selection_adjustment',
    'payment_selection_breakout',
    'payment_selection_summary',
    'payment_manager_review_request'
  ];

  const [tables] = await execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  expect(tables.map(row => row.name)).toEqual(expect.arrayContaining(expected));

  const [indexes] = await execute('PRAGMA index_list(payment_selection_record)');
  expect(indexes.some(index => index.name === 'uk_payment_store_seq')).toBe(true);
  expect(indexes.some(index => index.name === 'uk_payment_source_task')).toBe(true);

  const [reviewIndexes] = await execute('PRAGMA index_list(payment_manager_review_request)');
  expect(reviewIndexes.some(index => index.unique === 1)).toBe(true);
});

it('applies the base SQLite schema to a legacy image table before migration', async () => {
  const initSqlJs = require('sql.js');
  const paymentTrackingSchema = require('../../config/payment-tracking-schema');
  const SQL = await initSqlJs();
  const database = new SQL.Database();

  database.run(`CREATE TABLE payment_selection_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    deleted_at TEXT
  )`);

  const imageSchemaStatements = paymentTrackingSchema.sqlite.filter(sql => (
    sql.includes('payment_selection_image')
  ));

  expect(() => {
    for (const sql of imageSchemaStatements) database.run(sql);
  }).not.toThrow();

  database.close();
});

it('keeps payment tracking data when database initialization runs again', async () => {
  await execute(
    `INSERT INTO payment_selection_record (store, store_seq, planner_id, planner_name)
     VALUES (?, ?, ?, ?)`,
    ['幂等测试店铺', 1, 99, '幂等测试用户']
  );

  const { initDatabase } = require('../../config/database');
  await initDatabase();

  const [rows] = await execute(
    'SELECT planner_name FROM payment_selection_record WHERE store = ? AND store_seq = ?',
    ['幂等测试店铺', 1]
  );
  expect(rows).toEqual([{ planner_name: '幂等测试用户' }]);
});

it('backfills legacy manager reviews once and removes retired permissions', async () => {
  const marker = 'migration.payment_manager_review_backfill.v1';
  await execute('DELETE FROM sys_config WHERE config_key = ?', [marker]);
  await execute("INSERT INTO sys_permission (code, name) VALUES ('payment.manager_review', '旧店长权限')");
  await execute(
    "INSERT INTO sys_user_permission (user_id, permission_code, effect) VALUES (1, 'payment.manager_review', 'allow')"
  );

  const records = [
    ['LEGACY-PENDING', null],
    ['LEGACY-PAID', 1],
    ['LEGACY-DENIED', 0]
  ];
  const recordIds = new Map();
  for (let index = 0; index < records.length; index += 1) {
    const [styleNumber, paidEnabled] = records[index];
    const [result] = await execute(
      `INSERT INTO payment_selection_record
         (store, store_seq, planner_id, planner_name, style_number, current_stage, process_status, version)
       VALUES (?, ?, ?, ?, ?, 'testing', 'in_progress', 7)`,
      ['旧数据审核店', index + 1, 1, '旧数据填写人', styleNumber]
    );
    recordIds.set(styleNumber, Number(result.insertId));
    await execute(
      'INSERT INTO payment_selection_testing (record_id, paid_enabled, paid_at) VALUES (?, ?, ?)',
      [result.insertId, paidEnabled, paidEnabled === 1 ? '2026-08-30 12:00:00' : null]
    );
  }

  const { initDatabase } = require('../../config/database');
  await initDatabase();

  const [postMigrationRecord] = await execute(
    `INSERT INTO payment_selection_record
       (store, store_seq, planner_id, planner_name, style_number, current_stage, process_status, version)
     VALUES (?, ?, ?, ?, ?, 'testing', 'in_progress', 3)`,
    ['迁移后店铺', 1, 1, '店长本人', 'POST-MIGRATION']
  );
  await execute(
    'INSERT INTO payment_selection_testing (record_id, paid_enabled, paid_at) VALUES (?, NULL, NULL)',
    [postMigrationRecord.insertId]
  );
  await initDatabase();

  const [requests] = await execute(
    `SELECT record_id, store, applicant_id, applicant_name, request_version
     FROM payment_manager_review_request
     WHERE record_id IN (?, ?, ?)` ,
    [
      recordIds.get('LEGACY-PENDING'),
      recordIds.get('LEGACY-PAID'),
      recordIds.get('LEGACY-DENIED')
    ]
  );
  expect(requests).toEqual([{
    record_id: recordIds.get('LEGACY-PENDING'),
    store: '旧数据审核店',
    applicant_id: 1,
    applicant_name: '旧数据填写人',
    request_version: 7
  }]);
  const [postMigrationRequests] = await execute(
    'SELECT id FROM payment_manager_review_request WHERE record_id = ?',
    [postMigrationRecord.insertId]
  );
  expect(postMigrationRequests).toHaveLength(0);

  const [paidStates] = await execute(
    `SELECT record_id, paid_enabled, paid_at FROM payment_selection_testing
     WHERE record_id IN (?, ?, ?) ORDER BY record_id ASC`,
    [
      recordIds.get('LEGACY-PENDING'),
      recordIds.get('LEGACY-PAID'),
      recordIds.get('LEGACY-DENIED')
    ]
  );
  expect(paidStates).toEqual([
    { record_id: recordIds.get('LEGACY-PENDING'), paid_enabled: null, paid_at: null },
    { record_id: recordIds.get('LEGACY-PAID'), paid_enabled: 1, paid_at: '2026-08-30 12:00:00' },
    { record_id: recordIds.get('LEGACY-DENIED'), paid_enabled: 0, paid_at: null }
  ]);

  const [markers] = await execute('SELECT config_value FROM sys_config WHERE config_key = ?', [marker]);
  expect(markers).toEqual([{ config_value: '1' }]);
  const [retiredCatalog] = await execute("SELECT id FROM sys_permission WHERE code = 'payment.manager_review'");
  const [retiredOverrides] = await execute(
    "SELECT id FROM sys_user_permission WHERE permission_code = 'payment.manager_review'"
  );
  expect(retiredCatalog).toHaveLength(0);
  expect(retiredOverrides).toHaveLength(0);
});
