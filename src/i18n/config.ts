import type { InitOptions } from 'i18next'

/**
 * i18next 의 DOM 비의존 init 옵션. index.ts(prod)와 단위 테스트가 같은 객체를 공유해
 * flat key / interpolation / fallback 계약이 어긋나지 않도록 한다.
 * detection / backend / languageChanged 핸들러처럼 런타임(window/document) 에 의존하는
 * 부분은 index.ts 가 별도로 붙인다.
 */
export const i18nBaseOptions: InitOptions = {
  fallbackLng: 'ko', // ko 가 번역 베이스 — en 에 누락된 키는 ko 값으로 폴백.
  supportedLngs: ['ko', 'en'],
  // locale JSON 이 "eqp.sidebar.title" 같은 flat key 라 중첩 해석을 끈다. 미설정 시 전 키 깨짐.
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    escapeValue: false, // React 가 이미 XSS escape.
  },
  react: {
    useSuspense: false,
  },
}
