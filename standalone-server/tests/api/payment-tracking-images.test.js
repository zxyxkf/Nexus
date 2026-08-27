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
let designImageConfigId;
let imageRoot;
let sourceRoot;
let storeAUserId;

const suffix = Date.now();

async function login(username) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'test123456' });
  return response.body.data.token;
}

async function updateImageRoot(value) {
  return updateConfig(imageConfigId, value);
}

async function updateConfig(id, value) {
  const response = await request(app)
    .put('/api/config/update')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ id, configValue: value });
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
  storeAUserId = byName.get(users[0].username).id;
  for (const user of users) {
    await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: byName.get(user.username).id,
        permissions: user === users[0]
          ? ['payment.selection.view', 'payment.open']
          : ['payment.selection.view'],
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
  designImageConfigId = configs.body.data.find(
    config => config.config_key === 'upload.design_images_dir'
  ).id;
  imageRoot = path.join(getTmpDir(), 'payment-images');
  sourceRoot = path.join(getTmpDir(), 'task-images');
  await updateImageRoot(imageRoot);
  await updateConfig(designImageConfigId, sourceRoot);

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

it('opens payment tracking from task images and reports batch skip reasons', async () => {
  const { execute } = require('../../config/database');
  fs.mkdirSync(sourceRoot, { recursive: true });

  async function createTask(taskNo, options = {}) {
    const [result] = await execute(
      `INSERT INTO task_info
         (task_no, title, status, publisher_id, publisher_name, style_number, task_group)
       VALUES (?, ?, 'doing', ?, ?, ?, 'design')`,
      [
        taskNo,
        `开启打款测试 ${taskNo}`,
        options.publisherId ?? storeAUserId,
        options.publisherName || '图片A店运营',
        options.styleNumber || `${taskNo}-STYLE`
      ]
    );
    const taskId = result.insertId;
    for (const file of options.files || []) {
      if (!file.missing) fs.writeFileSync(path.join(sourceRoot, file.name), PNG);
      await execute(
        `INSERT INTO task_file
           (task_id, file_name, file_path, file_size, file_type, mime_type, uploader_id, file_category)
         VALUES (?, ?, ?, ?, 'image', 'image/png', ?, 'work')`,
        [taskId, file.name, `design/images/${file.name}`, PNG.length, storeAUserId]
      );
    }
    return taskId;
  }

  const [admins] = await execute("SELECT id FROM sys_user WHERE username = 'admin'");
  const multiImageTask = await createTask('PAY-OPEN-1', {
    styleNumber: 'STYLE-100',
    files: [{ name: 'open-1.png' }, { name: 'open-2.png' }]
  });
  const noImageTask = await createTask('PAY-OPEN-2');
  const noStoreTask = await createTask('PAY-OPEN-3', {
    publisherId: admins[0].id,
    publisherName: '管理员',
    files: [{ name: 'open-no-store.png' }]
  });
  const missingImageTask = await createTask('PAY-OPEN-4', {
    files: [{ name: 'missing-source.png', missing: true }]
  });
  const goodBatchTask = await createTask('PAY-OPEN-5', {
    files: [{ name: 'open-batch.png' }]
  });

  const [beforeRows] = await execute('SELECT status FROM task_info WHERE id = ?', [multiImageTask]);
  const openedResponse = await request(app)
    .post(`/api/payment-tracking/open/task/${multiImageTask}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(openedResponse.body.code).toBe(0);
  expect(openedResponse.body.data).toMatchObject({
    plannerId: storeAUserId,
    store: '图片A店',
    styleNumber: 'STYLE-100',
    sourceTaskId: multiImageTask,
    sourceTaskNo: 'PAY-OPEN-1'
  });
  expect(openedResponse.body.data.images).toHaveLength(2);

  const reviewList = await request(app)
    .get('/api/task/my-published?taskGroup=design&status=doing&pageSize=100')
    .set('Authorization', `Bearer ${adminToken}`);
  const openedTask = reviewList.body.data.list.find(task => Number(task.id) === Number(multiImageTask));
  expect(openedTask).toMatchObject({ payment_tracking_opened: 1 });

  const duplicate = await request(app)
    .post(`/api/payment-tracking/open/task/${multiImageTask}`)
    .set('Authorization', `Bearer ${storeAToken}`);
  expect(duplicate.body.data).toMatchObject({
    id: openedResponse.body.data.id,
    alreadyOpened: true
  });

  const batch = await request(app)
    .post('/api/payment-tracking/open/batch')
    .set('Authorization', `Bearer ${storeAToken}`)
    .send({
      taskIds: [multiImageTask, noImageTask, noStoreTask, missingImageTask, goodBatchTask]
    });
  expect(batch.body.data).toMatchObject({ successCount: 1, skippedCount: 4 });
  expect(batch.body.data.skipped.map(item => item.reason)).toEqual(expect.arrayContaining([
    '已开启打款',
    '没有作品图片',
    '任务发布人未绑定店铺',
    '图片复制失败'
  ]));

  const [afterRows] = await execute('SELECT status FROM task_info WHERE id = ?', [multiImageTask]);
  expect(afterRows[0].status).toBe(beforeRows[0].status);
});
