import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * S09 D-3 재현 — 에러 경계가 레포 전체 0건.
 *
 * 9개 페이지가 전부 `lazy()` 인데 `Suspense` 는 로딩만 처리하고 reject 는 통과시킨다. 배포로 청크
 * 해시가 바뀐 뒤 구 index.html 을 캐싱한 탭이 라우트를 이동하면 `import()` 가 404 로 reject 되고,
 * 잡는 경계가 없어 React 19 가 트리 전체를 언마운트한다 → 복구 UI 없는 백지.
 * 이 앱은 데이터 라우터(`createBrowserRouter`)가 아니라 `<BrowserRouter>+<Routes>` 조합이라
 * react-router 의 `errorElement` 는 적용 자체가 불가하다.
 *
 * 검증은 소스 수준이다 — `node --experimental-strip-types` 는 JSX 를 변환하지 못해 `.tsx` 를
 * import 할 수 없고(ERR_UNKNOWN_FILE_EXTENSION) jsdom/RTL 도 없어 mount 검증이 불가하다.
 * fallback 의 실제 렌더는 Playwright e2e 담당.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readSource = (relativePath: string) => readFileSync(join(ROOT, relativePath), 'utf8')

test('ErrorBoundary 가 React 클래스 경계 계약을 갖춘다', () => {
  const source = readSource('src/shared/components/ErrorBoundary.tsx')

  // 함수 컴포넌트로는 렌더 throw 를 잡을 수 없다 — 클래스 + 두 훅이 있어야 경계로 동작한다.
  assert.match(source, /class ErrorBoundary extends Component/)
  assert.match(source, /static getDerivedStateFromError\(error: Error\)/)
  assert.match(source, /componentDidCatch\(/)
  // 청크 404 는 새로고침으로 복구되므로 복구 동작이 fallback 에 있어야 한다.
  assert.match(source, /window\.location\.reload\(\)/)
})

test('에러 경계가 루트·라우트·3D 캔버스 3계층에 걸려 있다', () => {
  const main = readSource('src/main.tsx')
  assert.match(main, /<ErrorBoundary/, 'D-3 회귀: 루트 경계가 없다 — provider throw 가 백지로 간다')

  const router = readSource('src/app/Router.tsx')
  assert.match(router, /<ErrorBoundary/, 'D-3 회귀: 라우트 경계가 없다 — lazy 청크 404 가 백지로 간다')

  const liveMapPage = readSource('src/features/live-map/components/LiveMapPage.tsx')
  assert.match(
    liveMapPage,
    /<ErrorBoundary/,
    'D-3 회귀: 3D 캔버스 경계가 없다 — WebGL 생성 실패가 페이지 전체를 언마운트한다',
  )
})

test('루트 경계는 provider 보다 바깥에 있다', () => {
  const main = readSource('src/main.tsx')
  // I18nProvider·PersistQueryClientProvider 자체가 throw 하면 그 안쪽 경계로는 잡지 못한다.
  assert.ok(
    main.indexOf('<ErrorBoundary') < main.indexOf('<AppProvider'),
    'D-3 회귀: 루트 경계가 AppProvider 안쪽에 있어 provider throw 를 놓친다',
  )
})

test('라우트 경계는 pathname 으로 초기화된다', () => {
  const router = readSource('src/app/Router.tsx')
  // 초기화가 없으면 한 화면의 청크 404 가 이후 모든 라우트를 계속 막는다.
  assert.match(router, /<ErrorBoundary key=\{location\.pathname\}/)
})

test('fallback 문구가 3개 로케일에 모두 있다', () => {
  const keys = [
    'common.error.boundaryTitle',
    'common.error.boundaryHint',
    'common.error.boundaryReload',
  ]
  for (const locale of ['ko', 'en', 'vi']) {
    const catalog = JSON.parse(readSource(`src/i18n/locales/${locale}.json`)) as Record<string, string>
    for (const key of keys) {
      assert.ok(catalog[key], `${locale}.json 에 ${key} 가 없다`)
    }
  }
})
