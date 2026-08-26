import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * ModelCheckInDiffModal — diff 테이블이 모달 폭(max-w-4xl=896px) 밖으로 튀어나오는지 검증.
 *
 * 정밀 분석 #1: ModelCheckInDiffModal 은 SelectableTable 기본 `min-w-max` 를 그대로 쓰고
 * (ModelCheckInDiffModal.tsx:200) value 컬럼이 동적 개수라, 컬럼이 많고 값이 길면
 * Deploy 모달을 두 번 깨뜨린 그 패턴과 동일하게 모달을 부풀릴 수 있다. 다만 여기엔
 * 테이블을 감싸는 블록 레벨 `<div className="overflow-x-auto">`(line 281) 가 있어,
 * 깨지는지(모달 밖 튀어나옴) / 내부 가로 스크롤로 끝나는지는 worst-case 렌더로만 확정된다.
 *
 * worst-case: model-parameter 노드에 14 컬럼 + 긴 값. 콘텐츠 nowrap 폭이 896px 를 크게 초과.
 *
 * PASS 조건:
 *   1) 모달 폭이 max-w-4xl(896px) 을 넘지 않는다 (grid min-content 가 max-w 를 밀어내지 않음).
 *   2) diff 테이블(스크롤 컨테이너) 우측 edge 가 모달 우측 edge 안에 있다 (밖으로 안 나감).
 *   3) console.error / pageerror 0 건.
 * 다컬럼 diff 의 내부 가로 스크롤(scrollWidth>clientWidth) 은 정상 — 단언 대상 아님.
 */

const createApiResponse = <TData>(data: TData) => ({
  success: true,
  data,
  errorCode: null,
  errorMsg: null,
})

const createNullSuccessResponse = () => ({
  success: true,
  data: null,
  errorCode: null,
  errorMsg: null,
})

const ROOT_MODEL = {
  modelVersionKey: 200,
  modelKey: 20,
  modelName: 'CHECKIN_DIFF_MODEL',
  parentModel: null,
  modelVersion: '26.05.26.0000',
  commInterface: 'SECS' as const,
  status: 'OPERATE',
  description: 'root',
  maker: 'demo',
  createdAt: '2026-05-26T00:00:00Z',
  updatedAt: '2026-05-26T00:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

const BRANCH_PREV = {
  modelVersionKey: 210,
  modelKey: 21,
  modelName: 'CHECKIN_DIFF_MODEL_admin',
  parentModel: 'CHECKIN_DIFF_MODEL',
  modelVersion: '26.05.26.0100',
  commInterface: 'SECS' as const,
  status: 'DEVELOP',
  description: 'branch prev',
  maker: 'demo',
  createdAt: '2026-05-26T00:05:00Z',
  updatedAt: '2026-05-26T00:05:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

const BRANCH_EDIT = {
  modelVersionKey: 211,
  modelKey: 21,
  modelName: 'CHECKIN_DIFF_MODEL_admin',
  parentModel: 'CHECKIN_DIFF_MODEL',
  modelVersion: 'EDIT',
  commInterface: 'SECS' as const,
  status: 'DEVELOP',
  description: 'branch edit',
  maker: 'demo',
  createdAt: '2026-05-26T00:10:00Z',
  updatedAt: '2026-05-26T00:10:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

// worst-case: 14 컬럼 + 긴 헤더/값. min-w-max 라면 콘텐츠 nowrap 폭이 896px 를 크게 초과한다.
const WIDE_COLUMNS = [
  'Parameter Name',
  'Parameter Value',
  'Description',
  'Unit Of Measure',
  'Minimum Allowed',
  'Maximum Allowed',
  'Default Value',
  'Display Format',
  'Group Category',
  'Editable Flag',
  'Source Node Path',
  'Validation Rule Expression',
  'Last Modified By',
  'Remark Comment',
]

const longVal = (label: string) => `${label}_VERY_LONG_VALUE_FOR_OVERFLOW_TEST_0123456789`

const buildWideState = () =>
  ({
    [BRANCH_EDIT.modelVersionKey]: {
      'model-parameter': {
        columns: WIDE_COLUMNS,
        rows: [
          {
            id: 'r-add',
            values: WIDE_COLUMNS.map((c, i) => longVal(`ADD_${i}_${c.replace(/\s/g, '')}`)),
          },
          {
            id: 'r-chg',
            values: WIDE_COLUMNS.map((c, i) => longVal(`CHG_BRANCH_${i}_${c.replace(/\s/g, '')}`)),
          },
        ],
      } as { columns: string[]; rows: { id: string; values: string[] }[] },
    },
    [BRANCH_PREV.modelVersionKey]: {
      'model-parameter': {
        columns: WIDE_COLUMNS,
        rows: [
          {
            id: 'r-chg',
            values: WIDE_COLUMNS.map((c, i) => longVal(`CHG_PARENT_${i}_${c.replace(/\s/g, '')}`)),
          },
          {
            id: 'r-del',
            values: WIDE_COLUMNS.map((c, i) => longVal(`DEL_${i}_${c.replace(/\s/g, '')}`)),
          },
        ],
      } as { columns: string[]; rows: { id: string; values: string[] }[] },
    },
  }) as Record<number, Record<string, { columns: string[]; rows: { id: string; values: string[] }[] }>>

const setupMocks = async (page: Page) => {
  const detailByModelAndNode = buildWideState()
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const url = new URL(request.url())
      const pathname = url.pathname
      const method = request.method()

      if (pathname === '/api/auth/csrf') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' },
          body: JSON.stringify(createNullSuccessResponse()),
        })
        return
      }
      if (pathname === '/api/auth/me') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              userPk: 1,
              userId: 'admin',
              permissionCodes: ['MODEL_READ', 'MODEL_WRITE'],
            }),
          ),
        })
        return
      }
      // 공유 topbar LineScopeSelector 는 data 가 배열이어야 함(객체면 .map 크래시 → 백지).
      if (pathname === '/api/line') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse([{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }])),
        })
        return
      }
      if (pathname === '/api/model' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              items: [ROOT_MODEL, BRANCH_PREV, BRANCH_EDIT],
              offset: 0,
              limit: 500,
              count: 3,
            }),
          ),
        })
        return
      }
      if (pathname === `/api/model/${BRANCH_EDIT.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(BRANCH_EDIT)),
        })
        return
      }
      if (pathname === `/api/model/${BRANCH_PREV.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(BRANCH_PREV)),
        })
        return
      }
      if (pathname === `/api/model/${ROOT_MODEL.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(ROOT_MODEL)),
        })
        return
      }

      const detailsGetMatch = method === 'GET' ? pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/) : null
      if (detailsGetMatch) {
        const modelVersionKey = Number(detailsGetMatch[1])
        const node = detailsGetMatch[2]
        const fixture = detailByModelAndNode[modelVersionKey]?.[node]
        if (fixture) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              createApiResponse({
                columns: fixture.columns,
                rows: fixture.rows.map((row) => ({
                  id: row.id,
                  values: row.values,
                  previewValues: row.values,
                })),
                mdfContents: [],
              }),
            ),
          })
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse({ columns: [], rows: [], mdfContents: [] })),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createApiResponse({ items: [] })),
      })
    },
  )
}

test('ModelCheckInDiffModal — 다컬럼/긴값 diff 가 모달 폭 밖으로 튀어나오지 않는다', async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(`[pageerror] ${error.message}`)
    console.log(`[pageerror] ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`[console:error] ${message.text()}`)
      console.log(`[console:error] ${message.text()}`)
    }
  })

  await setupMocks(page)
  await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
  await page.goto('/model/secs')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'CHECKIN_DIFF_MODEL', exact: true }).click()
  await page.getByRole('button', { name: BRANCH_EDIT.modelName }).click()
  const editRow = page.getByRole('row', {
    name: new RegExp(`${BRANCH_EDIT.modelName} EDIT`, 'i'),
  })
  await editRow.dblclick()
  await expect(page.getByRole('heading', { name: 'Model Parameter' })).toBeVisible()

  await page.getByRole('button', { name: 'Check In' }).click()

  const table = page.getByTestId('selectable-table-check-in-diff-model-parameter')
  await expect(table).toBeVisible()

  const dialog = page.getByRole('dialog')
  const dialogBox = await dialog.boundingBox()
  const tableBox = await table.boundingBox()
  const tableMetrics = await table.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }))
  const viewport = page.viewportSize()
  console.log(
    'DIALOG',
    JSON.stringify({
      x: Math.round(dialogBox?.x ?? 0),
      w: Math.round(dialogBox?.width ?? 0),
    }),
  )
  console.log(
    'TABLE_BOX',
    JSON.stringify({
      x: Math.round(tableBox?.x ?? 0),
      w: Math.round(tableBox?.width ?? 0),
    }),
  )
  console.log('TABLE_SCROLL', JSON.stringify(tableMetrics))
  console.log('VIEWPORT', JSON.stringify(viewport))

  await page.screenshot({
    path: 'test-results/model-check-in-diff-overflow.png',
  })

  // 1) 모달이 max-w-4xl(896px) 을 넘게 부풀지 않는다.
  expect(dialogBox?.width ?? 0).toBeLessThanOrEqual(896 + 4)
  // 2) diff 테이블 우측 edge 가 모달 우측 edge 안에 있다 (밖으로 안 나감).
  expect((tableBox?.x ?? 0) + (tableBox?.width ?? 0)).toBeLessThanOrEqual(
    (dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) + 1,
  )
  // 3) 콘솔/페이지 에러 0.
  expect(errors, errors.join('\n')).toEqual([])
})
