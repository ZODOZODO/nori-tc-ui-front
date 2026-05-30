import { useMemo, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ModelInfo } from '../types/model.types'

const MAX_MODEL_NAME_LENGTH = 1000

interface BranchModelCreateModalProps {
  open: boolean
  parentModel: ModelInfo | null
  sourceVersions: ModelInfo[]
  defaultSourceModelVersionKey: number | null
  currentUserId: string | null
  isPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (request: { suffix: string; sourceModelVersionKey: number }) => void | Promise<void>
}

/**
 * root model 기준 branch 생성 모달입니다.
 * 실제 최종 model name은 suffix와 현재 로그인 userId를 조합해 미리 보여 줍니다.
 */
export function BranchModelCreateModal({
  open,
  parentModel,
  sourceVersions,
  defaultSourceModelVersionKey,
  currentUserId,
  isPending,
  errorMessage,
  onOpenChange,
  onSubmit,
}: BranchModelCreateModalProps) {
  const resolvedDefaultSourceModelVersionKey =
    defaultSourceModelVersionKey ?? sourceVersions[0]?.modelVersionKey ?? null
  const [suffix, setSuffix] = useState('')
  const [selectedSourceModelVersionKey, setSelectedSourceModelVersionKey] = useState(
    () =>
      resolvedDefaultSourceModelVersionKey ? String(resolvedDefaultSourceModelVersionKey) : '',
  )
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const normalizedParentModelName = parentModel?.modelName ?? '-'
  const normalizedCurrentUserId = currentUserId?.trim() ?? ''
  const normalizedSuffix = suffix.trim()

  const selectedSourceModel = useMemo(
    () =>
      sourceVersions.find(
        (version) => String(version.modelVersionKey) === selectedSourceModelVersionKey,
      ) ?? null,
    [selectedSourceModelVersionKey, sourceVersions],
  )

  const previewModelName = useMemo(() => {
    const normalizedUserId = normalizedCurrentUserId || '{userId}'

    if (!normalizedSuffix) {
      return `${normalizedParentModelName}_{suffix}_${normalizedUserId}`
    }

    return `${normalizedParentModelName}_${normalizedSuffix}_${normalizedUserId}`
  }, [normalizedCurrentUserId, normalizedParentModelName, normalizedSuffix])

  const finalModelName = useMemo(() => {
    if (!normalizedCurrentUserId || !parentModel?.modelName) {
      return null
    }

    return `${parentModel.modelName}_${normalizedSuffix}_${normalizedCurrentUserId}`
  }, [normalizedCurrentUserId, normalizedSuffix, parentModel])

  const remainingModelNameLength =
    finalModelName === null ? null : MAX_MODEL_NAME_LENGTH - finalModelName.length
  const isModelNameTooLong =
    remainingModelNameLength !== null && remainingModelNameLength < 0

  const handleSubmit = async () => {
    if (!normalizedSuffix) {
      setFormErrorMessage('suffix를 입력해 주세요.')
      return
    }

    if (!normalizedCurrentUserId) {
      setFormErrorMessage('현재 사용자 정보를 확인한 뒤 다시 시도해 주세요.')
      return
    }

    const normalizedSourceModelVersionKey = Number(selectedSourceModelVersionKey)
    if (!Number.isInteger(normalizedSourceModelVersionKey) || normalizedSourceModelVersionKey <= 0) {
      setFormErrorMessage('복제할 버전을 선택해 주세요.')
      return
    }

    if (isModelNameTooLong) {
      setFormErrorMessage('최종 Model Name이 1000자를 초과했습니다. suffix를 줄여 주세요.')
      return
    }

    setFormErrorMessage(null)
    await onSubmit({ suffix: normalizedSuffix, sourceModelVersionKey: normalizedSourceModelVersionKey })
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
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Branch Model Create</DialogTitle>
          <DialogDescription>
            선택한 root model 버전을 baseline branch로 복제하고, 생성 시점에는 임시 버전이 자동 부여됩니다.
            생성 직후에는 읽기 전용이며 실제 편집은 Check Out 후 EDIT 작업본에서 진행합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <section className="rounded-2xl border border-border bg-muted p-4">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">Parent Model</label>
                  <div className="flex h-11 items-center rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground">
                    {parentModel?.modelName ?? '-'}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Source Version
                    <span className="ml-1 text-danger">*</span>
                  </label>
                  <Select
                    value={selectedSourceModelVersionKey || undefined}
                    onValueChange={setSelectedSourceModelVersionKey}
                    disabled={isPending || sourceVersions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="복제할 버전을 선택해 주세요." />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceVersions.map((version) => (
                        <SelectItem key={version.modelVersionKey} value={String(version.modelVersionKey)}>
                          {`${version.modelVersion} (${version.status})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">Source Description</label>
                <div className="min-h-11 rounded-xl border border-border bg-muted px-3 py-3 text-sm text-muted-foreground">
                  {selectedSourceModel?.description?.trim() || '설명 없음'}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  suffix
                  <span className="ml-1 text-danger">*</span>
                </label>
                <Input
                  value={suffix}
                  onChange={(event) => setSuffix(event.target.value)}
                  placeholder="예: hotfix"
                />
                <p className="text-[11px] text-muted-foreground">
                  최종 모델명은 `parent + suffix + userId` 규칙으로 생성되며 최대 1000자까지 허용됩니다.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card px-3 py-3">
                <p className="text-[11px] font-semibold text-muted-foreground">최종 Model Name Preview</p>
                <p className="mt-1 break-all text-sm font-semibold text-foreground">{previewModelName}</p>
                <p
                  className={`mt-2 text-[11px] ${
                    isModelNameTooLong ? 'text-danger' : 'text-muted-foreground'
                  }`}
                >
                  {remainingModelNameLength === null
                    ? '현재 사용자 정보를 확인한 뒤 길이를 계산합니다.'
                    : isModelNameTooLong
                      ? `${Math.abs(remainingModelNameLength)}자 초과`
                      : `남은 길이 ${remainingModelNameLength}자`}
                </p>
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
          <Button
            onClick={() => void handleSubmit()}
            disabled={
              isPending ||
              !normalizedCurrentUserId ||
              isModelNameTooLong ||
              !selectedSourceModelVersionKey
            }
          >
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
