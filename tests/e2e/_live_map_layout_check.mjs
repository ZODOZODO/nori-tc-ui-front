import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const outDir = 'C:/tmp/playwright-live-map-layout'
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1720, height: 1180 } })
const page = await context.newPage()

page.on('console', (message) => {
  if (message.type() === 'error') {
    console.log(`[console:error] ${message.text()}`)
  }
})

try {
  await page.goto(`${baseUrl}/login`)
  await page.waitForLoadState('networkidle')

  await page.getByLabel('ID').fill('admin')
  await page.getByLabel('Password').fill('ChangeMe123!')
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.waitForURL(/\/eqp$/, { timeout: 15000 })

  await page.goto(`${baseUrl}/eqp/live-map`)
  await page.waitForURL(/\/live-map$/, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  await page.screenshot({ path: path.join(outDir, 'live-map-full.png'), fullPage: true })

  const boardRect = await page.locator('[style*="transform: scale"]').boundingBox()
  if (boardRect) {
    // CVD+CMP+DIFF 영역 전체
    await page.screenshot({
      path: path.join(outDir, 'cvd-cluster-zoom.png'),
      clip: { x: boardRect.x + 10, y: boardRect.y + 50, width: 640, height: 480 },
    })
    // CVD 클러스터만 (x=34,y=76,w=232,h=364) 2× 배율로 크롭
    await page.screenshot({
      path: path.join(outDir, 'cvd-only.png'),
      clip: { x: boardRect.x + 30, y: boardRect.y + 70, width: 240, height: 380 },
    })
    // CMP 클러스터만 (x=290)
    await page.screenshot({
      path: path.join(outDir, 'cmp-only.png'),
      clip: { x: boardRect.x + 285, y: boardRect.y + 70, width: 240, height: 380 },
    })
  }

  const metrics = await page.evaluate(() => {
    const boardInner = document.querySelector('[style*="transform: scale"]')

    // 클러스터 카드
    const clusterCards = boardInner
      ? Array.from(boardInner.children).filter(el =>
          el.tagName === 'DIV' &&
          (el.getAttribute('style') ?? '').includes('width:') &&
          (el.getAttribute('style') ?? '').includes('height:')
        )
      : []

    // 첫 번째 클러스터(CVD) 내부 구조 측정
    const cvdCard = clusterCards[0] ?? null
    const cvdChildren = cvdCard ? Array.from(cvdCard.children) : []
    const cvdInnerPanel = cvdCard?.querySelector('.rounded-\\[14px\\]') ?? null
    const cvdStatusPanel = cvdCard?.querySelector('.grid-cols-2') ?? null

    // 모든 절대 위치 div (inner panel, status panel 포함)
    const cvdAbsDivs = cvdCard
      ? Array.from(cvdCard.querySelectorAll('div')).map(el => ({
          class: el.className.slice(0, 80),
          rect: (() => { const r = el.getBoundingClientRect(); const pr = cvdCard.getBoundingClientRect(); return { top: r.top - pr.top, left: r.left - pr.left, w: r.width, h: r.height } })(),
        }))
      : []

    // 장비 노드: clusterId별 집계
    const machineNodes = boardInner
      ? Array.from(boardInner.querySelectorAll('button[style*="left"]'))
      : []

    // CVD 클러스터(x=34, y=76)에 속하는 노드
    const cvdLeft = 34, cvdTop = 76, cvdW = 232, cvdH = 320
    const cvdNodes = machineNodes.filter(el => {
      const style = el.getAttribute('style') ?? ''
      const leftMatch = style.match(/left:\s*(\d+)px/)
      const topMatch = style.match(/top:\s*(\d+)px/)
      if (!leftMatch || !topMatch) return false
      const x = parseInt(leftMatch[1])
      const y = parseInt(topMatch[1])
      return x >= cvdLeft && x < cvdLeft + cvdW && y >= cvdTop && y < cvdTop + cvdH + 200
    })

    // ETC 클러스터(x=1058, y=444) 노드 수
    const etcLeft = 1058, etcTop = 444
    const etcNodes = machineNodes.filter(el => {
      const style = el.getAttribute('style') ?? ''
      const leftMatch = style.match(/left:\s*(\d+)px/)
      if (!leftMatch) return false
      const x = parseInt(leftMatch[1])
      return x >= etcLeft && x < etcLeft + 232
    })

    return {
      clusterCardCount: clusterCards.length,
      machineNodeCount: machineNodes.length,
      cvdCardStyle: cvdCard?.getAttribute('style') ?? '',
      cvdAbsDivs: cvdAbsDivs.slice(0, 6),
      cvdNodeCount: cvdNodes.length,
      cvdNodePositions: cvdNodes.map(el => el.getAttribute('style') ?? ''),
      etcNodeCount: etcNodes.length,
    }
  })

  console.log(JSON.stringify({ outDir, metrics }, null, 2))
} finally {
  await browser.close()
}
