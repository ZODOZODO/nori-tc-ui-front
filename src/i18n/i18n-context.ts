import { createContext, useContext } from 'react'

export type Lang = 'ko' | 'en'

export interface I18nContextValue {
  lang: Lang
  setLang: (next: Lang) => void
  t: (key: string) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

/**
 * i18n 컨텍스트 접근 훅입니다. Provider 외부에서 호출하면 예외를 던집니다.
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (context === null) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
