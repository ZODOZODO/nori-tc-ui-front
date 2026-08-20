import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'
import { LIVE_MAP_FLOW_COLOR_PRESETS, type LiveMapFlowGroup } from '../lib/live-map-flow.model'

export interface LiveMapFlowGroupPatch {
  title: string
  subtitle: string
  color: string | null
}

/**
 * 공정 흐름 그룹 표시 속성(이름/부제/색) 편집 다이얼로그입니다.
 * 부모가 group 전환 시 key={group.id} 로 remount 해 폼 상태를 초기화합니다.
 */
export function LiveMapFlowGroupDialog({
  group,
  onClose,
  onSubmit,
}: {
  group: LiveMapFlowGroup
  onClose: () => void
  onSubmit: (patch: LiveMapFlowGroupPatch) => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState(group.title)
  const [subtitle, setSubtitle] = useState(group.subtitle)
  const [color, setColor] = useState<string | null>(group.color)
  const trimmedTitle = title.trim()

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-105">
        <DialogHeader>
          <DialogTitle>{t('livemap.flow.editGroup')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            {t('livemap.flow.groupName')}
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              data-testid="live-map-flow-group-title"
              className="h-9 rounded-[12px] text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
            {t('livemap.flow.groupSubtitle')}
            <Input
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              className="h-9 rounded-[12px] text-sm"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('livemap.flow.groupColor')}
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
              {LIVE_MAP_FLOW_COLOR_PRESETS.map((preset) => (
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={trimmedTitle.length === 0}
            data-testid="live-map-flow-group-submit"
            onClick={() => onSubmit({ title: trimmedTitle, subtitle: subtitle.trim(), color })}
          >
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
