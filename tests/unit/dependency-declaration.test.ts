import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * src 가 import 하는 모든 외부 패키지가 package.json 에 선언되어 있는지 검사한다.
 *
 * 전이 의존(다른 패키지의 dependencies)으로 우연히 해석되는 import 는 계약이 아니다. 그 패키지가
 * 의존을 빼거나 hoisting 이 달라지면 lockfile 재생성·CI clean install 에서 `npm run build` 가 깨진다.
 * 실측 사례: `three-stdlib` 가 @react-three/drei 의 전이 의존으로만 해석되던 시점(감사 S09 A-3).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * `from '<spec>'` / `import '<spec>'` / `import('<spec>')` 의 모듈 지정자만 뽑는다.
 * 앞선 인용부호를 lookbehind 로 배제해야 `new Set(['from', 'path'])` 의 문자열 `'from'` 이
 * import 절로 오인되지 않는다(`model-detail-editor.ts:66` 실측 오탐).
 */
const SPECIFIER_PATTERN = /(?:(?<!['"])\bfrom|^\s*import|\bimport\()\s*['"]([^'"\n]+)['"]/gm

function collectSourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) found.push(...collectSourceFiles(path))
    else if (/\.tsx?$/.test(path)) found.push(path)
  }
  return found
}

/** `@scope/pkg/sub` → `@scope/pkg`, `pkg/sub` → `pkg`. */
function packageNameOf(specifier: string): string {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
}

function isExternalPackage(specifier: string): boolean {
  return !(
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('@/') ||
    specifier.startsWith('node:') ||
    specifier.startsWith('virtual:')
  )
}

test('src 의 모든 외부 패키지 import 가 package.json 에 선언되어 있다', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ])

  const undeclared = new Map<string, string[]>()
  for (const file of collectSourceFiles(join(ROOT, 'src'))) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(SPECIFIER_PATTERN)) {
      const specifier = match[1]
      if (!isExternalPackage(specifier)) continue
      const name = packageNameOf(specifier)
      if (declared.has(name)) continue
      const sites = undeclared.get(name) ?? []
      sites.push(file.slice(ROOT.length + 1))
      undeclared.set(name, sites)
    }
  }

  const report = [...undeclared.entries()].map(([name, sites]) => `${name} (${sites.join(', ')})`)
  assert.deepEqual(report, [], `package.json 미선언 패키지: ${report.join(' / ')}`)
})

test('three-stdlib 는 전이 의존이 아니라 직접 dependencies 로 선언되어 있다', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
  }
  // vite.config.ts 의 manualChunks 가 three-vendor 로 명시 라우팅하므로 빌드 구성이 이 패키지를 전제한다.
  assert.ok(
    manifest.dependencies?.['three-stdlib'],
    'three-stdlib 가 dependencies 에 없다 — @react-three/drei 전이 의존에만 의존하는 상태',
  )
})
