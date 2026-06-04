import { expect, test } from '@playwright/test'

/**
 * react-i18next 전환(P0) 회귀 가드.
 * locale JSON 은 `"login.title"` 처럼 `.` 을 포함한 flat key 다. i18next 의 기본
 * keySeparator/nsSeparator(`.`/`:`) 가 켜져 있으면 flat key 가 중첩 경로로 해석돼
 * 조회 실패 → t() 가 key 문자열 그대로(`"login.title"`) 를 렌더한다.
 * → 화면에 "login.<...>" 같은 raw key 가 노출되지 않고, 번역된 값이 보이는지 검증한다.
 */
test('flat key 가 raw key 가 아니라 번역 값으로 렌더됩니다.', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message)
  })

  await page.goto('/login')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // raw flat key 가 화면 어디에도 노출되면 keySeparator/nsSeparator 미설정 회귀.
  const rawKeys = ['login.title', 'login.idLabel', 'login.pwLabel', 'login.submit']
  for (const key of rawKeys) {
    await expect(page.getByText(key, { exact: false })).toHaveCount(0)
  }

  // 번역된 값이 실제로 렌더되는지 (Playwright 기본 locale en-US → 'en').
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Sign in|로그인/)

  expect(consoleErrors, consoleErrors.join('\n')).toEqual([])
})
