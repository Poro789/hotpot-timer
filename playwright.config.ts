import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  // SW 注册/离线等时序用例在重载或慢机器上偶发超时，重试一次兜底
  retries: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 420, height: 900 },
  },
  webServer: {
    command: 'npm run build:assets && vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
