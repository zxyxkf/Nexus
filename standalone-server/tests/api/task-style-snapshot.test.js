const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { setupApp, getTmpDir } = require('./helpers/setup');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z9xkAAAAASUVORK5CYII=',
  'base64'
);

let app;
let execute;
let adminToken;
let csToken;
let csUserId;
let styleId;
let otherStyleId;
let styleImages;
let otherStyleImage;
let missingSourceImage;
let taskSequence = 0;

async function updateUploadConfig(key, value) {
  const list = await request(app)
    .get('/api/config/list?group=upload')
    .set('Authorization', `Bearer ${adminToken}`);
  const config = list.body.data.find(item => item.config_key === key);
  expect(config).toBeDefined();
  const response = await request(app)
    .put('/api/config/update')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ id: config.id, configValue: value });
  expect(response.body.code).toBe(0);
}

async function createUser() {
  const username = `style_snapshot_cs_${Date.now()}`;
  const created = await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: 'test123456', realName: '快照客服', role: 'cs_agent' });
  expect(created.body.code).toBe(0);

  const users = await request(app)
    .get('/api/user/list?role=cs_agent&pageSize=100')
    .set('Authorization', `Bearer ${adminToken}`);
  csUserId = users.body.data.list.find(user => user.username === username).id;

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'test123456' });
  expect(login.body.code).toBe(0);
  csToken = login.body.data.token;
}

async function createStyle(productName, styleName, imageNames) {
  const product = await request(app)
    .post('/api/material-library/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: productName });
  expect(product.body.code).toBe(0);

  const style = await request(app)
    .post(`/api/material-library/products/${product.body.data.id}/styles`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: styleName });
  expect(style.body.code).toBe(0);

  let upload = request(app)
    .post(`/api/material-library/styles/${style.body.data.id}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .field('originalNames', JSON.stringify(imageNames));
  imageNames.forEach(name => {
    upload = upload.attach('files', PNG, { filename: name, contentType: 'image/png' });
  });
  const uploaded = await upload;
  expect(uploaded.body.code).toBe(0);
  return { style: style.body.data, images: uploaded.body.data };
}

async function createCsTask(status = 'wait') {
  taskSequence += 1;
  const response = await request(app)
    .post('/api/task/create')
    .set('Authorization', `Bearer ${csToken}`)
    .send({
      title: `款式快照任务${taskSequence}`,
      description: '款式图接口测试',
      score: 1,
      taskGroup: 'cs'
    });
  expect(response.body.code).toBe(0);
  const taskId = response.body.data.id;
  if (status !== 'wait') await execute('UPDATE task_info SET status = ? WHERE id = ?', [status, taskId]);
  return taskId;
}

function snapshotRequest(taskId, manifest) {
  return request(app)
    .post('/api/task/style-snapshots')
    .set('Authorization', `Bearer ${csToken}`)
    .field('taskId', String(taskId))
    .field('materialStyleId', String(styleId))
    .field('manifest', JSON.stringify(manifest));
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();
  ({ execute } = require('../../config/database'));

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = login.body.data.token;

  const materialDir = path.join(getTmpDir(), 'material-library');
  const csImageDir = path.join(getTmpDir(), 'cs-images');
  await updateUploadConfig('upload.material_library_dir', materialDir);
  await updateUploadConfig('upload.cs_images_dir', csImageDir);
  await createUser();

  const primary = await createStyle('快照商品库', '快照款式', ['原图A.png', '原图B.png', '缺失源图.png']);
  styleId = primary.style.id;
  styleImages = primary.images.slice(0, 2);
  missingSourceImage = primary.images[2];

  const secondary = await createStyle('其他商品库', '其他款式', ['其他款式.png']);
  otherStyleId = secondary.style.id;
  otherStyleImage = secondary.images[0];
}, 30000);

test('copies originals and edited PNGs in manifest order', async () => {
  const taskId = await createCsTask();
  const manifest = [
    { materialImageId: styleImages[0].id, position: 0, editedField: '' },
    { materialImageId: styleImages[1].id, position: 1, editedField: `edited-${styleImages[1].id}` }
  ];

  const response = await snapshotRequest(taskId, manifest)
    .attach(`edited-${styleImages[1].id}`, PNG, { filename: '原图B-效果图.png', contentType: 'image/png' });

  expect(response.body).toMatchObject({ code: 0, data: { copied: 2, edited: 1 } });
  const [files] = await execute(
    "SELECT file_name, file_category FROM task_file WHERE task_id = ? ORDER BY id ASC",
    [taskId]
  );
  expect(files).toEqual([
    expect.objectContaining({ file_name: '原图A.png', file_category: 'style' }),
    expect.objectContaining({ file_name: '原图B-效果图.png', file_category: 'style' })
  ]);
});
test('does not change accepted task status while saving style files', async () => {
  const taskId = await createCsTask('accepted');
  const response = await snapshotRequest(taskId, [
    { materialImageId: styleImages[0].id, position: 0, editedField: '' }
  ]);

  expect(response.body.code).toBe(0);
  const [rows] = await execute('SELECT status FROM task_info WHERE id = ?', [taskId]);
  expect(rows[0].status).toBe('accepted');
});

test('rejects material images from another style', async () => {
  const taskId = await createCsTask();
  const response = await snapshotRequest(taskId, [
    { materialImageId: otherStyleImage.id, position: 0, editedField: '' }
  ]);

  expect(response.body.code).toBe(400);
  const [files] = await execute("SELECT id FROM task_file WHERE task_id = ? AND file_category = 'style'", [taskId]);
  expect(files).toHaveLength(0);
  expect(otherStyleId).not.toBe(styleId);
});

test('rolls back records and disk files when one manifest item fails', async () => {
  const taskId = await createCsTask();
  const { resolvePath, getStorageDir } = require('../../utils/share');
  const [missingRows] = await execute('SELECT file_path FROM material_image WHERE id = ?', [missingSourceImage.id]);
  fs.unlinkSync(resolvePath(missingRows[0].file_path));
  const csImageDir = getStorageDir('cs', 'images');
  const before = fs.existsSync(csImageDir) ? fs.readdirSync(csImageDir, { recursive: true }).sort() : [];

  const response = await snapshotRequest(taskId, [
    { materialImageId: styleImages[0].id, position: 0, editedField: '' },
    { materialImageId: missingSourceImage.id, position: 1, editedField: '' }
  ]);

  expect(response.body.code).toBe(404);
  const [files] = await execute("SELECT id FROM task_file WHERE task_id = ? AND file_category = 'style'", [taskId]);
  expect(files).toHaveLength(0);
  const after = fs.existsSync(csImageDir) ? fs.readdirSync(csImageDir, { recursive: true }).sort() : [];
  expect(after).toEqual(before);
});

test('publishes a task and its reference and style files as one operation', async () => {
  const title = `原子发布成功-${Date.now()}`;
  const response = await request(app)
    .post('/api/task/publish')
    .set('Authorization', `Bearer ${csToken}`)
    .field('taskPayload', JSON.stringify({ title, taskGroup: 'cs', score: 1 }))
    .field('referenceOriginalNames', JSON.stringify(['参考图.png']))
    .field('materialStyleId', String(styleId))
    .field('styleManifest', JSON.stringify([
      { materialImageId: styleImages[0].id, position: 0, editedField: '' }
    ]))
    .attach('references', PNG, { filename: 'nexus-upload-1.png', contentType: 'image/png' });

  expect(response.body.code).toBe(0);
  const [tasks] = await execute('SELECT id, status FROM task_info WHERE title = ?', [title]);
  expect(tasks).toHaveLength(1);
  const [files] = await execute(
    'SELECT file_name, file_category FROM task_file WHERE task_id = ? ORDER BY id',
    [tasks[0].id]
  );
  expect(files).toEqual([
    expect.objectContaining({ file_name: '参考图.png', file_category: 'reference' }),
    expect.objectContaining({ file_category: 'style' })
  ]);
});

test('does not leave a task or files when atomic publish cannot copy a material image', async () => {
  const title = `原子发布回滚-${Date.now()}`;
  const { getStorageDir } = require('../../utils/share');
  const csImageDir = getStorageDir('cs', 'images');
  const before = fs.existsSync(csImageDir) ? fs.readdirSync(csImageDir, { recursive: true }).sort() : [];

  const response = await request(app)
    .post('/api/task/publish')
    .set('Authorization', `Bearer ${csToken}`)
    .field('taskPayload', JSON.stringify({ title, taskGroup: 'cs', score: 1 }))
    .field('referenceOriginalNames', JSON.stringify(['失败前参考图.png']))
    .field('materialStyleId', String(styleId))
    .field('styleManifest', JSON.stringify([
      { materialImageId: styleImages[0].id, position: 0, editedField: '' },
      { materialImageId: missingSourceImage.id, position: 1, editedField: '' }
    ]))
    .attach('references', PNG, { filename: 'nexus-upload-1.png', contentType: 'image/png' });

  expect(response.body.code).toBe(404);
  const [tasks] = await execute('SELECT id FROM task_info WHERE title = ?', [title]);
  expect(tasks).toHaveLength(0);
  const after = fs.existsSync(csImageDir) ? fs.readdirSync(csImageDir, { recursive: true }).sort() : [];
  expect(after).toEqual(before);
});
