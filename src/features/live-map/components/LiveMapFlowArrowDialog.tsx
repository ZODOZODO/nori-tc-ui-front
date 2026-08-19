import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/i18n/i18n-context'
import {
  LIVE_MAP_FLOW_ARROW_DEFAULT_STYLE,
  type LiveMapFlowArrow,
  type LiveMapFlowArrowDash,
  type LiveMapFlowArrowPatch,
} from '../lib/live-map-flow.model'

/** 화살표 색 프리셋 — 그룹 색 프리셋과 동일 팔레트(시각 일관성). */
const ARROW_COLOR_PRESETS = [
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#0ea5e9',
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#64748b',
] as const

const ARROW_WIDTH_PRESETS = [2, 3, 4, 6] as const

const ARROW_DASH_OPTIONS: readonly { value: LiveMapFlowArrowDash; labelKey: string }[] = [
  { value: 'solid', labelKey: 'livemap.flow.arrowStyleSolid' },
  { value: 'dashed', labelKey: 'livemap.flow.arrowStyleDashed' },
  { value: 'dotted', labelKey: 'livemap.flow.arrowStyleDotted' },
]

/**
 * 공정 흐름 화살표 생성/편집 다이얼로그입니다. arrow=null 이면 생성 모드.
 * 부모가 대상 전환 시 key 로 remount 해 폼 상태를 초기화합니다.
 */
export function LiveMapFlowArrowDialog({
  arrow,
  groupOptions,
  onClose,
  onSubmit,
  onDelete,
}: {
  arrow: LiveMapFlowArrow | null
  /** 끝점 후보 그룹 — title 은 미배정 i18n 라벨까지 해석 완료된 표시명. */
  groupOptions: readonly { id: string; title: string }[]
  onClose: () => void
  onSubmit: (patch: LiveMapFlowArrowPatch) => void
  /** 편집 모드에서만 전달 — 생성 모드에선 삭제 버튼 미노출. */
  onDelete?: () => void
}) {
  const { t } = useI18n()
  const [fromGroupId, setFromGroupId] = useState(arrow?.fromGroupId ?? groupOptions[0]?.id ?? '')
  const [toGroupId, setToGroupId] = useState(
    arrow?.toGroupId ?? groupOptions.find((option) => option.id !== groupOptions[0]?.id)?.id ?? '',
  )
  const [color, setColor] = useState<string | null>(
    arrow ? arrow.color : LIVE_MAP_FLOW_ARROW_DEFAULT_STYLE.color,
  )
  const [strokeWidth, setStrokeWidth] = useState<number>(
    arrow?.strokeWidth ?? LIVE_MAP_FLOW_ARROW_DEFAULT_STYLE.strokeWidth,
  )
  const [dash, setDash] = useState<LiveMapFlowArrowDash>(
    arrow?.dash ?? LIVE_MAP_FLOW_ARROW_DEFAULT_STYLE.dash,
  )
  const isValid = fromGroupId.length > 0 && toGroupId.length > 0 && fromGroupId !== toGroupId

  const endpointSelect = (
    label: string,
    value: string,
    onChange: (groupId: string) => void,
    testId: string,
  ) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-testid={testId} className="h-9 w-full rounded-[12px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groupOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-105">
        <DialogHeader>
          <DialogTitle>
            {arrow ? t('livemap.flow.editArrow') : t('livemap.flow.addArrow')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            {endpointSelect(
              t('livemap.flow.arrowFrom'),
              fromGroupId,
              setFromGroupId,
              'live-map-flow-arrow-from',
            )}
            {endpointSelect(
              t('livemap.flow.arrowTo'),
              toGroupId,
              setToGroupId,
              'live-map-flow-arrow-to',
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('livemap.flow.arrowColor')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setColor(null)}
                aria-pressed={color === null}
                className={`flex h-7 items-center rounded-pill border px-2.5 text-[11px] font-bold transition-colors ${
                  color === null
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('livemap.flow.colorNone')}
              </Button>
              {ARROW_COLOR_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setColor(preset)}
                  aria-label={preset}
                  aria-pressed={color === preset}
                  className={`size-7 rounded-full border-2 transition-transform ${
                    color === preset ? 'scale-110 border-foreground' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('livemap.flow.arrowWidth')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {ARROW_WIDTH_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStrokeWidth(preset)}
                  aria-pressed={strokeWidth === preset}
                  data-testid={`live-map-flow-arrow-width-${preset}`}
                  className={`flex h-8 w-12 items-center justify-center rounded-[10px] border transition-colors ${
                    strokeWidth === preset
                      ? 'border-brand-primary bg-brand-primary/10'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <span
                    className="w-7 rounded-full bg-foreground"
                    style={{ height: preset }}
                  />
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('livemap.flow.arrowStyle')}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {ARROW_DASH_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDash(option.value)}
                  aria-pressed={dash === option.value}
                  data-testid={`live-map-flow-arrow-dash-${option.value}`}
                  className={`flex h-7 items-center rounded-pill border px-2.5 text-[11px] font-bold transition-colors ${
                    dash === option.value
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(option.labelKey)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          {onDelete ? (
            <Button
              variant="destructive"
              data-testid="live-map-flow-arrow-delete"
              onClick={onDelete}
              className="mr-auto"
            >
              {t('livemap.flow.deleteArrow')}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!isValid}
            data-testid="live-map-flow-arrow-submit"
            onClick={() => onSubmit({ fromGroupId, toGroupId, color, strokeWidth, dash })}
          >
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
