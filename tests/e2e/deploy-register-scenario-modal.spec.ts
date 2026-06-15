import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * deploy 등록 탭 "시나리오 선택" 모달의 레이아웃 검증 — 테이블이 모달 폭 안에 줄바꿈되어 들어오는지.
 *
 * 등록 탭은 라인선택 → 검색 → 설비선택 → 추가의 다단계 폼이라, deploy-ui store(sessionStorage persist)에
 * 선택 설비를 직접 주입해 그 단계를 우회한다(merge 가 selectedInterfaceType 을 재계산). 배포 버튼만 눌러
 * scenario-preview(mock) → 모달을 띄운다.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = { userPk: 1, userId: 'admin', permissionCodes: ['DEPLOY_READ', 'DEPLOY_WRITE', 'LINE_READ'] }
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

const TARGET = {
  eqpKey: 10,
  eqpId: 'EQP_LONG_01',
  commInterface: 'SECS',
  enabled: true,
  modelVersionKey: 100,
  modelName: 'MODEL_A',
  modelVersion: 'v1',
  modelStatus: 'OPERATE',
  businessJarRef: 5,
  businessJarFileName: 'biz.jar',
  appliedParamVersion: 'p1',
  blockedByActiveDeploy: false,
  activeDeployKey: null,
  activeDeployStatus: null,
  activeDeployName: null,
  activeRequestedBy: null,
}

// 실제 백엔드 시나리오 데이터 재현 — 특히 긴 코드(REGISTER_MODEL_BUSINESS_JAR_EQP_PARAM)와
// 긴 시나리오명이 nowrap 으로 테이블을 모달 밖으로 밀어내는 케이스를 검증한다.
const PREVIEW = {
  removedEqpIds: [],
  remainingEqpIds: ['EQP_LONG_01'],
  unionChangeKinds: ['MODEL'],
  recommendedScenarioCode: 'REGISTER_MODEL_ONLY',
  recommendedReason: '감지된 변경 조합과 정확히 일치합니다.',
  scenarios: [
    {
      code: 'REGISTER_MODEL_ONLY',
      name: 'Model 변경',
      summary: 'Model 또는 Model Version 변경만 반영한다.',
      version: 1,
      stepCount: 1,
      coversChangeKinds: ['Model'],
      recommended: true,
      selectable: true,
      reason: '감지된 변경 조합과 정확히 일치합니다.',
    },
    {
      code: 'REGISTER_MODEL_BUSINESS_JAR',
      name: 'Model + Business Jar 변경',
      summary: 'Model 변경과 Business Jar 변경을 함께 반영한다.',
      version: 1,
      stepCount: 1,
      coversChangeKinds: ['Business Jar', 'Model'],
      recommended: false,
      selectable: true,
      reason: '감지된 변경 조합을 모두 포함하는 상위 시나리오입니다.',
    },
    {
      code: 'REGISTER_MODEL_EQP_PARAM',
      name: 'Model + Eqp Param 변경',
      summary: 'Model 변경과 설비 파라미터 버전 변경을 함께 수행한다.',
      version: 2,
      stepCount: 2,
      coversChangeKinds: ['Eqp Param', 'Model'],
      recommended: false,
      selectable: true,
      reason: '감지된 변경 조합을 모두 포함하는 상위 시나리오입니다.',
    },
    {
      code: 'REGISTER_MODEL_BUSINESS_JAR_EQP_PARAM',
      name: 'Model + Business Jar + Eqp Param 변경',
      summary: 'Model, Business Jar, Eqp Param 변경을 모두 반영한다.',
      version: 2,
      stepCount: 2,
      coversChangeKinds: ['Business Jar', 'Eqp Param', 'Model'],
      recommended: false,
      selectable: true,
      reason: '감지된 변경 조합을 모두 포함하는 상위 시나리오입니다.',
    },
  ],
}

const setupMocks = async (page: Page) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const pathname = new URL(request.url()).pathname
      const method = request.method()
      if (pathname === '/api/auth/csrf') {
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) })
      }
      if (pathname === '/api/auth/me') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) })
      }
      if (pathname === '/api/line') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) })
      }
      if (pathname === '/api/deploys/register/scenario-preview' && method === 'POST') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(PREVIEW)) })
      }
      if (pathname === '/api/deploys/register/targets') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [TARGET], offset: 0, limit: 500, count: 1 })) })
      }
      if (pathname === '/api/eqp/options') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ developModelOptions: [], operateModelOptions: [], businessJarOptions: [] })) })
      }
      // fallback — eqp list, deploys history 등
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 50, count: 0 })) })
    },
  )
}

test('시나리오 선택 모달 — 테이블이 모달 폭 안에 줄바꿈되어 들어온다 (가로 overflow 없음)', async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`[console:error] ${message.text()}`)
  })

  await setupMocks(page)
  // 사용자 환경과 동일하게 한국어 UI 로 띄운다(언어 감지 localStorage key = 'nori-tc-lang').
  await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
  await page.goto('/deploy')

  // 라인 선택 → 검색(전체) → 설비 전체선택 → 추가. (store 주입은 DeployPage 의 StrictMode cleanup clear 로 무효)
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByRole('button', { name: '조회', exact: true }).click()

  const searchTable = page.getByTestId('deploy-register-search-table')
  await expect(searchTable).toBeVisible()
  // 헤더 select-all 체크박스(첫 체크박스) → 선택 가능 항목 전체 선택.
  await searchTable.locator('input[type="checkbox"]').first().check()
  await page.getByRole('button', { name: '선택에 추가', exact: true }).click()

  const deployBtn = page.getByTestId('deploy-register-submit')
  await expect(deployBtn).toBeEnabled()
  await deployBtn.click()

  const table = page.getByTestId('deploy-register-scenario-table')
  await expect(table).toBeVisible()

  const dialog = page.getByRole('dialog')
  const dialogBox = await dialog.boundingBox()
  const tableBox = await table.boundingBox()
  const tableMetrics = await table.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
  // eslint-disable-next-line no-console
  console.log('DIALOG', JSON.stringify({ x: Math.round(dialogBox?.x ?? 0), w: Math.round(dialogBox?.width ?? 0) }))
  // eslint-disable-next-line no-console
  console.log('TABLE_BOX', JSON.stringify({ x: Math.round(tableBox?.x ?? 0), w: Math.round(tableBox?.width ?? 0) }))
  // eslint-disable-next-line no-console
  console.log('TABLE_SCROLL', JSON.stringify(tableMetrics))

  await page.screenshot({ path: 'test-results/deploy-scenario-modal.png' })

  // 테이블 자체에 가로 스크롤이 없고(줄바꿈됨), 테이블 우측이 모달 우측 경계 안에 있다(모달 밖 overflow 없음).
  expect(tableMetrics.scrollWidth).toBeLessThanOrEqual(tableMetrics.clientWidth + 2)
  expect((tableBox?.x ?? 0) + (tableBox?.width ?? 0)).toBeLessThanOrEqual(
    (dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) + 1,
  )
  expect(errors, errors.join('\n')).toEqual([])
})
