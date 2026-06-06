/**
 * Playwright 配置 — API 冒烟测试（无需浏览器）
 * 使用 APIRequestContext，验证核心业务流程
 */

import { defineConfig } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:18632';

export default defineConfig({
  testDir: './tests',
  testMatch: 'smoke.spec.js',
  timeout: 60000,
  expect: { timeout: 10000 },
  retries: 1,
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  // API-only 测试不需要浏览器项目
  projects: [
    {
      name: 'api',
      use: {},
    },
  ],
});
