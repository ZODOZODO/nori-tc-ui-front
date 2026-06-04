import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n, type Lang } from './i18n-context'

// 지원 언어 목록 — 라벨은 각 언어 고유 표기. 추가 언어는 이 배열 + 해당 locale JSON 으로 확장.
const LANGUAGES: readonly { code: Lang; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
]

/**
 * 다국어 선택 드롭다운입니다. 현재 언어를 표시하고, 펼쳐서 다른 언어를 선택합니다.
 */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  const currentLanguage = LANGUAGES.find((item) => item.code === lang) ?? LANGUAGES[0]

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="h-[38px] gap-1.5 rounded-full border-border px-3.5 text-sm font-medium text-muted-foreground"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('language.toggleLabel')}
      >
        <Globe className="size-4" aria-hidden="true" />
        {currentLanguage.label}
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </Button>

      {isOpen ? (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-[var(--z-dropdown)] min-w-[148px] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-soft-lg"
        >
          {LANGUAGES.map((item) => {
            const isActive = item.code === lang
            return (
              <li key={item.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    setLang(item.code)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus:bg-muted focus:outline-none ${
                    isActive ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                  }`}
                >
                  {item.label}
                  {isActive ? <Check className="size-4 text-brand-primary" aria-hidden="true" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
