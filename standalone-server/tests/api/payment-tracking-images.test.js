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
let storeAToken;
let storeBToken;
let recordId;
let imageConfigId;
let imageRoot;

const suffix = Date.now();

async function login(username) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'test123456' });
  return response.body.data.token;
}

async function updateImageRoot(value) {
  const response = await request(app)
    .put('/api/config/update')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ id: imageConfigId, configValue: value });
  expect(response.body.code).toBe(0);
}

function countFiles(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const fullPath = path.join(dir, entry.name);
    return total + (entry.isDirectory() ? countFiles(fullPath) : 1);
  }, 0);
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();

  adminToken = (await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })).body.data.token;

  const users = [
    { username: `image_a_${suffix}`, store: '图片A店' },
    { username: `image_b_${suffix}`, store: '图片B店' }
  ];
  for (const user of users) {
    await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...user, password: 'test123456', realName: user.username, role: 'operator' });
  }

  const list = await request(app)
    .get('/api/user/list?role=operator&pageSize=100')
    .set('Authorization', `Bearer ${adminToken}`);
  const byName = new Map(list.body.data.list.map(user => [user.username, user]));
  for (const user of users) {
    await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: byName.get(user.username).id,
        permissions: ['payment.selection.view'],
        deniedPermissions: []
      });
  }
  storeAToken = await login(users[0].username);
  storeBToken = await login(users[1].username);

  const configs = await request(app)
    .get('/api/config/list?group=upload')
    .set('Authorization', `Bearer ${adminToken}`);
  imageConfigId = configs.body.data.find(
    config => config.config_key === 'upload.payment_tracking_images_dir'
  ).id;
  imageRoot = path.join(getTmpDir(), 'payment-images');
  await updateImageRoot(imageRoot);

  const created = await request(app)
    .post('/api/payment-tracking/records')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ styleNumber: 'IMG-100' });
  recordId = created.body.data.id;
}, 30000);

it('uploads, previews, reorders and soft deletes independently stored images', async () => {
  const productUpload = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/images/product_main`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .attach('files', PNG, { filename: 'one.png', contentType: 'image/png' })
    .attach('files', PNG, { filename: 'two.png', contentType: 'image/png' });
  expect(productUpload.body.code).toBe(0);
  const productImages = productUpload.body.data.images.filter(image => image.category === 'product_main');
  expect(productImages.map(image => image.sortOrder)).toEqual([0, 1]);
  expect(countFiles(imageRoot)).toBe(2);

  const detailUpload = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/images/detail_screenshot`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .attach('files', PNG, { filename: 'detail.png', contentType: 'image/png' });
  expect(detailUpload.body.data.images.some(image => image.category === 'detail_screenshot')).toBe(true);

  const competitorUpload = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/images/competitor`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .attach('files', PNG, { filename: 'competitor.png', contentType: 'image/png' });
  expect(competitorUpload.body.data.images.some(image => image.category === 'competitor')).toBe(true);

  const firstId = productImages[0].id;
  const secondId = productImages[1].id;
  const preview = await request(app)
    .get(`/api/payment-tracking/images/${firstId}/preview`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(preview.status).toBe(200);
  expect(preview.headers['content-type']).toMatch(/^image\/png/);

  const forbiddenPreview = await request(app)
    .get(`/api/payment-tracking/images/${firstId}/preview`)
    .set('Authorization', `Bearer ${storeBToken}`);
  expect(forbiddenPreview.body.code).toBe(403);

  const reordered = await request(app)
    .put(`/api/payment-tracking/records/${recordId}/images/order`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({ imageIds: [secondId, firstId] });
  expect(reordered.body.data.images.filter(image => image.category === 'product_main').map(image => image.id))
    .toEqual([secondId, firstId]);

  const filesBeforeDelete = countFiles(imageRoot);
  const deleted = await request(app)
    .delete(`/api/payment-tracking/records/${recordId}/images/${firstId}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(deleted.body.code).toBe(0);
  expect(deleted.body.data.images.some(image => image.id === firstId)).toBe(false);
  expect(countFiles(imageRoot)).toBe(filesBeforeDelete);
});

it('rejects non-images and rolls back when the configured directory is not writable', async () => {
  const before = await request(app)
    .get(`/api/payment-tracking/records/${recordId}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  const beforeCount = before.body.data.images.length;

  const nonImage = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/images/product_main`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .attach('files', Buffer.from('not an image'), { filename: 'note.txt', contentType: 'text/plain' });
  expect(nonImage.body.code).toBe(400);

  const blockedRoot = path.join(getTmpDir(), 'blocked-payment-root');
  fs.writeFileSync(blockedRoot, 'this is a file, not a directory');
  await updateImageRoot(blockedRoot);
  const failed = await request(app)
    .post(`/api/payment-tracking/records/${recordId}/images/product_main`)
    .set('Authorization', `Bearer ${storeAToken}`)
    .attach('files', PNG, { filename: 'will-fail.png', contentType: 'image/png' });
  expect(failed.body.code).not.toBe(0);

  const after = await request(app)
    .get(`/api/payment-tracking/records/${recordId}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(after.body.data.images).toHaveLength(beforeCount);

  await updateImageRoot(imageRoot);
});
