const request = require('supertest');
const ExcelJS = require('exceljs');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

beforeAll(async () => {
  app = await setupApp();
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = loginRes.body.data.token;
}, 30000);

describe('GET /api/export/dashboard', () => {
  it('exports only table sheets for the requested dashboard group', async () => {
    const res = await request(app)
      .get('/api/export/dashboard?groups=design')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body);
    const sheetNames = workbook.worksheets.map(sheet => sheet.name);

    expect(sheetNames).toEqual(expect.arrayContaining([
      '美工综合统计',
      '美工月度积分明细',
      '美工日统计',
      '项目类型完成统计',
      '运营发布统计'
    ]));
    expect(sheetNames).not.toContain('统计概览');
    expect(sheetNames).not.toContain('用户统计');
    expect(sheetNames).not.toContain('助理综合统计');
    expect(sheetNames).not.toContain('基础美工综合统计');
  });
});
