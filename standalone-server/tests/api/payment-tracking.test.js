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
let storeAUserId;

const suffix = Date.now();
const users = {
  storeA: `payment_a_${suffix}`,
  storeB: `payment_b_${suffix}`,
  noPermission: `payment_none_${suffix}`,
  recordsOnly: `payment_records_${suffix}`,
  manager: `payment_manager_${suffix}`,
  reopener: `payment_reopener_${suffix}`
};

async function login(username) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'test123456' });
  return response.body.data.token;
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
    [users.reopener, 'A店']
  ]) {
    await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'test123456', realName: username, role: 'operator', store });
  }

  const list = await request(app)
    .get('/api/user/list?role=operator&pageSize=100')
    .set('Authorization', `Bearer ${adminToken}`);
  const byName = new Map(list.body.data.list.map(user => [user.username, user]));
  storeAUserId = byName.get(users.storeA).id;

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
      userId: byName.get(users.manager).id,
      permissions: ['payment.selection.view', 'payment.manager_review'],
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

  const deleted = await request(app)
    .delete(`/api/payment-tracking/records/${created.body.data.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(deleted.body.code).toBe(0);

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

  const preparation = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: 2, stageCode: 'selection' });
  expect(preparation.body.data.currentStage).toBe('preparation');
  expect(preparation.body.data.stages.map(stage => stage.stageCode)).toEqual(['selection', 'preparation']);

  const plannerCannotReview = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/preparation`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: 3, data: { paidEnabled: true, paidAt: '2026-09-01' } });
  expect(plannerCannotReview.body.code).toBe(403);

  const reviewed = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/preparation`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({
      version: 3,
      data: { reviewCount: 6, newOpsRegistered: true, paidEnabled: true, paidAt: '2026-09-01' }
    });
  expect(reviewed.body.data.version).toBe(4);

  const testing = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ version: 4, stageCode: 'preparation' });
  expect(testing.body.data.currentStage).toBe('testing');

  const unqualified = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/testing`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: 5, data: { potentialStatus: '不符合', unqualifiedAction: '直接关闭' } });
  const blockedTesting = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: unqualified.body.data.version, stageCode: 'testing' });
  expect(blockedTesting.body.code).toBe(400);

  const testingDetail = await request(app)
    .get(`/api/payment-tracking/records/${recordId}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(testingDetail.body.data.stages.map(stage => stage.stageCode)).toEqual([
    'selection', 'preparation', 'testing'
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

  const invalidAbandon = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/monitoring`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: monitoring.body.data.version, data: { abandoned: true } });
  expect(invalidAbandon.body.code).toBe(400);

  const monitored = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/monitoring`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: monitoring.body.data.version, data: { abandoned: false, domesticSalesCount: 10 } });
  const breakout = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: monitored.body.data.version, stageCode: 'monitoring' });
  expect(breakout.body.data.currentStage).toBe('breakout');

  const undecidedBreakout = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: breakout.body.data.version, stageCode: 'breakout' });
  expect(undecidedBreakout.body.code).toBe(400);

  const breakoutSaved = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/breakout`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: breakout.body.data.version, data: { strongLiftQualified: false } });
  const summary = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/advance`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: breakoutSaved.body.data.version, stageCode: 'breakout' });
  expect(summary.body.data.currentStage).toBe('summary');

  const summarySaved = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/stages/summary`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ version: summary.body.data.version, data: {} });
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
