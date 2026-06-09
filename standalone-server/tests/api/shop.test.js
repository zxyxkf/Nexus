const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;

beforeAll(async () => {
  app = await setupApp();
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = loginRes.body.data.token;
}, 30000);

describe('GET /api/shop/list', () => {
  it('returns shop list after database initialization', async () => {
    const res = await request(app)
      .get('/api/shop/list')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
