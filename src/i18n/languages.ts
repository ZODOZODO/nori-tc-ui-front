import type { Lang } from './i18n-context'

// 지원 언어 목록 — 라벨은 각 언어 고유 표기. 추가 언어는 이 배열 + 해당 locale JSON 으로 확장.
// LanguageToggle 과 LoginPage 의 별도 토글이 같은 순환 순서를 공유하도록 컴포넌트와 분리해 export.
export const LANGUAGES: readonly { code: Lang; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
]
