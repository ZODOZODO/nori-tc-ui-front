import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * SPEC `selectable-table-rollout` R6-AC (L137) — 가상화 1,000 행 스크롤 60fps 측정.
 *
 * `_perf_measure.mjs` 의 chromium-launch 구조를 답습한 standalone 측정 스크립트(playwright
 * test 아님). DEV 전용 fixture `/__fixtures/selectable-table?virtual=1&rows=1000` 를 띄워
 * 페이지에 rAF 레코더를 주입하고, 컨테이너를 프로그램 스크롤하며 프레임 타임스탬프를 수집한다.
 *   평균 fps = (프레임수 − 1) / 총 경과시간(s)
 *
 * 사전 조건: dev server 가 BASE_URL 에서 가동 중이어야 한다 (pnpm dev).
 *
 * 환경변수:
 *   BASE_URL    (기본 http://127.0.0.1:3000)
 *   ROWS        (기본 1000)
 *   OUTPUT_PATH 결과 JSON 저장 경로. 미지정 시 stdout 만.
 *   HEADLESS    'false' 면 브라우저 띄움 (기본 true)
 */

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const rows = Number(process.env.ROWS ?? '1000')
const OUTPUT_PATH = process.env.OUTPUT_PATH ?? ''
const HEADLESS = (process.env.HEADLESS ?? 'true') !== 'false'

const browser = await chromium.launch({ headless: HEADLESS })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

let result

try {
  await page.goto(`${baseUrl}/__fixtures/selectable-table?virtual=1&rows=${rows}`)
  await page.getByTestId('selectable-table-fixture').waitFor({ state: 'visible' })
  await page.waitForTimeout(500)

  // 페이지 컨텍스트에서 rAF 타임스탬프를 수집하며 컨테이너를 top→bottom 프로그램 스크롤.
  result = await page.evaluate(async () => {
    const container = document.querySelector('[data-testid="selectable-table-fixture"]')
    if (!container) {
      return { error: 'fixture container not found' }
    }
    const maxScroll = container.scrollHeight - container.clientHeight
    const frames = []
    let done = false

    const startScroll = container.scrollTop
    const SCROLL_MS = 2000
    let scrollStart = 0

    const record = (timestamp) => {
      frames.push(timestamp)
      if (scrollStart === 0) {
        scrollStart = timestamp
      }
      const progress = Math.min(1, (timestamp - scrollStart) / SCROLL_MS)
      container.scrollTop = startScroll + (maxScroll - startScroll) * progress
      if (progress >= 1) {
        done = true
        return
      }
      requestAnimationFrame(record)
    }
    requestAnimationFrame(record)

    await new Promise((resolve) => {
      const check = () => (done ? resolve() : setTimeout(check, 16))
      check()
    })

    const intervals = []
    for (let i = 1; i < frames.length; i += 1) {
      intervals.push(frames[i] - frames[i - 1])
    }
    const elapsedMs = frames[frames.length - 1] - frames[0]
    const avgFps = (frames.length - 1) / (elapsedMs / 1000)
    const maxIntervalMs = Math.max(...intervals)
    const minIntervalMs = Math.min(...intervals)
    return {
      frameCount: frames.length,
      elapsedMs: Number(elapsedMs.toFixed(1)),
      avgFps: Number(avgFps.toFixed(1)),
      maxIntervalMs: Number(maxIntervalMs.toFixed(2)),
      minIntervalMs: Number(minIntervalMs.toFixed(2)),
      maxScroll,
    }
  })
} finally {
  await browser.close()
}

const payload = {
  meta: {
    measuredAt: new Date().toISOString(),
    baseUrl,
    rows,
    route: `/__fixtures/selectable-table?virtual=1&rows=${rows}`,
  },
  ...result,
}

const json = JSON.stringify(payload, null, 2)

if (OUTPUT_PATH) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, json)
  console.log(`[fps] measurement saved -> ${OUTPUT_PATH}`)
}

console.log(json)
