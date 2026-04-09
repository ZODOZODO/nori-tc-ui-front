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
      ? 'root model 기본 정보를 입력합니다. root는 기준선으로 유지되며 상세 변경은 branch에서 수행합니다.'
      : 'root model의 공통 정보를 수정합니다. Model Name은 변경할 수 없습니다.'

  const handleSubmit = async () => {
    const normalizedModelName = modelName.trim()
    if (mode === 'create' && !normalizedModelName) {
      setFormErrorMessage('Model Name을 입력해 주세요.')
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
        className="max-w-[560px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <section className="rounded-2xl border border-[#E4EAE6] bg-[#FAFCFB] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[#1F2D26]">기본 정보</h3>
              <p className="mt-1 text-xs text-[#65726B]">
                root model은 기준 정보만 수정할 수 있으며, 상세 편집은 branch checkout 이후에만 가능합니다.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#1E3D33]">
                  Model Name
                  {mode === 'create' ? <span className="ml-1 text-[#C5534B]">*</span> : null}
                </label>
                <Input
                  value={modelName}
                  onChange={(event) => setModelName(event.target.value)}
                  readOnly={mode === 'update'}
                  className={mode === 'update' ? 'bg-[#F4F7F5]' : undefined}
                  placeholder="예: MODEL_A"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#1E3D33]">Maker</label>
                <Input
                  value={maker}
                  onChange={(event) => setMaker(event.target.value)}
                  placeholder="제조사명을 입력해 주세요."
                />
              </div>
            </div>
          </section>

          {formErrorMessage ? (
            <p className="rounded-xl border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
              {formErrorMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-xl border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
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
