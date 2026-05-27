import { expect, test, type Page } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R6 가상화 정합 — windowing + rowIdx↔row 정합 + drag-beyond-viewport.
 *
 * AC L137(60fps) 은 별도 측정 스크립트(`_virtual_fps_measure.mjs`)가 담당하고, 본 spec 은
 * 가상화 활성 시 (1) DOM 행이 윈도우로 줄고 (2) 스크롤 후에도 buildTsv 가 전체 배열 기준이라
 * 정확하며 (3) off-screen 행까지 pointer-Y 매핑 + edge auto-scroll 로 drag 선택됨을 검증한다.
 * 진입점은 DEV 전용 fixture `/__fixtures/selectable-table?virtual=1&rows=1000`.
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

const pad5 = (index: number): string => String(index).padStart(5, '0')

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('Selectable-Table-R6-virtual-1: windowing + 스크롤 후 rowIdx↔row 정합 (2x2 range copy)', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)

  await page.goto('/__fixtures/selectable-table?virtual=1&rows=1000')
  const container = page.getByTestId('selectable-table-fixture')
  await expect(container).toBeVisible()

  // 윈도잉 — 1000 행 중 일부 윈도우만 DOM 에 렌더.
  const renderedCol0 = container.locator('[data-col-idx="0"][data-row-idx]')
  const renderedCount = await renderedCol0.count()
  expect(renderedCount).toBeGreaterThan(0)
  expect(renderedCount).toBeLessThan(100)

  // 중간으로 스크롤 → 윈도우 이동.
  await container.evaluate((element) => element.scrollTo({ top: 4000 }))
  await page.waitForTimeout(150)

  // 컨테이너 수직 중앙에 가장 가까운 렌더 행을 고른다 (하단 edge auto-scroll 회피).
  const box = (await container.boundingBox())!
  const midY = box.y + box.height / 2
  const handles = await container.locator('[data-col-idx="0"][data-row-idx]').elementHandles()
  let rowIdx = -1
  let bestDist = Number.POSITIVE_INFINITY
  for (const handle of handles) {
    const cellBox = await handle.boundingBox()
    if (!cellBox) {
      continue
    }
    const dist = Math.abs(cellBox.y + cellBox.height / 2 - midY)
    if (dist < bestDist) {
      bestDist = dist
      rowIdx = Number(await handle.getAttribute('data-row-idx'))
    }
  }
  expect(rowIdx).toBeGreaterThan(3)

  const start = container.locator(`[data-row-idx="${rowIdx}"][data-col-idx="0"]`)
  const end = container.locator(`[data-row-idx="${rowIdx + 1}"][data-col-idx="1"]`)
  await start.hover()
  await page.mouse.down()
  await end.hover()
  await page.mouse.up()

  await page.keyboard.press('ControlOrMeta+C')

  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  const cells = clipboard.split('\n').flatMap((line) => line.split('\t'))
  expect(new Set(cells)).toEqual(
    new Set([
      `Item ${pad5(rowIdx)}`,
      String(rowIdx),
      `Item ${pad5(rowIdx + 1)}`,
      String(rowIdx + 1),
    ]),
  )

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R6-virtual-2: drag 하단 경계 → auto-scroll 로 off-screen 행까지 선택', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)

  await page.goto('/__fixtures/selectable-table?virtual=1&rows=1000')
  const container = page.getByTestId('selectable-table-fixture')
  await expect(container).toBeVisible()

  const windowCount = await container.locator('[data-col-idx="0"][data-row-idx]').count()
  const box = (await container.boundingBox())!

  // row 0 에서 시작 → 컨테이너 하단 경계로 이동해 auto-scroll 유발 → 유지 → 해제.
  const start = container.locator('[data-row-idx="0"][data-col-idx="0"]')
  await start.hover()
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 6, { steps: 5 })
  await page.waitForTimeout(700) // rAF auto-scroll 진행
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 5)
  await page.mouse.up()

  await page.keyboard.press('ControlOrMeta+C')

  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  const lines = clipboard.split('\n').filter((line) => line.length > 0)
  // 초기 윈도우보다 많은 행이 선택됨 = off-screen 행이 pointer-Y 매핑으로 잡힘.
  expect(lines.length).toBeGreaterThan(windowCount)

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
