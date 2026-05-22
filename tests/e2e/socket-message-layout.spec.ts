import { expect, test } from '@playwright/test'

test.use({
  baseURL: 'http://127.0.0.1:3001',
})

const createApiResponse = <TData>(data: TData) => ({
  success: true,
  data,
  errorCode: null,
  errorMsg: null,
})

const rootModel = {
  modelVersionKey: 100,
  modelKey: 10,
  modelName: 'DEMO_MAKER_MODEL_T01',
  parentModel: null,
  modelVersion: '26.04.06.0000',
  commInterface: 'SOCKET',
  status: 'OPERATE',
  description: 'root',
  maker: 'demo',
  createdAt: '2026-04-06T12:00:00Z',
  updatedAt: '2026-04-06T12:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

const editModel = {
  modelVersionKey: 101,
  modelKey: 11,
  modelName: 'DEMO_MAKER_MODEL_T01_admin',
  parentModel: 'DEMO_MAKER_MODEL_T01',
  modelVersion: 'EDIT',
  commInterface: 'SOCKET',
  status: 'DEVELOP',
  description: 'edit',
  maker: 'demo',
  createdAt: '2026-04-06T12:10:00Z',
  updatedAt: '2026-04-06T12:10:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

const buildSocketRows = () =>
  Array.from({ length: 45 }, (_, index) => {
    const rowNumber = String(index + 1).padStart(2, '0')
    const messageName = `SOCKET_MESSAGE_NAME_${rowNumber}_VERY_LONG_IDENTIFIER_FOR_LAYOUT_CHECK`
    const description = `설명_${rowNumber}_LONG_TEXT_LONG_TEXT_LONG_TEXT_LONG_TEXT_LONG_TEXT`

    return {
      id: `socket-${rowNumber}`,
      values: [messageName, description],
      previewValues: [messageName, description],
    }
  })

test('Socket Message 상세 테이블 레이아웃을 재현합니다.', async ({ page }) => {
  page.on('pageerror', (error) => {
    console.log(`[pageerror] ${error.message}`)
  })

  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.log(`[console:error] ${message.text()}`)
    }
  })

  page.on('response', async (response) => {
    const url = response.url()
    if (url.includes('/src/features/model/components/ModelPage.tsx')) {
      console.log(
        `[response:model-page] status=${response.status()} content-type=${response.headers()['content-type'] ?? 'n/a'} url=${url}`,
      )
    }

    const contentType = response.headers()['content-type'] ?? ''
    if (
      contentType.includes('application/json') &&
      (url.includes('/src/') || url.includes('/node_modules/.vite/'))
    ) {
      console.log(`[response:json-module] status=${response.status()} content-type=${contentType} url=${url}`)
    }
  })

  page.on('requestfailed', (request) => {
    if (request.url().includes('/src/features/model/components/ModelPage.tsx')) {
      console.log(`[requestfailed:model-page] ${request.failure()?.errorText ?? 'unknown'} ${request.url()}`)
    }
  })

  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route) => {
      const pathname = new URL(route.request().url()).pathname

      if (pathname === '/api/auth/me') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({ userPk: 1, userId: 'admin', permissionCodes: ['MODEL_RW'] }),
          ),
        })
        return
      }

      if (pathname === '/api/model') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              items: [rootModel, editModel],
              offset: 0,
              limit: 500,
              count: 2,
            }),
          ),
        })
        return
      }

      if (pathname === '/api/model/101') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(editModel)),
        })
        return
      }

      if (pathname === '/api/model/101/details/model-parameter') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              columns: ['Parameter Name', 'Parameter Value', 'Description'],
              rows: [
                { id: 'param-1', values: ['EQPID', 'EQP_01', '설비 아이디'] },
                { id: 'param-2', values: ['MODE', 'AUTO', '동작 모드'] },
              ],
              mdfContents: [],
            }),
          ),
        })
        return
      }

      if (pathname === '/api/model/101/details/mdf') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              columns: [],
              rows: [],
              mdfContents: [{ name: 'MDF', xml: '<mdf></mdf>' }],
            }),
          ),
        })
        return
      }

      if (pathname === '/api/model/101/details/socket-message') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              columns: ['Socket Message Name', 'Description'],
              rows: buildSocketRows(),
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
    },
  )

  await page.setViewportSize({ width: 1720, height: 1180 })
  await page.goto('/model')
  await page.waitForLoadState('networkidle')
  console.log(`[body] ${(await page.locator('body').innerText()).trim()}`)

  await page.getByRole('button', { name: 'DEMO_MAKER_MODEL_T01_admin' }).click()
  const row = page.getByRole('row', { name: /DEMO_MAKER_MODEL_T01_admin EDIT/i })
  await row.dblclick()
  await page.getByRole('button', { name: 'Socket Message' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  await expect(page.getByRole('heading', { name: 'Socket Message' })).toBeVisible()
  await expect(
    page.getByRole('cell', { name: /SOCKET_MESSAGE_NAME_01/i }).first(),
  ).toBeVisible()

  const metrics = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('div.min-h-0.min-w-0.flex-1.overflow-auto'))
    const target = containers[containers.length - 1]
    const table = target ? target.querySelector('table') : null
    if (!target || !table) {
      return null
    }

    return {
      containerClientWidth: target.clientWidth,
      containerScrollWidth: target.scrollWidth,
      tableClientWidth: table.clientWidth,
      tableScrollWidth: table.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }
  })

  console.log(JSON.stringify({ metrics }, null, 2))
  const detailPanel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Socket Message' }) }).first()
  await detailPanel.screenshot({ path: 'test-results/socket-message-detail-panel.png' })
  await page.screenshot({ path: 'test-results/socket-message-layout-page.png', fullPage: true })
})
