import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/i18n-context'
import { useLineList } from '@/shared/hooks/useLineList'
import { ALL_LINES_VALUE, useLineScopeStore } from '@/shared/stores/line-scope.store'

interface LineScopeOption {
  value: string
  label: string
}

/**
 * 상단바 라인 스코프 드롭다운입니다.
 *
 * <p>GET /api/line 로 활성 라인 목록을 채우고(line_code 정렬), 선택 라인을 전역 스코프로 둡니다.
 * 드롭다운 스타일은 LanguageToggle 을 답습합니다.</p>
 */
export function LineScopeSelector() {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedLineValue = useLineScopeStore((state) => state.selectedLineValue)
  const setSelectedLineValue = useLineScopeStore((state) => state.setSelectedLineValue)
  const lineListQuery = useLineList()

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

  const options = useMemo<LineScopeOption[]>(() => {
    const lineOptions = (lineListQuery.data ?? []).map((line) => ({
      value: line.lineCode,
      label: line.lineName,
    }))
    return [{ value: ALL_LINES_VALUE, label: t('lineScope.all') }, ...lineOptions]
  }, [lineListQuery.data, t])

  const currentOption =
    options.find((option) => option.value === selectedLineValue) ?? options[0]

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="h-[38px] gap-1.5 rounded-full border-border px-3.5 text-sm font-medium text-muted-foreground"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('lineScope.toggleLabel')}
        data-testid="line-scope-trigger"
      >
        <Layers className="size-4" aria-hidden="true" />
        {currentOption?.label ?? t('lineScope.all')}
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </Button>

      {isOpen ? (
        <ul
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-[var(--z-dropdown)] max-h-[320px] min-w-[180px] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-soft-lg"
        >
          {options.map((option) => {
            const isActive = option.value === selectedLineValue
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-testid={`line-scope-option-${option.value}`}
                  onClick={() => {
                    setSelectedLineValue(option.value)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus:bg-muted focus:outline-none ${
                    isActive ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                  }`}
                >
                  {option.label}
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
