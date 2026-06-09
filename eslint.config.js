import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // eslint-plugin-react-hooks@7 flat.recommended 가 신규로 error 화한 규칙.
      // 레포 전반(ModelPage/EqpPage/EqpManageFormModal/EqpModelBindingModal/
      // LiveMapDemoModal/UserPasswordResetModal)의 기존 "prop/open 변화 시 상태 동기화"
      // 패턴을 위반으로 잡으나, 이는 v7 업그레이드로 새로 도입된 사전 부채다.
      // 빌드(eslint .)는 통과시키되 신호는 남기도록 error→warn 으로 둔다.
      // (전수 리팩터링은 라인 기능 PR 과 분리된 별도 정리 작업으로 진행)
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // i18n 미적용(하드코딩) 차단 게이트. 이 앱은 한국어가 소스 언어라 "미번역 = 하드코딩 한글" —
    // words.exclude 의 "한글 미포함" 정규식으로 영어 전용 리터럴(testid/SVG path/구분자 '·' 등
    // 번역 비대상)은 통과시키고, Hangul(가-힣 또는 호환 자모) 포함 리터럴만 잡는다. mode:'all' 로
    // JSX 텍스트·속성·JS 문자열(toast/zod 메시지 등) 전부 검사한다.
    // 기존 부채(2026-06 청산 완료) 이후, 새 하드코딩 한글은 빌드(eslint .)에서 error 로 차단한다.
    // 의도적 비번역(개발자용 throw·서버 메시지 매칭 등)은 eslint-disable-next-line + 사유 주석으로 명시.
    // src/dev/* 는 /__fixtures/* 경로 전용 dev 비주얼 픽스처(제품 화면 아님) — 번역 비대상.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/dev/**'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'all',
          'jsx-attributes': {
            exclude: ['className', 'styleName', 'style', 'type', 'key', 'id', 'width', 'height'],
          },
          words: { exclude: ['^[^\\uac00-\\ud7a3\\u3131-\\u318e]*$'] },
          // 템플릿 리터럴(`${x}층만 보기`) 안의 한글도 검사 — 기본값(false)은 이를 놓친다.
          'should-validate-template': true,
        },
      ],
    },
  },
])
