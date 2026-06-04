import i18n from '@/i18n'

const DATE_LOCALE_BY_LANG: Record<string, string> = {
  ko: 'ko-KR',
  en: 'en-US',
}

/**
 * 현재 UI 언어에 맞는 Intl 날짜 locale 을 돌려준다.
 * 표시용 날짜 포맷(formatDateTime / formatLastUpdated 등)이 모듈 로드 시점이 아닌
 * 호출 시점에 평가되어 언어 전환에 반응하도록 getter 로 둔다. detector 가 ko/en 으로만
 * 수렴하므로 그 외 값은 en-US 로 폴백한다.
 */
export const resolveDateLocale = (): string => DATE_LOCALE_BY_LANG[i18n.language] ?? 'en-US'
