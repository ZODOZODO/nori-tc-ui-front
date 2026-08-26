import { defineConfig, devices } from '@playwright/test'

/**
 * 프론트 레포의 E2E 검증은 Vite dev server를 직접 띄운 뒤 브라우저 단에서 동작을 확인합니다.
 * 기본값은 개발 환경과 동일한 3000 포트를 사용해 수동 실행 흐름과 테스트 흐름의 차이를 줄입니다.
 */
const E2E_PORT = process.env.E2E_PORT ?? '3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // 로컬 기본(코어/2 = 6)으로는 WebGL(r3f) 스펙 다수 + Vite dev server 동시 구동이 부하 한계를 넘겨
  // 3D 스펙이 간헐 타임아웃된다(직렬 실행은 전부 통과) → 로컬 워커 4 로 제한.
  workers: process.env.CI ? 1 : 4,
  // 병렬 워커가 Vite dev server 를 동시에 때리면 첫 페이지 로드/lazy 청크(three.js 등) 변환이
  // 기본 5s 를 넘겨 첫 가시성 단언이 플레이크된다 → expect 타임아웃만 상향(테스트 타임아웃은 기본 유지).
  expect: { timeout: 15_000 },
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}/login`,
    reuseExistingServer: !process.env.CI && process.env.E2E_PORT === undefined,
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
