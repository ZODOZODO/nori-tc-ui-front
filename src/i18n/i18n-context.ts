import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

export type Lang = 'ko' | 'en' | 'vi'

export interface I18nContextValue {
  lang: Lang
  setLang: (next: Lang) => void
  t: (key: string, options?: Record<string, unknown>) => string
}

/**
 * 기존 경량 Context i18n 의 호환 shim — react-i18next 의 useTranslation 위에 동일 시그니처를
 * 제공한다. 기존 수백 개 `useI18n().t(key)` 호출처를 무수정으로 유지하면서, 추가로
 * `t(key, { var })` interpolation 을 그대로 위임받는다.
 */
export function useI18n(): I18nContextValue {
  const { t, i18n } = useTranslation()

  const translate = useCallback(
    (key: string, options?: Record<string, unknown>): string => t(key, options ?? {}),
    [t],
  )

  const setLang = useCallback(
    (next: Lang) => {
      void i18n.changeLanguage(next)
    },
    [i18n],
  )

  return { lang: i18n.language as Lang, setLang, t: translate }
}
