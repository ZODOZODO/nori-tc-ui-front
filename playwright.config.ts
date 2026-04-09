import { defineConfig, devices } from '@playwright/test'

/**
 * 프론트 레포의 E2E 검증은 Vite dev server를 직접 띄운 뒤 브라우저 단에서 동작을 확인합니다.
 * 기본값은 개발 환경과 동일한 3000 포트를 사용해 수동 실행 흐름과 테스트 흐름의 차이를 줄입니다.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev -- --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
