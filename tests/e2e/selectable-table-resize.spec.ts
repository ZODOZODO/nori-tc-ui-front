import { expect, test, type Page } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R6-AC (L139) — header 우측 경계 drag → 컬럼 width 증가.
 *
 * 진입점은 DEV 전용 fixture `/__fixtures/selectable-table` (resizable 기본 on).
 * 글로벌 CLAUDE.md 14 — assertion 통과 + console.error / pageerror 0 건 모두 충족만 PASS.
 */

interface ConsoleErrorBucket {
  errors: string[]
}

const attachConsoleErrorListeners = (page: Page): ConsoleErrorBucket => {
  const bucket: ConsoleErrorBucket = { errors: [] }
  page.on('pageerror', (error) => {
    bucket.errors.push(`[pageerror] ${error.message}`)
    console.log(`[pageerror] ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      bucket.errors.push(`[console:error] ${message.text()}`)
      console.log(`[console:error] ${message.text()}`)
    }
  })
  return bucket
}

test('Selectable-Table-R6-AC-resize: header 우측 경계 drag → 컬럼 width px 증가', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)

  await page.goto('/__fixtures/selectable-table')
  const container = page.getByTestId('selectable-table-fixture')
  await expect(container).toBeVisible()

  const valueHeader = container.locator('thead th[data-col-key="value"]')
  await expect(valueHeader).toBeVisible()

  const before = await valueHeader.boundingBox()
  expect(before).not.toBeNull()
  const beforeWidth = before!.width

  // 우측 경계 drag 핸들을 잡고 오른쪽으로 80px 이동.
  const handle = container.locator('[data-resize-handle="value"]')
  await handle.hover()
  await page.mouse.down()
  await page.mouse.move(before!.x + before!.width + 80, before!.y + before!.height / 2, {
    steps: 10,
  })
  await page.mouse.up()

  const after = await valueHeader.boundingBox()
  expect(after).not.toBeNull()
  // drag 만큼 (≈80px) width 가 늘어난다 — 최소 40px 증가 단언.
  expect(after!.width).toBeGreaterThan(beforeWidth + 40)

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
