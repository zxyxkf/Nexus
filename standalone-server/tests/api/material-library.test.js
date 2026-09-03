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
  cleanupDir(materialDir);
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
});
