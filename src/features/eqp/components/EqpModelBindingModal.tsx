import { useEffect, useMemo, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildEqpUpdateRequest,
  EQP_SELECT_NONE_VALUE,
  findEqpModelOptionByVersionKey,
  getFilteredEqpModelOptions,
  getModelNameOptions,
  getModelVersionOptions,
  resolveAllowedModelStatus,
} from '../lib/eqp-management.util'
import type { EqpJarOption, EqpManageDetail, EqpManageOptions, EqpUpdateRequest } from '../types/eqp.types'

interface EqpModelBindingModalProps {
  open: boolean
  detail: EqpManageDetail | null
  options: EqpManageOptions | null
  isLoading: boolean
  isOptionsLoading: boolean
  isPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (request: EqpUpdateRequest) => void | Promise<void>
}

const toSelectValue = (value: string): string | undefined => (value ? value : undefined)

const resolveOptionalSelectValue = (value: string): string | null => {
  const normalized = value.trim()
  if (!normalized || normalized === EQP_SELECT_NONE_VALUE) {
    return null
  }
  return normalized
}

interface JarSelectOption {
  value: string
  label: string
}

const formatJarOptionLabel = (jarRef: number, jarFileName: string): string =>
  `${jarFileName} (#${jarRef})`

const buildJarSelectOptions = (
  baseOptions: readonly EqpJarOption[],
  selectedJarRef: number | null | undefined,
  selectedJarFileName: string | null | undefined,
): JarSelectOption[] => {
  const mergedOptions = new Map<number, JarSelectOption>()

  for (const option of baseOptions) {
    mergedOptions.set(option.jarRef, {
      value: String(option.jarRef),
      label: formatJarOptionLabel(option.jarRef, option.jarFileName),
    })
  }

  if (
    selectedJarRef !== null &&
    selectedJarRef !== undefined &&
    selectedJarRef > 0 &&
    selectedJarFileName &&
    !mergedOptions.has(selectedJarRef)
  ) {
    mergedOptions.set(selectedJarRef, {
      value: String(selectedJarRef),
      label: formatJarOptionLabel(selectedJarRef, selectedJarFileName),
    })
  }

  return Array.from(mergedOptions.values())
}

const resolveOptionalJarRef = (value: string): number | null => {
  const normalized = resolveOptionalSelectValue(value)
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Business Jar를 다시 선택해 주세요.')
  }

  return parsed
}

/**
 * EQP와 Model/Business Jar 연결을 변경하는 모달입니다.
 * is_dev와 protocol에 맞는 model/version만 선택하도록 필터링합니다.
 */
export function EqpModelBindingModal({
  open,
  detail,
  options,
  isLoading,
  isOptionsLoading,
  isPending,
  errorMessage,
  onOpenChange,
  onSubmit,
}: EqpModelBindingModalProps) {
  const [selectedModelName, setSelectedModelName] = useState('')
  const [selectedModelVersionKey, setSelectedModelVersionKey] = useState('')
  const [selectedBusinessJarRef, setSelectedBusinessJarRef] = useState(EQP_SELECT_NONE_VALUE)
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null)

  const filteredModelOptions = useMemo(
    () =>
      detail
        ? getFilteredEqpModelOptions(options, detail.commInterface, detail.isDev)
        : [],
    [detail, options],
  )
  const modelNameOptions = useMemo(
    () => getModelNameOptions(filteredModelOptions),
    [filteredModelOptions],
  )
  const modelVersionOptions = useMemo(
    () => getModelVersionOptions(filteredModelOptions, selectedModelName),
    [filteredModelOptions, selectedModelName],
  )
  const businessJarOptions = useMemo(
    () =>
      buildJarSelectOptions(
        options?.businessJarOptions ?? [],
        detail?.jars?.businessJarRef,
        detail?.jars?.businessJarFileName,
      ),
    [options?.businessJarOptions, detail?.jars?.businessJarRef, detail?.jars?.businessJarFileName],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    setSelectedModelName('')
    setSelectedModelVersionKey('')
    setSelectedBusinessJarRef(
      detail?.jars?.businessJarRef ? String(detail.jars.businessJarRef) : EQP_SELECT_NONE_VALUE,
    )
    setLocalErrorMessage(null)
  }, [open, detail])

  useEffect(() => {
    if (!open || !detail) {
      return
    }

    if (modelNameOptions.length === 0 || !selectedModelName) {
      if (selectedModelVersionKey) {
        setSelectedModelVersionKey('')
      }
      return
    }

    if (!modelNameOptions.includes(selectedModelName)) {
      setSelectedModelName('')
      if (selectedModelVersionKey) {
        setSelectedModelVersionKey('')
      }
      return
    }

    const nextModelName = selectedModelName
    const nextVersionOptions = getModelVersionOptions(filteredModelOptions, nextModelName)
    const hasSelectedVersion = nextVersionOptions.some(
      (option) => String(option.modelVersionKey) === selectedModelVersionKey,
    )
    const nextModelVersionKey = hasSelectedVersion
      ? selectedModelVersionKey
      : String(nextVersionOptions[0]?.modelVersionKey ?? '')

    if (nextModelVersionKey !== selectedModelVersionKey) {
      setSelectedModelVersionKey(nextModelVersionKey)
    }
  }, [
    open,
    detail,
    filteredModelOptions,
    modelNameOptions,
    selectedModelName,
    selectedModelVersionKey,
  ])

  const mergedErrorMessage = localErrorMessage ?? errorMessage

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      onOpenChange(nextOpen)
    }
  }

  const handleSave = async () => {
    try {
      setLocalErrorMessage(null)

      if (!detail) {
        throw new Error('설비 관리 상세 정보를 불러오지 못했습니다.')
      }

      const normalizedModelVersionKey = Number(selectedModelVersionKey)
      if (!Number.isInteger(normalizedModelVersionKey) || normalizedModelVersionKey <= 0) {
        throw new Error('Model Version을 선택해 주세요.')
      }

      const request = buildEqpUpdateRequest(detail, {
        modelVersionKey: normalizedModelVersionKey,
        businessJarRef: resolveOptionalJarRef(selectedBusinessJarRef),
      })

      await onSubmit(request)
    } catch (error) {
      setLocalErrorMessage(error instanceof Error ? error.message : '입력값을 다시 확인해 주세요.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="z-[60] max-w-[720px] rounded-2xl p-0" showCloseButton={!isPending}>
        <div className="flex flex-col">
          <DialogHeader className="border-b border-[#E4EAE6] px-6 py-5">
            <DialogTitle>Model Info Update</DialogTitle>
            <DialogDescription>
              EQP에 연결된 Model Version과 Business Jar를 변경합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {isLoading && !detail ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-[#65726B]">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                설비 관리 정보를 불러오는 중입니다.
              </div>
            ) : (
              <>
                <section className="grid gap-4 rounded-2xl border border-[#E4EAE6] bg-[#FAFCFB] p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-[#1E3D33]">EQP ID</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-[#E4EAE6] bg-[#F4F7F5] px-3 text-sm text-[#51605A]">
                      {detail?.eqpId ?? '-'}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#1E3D33]">허용 모델 상태</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-[#E4EAE6] bg-[#F4F7F5] px-3 text-sm text-[#51605A]">
                      {detail ? `${resolveAllowedModelStatus(detail.isDev)} / ${detail.commInterface}` : '-'}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#1E3D33]">현재 Model</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-[#E4EAE6] bg-[#F4F7F5] px-3 text-sm text-[#51605A]">
                      {detail?.modelBinding?.modelName ?? '-'}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#1E3D33]">현재 Version</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-[#E4EAE6] bg-[#F4F7F5] px-3 text-sm text-[#51605A]">
                      {detail?.modelBinding?.modelVersion ?? '-'}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 rounded-2xl border border-[#E4EAE6] bg-[#FAFCFB] p-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1E3D33]">Model Name</label>
                    <Select
                      value={toSelectValue(selectedModelName)}
                      onValueChange={setSelectedModelName}
                      disabled={isPending || isOptionsLoading || modelNameOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Model Name을 선택해 주세요." />
                      </SelectTrigger>
                      <SelectContent>
                        {modelNameOptions.map((modelName) => (
                          <SelectItem key={modelName} value={modelName}>
                            {modelName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-[#738078]">
                      {detail
                        ? `is_dev=${detail.isDev ? 'true' : 'false'} 기준으로 ${resolveAllowedModelStatus(detail.isDev)} 모델만 표시됩니다.`
                        : ''}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1E3D33]">Model Version</label>
                    <Select
                      value={toSelectValue(selectedModelVersionKey)}
                      onValueChange={setSelectedModelVersionKey}
                      disabled={isPending || isOptionsLoading || modelVersionOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Model Version을 선택해 주세요." />
                      </SelectTrigger>
                      <SelectContent>
                        {modelVersionOptions.map((option) => (
                          <SelectItem key={option.modelVersionKey} value={String(option.modelVersionKey)}>
                            {`${option.modelVersion} (${option.status})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-[#1E3D33]">Business Jar</label>
                    <Select
                      value={toSelectValue(selectedBusinessJarRef)}
                      onValueChange={setSelectedBusinessJarRef}
                      disabled={isPending || isOptionsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Business Jar를 선택해 주세요." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EQP_SELECT_NONE_VALUE}>미선택</SelectItem>
                        {businessJarOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#1E3D33]">선택 상태</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-[#E4EAE6] bg-[#F4F7F5] px-3 text-sm text-[#51605A]">
                      {findEqpModelOptionByVersionKey(
                        modelVersionOptions,
                        Number(selectedModelVersionKey),
                      )?.status ?? '-'}
                    </div>
                  </div>
                </section>

                {modelNameOptions.length === 0 ? (
                  <p className="rounded-xl border border-[#F0D9C7] bg-[#FFF7F1] px-3 py-2 text-sm text-[#A7662B]">
                    현재 EQP 조건에 맞는 model/version 옵션이 없습니다.
                  </p>
                ) : null}

                {mergedErrorMessage ? (
                  <p className="rounded-xl border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
                    {mergedErrorMessage}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="border-t border-[#E4EAE6] px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-[#D7E1DB] px-4 text-xs font-semibold"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full bg-[#1C7F59] px-4 text-xs font-semibold text-white hover:bg-[#166749]"
              onClick={() => void handleSave()}
              disabled={isPending || isLoading || isOptionsLoading || !detail}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
