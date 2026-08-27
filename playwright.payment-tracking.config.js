import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PAYMENT_TRACKING_TEST_PORT || 5175)
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/payment-tracking',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `cmd /c "set VITE_FORCE_LOCAL_API=1&& set VITE_DEV_PORT=${PORT}&& npm run dev -- --host 127.0.0.1"`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } }
    },
    {
      name: 'compact-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } }
    }
  ]
})
