const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;
let storeAToken;
let storeBToken;
let noPermissionToken;
let recordsOnlyToken;
let storeAUserId;

const suffix = Date.now();
const users = {
  storeA: `payment_a_${suffix}`,
  storeB: `payment_b_${suffix}`,
  noPermission: `payment_none_${suffix}`,
  recordsOnly: `payment_records_${suffix}`
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
    [users.recordsOnly, 'A店']
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

  storeAToken = await login(users.storeA);
  storeBToken = await login(users.storeB);
  noPermissionToken = await login(users.noPermission);
  recordsOnlyToken = await login(users.recordsOnly);
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
