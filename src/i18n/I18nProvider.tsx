import { useCallback, useMemo, useState, type ReactNode } from 'react'
import ko from './locales/ko.json'
import en from './locales/en.json'
import { I18nContext, type I18nContextValue, type Lang } from './i18n-context'

const STORAGE_KEY = 'nori-tc-lang'

const dictionaries: Record<Lang, Record<string, string>> = { ko, en }

/**
 * 초기 언어를 결정합니다.
 * 1) 사용자 설정(localStorage) 우선, 2) 없으면 브라우저 언어(Accept-Language 등가) 기반.
 */
function resolveInitialLang(): Lang {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'ko' || stored === 'en') {
    return stored
  }
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

interface I18nProviderProps {
  children: ReactNode
}

/**
 * 경량 i18n Provider — ko/en 메시지 사전과 언어 전환 상태를 제공합니다.
 * 외부 i18n 라이브러리 없이 React Context 만으로 1차 지원(2개 언어)을 구현합니다.
 */
export function I18nProvider({ children }: I18nProviderProps) {
  const [lang, setLangState] = useState<Lang>(resolveInitialLang)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next
  }, [])

  const t = useCallback((key: string) => dictionaries[lang][key] ?? key, [lang])

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
