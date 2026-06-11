import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'
import type { ModelInfo, ProtocolType } from '../types/model.types'

type ModelCreateOrUpdateMode = 'create' | 'update'

interface ModelCreateOrUpdateModalProps {
  open: boolean
  mode: ModelCreateOrUpdateMode
  interfaceType: ProtocolType
  targetModel: ModelInfo | null
  isPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (request: { modelName: string; maker: string | null }) => void | Promise<void>
}

/**
 * root model 생성/수정 공통 모달입니다.
 * update 모드에서는 modelName을 읽기 전용으로 유지합니다.
 */
export function ModelCreateOrUpdateModal({
  open,
  mode,
  interfaceType,
  targetModel,
  isPending,
  errorMessage,
  onOpenChange,
  onSubmit,
}: ModelCreateOrUpdateModalProps) {
  const { t } = useI18n()
  const [modelName, setModelName] = useState(() => targetModel?.modelName ?? '')
  const [maker, setMaker] = useState(() => targetModel?.maker ?? '')
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)

  const dialogTitle = mode === 'create'
    ? interfaceType === 'SOCKET'
      ? 'Socket Model Create'
      : 'SECS Model Create'
    : 'Model Info Update'

  const dialogDescription =
    mode === 'create'
      ? t('model.create.descCreate')
      : t('model.create.descUpdate')

  const handleSubmit = async () => {
    const normalizedModelName = modelName.trim()
    if (mode === 'create' && !normalizedModelName) {
      setFormErrorMessage(t('model.create.nameRequired'))
      return
    }

    setFormErrorMessage(null)

    await onSubmit({
      modelName: normalizedModelName || targetModel?.modelName || '',
      maker: maker.trim() ? maker.trim() : null,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent
        className="max-w-140"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <section className="rounded-2xl border border-border bg-muted p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-foreground">{t('model.create.sectionBasic')}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('model.create.basicHint')}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Model Name
                  {mode === 'create' ? <span className="ml-1 text-danger">*</span> : null}
                </label>
                <Input
                  value={modelName}
                  onChange={(event) => setModelName(event.target.value)}
                  readOnly={mode === 'update'}
                  className={mode === 'update' ? 'bg-muted' : undefined}
                  placeholder={t('common.example', { value: 'MODEL_A' })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">Maker</label>
                <Input
                  value={maker}
                  onChange={(event) => setMaker(event.target.value)}
                  placeholder={t('model.create.makerPlaceholder')}
                />
              </div>
            </div>
          </section>

          {formErrorMessage ? (
            <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {formErrorMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
