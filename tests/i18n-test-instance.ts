import i18next from 'i18next'
import ko from '../src/i18n/locales/ko.json' with { type: 'json' }
import en from '../src/i18n/locales/en.json' with { type: 'json' }
import { i18nBaseOptions } from '../src/i18n/config.ts'

/**
 * node --test 전용 i18n 인스턴스.
 *
 * 프로덕션 진입점 `src/i18n/index.ts` 는 LanguageDetector(window/localStorage) 와
 * resourcesToBackend(동적 import) 를 top-level init 에서 실행해 node(DOM 없음)에서 크래시한다.
 * lib 모듈(model-flow-editor / model-detail-editor / *.types)이 `import i18n from '@/i18n'`
 * 로 그 인스턴스를 끌어오므로, tests/alias-hooks.mjs 가 `@/i18n` 를 이 파일로 redirect 한다.
 *
 * prod 와 동일한 `i18nBaseOptions`(flat key / interpolation / fallback 계약)를 공유하고,
 * 실제 ko/en locale 을 inline resource 로 로드한다 — flow-card-render 테스트가
 * summarizeFlowFilter() == '필터 없음'(= i18n.t('model.flow.noFilter')) 을 assert 하므로
 * 키가 아닌 실제 ko 번역값이 반환돼야 한다. 베이스 언어 ko 고정.
 */
const i18n = i18next.createInstance()

await i18n.init({
  ...i18nBaseOptions,
  lng: 'ko',
  resources: {
    ko: { translation: ko },
    en: { translation: en },
  },
})

export default i18n
