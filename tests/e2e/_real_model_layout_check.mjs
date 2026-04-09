import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const outDir = '/tmp/playwright-real-model-layout'
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
fs.mkdirSync(outDir, { recursive: true })

async function capture(page, buttonName) {
  await page.getByRole('button', { name: buttonName }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  return page.evaluate(() => {
    const detailRoot = Array.from(document.querySelectorAll('section')).find(
      (element) =>
        element.textContent?.includes('Model Parameter') &&
        element.textContent?.includes('Socket Message'),
    )

    const containers = Array.from(
      detailRoot?.querySelectorAll('div.min-h-0.min-w-0.flex-1.overflow-auto') ?? [],
    )
    const target = containers[containers.length - 1] ?? null
    const table = target?.querySelector('table') ?? null
    const detailRect = detailRoot?.getBoundingClientRect() ?? null
    const targetRect = target?.getBoundingClientRect() ?? null

    return {
      detailPanelHeight: detailRect?.height ?? null,
      viewportHeight: window.innerHeight,
      targetClientWidth: target?.clientWidth ?? null,
      targetScrollWidth: target?.scrollWidth ?? null,
      targetClientHeight: target?.clientHeight ?? null,
      targetScrollHeight: target?.scrollHeight ?? null,
      tableClientWidth: table?.clientWidth ?? null,
      tableScrollWidth: table?.scrollWidth ?? null,
      tableClientHeight: table?.clientHeight ?? null,
      tableScrollHeight: table?.scrollHeight ?? null,
      hasHorizontalScrollbar: target ? target.scrollWidth > target.clientWidth : null,
      hasVerticalScrollbar: target ? target.scrollHeight > target.clientHeight : null,
      targetRectHeight: targetRect?.height ?? null,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollHeight: document.body.scrollHeight,
      bodyClientHeight: document.body.clientHeight,
    }
  })
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1720, height: 1180 } })
const page = await context.newPage()

page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    console.log(`[console:${message.type()}] ${message.text()}`)
  }
})

page.on('pageerror', (error) => {
  console.log(`[pageerror] ${error.message}`)
})

try {
  await page.goto(`${baseUrl}/login`)
  await page.waitForLoadState('networkidle')

  await page.getByLabel('ID').fill('admin')
  await page.getByLabel('Password').fill('ChangeMe123!')
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.waitForURL(/\/eqp$/, { timeout: 15000 })
  console.log(`[after-login-url] ${page.url()}`)
  console.log(`[after-login-body] ${(await page.locator('body').innerText()).trim()}`)

  await page.goto(`${baseUrl}/model`)
  await page.waitForURL(/\/model$/, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  await page.getByRole('button', { name: 'DEMO_MAKER_MODEL_T01_admin' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('row', { name: /DEMO_MAKER_MODEL_T01_admin\s+EDIT/i }).dblclick()
  await page.waitForTimeout(1000)

  const modelParameter = await capture(page, 'Model Parameter')
  await page.screenshot({ path: path.join(outDir, 'model-parameter.png'), fullPage: true })

  const socketMessage = await capture(page, 'Socket Message')
  await page.screenshot({ path: path.join(outDir, 'socket-message.png'), fullPage: true })

  console.log(
    JSON.stringify(
      {
        outDir,
        modelParameter,
        socketMessage,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
