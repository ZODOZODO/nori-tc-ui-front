import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from './index'

interface I18nProviderProps {
  children: ReactNode
}

/**
 * react-i18next 인스턴스를 트리에 주입하는 Provider.
 * 언어 결정 / 리소스 lazy-load / flat key 설정은 ./index 의 i18n init 이 담당한다.
 */
export function I18nProvider({ children }: I18nProviderProps) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
