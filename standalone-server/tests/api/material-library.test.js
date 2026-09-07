const os = require('os');
const path = require('path');
const request = require('supertest');
const { setupApp, cleanupDir } = require('./helpers/setup');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z9xkAAAAASUVORK5CYII=',
  'base64'
);

let app;
let adminToken;
let styleId;
let materialDir;
const cleanupDirs = [];

async function updateConfig(configs, key, value) {
  const config = configs.find(item => item.config_key === key);
  expect(config).toBeDefined();
  const response = await request(app)
    .put('/api/config/update')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ id: config.id, configValue: value });
  expect(response.body.code).toBe(0);
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = login.body.data.token;

  const configResponse = await request(app)
    .get('/api/config/list?group=upload')
    .set('Authorization', `Bearer ${adminToken}`);
  const configs = configResponse.body.data;
  materialDir = path.join(os.tmpdir(), `nexus-material-test-${Date.now()}`);
  cleanupDirs.push(materialDir);
  await updateConfig(configs, 'upload.material_library_dir', materialDir);
  await updateConfig(configs, 'upload.max_file_count', '2');

  const product = await request(app)
    .post('/api/material-library/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: '上传限制测试商品库' });
  expect(product.body.code).toBe(0);

  const style = await request(app)
    .post(`/api/material-library/products/${product.body.data.id}/styles`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: '上传限制测试款式' });
  expect(style.body.code).toBe(0);
  styleId = style.body.data.id;
}, 30000);

afterAll(() => {
  cleanupDirs.forEach(cleanupDir);
});

describe('POST /api/material-library/styles/:styleId/images', () => {
  it('uses the current upload.max_file_count value for every request', async () => {
    const withinLimit = await request(app)
      .post(`/api/material-library/styles/${styleId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('files', PNG, { filename: '军绿色A.png', contentType: 'image/png' })
      .attach('files', PNG, { filename: '图片.png', contentType: 'image/png' })
      .attach('files', PNG, { filename: '商品图A.png', contentType: 'image/png' });

    expect(withinLimit.body.code).toBe(0);
    expect(withinLimit.body.data).toHaveLength(3);

    const stored = await request(app)
      .get(`/api/material-library/styles/${styleId}/images`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stored.body.data.images.map(image => image.display_name)).toEqual([
      '军绿色A.png',
      '图片.png',
      '商品图A.png'
    ]);
  });

  it('rolls back the whole upload when a later file cannot be copied', async () => {
    const fs = require('fs');
    const service = require('../../services/material-library.service');
    const { execute } = require('../../config/database');
    const firstTemp = path.join(os.tmpdir(), `material-first-${Date.now()}.png`);
    const missingTemp = path.join(os.tmpdir(), `material-missing-${Date.now()}.png`);
    fs.writeFileSync(firstTemp, PNG);

    await expect(service.saveUploadedImages(
      { id: 1, role: 'admin', permissions: ['*'] },
      styleId,
      [
        { path: firstTemp, originalname: '整批回滚A.png', size: PNG.length, mimetype: 'image/png' },
        { path: missingTemp, originalname: '整批回滚B.png', size: PNG.length, mimetype: 'image/png' }
      ]
    )).rejects.toBeDefined();

    const [rows] = await execute(
      "SELECT id, file_path FROM material_image WHERE display_name IN ('整批回滚A.png', '整批回滚B.png')"
    );
    expect(rows).toHaveLength(0);
    const storedFiles = fs.existsSync(materialDir)
      ? fs.readdirSync(materialDir, { recursive: true }).map(String)
      : [];
    expect(storedFiles.some(name => name.includes('整批回滚'))).toBe(false);
    expect(fs.existsSync(firstTemp)).toBe(false);
  });

  it('keeps the physical image when the database deletion fails', async () => {
    const fs = require('fs');
    const dao = require('../../dao/material-library.dao');
    const { resolvePath } = require('../../utils/share');
    const uploaded = await request(app)
      .post(`/api/material-library/styles/${styleId}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('originalNames', JSON.stringify(['删除事务.png']))
      .attach('files', PNG, { filename: 'transport.png', contentType: 'image/png' });
    expect(uploaded.body.code).toBe(0);
    const image = await dao.getImage(uploaded.body.data[0].id);
    const absolutePath = resolvePath(image.file_path);
    expect(fs.existsSync(absolutePath)).toBe(true);

    const originalDelete = dao.deleteImage;
    dao.deleteImage = async () => { throw new Error('forced delete failure'); };
    try {
      await expect(require('../../services/material-library.service').deleteImage(
        { id: 1, role: 'admin', permissions: ['*'] },
        image.id
      )).rejects.toThrow('forced delete failure');
    } finally {
      dao.deleteImage = originalDelete;
    }

    expect(await dao.getImage(image.id)).toBeTruthy();
    expect(fs.existsSync(absolutePath)).toBe(true);
  });

  it('keeps the old storage config when the destination has a same-size different file', async () => {
    const fs = require('fs');
    const conflictDir = path.join(os.tmpdir(), `nexus-material-conflict-${Date.now()}`);
    cleanupDirs.push(conflictDir);
    const stored = await request(app)
      .get(`/api/material-library/styles/${styleId}/images`)
      .set('Authorization', `Bearer ${adminToken}`);
    const image = stored.body.data.images[0];
    const relative = String(image.file_path).replace(/^material[\\/]/, '');
    const sourcePath = path.join(materialDir, relative);
    const destinationPath = path.join(conflictDir, relative);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.writeFileSync(destinationPath, Buffer.alloc(fs.statSync(sourcePath).size, 0x7f));

    const configs = await request(app)
      .get('/api/config/list?group=upload')
      .set('Authorization', `Bearer ${adminToken}`);
    const materialConfig = configs.body.data.find(item => item.config_key === 'upload.material_library_dir');
    const response = await request(app)
      .put('/api/config/update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: materialConfig.id, configValue: conflictDir });

    expect(response.body.code).toBe(400);
    expect(response.body.msg).toContain('同名且内容不同');
    const after = await request(app)
      .get('/api/config/list?group=upload')
      .set('Authorization', `Bearer ${adminToken}`);
    const current = after.body.data.find(item => item.config_key === 'upload.material_library_dir');
    expect(path.resolve(current.config_value)).toBe(path.resolve(materialDir));
    expect(fs.existsSync(sourcePath)).toBe(true);
  });

  it('copies existing images before switching the configured storage directory', async () => {
    const fs = require('fs');
    const nextDir = path.join(os.tmpdir(), `nexus-material-migrated-${Date.now()}`);
    cleanupDirs.push(nextDir);
    const list = await request(app)
      .get('/api/config/list?group=upload')
      .set('Authorization', `Bearer ${adminToken}`);
    await updateConfig(list.body.data, 'upload.material_library_dir', nextDir);

    const stored = await request(app)
      .get(`/api/material-library/styles/${styleId}/images`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stored.body.code).toBe(0);
    expect(stored.body.data.images.length).toBeGreaterThan(0);
    for (const image of stored.body.data.images) {
      const relative = String(image.file_path).replace(/^material[\\/]/, '');
      expect(fs.existsSync(path.join(nextDir, relative))).toBe(true);
    }
    materialDir = nextDir;
  });

  it('requires material read permission for image preview and download', async () => {
    const stored = await request(app)
      .get(`/api/material-library/styles/${styleId}/images`)
      .set('Authorization', `Bearer ${adminToken}`);
    const image = stored.body.data.images[0];
    expect(image).toBeDefined();

    const { generateAccessToken } = require('../../middleware/auth');
    const csPublisherToken = generateAccessToken({
      id: 900001,
      username: 'material_cs_viewer',
      role: 'cs_agent',
      permissions: ['task.create.cs']
    });
    const deniedToken = generateAccessToken({
      id: 900002,
      username: 'material_denied_viewer',
      role: 'basic_designer',
      permissions: []
    });

    const preview = await request(app)
      .get(image.previewUrl)
      .set('Authorization', `Bearer ${csPublisherToken}`);
    expect(preview.status).toBe(200);
    expect(preview.headers['cache-control']).toContain('private');

    const download = await request(app)
      .get(image.downloadUrl)
      .set('Authorization', `Bearer ${csPublisherToken}`);
    expect(download.status).toBe(200);
    expect(download.headers['cache-control']).toContain('private');

    const denied = await request(app)
      .get(image.previewUrl)
      .set('Authorization', `Bearer ${deniedToken}`);
    expect(denied.body.code).toBe(403);

    const anonymous = await request(app).get(image.previewUrl);
    expect(anonymous.status).toBe(401);
  });
});
