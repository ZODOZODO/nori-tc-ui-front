import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import resourcesToBackend from 'i18next-resources-to-backend'
import { i18nBaseOptions } from './config'

const STORAGE_KEY = 'nori-tc-lang'

/**
 * 초기 언어 결정 로직 — 기존 경량 Provider 의 resolveInitialLang 과 동등.
 * 1) localStorage('nori-tc-lang') 가 ko/en 이면 그 값, 2) 아니면 브라우저 언어가
 * ko 로 시작하면 'ko', 그 외 전부 'en'. (i18next 기본 fallback 동작과 달리
 * 비지원 locale 도 'en' 으로 수렴시켜 기존 동작을 보존한다.)
 */
const noriLanguageDetector = new LanguageDetector()
noriLanguageDetector.addDetector({
  name: 'noriInitial',
  lookup() {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'ko' || stored === 'en') {
      return stored
    }
    return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
  },
  cacheUserLanguage(lng: string) {
    window.localStorage.setItem(STORAGE_KEY, lng)
  },
})

// 언어 전환 시 <html lang> 동기화 — 기존 setLang 이 하던 일을 이벤트로 이전.
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})

/**
 * react-i18next 기반 i18n init 결과 Promise.
 * main.tsx 가 이 Promise 를 await 한 뒤 렌더하여 초기 언어 리소스가 로드되기 전
 * raw key 가 잠깐 노출되는 flash 를 막는다.
 */
export const i18nReady = i18n
  .use(initReactI18next)
  .use(noriLanguageDetector)
  // locale JSON 을 언어별로 동적 import → 메인 번들에서 분리. zh/ja/vi 는 json 추가만으로 확장.
  .use(resourcesToBackend((language: string) => import(`./locales/${language}.json`)))
  .init({
    ...i18nBaseOptions,
    detection: {
      order: ['noriInitial'],
      caches: ['noriInitial'],
    },
  })

export default i18n
