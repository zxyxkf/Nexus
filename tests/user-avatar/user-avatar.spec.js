import { test, expect } from '@playwright/test'

const testUser = {
  id: 1,
  username: 'admin',
  realName: '管理员',
  role: 'admin',
  permissions: ['*']
}

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mNkYPj/n4GBgYGJAQoAHgQCAfZC2aQAAAAASUVORK5CYII=',
  'base64'
)

async function mockLayoutApi(page, avatarHandler) {
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/user/avatar') return avatarHandler(route)
    if (url.pathname === '/api/health') {
      return route.fulfill({ json: { code: 0, msg: 'ok' } })
    }
    if (url.pathname.includes('/notification/list')) {
      return route.fulfill({ json: { code: 0, data: { list: [], total: 0 } } })
    }
    if (url.pathname.includes('/unread-count')) {
      return route.fulfill({ json: { code: 0, data: 0 } })
    }
    return route.fulfill({ json: { code: 0, data: { list: [], total: 0 } } })
  })
}

async function openAsTestUser(page) {
  await page.addInitScript(user => {
    localStorage.setItem('d_design_token', 'avatar-test-token')
    localStorage.setItem('d_design_user', JSON.stringify(user))
  }, testUser)
  await page.goto('/#/dashboard')
  await expect(page.locator('.layout-header')).toBeVisible()
}

async function openProfile(page) {
  await page.locator('.user-dropdown').click()
  await page.getByText('个人信息', { exact: true }).click()
  await expect(page.getByRole('dialog', { name: '个人信息' })).toBeVisible()
}

test('initial avatar is loaded once and falls back consistently to a circular initial', async ({ page }) => {
  let avatarGetCount = 0
  await mockLayoutApi(page, async route => {
    avatarGetCount += 1
    return route.fulfill({ status: 204, body: '' })
  })
  await openAsTestUser(page)

  const headerAvatar = page.locator('.user-dropdown [data-testid="user-avatar"]')
  await expect(headerAvatar).toContainText('管')
  await expect.poll(() => avatarGetCount).toBe(1)
  await expect(headerAvatar).toHaveCSS('border-radius', '50%')

  await page.locator('.user-dropdown').click()
  const dropdownAvatar = page.locator('.dropdown-user-header [data-testid="user-avatar"]')
  await expect(dropdownAvatar).toContainText('管')
  await expect(dropdownAvatar).toHaveCSS('border-radius', '50%')

  await page.getByText('个人信息', { exact: true }).click()
  const profileAvatar = page.locator('.profile-avatar-section [data-testid="user-avatar"]')
  await expect(profileAvatar).toContainText('管')
  await expect(profileAvatar).toHaveCSS('border-radius', '50%')
  expect(avatarGetCount).toBe(1)
})

test('profile avatar opens a circular crop and refreshes every avatar after upload', async ({ page }) => {
  let avatarGetCount = 0
  let avatarPostCount = 0
  let uploaded = false
  await mockLayoutApi(page, async route => {
    if (route.request().method() === 'POST') {
      avatarPostCount += 1
      const contentType = route.request().headers()['content-type'] || ''
      const body = route.request().postDataBuffer()?.toString('latin1') || ''
      expect(contentType).toContain('multipart/form-data')
      expect(body).toContain('name="avatar"')
      expect(body).toContain('filename="avatar.webp"')
      uploaded = true
      return route.fulfill({ json: { code: 0, msg: '头像已更新', data: { hasAvatar: true } } })
    }
    avatarGetCount += 1
    if (!uploaded) return route.fulfill({ status: 204, body: '' })
    return route.fulfill({ status: 200, contentType: 'image/png', body: pngBuffer })
  })
  await openAsTestUser(page)
  await openProfile(page)

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByTestId('profile-avatar-edit').click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: pngBuffer })

  const cropDialog = page.getByRole('dialog', { name: '裁剪头像' })
  await expect(cropDialog).toBeVisible()
  await expect(cropDialog.locator('.cropper-view-box')).toHaveCSS('border-radius', '50%')
  await page.getByRole('button', { name: '保存头像' }).click()

  await expect.poll(() => avatarPostCount).toBe(1)
  await expect.poll(() => avatarGetCount).toBe(2)
  await expect(page.getByText('头像已更新', { exact: true })).toBeVisible()
  await expect(page.getByTestId('profile-avatar-edit').locator('img')).toBeVisible()
  await expect(page.locator('.user-dropdown [data-testid="user-avatar"] img')).toBeVisible()

  await page.getByRole('dialog', { name: '个人信息' }).getByLabel('关闭此对话框').click()
  await page.locator('.user-dropdown').click()
  await expect(page.locator('.dropdown-user-header [data-testid="user-avatar"] img')).toBeVisible()
})

test('a forced refresh wins over an older avatar request that finishes later', async ({ page }) => {
  let avatarGetCount = 0
  let releaseInitial
  let finishInitial
  const initialRelease = new Promise(resolve => { releaseInitial = resolve })
  const initialFinished = new Promise(resolve => { finishInitial = resolve })

  await mockLayoutApi(page, async route => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { code: 0, msg: '头像已更新', data: { hasAvatar: true } } })
    }
    avatarGetCount += 1
    if (avatarGetCount === 1) {
      await initialRelease
      await route.fulfill({ status: 204, body: '' })
      finishInitial()
      return
    }
    return route.fulfill({ status: 200, contentType: 'image/png', body: pngBuffer })
  })

  await openAsTestUser(page)
  await expect.poll(() => avatarGetCount).toBe(1)
  await openProfile(page)

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByTestId('profile-avatar-edit').click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: pngBuffer })
  await expect(page.getByRole('dialog', { name: '裁剪头像' })).toBeVisible()
  await page.getByRole('button', { name: '保存头像' }).click()

  await expect.poll(() => avatarGetCount).toBe(2)
  const profileImage = page.getByTestId('profile-avatar-edit').locator('img')
  await expect(profileImage).toBeVisible()

  releaseInitial()
  await initialFinished
  await expect(profileImage).toBeVisible()
})

test('an avatar response from the previous account cannot overwrite the current user', async ({ page }) => {
  let releaseAvatar
  let finishAvatar
  const avatarRelease = new Promise(resolve => { releaseAvatar = resolve })
  const avatarFinished = new Promise(resolve => { finishAvatar = resolve })

  await mockLayoutApi(page, async route => {
    await avatarRelease
    await route.fulfill({ status: 200, contentType: 'image/png', body: pngBuffer })
    finishAvatar()
  })
  await openAsTestUser(page)

  await page.evaluate(() => {
    localStorage.setItem('d_design_token', 'next-user-token')
    localStorage.setItem('d_design_user', JSON.stringify({
      id: 2,
      username: 'next-user',
      realName: '新用户',
      role: 'designer',
      permissions: []
    }))
    window.dispatchEvent(new CustomEvent('nexus-auth-change'))
  })

  const headerAvatar = page.locator('.user-dropdown [data-testid="user-avatar"]')
  await expect(headerAvatar).toContainText('新')
  releaseAvatar()
  await avatarFinished
  await expect(headerAvatar).toContainText('新')
  await expect(headerAvatar.locator('img')).toHaveCount(0)
})

test('canceling the crop keeps the current avatar and sends no upload', async ({ page }) => {
  let avatarPostCount = 0
  await mockLayoutApi(page, async route => {
    if (route.request().method() === 'POST') avatarPostCount += 1
    return route.fulfill({ status: 204, body: '' })
  })
  await openAsTestUser(page)
  await openProfile(page)

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByTestId('profile-avatar-edit').click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: pngBuffer })
  await expect(page.getByRole('dialog', { name: '裁剪头像' })).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()

  await expect(page.getByRole('dialog', { name: '裁剪头像' })).toHaveCount(0)
  expect(avatarPostCount).toBe(0)
  await expect(page.getByTestId('profile-avatar-edit')).toContainText('管')
})

test('invalid and oversized source images are rejected without changing the avatar', async ({ page }) => {
  let avatarPostCount = 0
  await mockLayoutApi(page, async route => {
    if (route.request().method() === 'POST') avatarPostCount += 1
    return route.fulfill({ status: 204, body: '' })
  })
  await openAsTestUser(page)
  await openProfile(page)

  const editAvatar = page.getByTestId('profile-avatar-edit')
  const fileInput = page.getByTestId('avatar-file-input')

  await editAvatar.click()
  await fileInput.setInputFiles({
    name: 'portrait.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('not-an-avatar')
  })
  await expect(page.getByText('只允许选择 JPG、PNG 或 WebP 图片', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: '裁剪头像' })).toHaveCount(0)

  await editAvatar.click()
  await fileInput.setInputFiles({
    name: 'oversized.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(20 * 1024 * 1024 + 1)
  })
  await expect(page.getByText('头像原图不能超过 20 MB', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: '裁剪头像' })).toHaveCount(0)

  expect(avatarPostCount).toBe(0)
  await expect(editAvatar).toContainText('管')
})
