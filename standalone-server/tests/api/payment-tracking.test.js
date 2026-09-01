const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;
let storeAToken;
let storeBToken;
let noPermissionToken;
let recordsOnlyToken;
let managerToken;
let reopenerToken;
let globalManagerToken;
let readOnlySubAdminToken;
let storeAUserId;
let globalManagerUserId;

const suffix = Date.now();
const users = {
  storeA: `payment_a_${suffix}`,
  storeB: `payment_b_${suffix}`,
  noPermission: `payment_none_${suffix}`,
  recordsOnly: `payment_records_${suffix}`,
  manager: `payment_manager_${suffix}`,
  reopener: `payment_reopener_${suffix}`,
  globalManager: `payment_global_${suffix}`,
  readOnlySubAdmin: `payment_read_all_${suffix}`
};

async function login(username) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'test123456' });
  return response.body.data.token;
}

async function createRecordAtSummary(styleNumber) {
  const { execute } = require('../../config/database');
  const created = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber });
  const recordId = created.body.data.id;

  await execute(
    `UPDATE payment_selection_stage
     SET stage_status = 'completed', completed_at = CURRENT_TIMESTAMP
     WHERE record_id = ? AND stage_code = 'selection'`,
    [recordId]
  );
  await execute(
    `INSERT INTO payment_selection_stage (record_id, stage_code, stage_status, completed_at)
     VALUES (?, 'testing', 'completed', CURRENT_TIMESTAMP),
            (?, 'monitoring', 'completed', CURRENT_TIMESTAMP),
            (?, 'summary', 'active', NULL)`,
    [recordId, recordId, recordId]
  );
  await execute(
    `INSERT INTO payment_selection_testing
       (record_id, paid_enabled, paid_at, promotion_method, potential_status,
        unqualified_action, manager_report_date, wei_stock_reported)
     VALUES (?, 1, '2026-08-20 09:00:00', '测试推广', '符合潜力款标准',
             '', '2026-08-21', 1)`,
    [recordId]
  );
  await execute(
    `INSERT INTO payment_selection_monitoring (record_id, link_optimized, link_status)
     VALUES (?, 1, 'keep_breaking')`,
    [recordId]
  );
  const [adjustment] = await execute(
    `INSERT INTO payment_selection_adjustment
       (record_id, client_key, sort_order, reason, detail_text, feedback_text)
     VALUES (?, 'downstream-adjustment', 0, '旧调整', '旧操作', '旧备注')`,
    [recordId]
  );
  await execute(
    `INSERT INTO payment_selection_summary (record_id, summary_text)
     VALUES (?, '旧总结')`,
    [recordId]
  );
  await execute(
    `INSERT INTO payment_selection_image
       (record_id, category, adjustment_id, storage_root, relative_path,
        original_name, mime_type, sort_order)
     VALUES (?, 'potential_judgment', NULL, 'C:/payment-test-images', 'potential.png',
             'potential.png', 'image/png', 0),
            (?, 'link_optimization', NULL, 'C:/payment-test-images', 'link.png',
             'link.png', 'image/png', 0),
            (?, 'adjustment_feedback', ?, 'C:/payment-test-images', 'feedback.png',
             'feedback.png', 'image/png', 0)`,
    [recordId, recordId, recordId, adjustment.insertId]
  );
  await execute(
    `INSERT INTO payment_selection_link_status
       (record_id, stage_code, flash_sale_registered, flash_sale_group,
        rapid_order_entered, new_product_operation_registered, product_burst, product_burst_mode)
     VALUES (?, 'monitoring', 1, 'potential_breakout', 1, 1, 1, 'super_breakout')`,
    [recordId]
  );
  await execute(
    `UPDATE payment_selection_record SET current_stage = 'summary'
     WHERE id = ?`,
    [recordId]
  );

  return created.body.data;
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = adminLogin.body.data.token;

  for (const [username, store] of [
    [users.storeA, 'A店'],
    [users.storeB, 'B店'],
    [users.noPermission, 'A店'],
    [users.recordsOnly, 'A店'],
    [users.manager, 'A店'],
    [users.reopener, 'A店'],
    [users.globalManager, ''],
    [users.readOnlySubAdmin, '']
  ]) {
    await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username,
        password: 'test123456',
        realName: username,
        role: [users.globalManager, users.readOnlySubAdmin].includes(username) ? 'sub_admin' : 'operator',
        store,
        isStoreManager: username === users.manager ? 1 : 0
      });
  }

  const list = await request(app)
    .get('/api/user/list?pageSize=100')
    .set('Authorization', `Bearer ${adminToken}`);
  const byName = new Map(list.body.data.list.map(user => [user.username, user]));
  storeAUserId = byName.get(users.storeA).id;
  globalManagerUserId = byName.get(users.globalManager).id;

  for (const username of [users.storeA, users.storeB]) {
    await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: byName.get(username).id,
        permissions: ['payment.selection.view'],
        deniedPermissions: []
      });
  }

  await request(app)
    .post('/api/user/permissions/save')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      userId: byName.get(users.recordsOnly).id,
      permissions: ['payment.records.view'],
      deniedPermissions: []
    });

  await request(app)
    .post('/api/user/permissions/save')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      userId: globalManagerUserId,
      permissions: ['payment.manage.all'],
      deniedPermissions: []
    });

  await request(app)
    .post('/api/user/permissions/save')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      userId: byName.get(users.manager).id,
      permissions: ['payment.selection.view'],
      deniedPermissions: []
    });

  await request(app)
    .post('/api/user/permissions/save')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      userId: byName.get(users.reopener).id,
      permissions: ['payment.selection.view', 'payment.stage_reopen'],
      deniedPermissions: []
    });

  storeAToken = await login(users.storeA);
  storeBToken = await login(users.storeB);
  noPermissionToken = await login(users.noPermission);
  recordsOnlyToken = await login(users.recordsOnly);
  managerToken = await login(users.manager);
  reopenerToken = await login(users.reopener);
  globalManagerToken = await login(users.globalManager);
  readOnlySubAdminToken = await login(users.readOnlySubAdmin);
}, 30000);

it('creates store-scoped records with independent store sequences', async () => {
  const created = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ selectionDate: '2026-08-27', styleNumber: 'A-100' });
  expect(created.body.code).toBe(0);
  expect(created.body.data).toMatchObject({
    store: 'A店',
    storeSeq: 1,
    plannerId: storeAUserId,
    currentStage: 'selection',
    processStatus: 'in_progress'
  });

  const second = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: 'A-101' });
  expect(second.body.data.storeSeq).toBe(2);

  const storeBFirst = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeBToken}`)
    .send({ styleNumber: 'B-100' });
  expect(storeBFirst.body.data.storeSeq).toBe(1);

  const storeAList = await request(app)
    .get('/api/payment-tracking/records?processStatus=in_progress')
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(storeAList.body.data.list.map(record => record.styleNumber)).toEqual(['A-101', 'A-100']);

  const adminList = await request(app)
    .get('/api/payment-tracking/records?processStatus=in_progress')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(adminList.body.data.total).toBe(3);

  const forbidden = await request(app)
    .get(`/api/payment-tracking/records/${created.body.data.id}`)
    .set('Authorization', `Bearer ${storeBToken}`);
  expect(forbidden.body.code).toBe(403);

  const denied = await request(app)
    .get('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${noPermissionToken}`);
  expect(denied.status).toBe(403);

  const endedList = await request(app)
    .get('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${recordsOnlyToken}`);
  expect(endedList.body).toMatchObject({ code: 0, data: { total: 0 } });

  const recordsCannotReadSelections = await request(app)
    .get('/api/payment-tracking/records?processStatus=in_progress')
    .set('Authorization', `Bearer ${recordsOnlyToken}`);
  expect(recordsCannotReadSelections.body.code).toBe(403);

  const recordsCannotReadSelectionDetail = await request(app)
    .get(`/api/payment-tracking/records/${created.body.data.id}`)
    .set('Authorization', `Bearer ${recordsOnlyToken}`);
  expect(recordsCannotReadSelectionDetail.body.code).toBe(403);

  const deleted = await request(app)
    .delete(`/api/payment-tracking/records/${created.body.data.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ version: created.body.data.version });
  expect(deleted.body.code).toBe(0);

  const repeatedDelete = await request(app)
    .delete(`/api/payment-tracking/records/${created.body.data.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ version: created.body.data.version });
  expect(repeatedDelete.body.code).toBe(0);

  const afterDelete = await request(app)
    .get('/api/payment-tracking/records?processStatus=in_progress')
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(afterDelete.body.data.list.map(record => record.styleNumber)).toEqual(['A-101']);
});

it('returns list card details and applies planner and current-stage filters', async () => {
  const created = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: 'LIST-CARD-100' });
  const recordId = created.body.data.id;

  const { execute } = require('../../config/database');
  await execute(
    `INSERT INTO payment_selection_image
       (record_id, category, storage_root, relative_path, original_name, mime_type, file_size)
     VALUES (?, 'product_main', ?, ?, 'cover.png', 'image/png', 8)`,
    [recordId, 'test-fixtures', 'cover.png']
  );
  await execute(
    `UPDATE payment_selection_stage SET stage_status = 'completed', completed_at = CURRENT_TIMESTAMP
     WHERE record_id = ? AND stage_code = 'selection'`,
    [recordId]
  );
  await execute(
    `INSERT INTO payment_selection_stage (record_id, stage_code, stage_status)
     VALUES (?, 'preparation', 'completed'), (?, 'testing', 'active')`,
    [recordId, recordId]
  );
  await execute(
    `UPDATE payment_selection_record SET current_stage = 'testing' WHERE id = ?`,
    [recordId]
  );

  const filtered = await request(app)
    .get(`/api/payment-tracking/records?processStatus=in_progress&plannerId=${storeAUserId}&stageCode=testing`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(filtered.body.code).toBe(0);
  expect(filtered.body.data.list).toHaveLength(1);
  expect(filtered.body.data.list[0]).toMatchObject({
    id: recordId,
    styleNumber: 'LIST-CARD-100',
    currentStage: 'testing'
  });
  expect(filtered.body.data.list[0].stages.map(stage => stage.stageCode)).toEqual([
    'selection', 'preparation', 'testing'
  ]);
  expect(filtered.body.data.list[0].images).toEqual([
    expect.objectContaining({ category: 'product_main', originalName: 'cover.png' })
  ]);

  const wrongPlanner = await request(app)
    .get('/api/payment-tracking/records?processStatus=in_progress&plannerId=999999&stageCode=testing')
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(wrongPlanner.body.data.total).toBe(0);

  const cannotOverrideStore = await request(app)
    .get('/api/payment-tracking/records?processStatus=in_progress&store=B店&stageCode=testing')
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(cannotOverrideStore.body.data.list.every(record => record.store === 'A店')).toBe(true);
});

it('allows a global payment manager without a store to manage records across stores', async () => {
  const storeARecord = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: `GLOBAL-A-${suffix}` });
  const storeBRecord = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeBToken}`)
    .send({ styleNumber: `GLOBAL-B-${suffix}` });
  expect(storeARecord.body.code).toBe(0);
  expect(storeBRecord.body.code).toBe(0);

  const globalList = await request(app)
    .get('/api/payment-tracking/records?processStatus=in_progress&keyword=GLOBAL-')
    .set('Authorization', `Bearer ${globalManagerToken}`);
  expect(globalList.body.data.list.map(record => record.store).sort()).toEqual(['A店', 'B店']);

  const crossStoreDetail = await request(app)
    .get(`/api/payment-tracking/records/${storeBRecord.body.data.id}`)
    .set('Authorization', `Bearer ${globalManagerToken}`);
  expect(crossStoreDetail.body.data).toMatchObject({
    id: storeBRecord.body.data.id,
    store: 'B店'
  });

  const saved = await request(app)
    .put(`/api/payment-tracking/records/${storeBRecord.body.data.id}/stages/selection`)
    .set('Authorization', `Bearer ${globalManagerToken}`)
    .send({ version: crossStoreDetail.body.data.version, data: { listingCategory: '女装' } });
  expect(saved.body.code).toBe(0);

  const ended = await request(app)
    .post(`/api/payment-tracking/records/${storeBRecord.body.data.id}/end`)
    .set('Authorization', `Bearer ${globalManagerToken}`)
    .send({ version: saved.body.data.version });
  expect(ended.body.data.processStatus).toBe('ended');

  const restored = await request(app)
    .post(`/api/payment-tracking/records/${storeBRecord.body.data.id}/restore`)
    .set('Authorization', `Bearer ${globalManagerToken}`)
    .send({ version: ended.body.data.version });
  expect(restored.body.data).toMatchObject({ store: 'B店', processStatus: 'in_progress' });

  const deleted = await request(app)
    .delete(`/api/payment-tracking/records/${storeARecord.body.data.id}`)
    .set('Authorization', `Bearer ${globalManagerToken}`)
    .send({ version: storeARecord.body.data.version });
  expect(deleted.body.code).toBe(0);
});

it('allows a sub-admin to view all stores but rejects every payment write operation', async () => {
  const storeARecord = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: `READONLY-A-${suffix}` });
  const storeBRecord = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeBToken}`)
    .send({ styleNumber: `READONLY-B-${suffix}` });

  const listRes = await request(app)
    .get('/api/payment-tracking/records?processStatus=in_progress&keyword=READONLY-')
    .set('Authorization', `Bearer ${readOnlySubAdminToken}`);
  expect(listRes.body.code).toBe(0);
  expect(listRes.body.data.list.map(record => record.store).sort()).toEqual(['A店', 'B店']);
  expect(listRes.body.data.list.every(record => Object.values(record.allowedActions).every(value => value === false))).toBe(true);

  const detailRes = await request(app)
    .get(`/api/payment-tracking/records/${storeBRecord.body.data.id}`)
    .set('Authorization', `Bearer ${readOnlySubAdminToken}`);
  expect(detailRes.body).toMatchObject({ code: 0, data: { store: 'B店' } });

  const attempts = [
    request(app)
      .post('/api/payment-tracking/records')
      .set('Authorization', `Bearer ${readOnlySubAdminToken}`)
      .send({ styleNumber: `DENIED-${suffix}` }),
    request(app)
      .put(`/api/payment-tracking/records/${storeBRecord.body.data.id}/stages/selection`)
      .set('Authorization', `Bearer ${readOnlySubAdminToken}`)
      .send({ version: storeBRecord.body.data.version, data: { detailText: '不可写' } }),
    request(app)
      .delete(`/api/payment-tracking/records/${storeBRecord.body.data.id}`)
      .set('Authorization', `Bearer ${readOnlySubAdminToken}`)
      .send({ version: storeBRecord.body.data.version }),
    request(app)
      .post(`/api/payment-tracking/records/${storeBRecord.body.data.id}/restore`)
      .set('Authorization', `Bearer ${readOnlySubAdminToken}`)
      .send({ version: storeBRecord.body.data.version }),
    request(app)
      .post(`/api/payment-tracking/records/${storeBRecord.body.data.id}/stages/selection/reopen`)
      .set('Authorization', `Bearer ${readOnlySubAdminToken}`)
      .send({ version: storeBRecord.body.data.version })
  ];

  const results = await Promise.all(attempts);
  expect(results.map(result => result.status)).toEqual([403, 403, 403, 403, 403]);
});

it('provides configurable listing categories and rejects unknown active values', async () => {
  const created = await request(app)
    .post('/api/payment-tracking/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `类目-${suffix}`, sortOrder: 10 });
  expect(created.body).toMatchObject({ code: 0, data: { name: `类目-${suffix}`, active: 1 } });

  const duplicate = await request(app)
    .post('/api/payment-tracking/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `  类目-${suffix}  ` });
  expect(duplicate.body.code).toBe(400);

  const listed = await request(app)
    .get('/api/payment-tracking/categories')
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(listed.body.data.some(item => item.name === `类目-${suffix}`)).toBe(true);

  const record = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: `CATEGORY-${suffix}` });
  const invalid = await request(app)
    .put(`/api/payment-tracking/records/${record.body.data.id}/stages/selection`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: record.body.data.version, data: { listingCategory: `不存在-${suffix}` } });
  expect(invalid.body.code).toBe(400);

  const deleted = await request(app)
    .delete(`/api/payment-tracking/categories/${created.body.data.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(deleted.body.code).toBe(0);
});

it('provides super-admin promotion methods and rejects unconfigured stage values', async () => {
  const methodName = `直通车-${suffix}`;
  const created = await request(app)
    .post('/api/payment-tracking/promotion-methods')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: methodName, sortOrder: 10, active: true });
  expect(created.body).toMatchObject({ code: 0, data: { name: methodName, active: 1 } });

  const duplicate = await request(app)
    .post('/api/payment-tracking/promotion-methods')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: `  ${methodName}  ` });
  expect(duplicate.body.code).toBe(400);

  const forbidden = await request(app)
    .post('/api/payment-tracking/promotion-methods')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ name: `无权新增-${suffix}` });
  expect(forbidden.body.code).toBe(403);

  const activeList = await request(app)
    .get('/api/payment-tracking/promotion-methods')
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(activeList.body.data).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: methodName, active: 1 })
  ]));

  const disabled = await request(app)
    .put(`/api/payment-tracking/promotion-methods/${created.body.data.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ active: false });
  expect(disabled.body.data.active).toBe(0);
  const afterDisable = await request(app)
    .get('/api/payment-tracking/promotion-methods')
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(afterDisable.body.data.some(item => item.name === methodName)).toBe(false);

  const reenabled = await request(app)
    .put(`/api/payment-tracking/promotion-methods/${created.body.data.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ active: true });
  expect(reenabled.body.data.active).toBe(1);

  const record = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: `PROMOTION-${suffix}` });
  const { execute } = require('../../config/database');
  await execute("UPDATE payment_selection_stage SET stage_status = 'completed' WHERE record_id = ? AND stage_code = 'selection'", [record.body.data.id]);
  await execute("INSERT INTO payment_selection_stage (record_id, stage_code, stage_status) VALUES (?, 'testing', 'active')", [record.body.data.id]);
  await execute("UPDATE payment_selection_record SET current_stage = 'testing' WHERE id = ?", [record.body.data.id]);

  const invalid = await request(app)
    .put(`/api/payment-tracking/records/${record.body.data.id}/stages/testing`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: record.body.data.version, data: { promotionMethod: `未配置-${suffix}` } });
  expect(invalid.body).toMatchObject({
    code: 400,
    data: { errors: { promotionMethod: '推广方式无效，请选择已配置的方式' } }
  });

  const valid = await request(app)
    .put(`/api/payment-tracking/records/${record.body.data.id}/stages/testing`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: record.body.data.version, data: { promotionMethod: methodName } });
  expect(valid.body.data.stageData.testing.promotionMethod).toBe(methodName);

  const removed = await request(app)
    .delete(`/api/payment-tracking/promotion-methods/${created.body.data.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(removed.body.code).toBe(0);
});

it('saves and advances a selection without cost or sale price', async () => {
  const created = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: 'OPTIONAL-PRICE' });
  const recordId = created.body.data.id;

  const { execute } = require('../../config/database');
  await execute(
    `INSERT INTO payment_selection_image
       (record_id, category, storage_root, relative_path, original_name, mime_type, file_size)
     VALUES (?, 'product_main', ?, ?, 'fixture.png', 'image/png', 8)`,
    [recordId, 'test-fixtures', 'fixture.png']
  );

  const selection = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/selection`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: 1,
      data: {
        selectionDate: '2026-09-01',
        styleNumber: 'OPTIONAL-PRICE',
        productId: 'OPTIONAL-1',
        selectionMethod: '方式五：跟款',
        listingDate: '2026-09-02',
        listingCategory: '女装'
      }
    });
  expect(selection.body.data).toMatchObject({
    version: 2,
    cost: null,
    salePrice: null,
    grossMargin: null
  });

  const advanced = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: 2, stageCode: 'selection' });
  expect(advanced.body).toMatchObject({
    code: 0,
    data: { currentStage: 'testing' }
  });
});

it('runs the workflow without exposing future stages and enforces optimistic locking', async () => {
  const created = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: 'FLOW-100' });
  const recordId = created.body.data.id;

  const { execute } = require('../../config/database');
  await execute(
    `INSERT INTO payment_selection_image
       (record_id, category, storage_root, relative_path, original_name, mime_type, file_size)
     VALUES (?, 'product_main', ?, ?, 'fixture.png', 'image/png', 8)`,
    [recordId, 'test-fixtures', 'fixture.png']
  );

  const invalidPrice = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/selection`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: 1, data: { cost: 24, salePrice: 0 } });
  expect(invalidPrice.body).toMatchObject({
    code: 400,
    data: { errors: { sale_price: '售价必须大于0' } }
  });
  const unchangedAfterInvalidPrice = await request(app)
    .get(`/api/payment-tracking/records/${recordId}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(unchangedAfterInvalidPrice.body.data).toMatchObject({ version: 1, salePrice: null });

  const selection = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/selection`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: 1,
      data: {
        selectionDate: '2026-08-27',
        styleNumber: 'FLOW-100',
        cost: 24,
        salePrice: 75,
        productId: '998877',
        selectionMethod: '方式五：跟款',
        skuLe200: true,
        listingDate: '2026-08-28',
        listingCategory: '女装'
      }
    });
  expect(selection.body.data).toMatchObject({ version: 2, grossMargin: 0.68 });

  const stale = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/selection`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: 1, data: { detailText: '过期修改' } });
  expect(stale.body.code).toBe(409);

  const futureStage = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/monitoring`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: 2, data: {} });
  expect(futureStage.body.code).toBe(403);

  const testing = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: 2, stageCode: 'selection' });
  expect(testing.body.data.currentStage).toBe('testing');
  expect(testing.body.data.stages.map(stage => stage.stageCode)).toEqual(['selection', 'testing']);
  expect(testing.body.data.managerReviewPending).toBe(true);

  const plannerCannotReview = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/testing`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: 3, data: { paidEnabled: true, paidAt: '2026-09-01' } });
  expect(plannerCannotReview.body.code).toBe(403);

  const managerReviewList = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${managerToken}`);
  const managerReview = managerReviewList.body.data.list.find(
    item => Number(item.recordId) === Number(recordId)
  );
  expect(managerReview).toBeDefined();

  const approved = await request(app)
    .post(`/api/payment-tracking/manager-reviews/${managerReview.id}/approve`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ requestVersion: managerReview.requestVersion, paidAt: '2026-09-01' });
  expect(approved.body.data).toMatchObject({
    version: 4,
    managerReviewPending: false,
    stageData: { testing: { paidEnabled: true, paidAt: '2026-09-01' } }
  });

  const reviewed = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/testing`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: approved.body.data.version,
      data: {
        weiStockReported: false
      }
    });
  expect(reviewed.body.data.version).toBe(5);
  expect(reviewed.body.data.stageData.testing).toMatchObject({
    paidEnabled: true,
    weiStockReported: false
  });

  const unqualified = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/testing`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: reviewed.body.data.version, data: { potentialStatus: '不符合', unqualifiedAction: '直接关闭' } });
  const blockedTesting = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: unqualified.body.data.version, stageCode: 'testing' });
  expect(blockedTesting.body.code).toBe(400);

  const testingDetail = await request(app)
    .get(`/api/payment-tracking/records/${recordId}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(testingDetail.body.data.stages.map(stage => stage.stageCode)).toEqual([
    'selection', 'testing'
  ]);

  const qualified = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/testing`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: unqualified.body.data.version, data: { potentialStatus: '符合潜力款标准' } });
  const monitoring = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: qualified.body.data.version, stageCode: 'testing' });
  expect(monitoring.body.data.currentStage).toBe('monitoring');

  const protectedLink = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/monitoring`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: monitoring.body.data.version,
      data: { linkOptimized: true, linkStatus: 'protect_roi' }
    });
  expect(protectedLink.body.data.stageData.monitoring).toMatchObject({
    linkOptimized: true,
    linkStatus: 'protect_roi'
  });
  const blockedMonitoring = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: protectedLink.body.data.version, stageCode: 'monitoring' });
  expect(blockedMonitoring.body.code).toBe(400);

  const monitored = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/monitoring`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: protectedLink.body.data.version,
      data: { linkStatus: 'keep_breaking' }
    });
  expect(monitored.body.data.stageData.monitoring.linkStatus).toBe('keep_breaking');
  const summary = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: monitored.body.data.version, stageCode: 'monitoring' });
  expect(summary.body.data.currentStage).toBe('summary');

  const summarySaved = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/summary`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: summary.body.data.version, data: { exploded: false } });
  expect(summarySaved.body.data.stageData.summary.exploded).toBe(false);
  const ended = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/end`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: summarySaved.body.data.version });
  expect(ended.body.data).toMatchObject({
    processStatus: 'ended',
    endStage: 'summary',
    endType: 'completed',
    endReason: '流程完成'
  });

  const repeatedEnd = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/end`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: summarySaved.body.data.version });
  expect(repeatedEnd.body.data).toMatchObject({
    processStatus: 'ended',
    version: ended.body.data.version
  });

  const selectionsCannotReadEndedDetail = await request(app)
    .get(`/api/payment-tracking/records/${recordId}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(selectionsCannotReadEndedDetail.body.code).toBe(403);

  const nonPlannerRestore = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/restore`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ version: ended.body.data.version });
  expect(nonPlannerRestore.body.code).toBe(403);

  const restored = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/restore`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: ended.body.data.version });
  expect(restored.body.data).toMatchObject({ processStatus: 'in_progress', currentStage: 'summary' });

  const repeatedRestore = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/restore`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: ended.body.data.version });
  expect(repeatedRestore.body.data).toMatchObject({
    processStatus: 'in_progress',
    version: restored.body.data.version
  });

  const reopened = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/stages/selection/reopen`)
    .set('Authorization', `Bearer ${reopenerToken}`)
    .send({ version: restored.body.data.version });
  expect(reopened.body.data.stages.find(stage => stage.stageCode === 'selection').isReopened).toBe(true);

  const corrected = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/selection`)
    .set('Authorization', `Bearer ${reopenerToken}`)
    .send({ version: reopened.body.data.version, data: { detailText: '历史阶段已修正' } });
  expect(corrected.body.data.currentStage).toBe('summary');
  expect(corrected.body.data.stages.find(stage => stage.stageCode === 'selection').isReopened).toBe(false);
});

it('requires confirmation before a reopened terminal stage invalidates downstream data', async () => {
  const seeded = await createRecordAtSummary(`INVALIDATE-CONFIRM-${suffix}`);
  const reopened = await request(app)
    .post(`/api/payment-tracking/records/${seeded.id}/stages/testing/reopen`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ version: seeded.version });
  expect(reopened.body).toMatchObject({
    code: 0,
    data: { currentStage: 'summary', processStatus: 'in_progress' }
  });

  const unconfirmed = await request(app)
    .put(`/api/payment-tracking/records/${seeded.id}/stages/testing`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      version: reopened.body.data.version,
      data: { paidEnabled: false, potentialStatus: '符合潜力款标准' }
    });
  expect(unconfirmed.body).toMatchObject({
    code: 400,
    data: { requiresDownstreamInvalidation: true, stageCode: 'testing' }
  });

  const unchanged = await request(app)
    .get(`/api/payment-tracking/records/${seeded.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(unchanged.body.data).toMatchObject({
    version: reopened.body.data.version,
    currentStage: 'summary',
    processStatus: 'in_progress'
  });
  expect(unchanged.body.data.stageData.testing.paidEnabled).toBe(true);
  expect(unchanged.body.data.stages.map(stage => stage.stageCode)).toEqual([
    'selection', 'testing', 'monitoring', 'summary'
  ]);
  expect(unchanged.body.data.images.map(image => image.category)).toEqual(expect.arrayContaining([
    'potential_judgment', 'link_optimization', 'adjustment_feedback'
  ]));
  expect(unchanged.body.data.linkStatus).toMatchObject({ stageCode: 'monitoring' });

  const confirmed = await request(app)
    .put(`/api/payment-tracking/records/${seeded.id}/stages/testing`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      version: reopened.body.data.version,
      confirmDownstreamInvalidation: true,
      data: { paidEnabled: false, potentialStatus: '符合潜力款标准' }
    });
  expect(confirmed.body).toMatchObject({
    code: 0,
    data: {
      currentStage: 'testing',
      processStatus: 'ended',
      endStage: 'testing',
      endType: 'payment_not_enabled',
      endReason: '店长未确认开启付费',
      linkStatus: null
    }
  });
  expect(confirmed.body.data.stages.map(stage => stage.stageCode)).toEqual([
    'selection', 'testing'
  ]);
  expect(confirmed.body.data.stages.find(stage => stage.stageCode === 'testing')).toMatchObject({
    stageStatus: 'ended',
    isReopened: false
  });
  expect(confirmed.body.data.stageData.monitoring).toBeUndefined();
  expect(confirmed.body.data.stageData.summary).toBeUndefined();
  expect(confirmed.body.data.images.map(image => image.category)).toEqual(['potential_judgment']);

  const { execute } = require('../../config/database');
  const [images] = await execute(
    `SELECT category, deleted_at FROM payment_selection_image
     WHERE record_id = ? ORDER BY id`,
    [seeded.id]
  );
  expect(images.find(image => image.category === 'potential_judgment').deleted_at).toBeNull();
  expect(images.find(image => image.category === 'link_optimization').deleted_at).not.toBeNull();
  expect(images.find(image => image.category === 'adjustment_feedback').deleted_at).not.toBeNull();
  const [adjustments] = await execute(
    'SELECT id FROM payment_selection_adjustment WHERE record_id = ?',
    [seeded.id]
  );
  expect(adjustments).toHaveLength(0);
});

it('uses existing terminal reasons and preserves non-terminal historical edits', async () => {
  const { execute } = require('../../config/database');
  const unqualifiedSeed = await createRecordAtSummary(`INVALIDATE-POTENTIAL-${suffix}`);
  const unqualifiedReopened = await request(app)
    .post(`/api/payment-tracking/records/${unqualifiedSeed.id}/stages/testing/reopen`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ version: unqualifiedSeed.version });
  const unqualified = await request(app)
    .put(`/api/payment-tracking/records/${unqualifiedSeed.id}/stages/testing`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      version: unqualifiedReopened.body.data.version,
      confirmDownstreamInvalidation: true,
      data: {
        paidEnabled: true,
        potentialStatus: '不符合',
        unqualifiedAction: '直接关闭'
      }
    });
  expect(unqualified.body.data).toMatchObject({
    currentStage: 'testing',
    processStatus: 'ended',
    endType: 'unqualified',
    endReason: '未达潜力款 · 后续操作：直接关闭'
  });

  const continuingSeed = await createRecordAtSummary(`INVALIDATE-CONTINUE-${suffix}`);
  const continuingReopened = await request(app)
    .post(`/api/payment-tracking/records/${continuingSeed.id}/stages/testing/reopen`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ version: continuingSeed.version });
  const continuing = await request(app)
    .put(`/api/payment-tracking/records/${continuingSeed.id}/stages/testing`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      version: continuingReopened.body.data.version,
      data: { managerReportDate: '2026-08-30' }
    });
  expect(continuing.body.data).toMatchObject({
    currentStage: 'summary',
    processStatus: 'in_progress'
  });
  expect(continuing.body.data.stages.map(stage => stage.stageCode)).toEqual([
    'selection', 'testing', 'monitoring', 'summary'
  ]);
  expect(continuing.body.data.stageData.monitoring.linkStatus).toBe('keep_breaking');
  expect(continuing.body.data.stageData.summary.summaryText).toBe('旧总结');
  expect(continuing.body.data.linkStatus).toMatchObject({ stageCode: 'monitoring' });

  const emptyPaymentSeed = await createRecordAtSummary(`INVALIDATE-EMPTY-${suffix}`);
  await execute(
    'UPDATE payment_selection_testing SET paid_enabled = NULL WHERE record_id = ?',
    [emptyPaymentSeed.id]
  );
  const emptyPaymentReopened = await request(app)
    .post(`/api/payment-tracking/records/${emptyPaymentSeed.id}/stages/testing/reopen`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ version: emptyPaymentSeed.version });
  const emptyPaymentSaved = await request(app)
    .put(`/api/payment-tracking/records/${emptyPaymentSeed.id}/stages/testing`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      version: emptyPaymentReopened.body.data.version,
      data: { managerReportDate: '2026-08-31' }
    });
  expect(emptyPaymentSaved.body).toMatchObject({
    code: 0,
    data: { currentStage: 'summary', processStatus: 'in_progress' }
  });
});

it('ends at a reopened third stage without deleting third-stage-owned data', async () => {
  const seeded = await createRecordAtSummary(`INVALIDATE-MONITORING-${suffix}`);
  const reopened = await request(app)
    .post(`/api/payment-tracking/records/${seeded.id}/stages/monitoring/reopen`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ version: seeded.version });
  const ended = await request(app)
    .put(`/api/payment-tracking/records/${seeded.id}/stages/monitoring`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      version: reopened.body.data.version,
      confirmDownstreamInvalidation: true,
      data: { linkOptimized: false, linkStatus: 'protect_roi' }
    });
  expect(ended.body.data).toMatchObject({
    currentStage: 'monitoring',
    processStatus: 'ended',
    endStage: 'monitoring',
    endType: 'protect_roi',
    endReason: '链接状态：保投产'
  });
  expect(ended.body.data.stages.map(stage => stage.stageCode)).toEqual([
    'selection', 'testing', 'monitoring'
  ]);
  expect(ended.body.data.stageData.summary).toBeUndefined();
  expect(ended.body.data.stageData.monitoring.adjustments).toHaveLength(1);
  expect(ended.body.data.images.map(image => image.category)).toEqual(expect.arrayContaining([
    'potential_judgment', 'link_optimization', 'adjustment_feedback'
  ]));
  expect(ended.body.data.linkStatus).toMatchObject({ stageCode: 'monitoring' });
});

it('rolls back a historical stage save when downstream invalidation fails', async () => {
  const repository = require('../../services/payment-tracking/repository');
  const seeded = await createRecordAtSummary(`INVALIDATE-ROLLBACK-${suffix}`);
  const reopened = await request(app)
    .post(`/api/payment-tracking/records/${seeded.id}/stages/testing/reopen`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ version: seeded.version });
  const invalidateSpy = jest.spyOn(repository, 'invalidateStagesAfter')
    .mockRejectedValueOnce(new Error('forced downstream cleanup failure'));

  const failed = await request(app)
    .put(`/api/payment-tracking/records/${seeded.id}/stages/testing`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      version: reopened.body.data.version,
      confirmDownstreamInvalidation: true,
      data: { paidEnabled: false }
    });
  invalidateSpy.mockRestore();
  expect(failed.body.code).not.toBe(0);

  const unchanged = await request(app)
    .get(`/api/payment-tracking/records/${seeded.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(unchanged.body.data).toMatchObject({
    version: reopened.body.data.version,
    currentStage: 'summary',
    processStatus: 'in_progress'
  });
  expect(unchanged.body.data.stageData.testing.paidEnabled).toBe(true);
  expect(unchanged.body.data.stages.map(stage => stage.stageCode)).toEqual([
    'selection', 'testing', 'monitoring', 'summary'
  ]);
  expect(unchanged.body.data.stages.find(stage => stage.stageCode === 'testing').isReopened)
    .toBe(true);
  expect(unchanged.body.data.images).toHaveLength(3);
  expect(unchanged.body.data.linkStatus).toMatchObject({ stageCode: 'monitoring' });
});

it('keeps one editable stage-owned link status and allows explicit clearing before moving it', async () => {
  const { execute } = require('../../config/database');
  const created = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: `LINK-STATUS-${suffix}` });
  const linkRecordId = created.body.data.id;
  await execute(
    "UPDATE payment_selection_stage SET stage_status = 'completed' WHERE record_id = ? AND stage_code = 'selection'",
    [linkRecordId]
  );
  await execute(
    "INSERT INTO payment_selection_stage (record_id, stage_code, stage_status) VALUES (?, 'testing', 'active')",
    [linkRecordId]
  );
  await execute("UPDATE payment_selection_record SET current_stage = 'testing' WHERE id = ?", [linkRecordId]);

  const missingFlashGroup = await request(app)
    .put(`/api/payment-tracking/records/${linkRecordId}/stages/testing/link-status`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: created.body.data.version,
      data: { flashSaleRegistered: true }
    });
  expect(missingFlashGroup.body).toMatchObject({ code: 400 });

  const missingBurstMode = await request(app)
    .put(`/api/payment-tracking/records/${linkRecordId}/stages/testing/link-status`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: created.body.data.version,
      data: { productBurst: true }
    });
  expect(missingBurstMode.body).toMatchObject({ code: 400 });

  const savedTesting = await request(app)
    .put(`/api/payment-tracking/records/${linkRecordId}/stages/testing/link-status`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: created.body.data.version,
      data: {
        flashSaleRegistered: true,
        flashSaleGroup: 'new_product_cold_start',
        rapidOrderEntered: true,
        newProductOperationRegistered: true,
        newProductPeak: false,
        productBurst: true,
        productBurstMode: 'trade_price_for_volume'
      }
    });
  expect(savedTesting.body.code).toBe(0);
  expect(savedTesting.body.data.linkStatus).toMatchObject({
    stageCode: 'testing',
    flashSaleRegistered: true,
    flashSaleGroup: 'new_product_cold_start',
    rapidOrderEntered: true,
    newProductOperationRegistered: true,
    newProductPeak: false,
    productBurst: true,
    productBurstMode: 'trade_price_for_volume'
  });

  await execute(
    "UPDATE payment_selection_stage SET stage_status = 'completed', is_reopened = 0 WHERE record_id = ? AND stage_code = 'testing'",
    [linkRecordId]
  );
  await execute(
    "INSERT INTO payment_selection_stage (record_id, stage_code, stage_status) VALUES (?, 'monitoring', 'active')",
    [linkRecordId]
  );
  await execute('INSERT INTO payment_selection_monitoring (record_id) VALUES (?)', [linkRecordId]);
  await execute("UPDATE payment_selection_record SET current_stage = 'monitoring' WHERE id = ?", [linkRecordId]);

  const duplicateOwner = await request(app)
    .put(`/api/payment-tracking/records/${linkRecordId}/stages/monitoring/link-status`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: savedTesting.body.data.version,
      data: { newProductOperationRegistered: true }
    });
  expect(duplicateOwner.body).toMatchObject({ code: 400 });

  await execute(
    "UPDATE payment_selection_stage SET is_reopened = 1 WHERE record_id = ? AND stage_code = 'testing'",
    [linkRecordId]
  );
  const clearedTesting = await request(app)
    .put(`/api/payment-tracking/records/${linkRecordId}/stages/testing/link-status`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: savedTesting.body.data.version, clear: true });
  expect(clearedTesting.body).toMatchObject({ code: 0, data: { linkStatus: null } });

  const savedMonitoring = await request(app)
    .put(`/api/payment-tracking/records/${linkRecordId}/stages/monitoring/link-status`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: clearedTesting.body.data.version,
      data: {
        flashSaleRegistered: false,
        rapidOrderEntered: true,
        newProductOperationRegistered: true,
        newProductPeak: true,
        productBurst: true,
        productBurstMode: 'super_breakout'
      }
    });
  expect(savedMonitoring.body.code).toBe(0);
  expect(savedMonitoring.body.data.linkStatus).toMatchObject({
    stageCode: 'monitoring',
    flashSaleRegistered: false,
    flashSaleGroup: '',
    rapidOrderEntered: null,
    newProductOperationRegistered: true,
    newProductPeak: true,
    productBurst: true,
    productBurstMode: 'super_breakout'
  });

  const listed = await request(app)
    .get(`/api/payment-tracking/records?keyword=LINK-STATUS-${suffix}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(listed.body.data.list[0].linkStatus).toMatchObject({ stageCode: 'monitoring' });

  await execute(
    "UPDATE payment_selection_stage SET stage_status = 'completed' WHERE record_id = ? AND stage_code = 'monitoring'",
    [linkRecordId]
  );
  await execute(
    "INSERT INTO payment_selection_stage (record_id, stage_code, stage_status) VALUES (?, 'summary', 'active')",
    [linkRecordId]
  );
  await execute("UPDATE payment_selection_record SET current_stage = 'summary' WHERE id = ?", [linkRecordId]);
  const lockedHistorical = await request(app)
    .put(`/api/payment-tracking/records/${linkRecordId}/stages/monitoring/link-status`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      version: savedMonitoring.body.data.version,
      data: { productBurst: false }
    });
  expect(lockedHistorical.body).toMatchObject({ code: 403 });

  const forbidden = await request(app)
    .get(`/api/payment-tracking/records/${linkRecordId}`)
    .set('Authorization', `Bearer ${storeBToken}`);
  expect(forbidden.body.code).toBe(403);
});

it('migrates retired stages and clears obsolete payment data idempotently', async () => {
  const { execute, getMode } = require('../../config/database');
  const { migratePaymentTracking } = require('../../config/payment-tracking-migration');
  const baseSeq = Number(String(Date.now()).slice(-8));

  const [stoppedResult] = await execute(
    `INSERT INTO payment_selection_record
       (store, store_seq, planner_id, planner_name, source_task_no, style_number,
        current_stage, process_status, end_stage, end_type, end_reason)
     VALUES ('迁移店铺', ?, ?, '迁移人员', ?, 'LEGACY-STOPPED',
             'preparation', 'ended', 'preparation', 'manual', '旧阶段结束')`,
    [baseSeq, storeAUserId, `LEGACY-PAYMENT-STOPPED-${suffix}`]
  );
  const stoppedId = stoppedResult.insertId;
  await execute(
    `INSERT INTO payment_selection_stage (record_id, stage_code, stage_status)
     VALUES (?, 'selection', 'completed'), (?, 'preparation', 'ended')`,
    [stoppedId, stoppedId]
  );
  await execute(
    `INSERT INTO payment_selection_preparation
       (record_id, review_count, new_ops_registered, paid_enabled, paid_at)
     VALUES (?, 12, 1, 1, '2026-08-20 09:30:00')`,
    [stoppedId]
  );
  await execute(
    `INSERT INTO payment_selection_testing
       (record_id, car_promotion_method, car_clicks, car_ctr, car_qualifies,
        site_promotion_method, overall_visitors, search_visitors, buyers, average_ctr)
     VALUES (?, '旧直通车', 99, 3.21, 1, '旧全站', 1000, 500, 12, 2.22)`,
    [stoppedId]
  );

  const [advancedResult] = await execute(
    `INSERT INTO payment_selection_record
       (store, store_seq, planner_id, planner_name, source_task_no, style_number, current_stage)
     VALUES ('迁移店铺', ?, ?, '迁移人员', ?, 'LEGACY-ADVANCED', 'monitoring')`,
    [baseSeq + 1, storeAUserId, `LEGACY-PAYMENT-ADVANCED-${suffix}`]
  );
  const advancedId = advancedResult.insertId;
  await execute(
    `INSERT INTO payment_selection_stage (record_id, stage_code, stage_status)
     VALUES (?, 'selection', 'completed'), (?, 'preparation', 'completed'),
            (?, 'testing', 'completed'), (?, 'monitoring', 'active')`,
    [advancedId, advancedId, advancedId, advancedId]
  );
  await execute(
    `INSERT INTO payment_selection_monitoring
       (record_id, domestic_sales_count, added_reviews, abandoned, abandon_reason, abandon_at)
     VALUES (?, 8, 6, 1, '旧放弃原因', '2026-08-28 10:00:00')`,
    [advancedId]
  );
  await execute(
    `INSERT INTO payment_selection_adjustment
       (record_id, sort_order, reason, fee_ratio_7d, payers_7d, total_budget, detail_text, feedback_text)
     VALUES (?, 0, '旧调整', 18.8, 20, 500, '旧操作概述', '旧备注')`,
    [advancedId]
  );

  const [activeBreakoutResult] = await execute(
    `INSERT INTO payment_selection_record
       (store, store_seq, planner_id, planner_name, source_task_no, style_number, current_stage)
     VALUES ('迁移店铺', ?, ?, '迁移人员', ?, 'LEGACY-BREAKOUT-ACTIVE', 'breakout')`,
    [baseSeq + 2, storeAUserId, `LEGACY-PAYMENT-BREAKOUT-ACTIVE-${suffix}`]
  );
  const activeBreakoutId = activeBreakoutResult.insertId;
  await execute(
    `INSERT INTO payment_selection_stage (record_id, stage_code, stage_status)
     VALUES (?, 'selection', 'completed'), (?, 'testing', 'completed'),
            (?, 'monitoring', 'completed'), (?, 'breakout', 'active')`,
    [activeBreakoutId, activeBreakoutId, activeBreakoutId, activeBreakoutId]
  );
  await execute(
    `INSERT INTO payment_selection_breakout
       (record_id, pit_output_day1, strong_lift_qualified, detail_text)
     VALUES (?, 123.45, 1, '必须清空的原第5阶段数据')`,
    [activeBreakoutId]
  );

  const [endedBreakoutResult] = await execute(
    `INSERT INTO payment_selection_record
       (store, store_seq, planner_id, planner_name, source_task_no, style_number,
        current_stage, process_status, end_stage, end_type, end_reason)
     VALUES ('迁移店铺', ?, ?, '迁移人员', ?, 'LEGACY-BREAKOUT-ENDED',
             'breakout', 'ended', 'breakout', 'manual', '原第5阶段结束')`,
    [baseSeq + 3, storeAUserId, `LEGACY-PAYMENT-BREAKOUT-ENDED-${suffix}`]
  );
  const endedBreakoutId = endedBreakoutResult.insertId;
  await execute(
    `INSERT INTO payment_selection_stage (record_id, stage_code, stage_status)
     VALUES (?, 'selection', 'completed'), (?, 'testing', 'completed'),
            (?, 'monitoring', 'completed'), (?, 'breakout', 'ended')`,
    [endedBreakoutId, endedBreakoutId, endedBreakoutId, endedBreakoutId]
  );
  await execute(
    `INSERT INTO payment_selection_breakout (record_id, pit_output_day2, feedback_text)
     VALUES (?, 678.9, '也必须清空')`,
    [endedBreakoutId]
  );

  await migratePaymentTracking({ execute, mode: getMode() });
  await migratePaymentTracking({ execute, mode: getMode() });

  const [stoppedRows] = await execute(
    `SELECT current_stage, end_stage FROM payment_selection_record WHERE id = ?`,
    [stoppedId]
  );
  expect(stoppedRows[0]).toMatchObject({ current_stage: 'testing', end_stage: 'testing' });
  const [stoppedStages] = await execute(
    'SELECT stage_code, stage_status FROM payment_selection_stage WHERE record_id = ? ORDER BY id',
    [stoppedId]
  );
  expect(stoppedStages).toEqual([
    expect.objectContaining({ stage_code: 'selection' }),
    expect.objectContaining({ stage_code: 'testing', stage_status: 'ended' })
  ]);
  const [testingRows] = await execute(
    `SELECT paid_enabled, paid_at, promotion_method, car_clicks, site_promotion_method
     FROM payment_selection_testing WHERE record_id = ?`,
    [stoppedId]
  );
  expect(testingRows[0]).toMatchObject({
    paid_enabled: 1,
    paid_at: '2026-08-20 09:30:00',
    promotion_method: '',
    car_clicks: null,
    site_promotion_method: ''
  });

  const [advancedStages] = await execute(
    'SELECT stage_code FROM payment_selection_stage WHERE record_id = ? ORDER BY id',
    [advancedId]
  );
  expect(advancedStages.map(row => row.stage_code)).toEqual(['selection', 'testing', 'monitoring']);
  const [monitoringRows] = await execute(
    `SELECT link_status, domestic_sales_count, abandon_reason, abandon_at
     FROM payment_selection_monitoring WHERE record_id = ?`,
    [advancedId]
  );
  expect(monitoringRows[0]).toMatchObject({
    link_status: 'protect_roi',
    domestic_sales_count: null,
    abandon_reason: '',
    abandon_at: null
  });
  const [adjustments] = await execute(
    `SELECT client_key, fee_ratio_7d, payers_7d, total_budget, detail_text, feedback_text
     FROM payment_selection_adjustment WHERE record_id = ?`,
    [advancedId]
  );
  expect(adjustments[0]).toMatchObject({
    client_key: expect.stringMatching(/^legacy-/),
    fee_ratio_7d: null,
    payers_7d: null,
    total_budget: null,
    detail_text: '旧操作概述',
    feedback_text: '旧备注'
  });

  const [activeBreakoutRows] = await execute(
    'SELECT current_stage, end_stage FROM payment_selection_record WHERE id = ?',
    [activeBreakoutId]
  );
  expect(activeBreakoutRows[0]).toMatchObject({ current_stage: 'summary', end_stage: null });
  const [activeBreakoutStages] = await execute(
    'SELECT stage_code, stage_status FROM payment_selection_stage WHERE record_id = ? ORDER BY id',
    [activeBreakoutId]
  );
  expect(activeBreakoutStages).toEqual([
    expect.objectContaining({ stage_code: 'selection' }),
    expect.objectContaining({ stage_code: 'testing' }),
    expect.objectContaining({ stage_code: 'monitoring' }),
    expect.objectContaining({ stage_code: 'summary', stage_status: 'active' })
  ]);

  const [endedBreakoutRows] = await execute(
    'SELECT current_stage, end_stage FROM payment_selection_record WHERE id = ?',
    [endedBreakoutId]
  );
  expect(endedBreakoutRows[0]).toMatchObject({ current_stage: 'summary', end_stage: 'summary' });
  const [endedBreakoutStages] = await execute(
    'SELECT stage_code, stage_status FROM payment_selection_stage WHERE record_id = ? ORDER BY id',
    [endedBreakoutId]
  );
  expect(endedBreakoutStages).toEqual([
    expect.objectContaining({ stage_code: 'selection' }),
    expect.objectContaining({ stage_code: 'testing' }),
    expect.objectContaining({ stage_code: 'monitoring' }),
    expect.objectContaining({ stage_code: 'summary', stage_status: 'ended' })
  ]);
  const [remainingBreakoutStages] = await execute(
    "SELECT id FROM payment_selection_stage WHERE stage_code = 'breakout'"
  );
  expect(remainingBreakoutStages).toHaveLength(0);
  const [remainingBreakoutData] = await execute('SELECT record_id FROM payment_selection_breakout');
  expect(remainingBreakoutData).toHaveLength(0);
});
