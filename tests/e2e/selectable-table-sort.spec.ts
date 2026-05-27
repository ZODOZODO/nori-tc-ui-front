import { expect, test, type Page } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R6-AC (L138) — header 클릭 정렬 토글 asc → desc → off 3 단계.
 *
 * 진입점은 DEV 전용 fixture `/__fixtures/selectable-table` (SelectableTableFixture).
 * 11 production 호출처는 `rangeCopy` 만 켜므로 sortable 가 켜진 테이블이 production 에 없어
 * fixture 로 검증한다. fixture 기본 데이터(3 행): name = [Cherry, Apple, Banana].
 *   off       : Cherry / Apple / Banana (원본 순서)
 *   asc       : Apple / Banana / Cherry
 *   desc      : Cherry / Banana / Apple
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

const cellText = async (page: Page, rowIdx: number, colIdx: number): Promise<string> => {
  const cell = page
    .getByTestId('selectable-table-fixture')
    .locator(`[data-row-idx="${rowIdx}"][data-col-idx="${colIdx}"]`)
  return (await cell.innerText()).trim()
}

const nameColumnOrder = async (page: Page): Promise<string[]> =>
  Promise.all([cellText(page, 0, 0), cellText(page, 1, 0), cellText(page, 2, 0)])

test('Selectable-Table-R6-AC-sort: header 클릭 asc → desc → off 3 단계 행 순서', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)

  await page.goto('/__fixtures/selectable-table')
  const container = page.getByTestId('selectable-table-fixture')
  await expect(container).toBeVisible()

  // 초기(정렬 off) — fixture 원본 순서.
  expect(await nameColumnOrder(page)).toEqual(['Cherry', 'Apple', 'Banana'])

  const nameHeader = container.getByRole('button', { name: /^name/ })

  // 1 클릭 → asc.
  await nameHeader.click()
  expect(await nameColumnOrder(page)).toEqual(['Apple', 'Banana', 'Cherry'])

  // 2 클릭 → desc.
  await nameHeader.click()
  expect(await nameColumnOrder(page)).toEqual(['Cherry', 'Banana', 'Apple'])

  // 3 클릭 → off (원본 순서 복귀).
  await nameHeader.click()
  expect(await nameColumnOrder(page)).toEqual(['Cherry', 'Apple', 'Banana'])

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
