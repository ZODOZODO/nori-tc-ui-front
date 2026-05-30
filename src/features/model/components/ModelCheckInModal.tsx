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

interface ModelCheckInModalProps {
  open: boolean
  isPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onCancel: () => void
  onUndo: () => void | Promise<void>
  onSave: (description: string) => void | Promise<void>
}

/**
 * Model Check In 저장 모달입니다.
 * - Cancel: 모달 닫기
 * - Undo: EDIT 상태 원복
 * - Save: 신규 버전 생성
 */
export function ModelCheckInModal({
  open,
  isPending,
  errorMessage,
  onOpenChange,
  onCancel,
  onUndo,
  onSave,
}: ModelCheckInModalProps) {
  const formKey = open ? 'open' : 'closed'

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (isPending) {
        return
      }
      onOpenChange(nextOpen)
    }}>
      {open ? (
        <ModelCheckInModalBody
          key={formKey}
          isPending={isPending}
          errorMessage={errorMessage}
          onCancel={onCancel}
          onUndo={onUndo}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  )
}

interface ModelCheckInModalBodyProps {
  isPending: boolean
  errorMessage: string | null
  onCancel: () => void
  onUndo: () => void | Promise<void>
  onSave: (description: string) => void | Promise<void>
}

/**
 * 모달이 열릴 때마다 새로 마운트되는 입력 본문입니다.
 *
 * props -> state 동기화 effect를 두지 않고, open 시점 remount로 초기값을 재설정합니다.
 */
function ModelCheckInModalBody({
  isPending,
  errorMessage,
  onCancel,
  onUndo,
  onSave,
}: ModelCheckInModalBodyProps) {
  const [description, setDescription] = useState('')

  const handleSave = async () => {
    await onSave(description.trim())
  }

  const handleUndo = async () => {
    await onUndo()
  }

  return (
    <DialogContent className="z-[60] max-w-[500px] rounded-2xl" showCloseButton={!isPending}>
      <DialogHeader>
        <DialogTitle>Save your changes?</DialogTitle>
        <DialogDescription>Save changes and return to Check Out mode?</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="model-checkin-description" className="text-xs font-semibold text-foreground">
            Description
          </label>
          <textarea
            id="model-checkin-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="변경 내용을 입력해 주세요."
            disabled={isPending}
            rows={3}
            className="resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 disabled:cursor-not-allowed disabled:bg-muted"
          />
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      <DialogFooter className="gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full border-border px-4 text-xs font-semibold"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full border-border px-4 text-xs font-semibold text-muted-foreground"
          onClick={() => void handleUndo()}
          disabled={isPending}
        >
          Undo
        </Button>
        <Button
          type="button"
          className="h-9 rounded-full bg-brand-primary px-4 text-xs font-semibold text-white hover:bg-brand-primary/90"
          onClick={() => void handleSave()}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
