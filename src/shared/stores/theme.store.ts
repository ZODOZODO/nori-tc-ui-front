import { create } from 'zustand'

export type AppTheme = 'light' | 'dark'

const STORAGE_KEY = 'nori-tc-theme'

/** `.dark` 클래스로 oklch 토큰 cascade 를 전환한다 (index.css `@custom-variant dark`). */
function applyThemeClass(theme: AppTheme): void {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function readInitialTheme(): AppTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

interface ThemeState {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  toggleTheme: () => void
}

const initialTheme = readInitialTheme()
// 모듈 로드 시점에 즉시 적용 — main.tsx 가 이 store 를 import 해 첫 페인트 전 .dark 반영.
applyThemeClass(initialTheme)

/**
 * 앱 전역 다크/라이트 테마 상태 저장소입니다.
 *
 * - localStorage 에 영구 저장되어 새로고침/페이지 이동 시 테마가 유지됩니다.
 * - 변경 시 document.documentElement 의 `.dark` 클래스를 토글해 토큰 cascade 를 전환합니다.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    window.localStorage.setItem(STORAGE_KEY, theme)
    applyThemeClass(theme)
    set({ theme })
  },
  toggleTheme: () =>
    set((state) => {
      const next: AppTheme = state.theme === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(STORAGE_KEY, next)
      applyThemeClass(next)
      return { theme: next }
    }),
}))
