import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve as resolvePath, join } from 'node:path'

/**
 * node --test 용 `@/` 경로 별칭 resolve hook.
 *
 * Vite/tsconfig 의 `@/* -> src/*` 별칭은 node 기본 resolver 가 모르므로, 별칭을 쓰는
 * 모듈을 단위 테스트가 로드하면 ERR_MODULE_NOT_FOUND 로 깨진다(빌드/e2e 는 Vite 가 해석해 정상).
 * 이 hook 을 `--import` 로 등록해 그 간극만 메운다.
 *
 * `@/i18n` 은 src/i18n/index.ts(브라우저 전용 init) 대신 node-safe 테스트 인스턴스로 redirect.
 */
const TESTS_DIR = resolvePath(fileURLToPath(import.meta.url), '..')
const ROOT = resolvePath(TESTS_DIR, '..')
const SRC = join(ROOT, 'src')
const I18N_INSTANCE = pathToFileURL(join(TESTS_DIR, 'i18n-test-instance.ts')).href

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/i18n' || specifier === '@/i18n/index' || specifier === '@/i18n/index.ts') {
      return { url: I18N_INSTANCE, shortCircuit: true }
    }
    if (specifier.startsWith('@/')) {
      const rel = specifier.slice(2)
      const candidates = [
        join(SRC, rel),
        join(SRC, `${rel}.ts`),
        join(SRC, `${rel}.tsx`),
        join(SRC, rel, 'index.ts'),
        join(SRC, rel, 'index.tsx'),
      ]
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true }
        }
      }
    }
    // 확장자 없는 상대 경로(`../types/eqp.types`)도 해석한다. Vite/tsc 는 확장자 생략을 허용하지만
    // node 기본 resolver 는 못 찾으므로, 값 import 를 쓰는 모듈(예: api)을 단위 테스트가 로드하면 깨진다.
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(specifier) &&
      context.parentURL
    ) {
      const base = resolvePath(fileURLToPath(context.parentURL), '..', specifier)
      const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true }
        }
      }
    }
    return nextResolve(specifier, context)
  },
})
