const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { setupApp, getTmpDir } = require('./helpers/setup');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

let app;
let adminToken;
let applicantToken;
let managerAToken;
let managerBToken;
let managerWithoutStoreToken;
let subAdminToken;
let applicantId;
let adminId;
let managerAId;
let managerBId;
let subAdminId;
let globalReviewerId;
const suffix = Date.now();

async function login(username) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'test123456' });
  expect(response.body.code).toBe(0);
  return response.body.data.token;
}

async function createUser(data) {
  const response = await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ password: 'test123456', ...data });
  expect(response.body.code).toBe(0);
}

async function createPendingRecord(label) {
  const created = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${applicantToken}`)
    .send({ styleNumber: label });
  expect(created.body.code).toBe(0);

  const saved = await request(app)
    .put(`/api/payment-tracking/records/${created.body.data.id}/stages/selection`)
    .set('Authorization', `Bearer ${applicantToken}`)
    .send({
      version: created.body.data.version,
      data: {
        selectionDate: '2026-08-31 09:00:00',
        styleNumber: label,
        cost: 10,
        salePrice: 20,
        productId: `PRODUCT-${label}`,
        selectionMethod: '方式一：通过类目飙升热搜词选品',
        listingDate: '2026-08-31 10:00:00',
        listingCategory: '测试类目'
      }
    });
  expect(saved.body.code).toBe(0);

  const imageRoot = path.join(getTmpDir(), 'manager-review-images');
  fs.mkdirSync(imageRoot, { recursive: true });
  const relativePath = `${label}.png`;
  fs.writeFileSync(path.join(imageRoot, relativePath), PNG);
  const { execute } = require('../../config/database');
  await execute(
    `INSERT INTO payment_selection_image
       (record_id, category, storage_root, relative_path, original_name, mime_type, file_size)
     VALUES (?, 'product_main', '.', ?, 'manager-review.png', 'image/png', 1)`,
    [created.body.data.id, relativePath]
  );
  await execute(
    'UPDATE payment_selection_image SET storage_root = ? WHERE record_id = ? AND relative_path = ?',
    [imageRoot, created.body.data.id, relativePath]
  );

  const advanced = await request(app)
    .post(`/api/payment-tracking/records/${created.body.data.id}/advance`)
    .set('Authorization', `Bearer ${applicantToken}`)
    .send({ version: saved.body.data.version, stageCode: 'selection' });
  expect(advanced.body.code).toBe(0);
  return advanced.body.data;
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();
  adminToken = (await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })).body.data.token;

  const usernames = {
    applicant: `manager_review_applicant_${suffix}`,
    managerA: `manager_review_a_${suffix}`,
    managerB: `manager_review_b_${suffix}`,
    managerWithoutStore: `manager_review_no_store_${suffix}`,
    subAdmin: `manager_review_sub_${suffix}`,
    globalReviewer: `manager_review_global_${suffix}`
  };
  await createUser({ username: usernames.applicant, realName: '申请人', role: 'operator', store: '审核A店', isStoreManager: false });
  await createUser({ username: usernames.managerA, realName: 'A店店长', role: 'operator', store: '审核A店', isStoreManager: true });
  await createUser({ username: usernames.managerB, realName: 'B店店长', role: 'operator', store: '审核B店', isStoreManager: true });
  await createUser({ username: usernames.managerWithoutStore, realName: '未配置店铺店长', role: 'operator', store: '审核B店', isStoreManager: true });
  await createUser({ username: usernames.subAdmin, realName: '子管理员', role: 'sub_admin' });
  await createUser({ username: usernames.globalReviewer, realName: '全店铺审核人', role: 'operator', store: '审核B店', isStoreManager: false });

  const users = await request(app)
    .get('/api/user/list?pageSize=100')
    .set('Authorization', `Bearer ${adminToken}`);
  const byName = new Map(users.body.data.list.map(user => [user.username, user]));
  adminId = byName.get('admin').id;
  applicantId = byName.get(usernames.applicant).id;
  managerAId = byName.get(usernames.managerA).id;
  managerBId = byName.get(usernames.managerB).id;
  subAdminId = byName.get(usernames.subAdmin).id;
  globalReviewerId = byName.get(usernames.globalReviewer).id;
  const managerWithoutStoreId = byName.get(usernames.managerWithoutStore).id;
  await request(app)
    .post('/api/user/permissions/save')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      userId: applicantId,
      permissions: ['payment.selection.view', 'payment.records.view', 'payment.delete', 'payment.stage_reopen'],
      deniedPermissions: []
    });
  await request(app)
    .post('/api/user/permissions/save')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      userId: globalReviewerId,
      permissions: ['payment.manage.all'],
      deniedPermissions: []
    });

  const { execute } = require('../../config/database');
  await execute("INSERT INTO payment_listing_category (name, sort_order, active) VALUES ('测试类目', 1, 1)");
  await execute('UPDATE sys_user SET store = ? WHERE id = ?', ['', managerWithoutStoreId]);

  applicantToken = await login(usernames.applicant);
  managerAToken = await login(usernames.managerA);
  managerBToken = await login(usernames.managerB);
  managerWithoutStoreToken = await login(usernames.managerWithoutStore);
  subAdminToken = await login(usernames.subAdmin);
}, 30000);

it('creates a store-scoped active request and locks normal workflow writes', async () => {
  const pending = await createPendingRecord(`PENDING-${suffix}`);
  expect(pending).toMatchObject({
    currentStage: 'testing',
    processStatus: 'in_progress',
    managerReviewPending: true
  });
  expect(pending.allowedActions).toMatchObject({ edit: false, advance: false, end: false, reopen: false });

  const list = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${managerAToken}`);
  expect(list.body.code).toBe(0);
  const review = list.body.data.list.find(item => Number(item.recordId) === Number(pending.id));
  expect(review).toMatchObject({ store: '审核A店', applicantId, requestVersion: pending.version });

  const { execute } = require('../../config/database');
  const [requestNotifications] = await execute(
    `SELECT user_id FROM sys_notification
     WHERE type = 'payment_manager_review' AND content LIKE ?`,
    [`%PENDING-${suffix}%`]
  );
  const notifiedUserIds = requestNotifications.map(item => Number(item.user_id));
  expect(notifiedUserIds).toEqual(expect.arrayContaining([
    Number(adminId),
    Number(managerAId),
    Number(subAdminId),
    Number(globalReviewerId)
  ]));
  expect(notifiedUserIds).not.toContain(Number(managerBId));
  expect(notifiedUserIds).not.toContain(Number(applicantId));

  const detail = await request(app)
    .get(`/api/payment-tracking/manager-reviews/${review.id}`)
    .set('Authorization', `Bearer ${managerAToken}`);
  expect(detail.body.code).toBe(0);
  const imageId = detail.body.data.record.images.find(image => image.category === 'product_main').id;
  const managerPreview = await request(app)
    .get(`/api/payment-tracking/images/${imageId}/preview`)
    .set('Authorization', `Bearer ${managerAToken}`);
  expect(managerPreview.status).toBe(200);
  expect(managerPreview.headers['content-type']).toMatch(/^image\/png/);

  const crossStorePreview = await request(app)
    .get(`/api/payment-tracking/images/${imageId}/preview`)
    .set('Authorization', `Bearer ${managerBToken}`);
  expect(crossStorePreview.body.code).toBe(403);

  const crossStoreList = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${managerBToken}`);
  expect(crossStoreList.body.data.list.some(item => Number(item.recordId) === Number(pending.id))).toBe(false);

  const forbiddenDetail = await request(app)
    .get(`/api/payment-tracking/manager-reviews/${review.id}`)
    .set('Authorization', `Bearer ${managerBToken}`);
  expect(forbiddenDetail.body.code).toBe(403);

  const forbiddenApplicantList = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${applicantToken}`);
  expect(forbiddenApplicantList.body.code).toBe(403);

  const unscopedManagerList = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${managerWithoutStoreToken}`);
  expect(unscopedManagerList.body.code).toBe(403);

  const globalList = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${subAdminToken}`);
  expect(globalList.body.data.list.some(item => Number(item.recordId) === Number(pending.id))).toBe(true);

  const lockedSave = await request(app)
    .put(`/api/payment-tracking/records/${pending.id}/stages/testing`)
    .set('Authorization', `Bearer ${applicantToken}`)
    .send({ version: pending.version, data: { potentialStatus: '不符合' } });
  expect(lockedSave.body.code).toBe(403);

  const lockedImage = await request(app)
    .post(`/api/payment-tracking/records/${pending.id}/images/potential_judgment`)
    .set('Authorization', `Bearer ${applicantToken}`)
    .field('version', String(pending.version))
    .attach('files', PNG, { filename: 'locked.png', contentType: 'image/png' });
  expect(lockedImage.body.code).toBe(403);

  const missingPaidAt = await request(app)
    .post(`/api/payment-tracking/manager-reviews/${review.id}/approve`)
    .set('Authorization', `Bearer ${managerAToken}`)
    .send({ requestVersion: review.requestVersion });
  expect(missingPaidAt.body.code).toBe(400);

  const approved = await request(app)
    .post(`/api/payment-tracking/manager-reviews/${review.id}/approve`)
    .set('Authorization', `Bearer ${managerAToken}`)
    .send({ requestVersion: review.requestVersion, paidAt: '2026-08-31 12:30:00' });
  expect(approved.body).toMatchObject({
    code: 0,
    data: {
      managerReviewPending: false,
      processStatus: 'in_progress',
      stageData: { testing: { paidEnabled: true, paidAt: '2026-08-31 12:30:00' } }
    }
  });

  const previewAfterDecision = await request(app)
    .get(`/api/payment-tracking/images/${imageId}/preview`)
    .set('Authorization', `Bearer ${managerAToken}`);
  expect(previewAfterDecision.body.code).toBe(403);

  const [approvalNotifications] = await execute(
    `SELECT id FROM sys_notification
     WHERE user_id = ? AND type = 'payment_manager_review' AND content LIKE ?`,
    [applicantId, `%PENDING-${suffix}%`]
  );
  expect(approvalNotifications).toHaveLength(1);

  const secondDecision = await request(app)
    .post(`/api/payment-tracking/manager-reviews/${review.id}/reject`)
    .set('Authorization', `Bearer ${managerAToken}`)
    .send({ requestVersion: review.requestVersion });
  expect(secondDecision.body.code).toBe(409);

  const applicantSave = await request(app)
    .put(`/api/payment-tracking/records/${pending.id}/stages/testing`)
    .set('Authorization', `Bearer ${applicantToken}`)
    .send({ version: approved.body.data.version, data: { potentialStatus: '不符合' } });
  expect(applicantSave.body.code).toBe(0);
});

it('rejects, removes the active row, and creates a fresh request on restore', async () => {
  const pending = await createPendingRecord(`REJECT-${suffix}`);
  const list = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${managerAToken}`);
  const review = list.body.data.list.find(item => Number(item.recordId) === Number(pending.id));

  const rejected = await request(app)
    .post(`/api/payment-tracking/manager-reviews/${review.id}/reject`)
    .set('Authorization', `Bearer ${managerAToken}`)
    .send({ requestVersion: review.requestVersion });
  expect(rejected.body).toMatchObject({
    code: 0,
    data: {
      processStatus: 'ended',
      endStage: 'testing',
      endType: 'payment_not_enabled',
      endReason: '店长未确认开启付费',
      managerReviewPending: false,
      stageData: { testing: { paidEnabled: false, paidAt: null } }
    }
  });

  const { execute } = require('../../config/database');
  const [rejectionNotifications] = await execute(
    `SELECT id FROM sys_notification
     WHERE user_id = ? AND type = 'payment_manager_review' AND content LIKE ?`,
    [applicantId, `%REJECT-${suffix}%`]
  );
  expect(rejectionNotifications).toHaveLength(1);

  const afterReject = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${managerAToken}`);
  expect(afterReject.body.data.list.some(item => Number(item.recordId) === Number(pending.id))).toBe(false);

  const restored = await request(app)
    .post(`/api/payment-tracking/records/${pending.id}/restore`)
    .set('Authorization', `Bearer ${applicantToken}`)
    .send({ version: rejected.body.data.version });
  expect(restored.body).toMatchObject({
    code: 0,
    data: {
      processStatus: 'in_progress',
      currentStage: 'testing',
      managerReviewPending: true,
      stageData: { testing: { paidEnabled: null, paidAt: null } }
    }
  });

  const freshList = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${managerAToken}`);
  const fresh = freshList.body.data.list.find(item => Number(item.recordId) === Number(pending.id));
  expect(fresh).toBeDefined();
  expect(fresh.id).not.toBe(review.id);

  const deleted = await request(app)
    .delete(`/api/payment-tracking/records/${pending.id}`)
    .set('Authorization', `Bearer ${applicantToken}`)
    .send({ version: restored.body.data.version });
  expect(deleted.body.code).toBe(0);

  const afterDelete = await request(app)
    .get('/api/payment-tracking/manager-reviews')
    .set('Authorization', `Bearer ${managerAToken}`);
  expect(afterDelete.body.data.list.some(item => Number(item.recordId) === Number(pending.id))).toBe(false);
});
