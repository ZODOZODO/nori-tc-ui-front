import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/i18n-context'
import { useThemeStore } from '@/shared/stores/theme.store'

/**
 * light ↔ dark 테마 전환 토글입니다. 현재 테마의 반대 아이콘을 표시합니다.
 */
export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const { t } = useI18n()

  const isDark = theme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      className="size-9.5 rounded-full border border-border text-muted-foreground"
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
    >
      {isDark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </Button>
  )
}
