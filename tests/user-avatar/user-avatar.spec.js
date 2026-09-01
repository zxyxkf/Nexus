import { test, expect } from '@playwright/test'

const testUser = {
  id: 1,
  username: 'admin',
  realName: '管理员',
  role: 'admin',
  permissions: ['*']
}

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
