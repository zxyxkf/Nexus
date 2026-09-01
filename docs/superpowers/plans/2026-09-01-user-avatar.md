# User Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow every logged-in user to crop and replace a circular profile avatar from the personal-information dialog while keeping avatar storage in a super-admin-configurable directory.

**Architecture:** Add an idempotent `sys_user.avatar_path` migration and a dedicated `upload.user_avatar_dir` storage root. An authenticated avatar service validates and normalizes uploads to 512 x 512 WebP, while the Vue user store loads one authenticated Blob URL shared by all three avatar displays. A focused crop dialog uses Cropper.js with a circular mask; the existing task, permission, and payment flows remain untouched.

**Tech Stack:** Vue 3, Pinia, Element Plus, Cropper.js 1.6, Express, Multer, Sharp, SQLite/MySQL, Jest/Supertest, Playwright

---

## File Map

**Create:**

- `standalone-server/services/avatar.service.js` - image normalization, atomic replacement, authenticated read resolution, and avatar-root relocation.
- `standalone-server/tests/api/avatar.test.js` - API, storage, replacement, relocation, and authorization coverage.
- `src/components/user/UserAvatar.vue` - one circular avatar renderer with initial fallback.
- `src/components/user/AvatarCropDialog.vue` - source validation, Cropper.js lifecycle, circular crop UI, and upload action.
- `tests/user-avatar/user-avatar.spec.js` - deterministic browser contract for fallback, crop entry, upload, and three-place synchronization.
- `playwright.user-avatar.config.js` - isolated Vite/Playwright runner on a dedicated port.

**Modify:**

- `standalone-server/config/database.js` - create/alter `avatar_path` and seed `upload.user_avatar_dir` idempotently.
- `standalone-server/utils/share.js` - load and expose the avatar storage root.
- `standalone-server/routes/user.js` - authenticated current-user avatar GET/POST routes and Multer boundary.
- `standalone-server/routes/config.js` - super-admin-only avatar-root update with relocation before commit.
- `standalone-server/tests/api/config.test.js` - assert avatar directory seed and protected update behavior.
- `standalone-server/package.json` and `standalone-server/package-lock.json` - production Sharp dependency.
- `src/api/user.js` - Blob read and multipart upload methods.
- `src/store/index.js` - one shared avatar Object URL and cleanup lifecycle.
- `src/views/Layout.vue` - replace three duplicate initial avatars and connect the profile edit affordance.
- `src/views/admin/Config.vue` - make the avatar-root row editable only for a super administrator.
- `package.json` and `package-lock.json` - Cropper.js and the focused Playwright command.

No existing dirty task-detail or task-page test file is part of this feature.

### Task 1: Add Avatar Schema, Config, and Dependencies

**Files:**

- Modify: `standalone-server/config/database.js`
- Modify: `standalone-server/utils/share.js`
- Modify: `standalone-server/tests/api/config.test.js`
- Modify: `standalone-server/package.json`
- Modify: `standalone-server/package-lock.json`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing schema and config assertions**

Add these assertions to `standalone-server/tests/api/config.test.js`:

```js
const { execute } = require('../../config/database');

it('seeds the editable user avatar directory and user schema', async () => {
  const res = await request(app)
    .get('/api/config/list?group=upload')
    .set('Authorization', `Bearer ${adminToken}`);
  const config = res.body.data.find(item => item.config_key === 'upload.user_avatar_dir');
  expect(config).toMatchObject({ editable: 1, config_group: 'upload' });
  expect(config.config_value.replace(/\\/g, '/')).toContain('user/avatars');

  const [columns] = await execute("PRAGMA table_info('sys_user')");
  expect(columns.some(column => column.name === 'avatar_path')).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm --prefix standalone-server test -- --runInBand tests/api/config.test.js
```

Expected: FAIL because `upload.user_avatar_dir` and `sys_user.avatar_path` do not exist.

- [ ] **Step 3: Install explicit runtime dependencies**

Run:

```powershell
npm --prefix standalone-server install sharp@0.34.5 --save
npm install cropperjs@1.6.2 --save
```

Add this root script while preserving all existing scripts:

```json
"test:user-avatar": "playwright test --config=playwright.user-avatar.config.js"
```

- [ ] **Step 4: Add idempotent user schema migration and seed**

Add `avatar_path` to both new-table definitions in `standalone-server/config/database.js`:

```sql
avatar_path TEXT DEFAULT ''
```

for SQLite and:

```sql
avatar_path VARCHAR(500) DEFAULT ''
```

for MySQL. Add corresponding statements to the existing ignored-error alter arrays:

```js
`ALTER TABLE sys_user ADD COLUMN avatar_path VARCHAR(500) DEFAULT ''`,
`ALTER TABLE sys_user ADD COLUMN avatar_path TEXT DEFAULT ''`,
```

Seed the directory with an environment-safe SQLite value and the mounted production value:

```js
const userAvatarDir = mode === 'mysql'
  ? '/app/host-uploads/user/avatars'
  : path.join(uploadRoot, 'user', 'avatars').replace(/\\/g, '/');

['upload.user_avatar_dir', userAvatarDir, 'upload', '用户头像存储目录', 1],
```

- [ ] **Step 5: Extend the storage cache**

Add the avatar default, config-key mapping, getter, and export in `standalone-server/utils/share.js`:

```js
user_avatar_dir: process.env.USER_AVATAR_DIR || path.join(HOST_UPLOAD_ROOT, 'user', 'avatars'),
```

```js
'upload.user_avatar_dir',
```

```js
'upload.user_avatar_dir': 'user_avatar_dir',
```

```js
function getUserAvatarDir() {
  const dir = storageConfig.user_avatar_dir || DEFAULT_CONFIG.user_avatar_dir;
  ensureDir(dir);
  return dir;
}
```

Export `getUserAvatarDir`.

- [ ] **Step 6: Run the focused test and verify it passes**

Run:

```powershell
npm --prefix standalone-server test -- --runInBand tests/api/config.test.js
```

Expected: PASS, including the new schema/config assertion.

- [ ] **Step 7: Commit only Task 1 files**

```powershell
git add package.json package-lock.json standalone-server/package.json standalone-server/package-lock.json standalone-server/config/database.js standalone-server/utils/share.js standalone-server/tests/api/config.test.js
git commit -m "feat: add avatar storage configuration"
```

### Task 2: Build the Authenticated Avatar API

**Files:**

- Create: `standalone-server/services/avatar.service.js`
- Create: `standalone-server/tests/api/avatar.test.js`
- Modify: `standalone-server/routes/user.js`

- [ ] **Step 1: Write failing current-user avatar API tests**

Create `standalone-server/tests/api/avatar.test.js` with a temporary avatar root configured through the real config API. Use a valid PNG fixture generated by Sharp so the test does not depend on repository binaries:

```js
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const sharp = require('sharp');
const { setupApp, getTmpDir } = require('./helpers/setup');
const { execute } = require('../../config/database');

let app;
let token;
let avatarDir;
let png;

beforeAll(async () => {
  app = await setupApp();
  const login = await request(app).post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  token = login.body.data.token;
  avatarDir = path.join(getTmpDir(), 'avatars');
  const [rows] = await execute(
    "SELECT id FROM sys_config WHERE config_key = 'upload.user_avatar_dir'"
  );
  await request(app).put('/api/config/update')
    .set('Authorization', `Bearer ${token}`)
    .send({ id: rows[0].id, configValue: avatarDir });
  png = await sharp({ create: { width: 64, height: 64, channels: 4, background: '#4361ee' } })
    .png().toBuffer();
});
```

Add tests with these exact contracts:

```js
it('requires authentication', async () => {
  await request(app).get('/api/user/avatar').expect(401);
  await request(app).post('/api/user/avatar').attach('avatar', png, 'avatar.png').expect(401);
});

it('returns 204 before an avatar is uploaded', async () => {
  await request(app).get('/api/user/avatar')
    .set('Authorization', `Bearer ${token}`)
    .expect(204);
});

it('normalizes an uploaded image to private 512px WebP', async () => {
  const upload = await request(app).post('/api/user/avatar')
    .set('Authorization', `Bearer ${token}`)
    .attach('avatar', png, { filename: 'avatar.png', contentType: 'image/png' });
  expect(upload.body).toMatchObject({ code: 0, data: { hasAvatar: true } });

  const image = await request(app).get('/api/user/avatar')
    .set('Authorization', `Bearer ${token}`)
    .expect('Content-Type', /image\/webp/)
    .expect('Cache-Control', /no-store/)
    .expect(200);
  expect(await sharp(image.body).metadata()).toMatchObject({ width: 512, height: 512, format: 'webp' });
});
```

Also assert:

- A fake JPEG body is rejected without changing `avatar_path`.
- A second valid upload removes the first referenced file.
- Deleting the referenced file manually makes GET return `204` instead of `500`; upload a fresh valid avatar afterward so later relocation tests remain independent.
- A temporary SQLite `BEFORE UPDATE OF avatar_path` trigger using `RAISE(FAIL, 'forced avatar update failure')` makes POST fail while the previously referenced path and file remain unchanged; drop the trigger in `finally`.

- [ ] **Step 2: Run the test and verify route failure**

Run:

```powershell
npm --prefix standalone-server test -- --runInBand tests/api/avatar.test.js
```

Expected: FAIL because `/api/user/avatar` has no GET/POST handlers.

- [ ] **Step 3: Implement the avatar service**

Create `standalone-server/services/avatar.service.js` with these public functions:

```js
module.exports = {
  getAvatar,
  replaceAvatar,
  relocateAvatarStorage,
  validateAvatarRoot
};
```

`replaceAvatar(userId, file)` must:

```js
const metadata = await sharp(file.buffer, { failOn: 'error', limitInputPixels: 144_000_000 }).metadata();
if (!metadata.width || !metadata.height || metadata.width > 12000 || metadata.height > 12000) {
  throw new AppError(400, '头像像素尺寸不能超过 12000 x 12000');
}
const output = await sharp(file.buffer, { failOn: 'error', limitInputPixels: 144_000_000 })
  .rotate()
  .resize(512, 512, { fit: 'cover', position: 'centre' })
  .webp({ quality: 88 })
  .toBuffer();
```

Use a filename shaped as `user-{id}-{uuid}.webp`, write `*.tmp`, rename it inside the configured root, update only `sys_user.id = userId`, and delete the old file only after the database update succeeds. Resolve every stored relative filename through a helper that verifies the final path stays below `getUserAvatarDir()`.

`getAvatar(userId)` returns `null` when the row has no avatar or the file is missing; otherwise it returns `{ filePath, mimeType: 'image/webp' }`.

- [ ] **Step 4: Add Multer and current-user routes**

In `standalone-server/routes/user.js`, define a 5 MB in-memory single-file boundary:

```js
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const accepted = ['image/jpeg', 'image/png', 'image/webp'].includes(String(file.mimetype).toLowerCase());
    callback(accepted ? null : new AppError(400, '只允许上传 JPG、PNG 或 WebP 图片'), accepted);
  }
}).single('avatar');
```

Add authenticated routes before `module.exports`:

```js
router.get('/avatar', async (req, res, next) => {
  try {
    const avatar = await avatarService.getAvatar(req.user.id);
    if (!avatar) return res.status(204).end();
    res.setHeader('Content-Type', avatar.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    return fs.createReadStream(avatar.filePath).pipe(res);
  } catch (error) { return next(error); }
});

router.post('/avatar', uploadAvatar, async (req, res, next) => {
  try {
    const data = await avatarService.replaceAvatar(req.user.id, req.file);
    return res.json({ code: 0, msg: '头像已更新', data });
  } catch (error) { return next(error); }
});
```

Translate Multer size errors to the normal `{ code: 400, msg }` contract instead of returning an unhandled HTTP 500.

- [ ] **Step 5: Run API tests**

Run:

```powershell
npm --prefix standalone-server test -- --runInBand tests/api/avatar.test.js tests/api/user.test.js
```

Expected: PASS with no user-management regressions.

- [ ] **Step 6: Commit only avatar API files**

```powershell
git add standalone-server/services/avatar.service.js standalone-server/routes/user.js standalone-server/tests/api/avatar.test.js
git commit -m "feat: add current user avatar API"
```

### Task 3: Protect and Relocate the Configured Avatar Directory

**Files:**

- Modify: `standalone-server/services/avatar.service.js`
- Modify: `standalone-server/routes/config.js`
- Modify: `standalone-server/tests/api/avatar.test.js`
- Modify: `standalone-server/tests/api/config.test.js`
- Modify: `src/views/admin/Config.vue`

- [ ] **Step 1: Add failing relocation and super-admin tests**

Extend `standalone-server/tests/api/avatar.test.js`:

```js
it('copies the referenced avatar before switching roots', async () => {
  const [before] = await execute("SELECT avatar_path FROM sys_user WHERE username = 'admin'");
  const nextRoot = path.join(getTmpDir(), 'avatars-next');
  const [configs] = await execute("SELECT id FROM sys_config WHERE config_key = 'upload.user_avatar_dir'");
  const update = await request(app).put('/api/config/update')
    .set('Authorization', `Bearer ${token}`)
    .send({ id: configs[0].id, configValue: nextRoot });
  expect(update.body.code).toBe(0);
  expect(fs.existsSync(path.join(nextRoot, before[0].avatar_path))).toBe(true);
  await request(app).get('/api/user/avatar')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
});
```

Create a normal designer, grant only `admin.config`, login as that user, and assert updating `upload.user_avatar_dir` returns business code `403`. Also assert a relative or unwritable target is rejected and leaves the old config value unchanged.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
npm --prefix standalone-server test -- --runInBand tests/api/avatar.test.js tests/api/config.test.js
```

Expected: FAIL because the generic config update currently neither relocates files nor restricts this key to role `admin`.

- [ ] **Step 3: Implement validated relocation**

In `avatar.service.js`, implement `validateAvatarRoot` and `relocateAvatarStorage`:

```js
function validateAvatarRoot(value) {
  const target = String(value || '').trim();
  if (!target || !path.isAbsolute(target)) throw new AppError(400, '头像存储目录必须是绝对路径');
  fs.mkdirSync(target, { recursive: true });
  const probe = path.join(target, `.avatar-write-${uuidv4()}.tmp`);
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
  return path.resolve(target);
}
```

`relocateAvatarStorage(oldRoot, newRoot)` queries non-empty `sys_user.avatar_path`, rejects path traversal, copies every referenced existing file into the same relative location under `newRoot`, cleans files copied during a failed attempt, and never deletes `oldRoot` files.

- [ ] **Step 4: Special-case only the avatar config update**

In `standalone-server/routes/config.js`, select `config_value` with the existing config row. Before updating:

```js
if (configs[0].config_key === 'upload.user_avatar_dir') {
  if (req.user.role !== 'admin') return res.json({ code: 403, msg: '仅超级管理员可配置头像存储目录' });
  await avatarService.relocateAvatarStorage(configs[0].config_value, configValue);
}
```

Only after relocation succeeds, update `sys_config` and call `initStorageConfig(pool)`. All other `upload.*` behavior remains unchanged.

- [ ] **Step 5: Disable the row for non-super-admin frontends**

In `src/views/admin/Config.vue`, reuse `useUserStore` and route edit availability through:

```js
function canEditConfig(row) {
  if (row.editable !== 1) return false;
  if (row.config_key === 'upload.user_avatar_dir') return userStore.isSuperAdmin;
  return true;
}
```

Use `canEditConfig(row)` for the edit button and `startEdit` guard. This is a UI affordance only; the backend remains authoritative.

- [ ] **Step 6: Run config and avatar API tests**

Run:

```powershell
npm --prefix standalone-server test -- --runInBand tests/api/avatar.test.js tests/api/config.test.js
```

Expected: PASS, including root-copy and super-admin enforcement.

- [ ] **Step 7: Commit only relocation files**

```powershell
git add standalone-server/services/avatar.service.js standalone-server/routes/config.js standalone-server/tests/api/avatar.test.js standalone-server/tests/api/config.test.js src/views/admin/Config.vue
git commit -m "feat: protect avatar storage relocation"
```

### Task 4: Add Shared Frontend Avatar State and Renderer

**Files:**

- Modify: `src/api/user.js`
- Modify: `src/store/index.js`
- Create: `src/components/user/UserAvatar.vue`
- Create: `tests/user-avatar/user-avatar.spec.js`
- Create: `playwright.user-avatar.config.js`

- [ ] **Step 1: Create the focused browser runner and failing fallback test**

Create `playwright.user-avatar.config.js` using port `5176`, `testDir: './tests/user-avatar'`, one Chromium desktop project at `1440 x 900`, and the same Vite command pattern as `playwright.task-pages.config.js`.

Create `tests/user-avatar/user-avatar.spec.js`. Before navigation, write these exact keys:

```js
await page.addInitScript(user => {
  localStorage.setItem('d_design_token', 'avatar-test-token');
  localStorage.setItem('d_design_user', JSON.stringify(user));
}, {
  id: 1,
  username: 'admin',
  realName: '管理员',
  role: 'admin',
  permissions: ['*']
});
```

Mock `/api/health`, notification/badge calls, and `GET /api/user/avatar` as `204`. Assert the header, dropdown, and personal-information dialog each render the initial `管` in a circular `data-testid="user-avatar"` component.

- [ ] **Step 2: Run the browser test and verify it fails**

Run:

```powershell
npm run test:user-avatar -- --grep "initial avatar"
```

Expected: FAIL because the shared component and test IDs do not exist.

- [ ] **Step 3: Add avatar API methods**

Append to `src/api/user.js`:

```js
export const getMyAvatarApi = () => request.get('/api/user/avatar', {
  responseType: 'blob',
  headers: { Accept: 'image/webp' }
});

export function uploadMyAvatarApi(file) {
  const formData = new FormData();
  formData.append('avatar', file, 'avatar.webp');
  return request.post('/api/user/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}
```

- [ ] **Step 4: Add one shared Object URL lifecycle to the user Store**

Extend state:

```js
avatarUrl: '',
avatarLoaded: false,
avatarLoading: false
```

Add actions `loadAvatar(force = false)` and `clearAvatar()`:

```js
clearAvatar() {
  if (this.avatarUrl) URL.revokeObjectURL(this.avatarUrl);
  this.avatarUrl = '';
  this.avatarLoaded = false;
  this.avatarLoading = false;
},
async loadAvatar(force = false) {
  if (this.avatarLoading || (this.avatarLoaded && !force)) return;
  this.avatarLoading = true;
  try {
    const blob = await getMyAvatarApi();
    const nextUrl = blob instanceof Blob && blob.size ? URL.createObjectURL(blob) : '';
    if (this.avatarUrl) URL.revokeObjectURL(this.avatarUrl);
    this.avatarUrl = nextUrl;
    this.avatarLoaded = true;
  } finally {
    this.avatarLoading = false;
  }
}
```

Call `clearAvatar()` when authentication changes to a different user and during logout. Do not persist Object URLs in localStorage.

- [ ] **Step 5: Create the shared circular renderer**

Create `src/components/user/UserAvatar.vue`:

```vue
<template>
  <el-avatar
    data-testid="user-avatar"
    :size="size"
    :src="userStore.avatarUrl || undefined"
    :style="userStore.avatarUrl ? undefined : { backgroundColor }"
  >
    {{ initial }}
  </el-avatar>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/store'

defineProps({ size: { type: Number, default: 34 }, backgroundColor: { type: String, default: '#4361ee' } })
const userStore = useUserStore()
const initial = computed(() => userStore.realName?.charAt(0) || userStore.username?.charAt(0) || '')
</script>

<style scoped>
:deep(.el-avatar) { flex-shrink: 0; border-radius: 50%; }
</style>
```

- [ ] **Step 6: Run the focused test after temporary Layout wiring**

Wire `UserAvatar` into the three existing Layout locations without adding crop behavior yet, call `userStore.loadAvatar()` on Layout mount, then run:

```powershell
npm run test:user-avatar -- --grep "initial avatar"
```

Expected: PASS with one avatar request and three synchronized fallback renderers.

- [ ] **Step 7: Commit shared state and renderer**

```powershell
git add src/api/user.js src/store/index.js src/components/user/UserAvatar.vue src/views/Layout.vue tests/user-avatar/user-avatar.spec.js playwright.user-avatar.config.js package.json package-lock.json
git commit -m "feat: share current user avatar state"
```

### Task 5: Add Circular Crop and Profile Integration

**Files:**

- Create: `src/components/user/AvatarCropDialog.vue`
- Modify: `src/views/Layout.vue`
- Modify: `tests/user-avatar/user-avatar.spec.js`

- [ ] **Step 1: Add failing crop-and-sync browser coverage**

Mock avatar calls with mutable state: first GET returns `204`; POST asserts a single multipart `avatar` part and sets uploaded state; later GET returns a small WebP fixture. Test this flow:

```js
await page.getByRole('button', { name: '用户菜单' }).click();
await page.getByText('个人信息', { exact: true }).click();
await page.getByTestId('profile-avatar-edit').click();
await page.getByTestId('avatar-file-input').setInputFiles({
  name: 'portrait.png',
  mimeType: 'image/png',
  buffer: validPngBuffer
});
await expect(page.getByRole('dialog', { name: '裁剪头像' })).toBeVisible();
await page.getByRole('button', { name: '保存头像' }).click();
await expect.poll(() => avatarPostCount).toBe(1);
await expect(page.getByText('头像已更新')).toBeVisible();
await expect(page.getByTestId('profile-avatar-edit').locator('img')).toBeVisible();
```

Also verify cancel performs no POST, non-image/over-20-MB source errors preserve the current avatar, and all rendered avatars remain square in layout but circular by computed `border-radius`.

- [ ] **Step 2: Run the crop test and verify it fails**

Run:

```powershell
npm run test:user-avatar
```

Expected: FAIL because the edit affordance and crop dialog do not exist.

- [ ] **Step 3: Implement `AvatarCropDialog.vue`**

The component exposes `selectFile()` and contains a hidden input:

```vue
<input
  ref="fileInput"
  data-testid="avatar-file-input"
  class="avatar-file-input"
  type="file"
  accept="image/jpeg,image/png,image/webp"
  @change="handleFile"
/>
```

Validate source type, `file.size <= 20 * 1024 * 1024`, and loaded image dimensions no larger than 12000 per side. Initialize Cropper.js only after the source image is rendered:

```js
cropper = new Cropper(imageRef.value, {
  aspectRatio: 1,
  viewMode: 1,
  dragMode: 'move',
  autoCropArea: 1,
  background: false,
  guides: false,
  center: false,
  movable: true,
  zoomable: true,
  scalable: false,
  rotatable: false,
  preview: '.avatar-crop-preview'
});
```

On save, use:

```js
const canvas = cropper.getCroppedCanvas({
  width: 512,
  height: 512,
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high'
});
const blob = await new Promise((resolve, reject) => {
  canvas.toBlob(value => value ? resolve(value) : reject(new Error('头像裁剪失败')), 'image/webp', 0.9);
});
const res = await uploadMyAvatarApi(new File([blob], 'avatar.webp', { type: 'image/webp' }));
if (res.code !== 0) throw new Error(res.msg || '头像上传失败');
await userStore.loadAvatar(true);
emit('saved');
```

Destroy Cropper and revoke the source Object URL on cancel, save, new selection, and component unmount. Style `.cropper-view-box`, `.cropper-face`, and `.avatar-crop-preview` with `border-radius: 50%` so both mask and preview are circular while the generated file remains square.

- [ ] **Step 4: Connect the profile edit affordance**

In `src/views/Layout.vue`, wrap only the personal-information `UserAvatar` in an accessible button:

```vue
<button
  type="button"
  class="profile-avatar-edit"
  data-testid="profile-avatar-edit"
  aria-label="修改头像"
  @click="avatarCropDialogRef.selectFile()"
>
  <UserAvatar :size="64" :background-color="avatarColor" />
  <span class="profile-avatar-overlay"><el-icon><Camera /></el-icon><span>修改头像</span></span>
</button>
<AvatarCropDialog ref="avatarCropDialogRef" @saved="ElMessage.success('头像已更新')" />
```

Keep username, real name, role, password actions, menu commands, and all routing behavior unchanged. Add hover/focus styles that do not resize the 64 px avatar and use the existing theme variables.

- [ ] **Step 5: Run the full focused browser test**

Run:

```powershell
npm run test:user-avatar
```

Expected: PASS for fallback, cancel, validation, upload, immediate refresh, and circular display.

- [ ] **Step 6: Commit crop integration**

```powershell
git add src/components/user/AvatarCropDialog.vue src/views/Layout.vue tests/user-avatar/user-avatar.spec.js
git commit -m "feat: add circular avatar cropping"
```

### Task 6: Regression and Local Runtime Verification

**Files:**

- Test only; no build or packaging output is permitted.

- [ ] **Step 1: Run backend avatar, config, auth, and user regressions**

Run:

```powershell
npm --prefix standalone-server test -- --runInBand tests/api/avatar.test.js tests/api/config.test.js tests/api/auth.test.js tests/api/user.test.js
```

Expected: all suites PASS.

- [ ] **Step 2: Run the complete backend suite**

Run:

```powershell
npm --prefix standalone-server test -- --runInBand
```

Expected: all existing backend suites PASS. Any unrelated pre-existing failure must be recorded without modifying unrelated files.

- [ ] **Step 3: Run the focused browser suite**

Run:

```powershell
npm run test:user-avatar
```

Expected: all user-avatar tests PASS in Chromium.

- [ ] **Step 4: Restart only the local backend and frontend if required**

Keep the existing local isolation:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:18632`
- Database: `.local-dev-data/design.db`
- Avatar files: local development upload root, never `/app/host-uploads` or the production MySQL database.

Do not run `npm run build`, `electron:build`, Docker build, or any packaging command.

- [ ] **Step 5: Verify the real local UI with Playwright**

Using the local signed-in account, verify:

1. The three existing avatar positions are circular and initially consistent.
2. Personal information opens in the existing centered dialog.
3. Hovering the profile avatar reveals the camera affordance without layout shift.
4. A PNG can be dragged/scaled in the circular crop mask and saved.
5. All three avatar locations refresh immediately.
6. Reload and re-login preserve the avatar.
7. System configuration shows `upload.user_avatar_dir` and only the super administrator can edit it.

- [ ] **Step 6: Review the final diff and commit any verification-only fixes**

Run:

```powershell
git diff --check
git status --short
git log -8 --oneline
```

Stage only avatar-feature files. Preserve all unrelated existing modifications and untracked local runtime data. Do not push.
