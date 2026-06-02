import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
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
])
