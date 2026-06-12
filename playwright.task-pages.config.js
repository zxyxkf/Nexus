import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.TASK_PAGE_TEST_PORT || 5174)
const BASE_URL = process.env.TASK_PAGE_TEST_BASE_URL || `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/task-pages',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000
  },
  webServer: {
    command: `cmd /c "set VITE_FORCE_LOCAL_API=1&& set VITE_DEV_PORT=${PORT}&& npm run dev -- --host 127.0.0.1"`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 }
      }
    }
  ]
})
