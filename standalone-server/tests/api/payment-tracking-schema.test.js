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
    'payment_selection_summary'
  ];

  const [tables] = await execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  expect(tables.map(row => row.name)).toEqual(expect.arrayContaining(expected));

  const [indexes] = await execute('PRAGMA index_list(payment_selection_record)');
  expect(indexes.some(index => index.name === 'uk_payment_store_seq')).toBe(true);
  expect(indexes.some(index => index.name === 'uk_payment_source_task')).toBe(true);
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
