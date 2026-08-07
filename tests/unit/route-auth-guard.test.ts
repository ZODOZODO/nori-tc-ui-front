import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 순서 88·322(react-router v8 이관) 회귀 게이트.
 *
 * 그 이관 커밋(`458cd2a`)은 `src` 11 파일을 바꿨는데 테스트는 0 건이었다. 바뀐 파일에
 * 순서 42 가 세운 라우트 인증 가드(`RequireAuth.tsx`)와 라우트 트리(`Router.tsx`)가 들어 있다.
 * 이관 검증은 tsc / lint / build / e2e 스윕으로 했지만 그 중 git 에 남아 CI 에서 다시 도는 것은
 * 없다(e2e 는 로컬 전용·gitignore). 그래서 "다음 사람이 되돌려도 아무것도 울리지 않는" 상태였다.
 *
 * 검증은 소스 수준이다 — `error-boundary.test.ts` 머리말에 적힌 것과 같은 제약이다.
 * `node --experimental-strip-types` 는 JSX 를 변환하지 못해 `.tsx` 를 import 할 수 없고
 * jsdom/RTL 도 없다. 다만 이 이관의 회귀 표면 자체가 **import 출처와 가드 배치**라서
 * 소스 단언으로 정확히 덮인다(실제 렌더 판정은 Playwright e2e 담당).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readSource = (relativePath: string) => readFileSync(join(ROOT, relativePath), 'utf8')

/**
 * `src` 아래의 모든 소스 파일 경로를 모읍니다.
 *
 * @param directory 탐색 시작 디렉터리(절대 경로)
 * @returns 소스 파일 절대 경로 목록
 */
function collectSourceFiles(directory: string): string[] {
  const collected: string[] = []
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) {
      collected.push(...collectSourceFiles(full))
      continue
    }
    if (/\.(ts|tsx)$/.test(entry)) {
      collected.push(full)
    }
  }
  return collected
}

test('보호 라우트 가드가 미인증에서 본문 대신 /login 리다이렉트를 반환한다', () => {
  const source = readSource('src/app/RequireAuth.tsx')

  // 사후 401 인터셉터로 되돌아가면(가드 제거) 이전 사용자 상태가 먼저 그려진다 — S09 E-3 의 결함.
  assert.match(source, /meQuery\.isError \|\| !meQuery\.data/, '미인증 판정 분기가 사라졌다')
  assert.match(source, /<Navigate to=\{LOGIN_ROUTE\} replace \/>/, '미인증 리다이렉트가 사라졌다')
  // 판정 전에 본문을 렌더하면 같은 잔여 렌더가 생긴다 — pending 은 반드시 자체 화면이어야 한다.
  assert.match(source, /meQuery\.isPending/, 'pending 분기가 사라져 판정 전 본문이 렌더된다')
  assert.equal(
    source.indexOf('meQuery.isPending') < source.indexOf('return children'),
    true,
    'pending 판정이 children 반환보다 뒤에 있으면 판정 전 렌더가 일어난다',
  )
})

test('로그인·픽스처를 뺀 모든 라우트가 RequireAuth 로 감싸져 있다', () => {
  const router = readSource('src/app/Router.tsx')

  const guarded = (router.match(/<RequireAuth>/g) ?? []).length
  assert.equal(guarded, 6, `보호 라우트 수가 6 에서 ${guarded} 로 바뀌었다 — 라우트 추가 시 가드 누락 의심`)
  assert.equal(
    (router.match(/<\/RequireAuth>/g) ?? []).length,
    guarded,
    'RequireAuth 여닫는 태그 수가 다르다',
  )
  // 미매치 경로가 열려 있으면 가드를 우회한다.
  assert.match(router, /<Route path="\*" element=\{<Navigate to="\/login" replace \/>\}/)
})

test('react-router v8 이관이 되돌아가지 않는다 — react-router-dom 참조 0건', () => {
  const offenders = collectSourceFiles(join(ROOT, 'src'))
    .filter((file) => /from ['"]react-router-dom['"]/.test(readFileSync(file, 'utf8')))
    .map((file) => file.slice(ROOT.length + 1).replace(/\\/g, '/'))

  assert.deepEqual(
    offenders,
    [],
    `react-router-dom 재유입 — 그 패키지는 GHSA-qwww-vcr4-c8h2 로 순서 88 에서 제거했다: ${offenders.join(', ')}`,
  )

  const manifest = JSON.parse(readSource('package.json')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const declared = { ...manifest.dependencies, ...manifest.devDependencies }
  assert.equal(declared['react-router-dom'], undefined, 'package.json 에 react-router-dom 이 되살아났다')
  assert.match(declared['react-router'] ?? '', /^\^?8\./, 'react-router 가 8.x 밖으로 내려갔다')
})
