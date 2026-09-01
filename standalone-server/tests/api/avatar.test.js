const fs = require('fs');
const path = require('path');
const request = require('supertest');
const sharp = require('sharp');
const { setupApp, getTmpDir } = require('./helpers/setup');

let app;
let token;
let avatarDir;
let png;
let execute;

async function getAdminAvatarPath() {
  const [rows] = await execute("SELECT avatar_path FROM sys_user WHERE username = 'admin'");
  return rows[0]?.avatar_path || '';
}

function storedFile(relativePath) {
  return path.join(avatarDir, relativePath);
}

async function uploadAvatar(buffer = png, options = {}) {
  return request(app)
    .post('/api/user/avatar')
    .set('Authorization', `Bearer ${token}`)
    .attach('avatar', buffer, {
      filename: options.filename || 'avatar.png',
      contentType: options.contentType || 'image/png'
    });
}

beforeAll(async () => {
  app = await setupApp();
  ({ execute } = require('../../config/database'));

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  token = login.body.data.token;

  avatarDir = path.join(getTmpDir(), 'avatars');
  const [configs] = await execute(
    "SELECT id FROM sys_config WHERE config_key = 'upload.user_avatar_dir'"
  );
  const configUpdate = await request(app)
    .put('/api/config/update')
    .set('Authorization', `Bearer ${token}`)
    .send({ id: configs[0].id, configValue: avatarDir });
  expect(configUpdate.body.code).toBe(0);

  png = await sharp({
    create: { width: 64, height: 64, channels: 4, background: '#4361ee' }
  }).png().toBuffer();
}, 30000);

describe('current user avatar API', () => {
  it('requires authentication', async () => {
    await request(app).get('/api/user/avatar').expect(401);
    await request(app)
      .post('/api/user/avatar')
      .attach('avatar', png, 'avatar.png')
      .expect(401);
  });

  it('returns 204 before an avatar is uploaded', async () => {
    await request(app)
      .get('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('normalizes an uploaded image to private 512px WebP', async () => {
    const upload = await uploadAvatar();
    expect(upload.body).toMatchObject({ code: 0, data: { hasAvatar: true } });

    const relativePath = await getAdminAvatarPath();
    expect(relativePath).toMatch(/^user-\d+-[a-f0-9]+\.webp$/);
    expect(fs.existsSync(storedFile(relativePath))).toBe(true);

    const image = await request(app)
      .get('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /image\/webp/)
      .expect('Cache-Control', /no-store/)
      .expect(200);
    expect(await sharp(image.body).metadata()).toMatchObject({
      width: 512,
      height: 512,
      format: 'webp'
    });
  });

  it('rejects forged image content without changing the current avatar', async () => {
    const before = await getAdminAvatarPath();
    const response = await uploadAvatar(Buffer.from('not an image'), {
      filename: 'forged.jpg',
      contentType: 'image/jpeg'
    });
    expect(response.body.code).toBe(400);
    expect(await getAdminAvatarPath()).toBe(before);
    expect(fs.existsSync(storedFile(before))).toBe(true);
  });

  it('removes the previous file after a successful replacement', async () => {
    const before = await getAdminAvatarPath();
    const green = await sharp({
      create: { width: 80, height: 60, channels: 4, background: '#2ec4b6' }
    }).png().toBuffer();

    const response = await uploadAvatar(green);
    expect(response.body.code).toBe(0);
    const after = await getAdminAvatarPath();
    expect(after).not.toBe(before);
    expect(fs.existsSync(storedFile(after))).toBe(true);
    expect(fs.existsSync(storedFile(before))).toBe(false);
  });

  it('keeps the previous avatar when the database update fails', async () => {
    const before = await getAdminAvatarPath();
    const filesBefore = fs.readdirSync(avatarDir).sort();
    await execute(`CREATE TRIGGER fail_avatar_update
      BEFORE UPDATE OF avatar_path ON sys_user
      BEGIN
        SELECT RAISE(FAIL, 'forced avatar update failure');
      END`);

    try {
      const response = await uploadAvatar();
      expect(response.status).toBe(500);
    } finally {
      await execute('DROP TRIGGER IF EXISTS fail_avatar_update');
    }

    expect(await getAdminAvatarPath()).toBe(before);
    expect(fs.existsSync(storedFile(before))).toBe(true);
    expect(fs.readdirSync(avatarDir).sort()).toEqual(filesBefore);
  });

  it('falls back to no-avatar when the referenced file is missing', async () => {
    const before = await getAdminAvatarPath();
    fs.unlinkSync(storedFile(before));

    await request(app)
      .get('/api/user/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const restore = await uploadAvatar();
    expect(restore.body.code).toBe(0);
    expect(fs.existsSync(storedFile(await getAdminAvatarPath()))).toBe(true);
  });

  it('rejects files above the avatar upload limit', async () => {
    const response = await uploadAvatar(Buffer.alloc(5 * 1024 * 1024 + 1), {
      filename: 'large.png',
      contentType: 'image/png'
    });
    expect(response.body.code).toBe(400);
  });
});
