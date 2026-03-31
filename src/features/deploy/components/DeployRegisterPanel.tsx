import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { EqpJarOption, EqpModelOption } from '@/features/eqp/types/eqp.types'
import { useMe } from '@/features/profile/hooks/useProfile'
import { createDeployName } from '../lib/deploy-utils'
import { useCreateDeploy } from '../hooks/useCreateDeploy'
import { useDeployEqpParamVersions } from '../hooks/useDeployEqpParamVersions'
import { useDeployRegisterOptions } from '../hooks/useDeployRegisterOptions'
import { useDeployRegisterTargets } from '../hooks/useDeployRegisterTargets'
import { useDeployScenarios } from '../hooks/useDeployScenarios'
import { useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployCreateRequest, DeployRegisterTargetItem, DeployScenarioSummary } from '../types/deploy.types'
import { DeployApiError } from '../api/deploy.api'

const EMPTY_SELECT_VALUE = '__empty__'
const EMPTY_REGISTER_TARGET_ITEMS: DeployRegisterTargetItem[] = []
const EMPTY_MODEL_OPTIONS: EqpModelOption[] = []
const EMPTY_JAR_OPTIONS: EqpJarOption[] = []
const DEPLOY_EVENT_TYPE = 'EQP_BUSINESS_JARFILE_UPDATE'

const cardClassName =
  'rounded-[18px] border border-[#E2E9E4] bg-white shadow-[0_10px_30px_-24px_rgba(30,54,40,0.35)]'

const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
  error instanceof Error && error.message ? error.message : fallbackMessage

const mergeModelOptions = (developModelOptions: EqpModelOption[], operateModelOptions: EqpModelOption[]) => {
  const mergedOptionMap = new Map<number, EqpModelOption>()

  for (const option of [...developModelOptions, ...operateModelOptions]) {
    mergedOptionMap.set(option.modelVersionKey, option)
  }

  return [...mergedOptionMap.values()]
}

const toUniqueModelOptions = (modelOptions: EqpModelOption[]) => {
  const uniqueModelMap = new Map<string, EqpModelOption>()

  for (const option of modelOptions) {
    if (!uniqueModelMap.has(option.modelName)) {
      uniqueModelMap.set(option.modelName, option)
    }
  }

  return [...uniqueModelMap.values()]
}

interface SelectedEquipmentRowProps {
  item: DeployRegisterTargetItem
  selectedEqpParamVersion?: string
  onChangeEqpParamVersion: (eqpId: string, eqpParamVersion: string) => void
  onRemove: (eqpId: string) => void
}

type DeployDialogState = {
  isSuccess: boolean
  message: string
}

type ScenarioDialogState = {
  isOpen: boolean
  selectedScenarioCode: string
  message: string
}

function SelectedEquipmentRow({
  item,
  selectedEqpParamVersion,
  onChangeEqpParamVersion,
  onRemove,
}: SelectedEquipmentRowProps) {
  const paramVersionsQuery = useDeployEqpParamVersions(item.eqpId)

  const paramVersionOptions = useMemo(() => {
    const versionSet = new Set<string>()

    if (selectedEqpParamVersion) {
      versionSet.add(selectedEqpParamVersion)
    }

    if (item.appliedParamVersion) {
      versionSet.add(item.appliedParamVersion)
    }

    for (const version of paramVersionsQuery.data ?? []) {
      versionSet.add(version)
    }

    return [...versionSet]
  }, [item.appliedParamVersion, paramVersionsQuery.data, selectedEqpParamVersion])

  const resolvedParamVersionValue =
    selectedEqpParamVersion ?? item.appliedParamVersion ?? paramVersionsQuery.data?.[0] ?? EMPTY_SELECT_VALUE

  return (
      <TableRow>
        <TableCell>{item.eqpId}</TableCell>
        <TableCell>{item.modelName ?? '-'}</TableCell>
        <TableCell>{item.modelVersion ?? '-'}</TableCell>
        <TableCell>{item.businessJarFileName ?? '-'}</TableCell>
      <TableCell>{item.commInterface}</TableCell>
      <TableCell>
        <Select
          value={resolvedParamVersionValue}
          onValueChange={(value) => {
            if (value !== EMPTY_SELECT_VALUE) {
              onChangeEqpParamVersion(item.eqpId, value)
            }
          }}
        >
          <SelectTrigger className="h-9 min-w-[160px]">
            <SelectValue placeholder="Eqp Param Version 선택" />
          </SelectTrigger>
          <SelectContent>
            {paramVersionOptions.length === 0 ? (
              <SelectItem value={EMPTY_SELECT_VALUE} disabled>
                {paramVersionsQuery.isLoading ? '버전 조회 중...' : '사용 가능한 버전이 없습니다.'}
              </SelectItem>
            ) : (
              paramVersionOptions.map((version) => (
                <SelectItem key={`${item.eqpId}-${version}`} value={version}>
                  {version}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {paramVersionsQuery.isError ? (
          <p className="mt-1 text-xs text-[#C5534B]">
            {getErrorMessage(
              paramVersionsQuery.error,
              '설비 파라미터 버전 목록을 조회하지 못했습니다.',
            )}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-lg text-[#6A7971] hover:bg-[#F3F7F5] hover:text-[#C5534B]"
          onClick={() => onRemove(item.eqpId)}
          aria-label={`${item.eqpId} 삭제`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function DeployRegisterPanel() {
  const registerFilters = useDeployUiStore((state) => state.registerFilters)
  const selectedEqpIds = useDeployUiStore((state) => state.selectedEqpIds)
  const selectedEqpTargetsById = useDeployUiStore((state) => state.selectedEqpTargetsById)
  const selectedEqpParamVersions = useDeployUiStore((state) => state.selectedEqpParamVersions)
  const selectedInterfaceType = useDeployUiStore((state) => state.selectedInterfaceType)
  const selectedModelName = useDeployUiStore((state) => state.selectedModelName)
  const selectedModelVersionKey = useDeployUiStore((state) => state.selectedModelVersionKey)
  const selectedBusinessJarRef = useDeployUiStore((state) => state.selectedBusinessJarRef)
  const hasSubmittedRegisterSearch = useDeployUiStore((state) => state.hasSubmittedRegisterSearch)
  const registerSearchRevision = useDeployUiStore((state) => state.registerSearchRevision)
  const submitRegisterSearch = useDeployUiStore((state) => state.submitRegisterSearch)
  const resetRegisterFilters = useDeployUiStore((state) => state.resetRegisterFilters)
  const addSelectedEqps = useDeployUiStore((state) => state.addSelectedEqps)
  const syncSelectedEqpTargets = useDeployUiStore((state) => state.syncSelectedEqpTargets)
  const removeSelectedEqp = useDeployUiStore((state) => state.removeSelectedEqp)
  const setSelectedEqpParamVersion = useDeployUiStore((state) => state.setSelectedEqpParamVersion)
  const setSelectedModelName = useDeployUiStore((state) => state.setSelectedModelName)
  const setSelectedModelVersionKey = useDeployUiStore((state) => state.setSelectedModelVersionKey)
  const setSelectedBusinessJarRef = useDeployUiStore((state) => state.setSelectedBusinessJarRef)
  const createServerDeployBridge = useDeployUiStore((state) => state.createServerDeployBridge)
  const clearRegisterState = useDeployUiStore((state) => state.clearRegisterState)

  const [draftModelName, setDraftModelName] = useState(registerFilters.modelName)
  const [draftModelVersionKey, setDraftModelVersionKey] = useState(
    registerFilters.modelVersionKey ? String(registerFilters.modelVersionKey) : EMPTY_SELECT_VALUE,
  )
  const [draftEqpId, setDraftEqpId] = useState(registerFilters.eqpId)
  const [searchSelectionIds, setSearchSelectionIds] = useState<string[]>([])
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [deployDialogState, setDeployDialogState] = useState<DeployDialogState | null>(null)
  const [scenarioDialogState, setScenarioDialogState] = useState<ScenarioDialogState>({
    isOpen: false,
    selectedScenarioCode: '',
    message: '',
  })

  const registerTargetsQuery = useDeployRegisterTargets(
    registerFilters,
    hasSubmittedRegisterSearch,
    registerSearchRevision,
  )
  const registerOptionsQuery = useDeployRegisterOptions()
  const meQuery = useMe(true)
  const createDeployMutation = useCreateDeploy()
  const deployScenariosQuery = useDeployScenarios(DEPLOY_EVENT_TYPE)

  const availableScenarios = useMemo(
    () => deployScenariosQuery.data?.scenarios ?? [],
    [deployScenariosQuery.data?.scenarios],
  )

  const registerTargetItems = useMemo(
    () =>
      hasSubmittedRegisterSearch
        ? registerTargetsQuery.data?.items ?? EMPTY_REGISTER_TARGET_ITEMS
        : EMPTY_REGISTER_TARGET_ITEMS,
    [hasSubmittedRegisterSearch, registerTargetsQuery.data?.items],
  )
  const registerTargetMap = useMemo(
    () => new Map(registerTargetItems.map((item) => [item.eqpId, item])),
    [registerTargetItems],
  )

  const mergedModelVersionOptions = useMemo(
    () =>
      mergeModelOptions(
        registerOptionsQuery.data?.developModelOptions ?? EMPTY_MODEL_OPTIONS,
        registerOptionsQuery.data?.operateModelOptions ?? EMPTY_MODEL_OPTIONS,
      ),
    [registerOptionsQuery.data?.developModelOptions, registerOptionsQuery.data?.operateModelOptions],
  )

  const searchModelOptions = useMemo(
    () => toUniqueModelOptions(mergedModelVersionOptions),
    [mergedModelVersionOptions],
  )

  const availableModelOptions = useMemo(() => {
    const interfaceFilteredOptions = selectedInterfaceType
      ? mergedModelVersionOptions.filter((option) => option.commInterface === selectedInterfaceType)
      : mergedModelVersionOptions

    return toUniqueModelOptions(interfaceFilteredOptions)
  }, [mergedModelVersionOptions, selectedInterfaceType])

  const availableModelVersionOptions = useMemo(
    () =>
      mergedModelVersionOptions.filter((option) => {
        if (selectedModelName && option.modelName !== selectedModelName) {
          return false
        }

        if (selectedInterfaceType && option.commInterface !== selectedInterfaceType) {
          return false
        }

        return true
      }),
    [mergedModelVersionOptions, selectedInterfaceType, selectedModelName],
  )

  const businessJarOptions = useMemo(
    () => registerOptionsQuery.data?.businessJarOptions ?? EMPTY_JAR_OPTIONS,
    [registerOptionsQuery.data?.businessJarOptions],
  )

  const currentModelVersion = useMemo(
    () =>
      mergedModelVersionOptions.find((option) => option.modelVersionKey === selectedModelVersionKey) ?? null,
    [mergedModelVersionOptions, selectedModelVersionKey],
  )

  const selectedBusinessJarOption = useMemo(
    () => businessJarOptions.find((option) => option.jarRef === selectedBusinessJarRef) ?? null,
    [businessJarOptions, selectedBusinessJarRef],
  )

  const selectedEqpItems = useMemo(
    () =>
      selectedEqpIds
        .map((eqpId) => selectedEqpTargetsById[eqpId])
        .filter((item): item is DeployRegisterTargetItem => Boolean(item)),
    [selectedEqpIds, selectedEqpTargetsById],
  )

  useEffect(() => {
    if (selectedEqpIds.length === 0 || registerTargetItems.length === 0) {
      return
    }

    syncSelectedEqpTargets(registerTargetItems.filter((item) => selectedEqpIds.includes(item.eqpId)))
  }, [registerTargetItems, selectedEqpIds, syncSelectedEqpTargets])

  const closeScenarioDialog = () => {
    setScenarioDialogState({
      isOpen: false,
      selectedScenarioCode: '',
      message: '',
    })
  }

  const openScenarioDialog = (
    message: string,
    selectedScenarioCode?: string,
  ) => {
    const trimmedCode = selectedScenarioCode?.trim()
    const fallbackScenarioCode = trimmedCode && trimmedCode.length > 0
      ? trimmedCode
      : scenarioDialogState.selectedScenarioCode
    const selectedCode = availableScenarios.find((scenario) => scenario.code === fallbackScenarioCode)?.code
      ?? availableScenarios[0]?.code
      ?? ''

    setScenarioDialogState({
      isOpen: true,
      selectedScenarioCode: selectedCode,
      message,
    })
  }

  const isScenarioRequiredError = (error: unknown): boolean => {
    const message = getErrorMessage(error, '')
    if (message.includes('resolvedScenarioCode')) {
      return true
    }

    if (error instanceof DeployApiError) {
      return error.payload.errorCode === 'INVALID_REQUEST' && message.includes('시나리오')
    }

    return message.includes('시나리오')
  }

  const buildDeployRequest = (resolvedScenarioCode?: string): DeployCreateRequest => {
    if (!selectedInterfaceType) {
      throw new Error('Deploy interfaceType 이 선택되지 않았습니다.')
    }

    const resolvedScenarioPayload =
      resolvedScenarioCode && resolvedScenarioCode !== EMPTY_SELECT_VALUE ? { resolvedScenarioCode } : {}

    return {
      deployName: createDeployName(currentModelVersion?.modelName ?? '', currentModelVersion?.modelVersion ?? ''),
      eventType: DEPLOY_EVENT_TYPE,
      executionPolicy: 'BEST_EFFORT',
      commonRequest: {
        interfaceType: selectedInterfaceType,
        uiMessage: {
          modelInfo: {
            modelVersionKey: currentModelVersion?.modelVersionKey,
            modelName: currentModelVersion?.modelName,
            modelVersion: currentModelVersion?.modelVersion,
            modelKey: currentModelVersion?.modelKey,
          },
          ...(selectedBusinessJarOption
            ? {
                businessJar: {
                  jarRef: selectedBusinessJarOption.jarRef,
                  jarFileName: selectedBusinessJarOption.jarFileName,
                },
              }
            : {}),
        },
        ...resolvedScenarioPayload,
      },
      targets: selectedEqpItems.map((item) => {
        const resolvedEqpParamVersion =
          selectedEqpParamVersions[item.eqpId] ?? item.appliedParamVersion ?? null

        return {
          eqpId: item.eqpId,
          ...(resolvedEqpParamVersion
            ? {
                uiMessageOverride: {
                  eqpParams: {
                    version: resolvedEqpParamVersion,
                  },
                },
              }
            : {}),
        }
      }),
    }
  }

  const handleDeploy = async () => {
    await executeDeploy()
  }

  const handleDeployWithScenario = async () => {
    await executeDeploy(scenarioDialogState.selectedScenarioCode)
  }

  const executeDeploy = async (resolvedScenarioCode?: string) => {
    if (selectedEqpItems.length === 0 || selectedModelVersionKey === null) {
      setFeedbackMessage('설비와 새 Model Version 을 모두 선택해 주세요.')
      openDeployDialog(false, '설비와 새 Model Version 을 모두 선택해 주세요.')
      return
    }

    if (!selectedInterfaceType) {
      setFeedbackMessage('서로 다른 Interface 의 설비는 한 번에 Deploy 할 수 없습니다.')
      openDeployDialog(false, '서로 다른 Interface 의 설비는 한 번에 Deploy 할 수 없습니다.')
      return
    }

    if (!currentModelVersion) {
      setFeedbackMessage('선택한 Model Version 정보를 확인할 수 없습니다.')
      openDeployDialog(false, '선택한 Model Version 정보를 확인할 수 없습니다.')
      return
    }

    const request = buildDeployRequest(resolvedScenarioCode)

    try {
      const result = await createDeployMutation.mutateAsync(request)
      setScenarioDialogState({
        isOpen: false,
        selectedScenarioCode: '',
        message: '',
      })
      createServerDeployBridge({
        deployKey: result.deployKey,
        deployStatus: result.deployStatus,
        requestedBy: meQuery.data?.userId?.trim() || 'SYSTEM',
        selectedModelVersion: currentModelVersion.modelVersion,
        selectedBusinessJarName: selectedBusinessJarOption?.jarFileName ?? null,
      })
      const successMessage =
        result.resultMessage?.message?.trim() ||
        `${createDeployName(currentModelVersion.modelName, currentModelVersion.modelVersion)} 배포 요청이 생성되었습니다.`
      resetRegisterLayouts()
      openDeployDialog(true, successMessage)
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Deploy 생성에 실패했습니다.')

      if (isScenarioRequiredError(error)) {
        openScenarioDialog(errorMessage, resolvedScenarioCode)
        setFeedbackMessage(errorMessage)
        return
      }

      setFeedbackMessage(errorMessage)
      openDeployDialog(false, errorMessage)
    }
  }

  const handleSearch = () => {
    submitRegisterSearch({
      modelName: draftModelName === EMPTY_SELECT_VALUE ? '' : draftModelName,
      modelVersionKey:
        draftModelVersionKey === EMPTY_SELECT_VALUE ? null : Number(draftModelVersionKey),
      eqpId: draftEqpId === EMPTY_SELECT_VALUE ? '' : draftEqpId.trim(),
    })
    setSearchSelectionIds([])
    setFeedbackMessage(null)
  }

  const handleClearSearch = () => {
    setDraftModelName(EMPTY_SELECT_VALUE)
    setDraftModelVersionKey(EMPTY_SELECT_VALUE)
    setDraftEqpId('')
    setSearchSelectionIds([])
    resetRegisterFilters()
    setFeedbackMessage(null)
  }

  const handleToggleSearchSelection = (eqpId: string) => {
    setSearchSelectionIds((currentIds) =>
      currentIds.includes(eqpId)
        ? currentIds.filter((currentId) => currentId !== eqpId)
        : [...currentIds, eqpId],
    )
  }

  const handleAddSelected = () => {
    if (searchSelectionIds.length === 0) {
      setFeedbackMessage('추가할 설비를 먼저 선택해 주세요.')
      return
    }

    const candidateItems = searchSelectionIds
      .map((eqpId) => registerTargetMap.get(eqpId))
      .filter((item): item is DeployRegisterTargetItem => Boolean(item))

    addSelectedEqps(candidateItems)
    setSearchSelectionIds([])
    setFeedbackMessage('선택한 설비를 Selected Equipments에 추가했습니다. 중복 설비는 한 번만 유지됩니다.')
  }

  const handleChangeSelectedModelName = (nextModelName: string) => {
    const normalizedModelName = nextModelName === EMPTY_SELECT_VALUE ? null : nextModelName
    setSelectedModelName(normalizedModelName)

    if (!normalizedModelName) {
      setSelectedModelVersionKey(null)
      return
    }

    const hasCompatibleVersion = availableModelVersionOptions.some(
      (option) =>
        option.modelName === normalizedModelName && option.modelVersionKey === selectedModelVersionKey,
    )

    if (!hasCompatibleVersion) {
      setSelectedModelVersionKey(null)
    }
  }

  const handleChangeModelVersionKey = (nextValue: string) => {
    if (nextValue === EMPTY_SELECT_VALUE) {
      setSelectedModelVersionKey(null)
      return
    }

    const nextModelVersionKey = Number(nextValue)
    const nextVersionOption = mergedModelVersionOptions.find(
      (option) => option.modelVersionKey === nextModelVersionKey,
    )

    setSelectedModelVersionKey(nextModelVersionKey)
    setSelectedModelName(nextVersionOption?.modelName ?? null)
  }

  const handleClearRegister = () => {
    resetRegisterLayouts()
  }

  const resetRegisterLayouts = () => {
    clearRegisterState()
    setDraftModelName(EMPTY_SELECT_VALUE)
    setDraftModelVersionKey(EMPTY_SELECT_VALUE)
    setDraftEqpId('')
    setSearchSelectionIds([])
    setFeedbackMessage(null)
    closeScenarioDialog()
  }

  const openDeployDialog = (isSuccess: boolean, message: string) => {
    setDeployDialogState({ isSuccess, message })
  }

  return (
    <div className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-6">
      <Dialog
        open={deployDialogState !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeployDialogState(null)
          }
        }}
      >
        {deployDialogState ? (
          <DialogContent className="max-w-[460px]">
            <DialogHeader>
              <DialogTitle>
                {deployDialogState.isSuccess ? 'Deploy 생성 성공' : 'Deploy 생성 실패'}
              </DialogTitle>
              <DialogDescription
                className={
                  deployDialogState.isSuccess ? 'text-[#2D6B56]' : 'text-[#B33A33]'
                }
              >
                {deployDialogState.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                className="h-9 rounded-full bg-[#243E33] px-4 text-white hover:bg-[#1D332B]"
                onClick={() => setDeployDialogState(null)}
              >
                확인
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={scenarioDialogState.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeScenarioDialog()
          }
        }}
      >
        <DialogContent className="max-w-[640px] rounded-2xl p-0">
          <div className="border-b border-[#EDF1EE] px-6 py-5">
            <DialogHeader className="p-0">
              <DialogTitle>시나리오 선택</DialogTitle>
              <DialogDescription className="text-[#56635C]">
                변경 건에 맞는 시나리오를 선택하면 Deploy 가 생성됩니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            <p className="rounded-xl bg-[#F6F9F7] px-3 py-2 text-xs leading-5 text-[#47605C]">
              {scenarioDialogState.message || '시나리오를 선택해 주세요.'}
            </p>

            <div className="space-y-2">
              {deployScenariosQuery.isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-[#E5EDE9] bg-[#FAFCFB] py-10 text-sm text-[#62716A]">
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  시나리오 목록을 불러오는 중입니다.
                </div>
              ) : deployScenariosQuery.isError ? (
                <div className="rounded-xl border border-[#E5EDE9] bg-[#FFFAFA] p-3 text-sm text-[#B33A33]">
                  {getErrorMessage(
                    deployScenariosQuery.error,
                    '시나리오 목록을 불러오지 못했습니다.',
                  )}
                </div>
              ) : availableScenarios.length === 0 ? (
                <div className="rounded-xl border border-[#E5EDE9] bg-[#F8FAF9] p-3 text-sm text-[#67716C]">
                  사용 가능한 시나리오가 없습니다.
                </div>
              ) : (
                availableScenarios.map((scenario: DeployScenarioSummary) => (
                  <button
                    key={scenario.code}
                    type="button"
                    onClick={() =>
                      setScenarioDialogState((currentState) => ({
                        ...currentState,
                        selectedScenarioCode: scenario.code,
                      }))
                    }
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      scenario.code === scenarioDialogState.selectedScenarioCode
                        ? 'border-[#1B7A57] bg-[#ECF5F0]'
                        : 'border-[#E3EAE6] bg-[#FFFFFF] hover:border-[#A9B9B1] hover:bg-[#F6FAF7]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#243129]">{scenario.name}</p>
                        <p className="text-xs text-[#68726C]">
                          {scenario.code} · v{scenario.version} · {scenario.stepCount}단계
                        </p>
                      </div>
                      <span
                        className={`ml-3 inline-flex size-5 items-center justify-center rounded-full border ${
                          scenario.code === scenarioDialogState.selectedScenarioCode
                            ? 'border-[#1B7A57] bg-[#1B7A57] text-white'
                            : 'border-[#C4CEC8] text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="size-3" />
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[#5D6A63]">{scenario.summary}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-[#EDF1EE] px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeScenarioDialog}
              className="h-10 rounded-xl border-[#D8E1DB] bg-white text-[#54635D]"
            >
              닫기
            </Button>
            <Button
              type="button"
              onClick={() => void handleDeployWithScenario()}
              disabled={createDeployMutation.isPending || !scenarioDialogState.selectedScenarioCode}
              className="h-10 rounded-xl bg-[#243E33] px-5 text-white hover:bg-[#1D332B]"
            >
              {createDeployMutation.isPending ? 'Deploy 중...' : '선택한 시나리오로 Deploy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className={cardClassName}>
        <div className="border-b border-[#EDF1EE] px-6 py-4">
          <h2 className="text-sm font-semibold text-[#243129]">Target Equipment Search</h2>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_92px_92px]">
            <Select value={draftModelName || EMPTY_SELECT_VALUE} onValueChange={setDraftModelName}>
              <SelectTrigger>
                <SelectValue placeholder="Model 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>전체 Model</SelectItem>
                {searchModelOptions.map((option) => (
                  <SelectItem key={option.modelName} value={option.modelName}>
                    {option.modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={draftModelVersionKey} onValueChange={setDraftModelVersionKey}>
              <SelectTrigger>
                <SelectValue placeholder="Model Version 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>전체 Version</SelectItem>
                {mergedModelVersionOptions
                  .filter(
                    (option) =>
                      !draftModelName ||
                      draftModelName === EMPTY_SELECT_VALUE ||
                      option.modelName === draftModelName,
                  )
                  .map((option) => (
                    <SelectItem key={option.modelVersionKey} value={String(option.modelVersionKey)}>
                      {option.modelVersion} / {option.status}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={draftEqpId || EMPTY_SELECT_VALUE} onValueChange={setDraftEqpId}>
              <SelectTrigger>
                <SelectValue placeholder="Eqp ID 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>전체 Eqp</SelectItem>
                {registerTargetItems.map((item) => (
                  <SelectItem key={item.eqpId} value={item.eqpId}>
                    {item.eqpId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              onClick={handleSearch}
              className="h-11 rounded-xl bg-[#243E33] text-white hover:bg-[#1D332B]"
            >
              Search
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleClearSearch}
              className="h-11 rounded-xl border-[#D8E1DB] bg-[#F8FBF9] text-[#526058]"
            >
              Clear
            </Button>
          </div>

          <div className="overflow-x-auto rounded-[14px] border border-[#ECF0ED]">
            <Table>
              <TableHeader className="bg-[#F6F8F6]">
                <TableRow className="hover:bg-[#F6F8F6]">
                  <TableHead className="w-14 text-center">Select</TableHead>
                  <TableHead>Eqp ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Model Version / Status</TableHead>
                  <TableHead>Business Jar File</TableHead>
                  <TableHead>Interface</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasSubmittedRegisterSearch ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-[#7B8781]">
                      검색 조건을 설정한 뒤 Search 버튼을 눌러 주세요.
                    </TableCell>
                  </TableRow>
                ) : registerTargetsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-[#7B8781]">
                      대상 설비를 조회하고 있습니다.
                    </TableCell>
                  </TableRow>
                ) : registerTargetsQuery.isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-[#C5534B]">
                      {getErrorMessage(
                        registerTargetsQuery.error,
                        '대상 설비 목록을 조회하지 못했습니다.',
                      )}
                    </TableCell>
                  </TableRow>
                ) : registerTargetItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-[#7B8781]">
                      검색 결과가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  registerTargetItems.map((item) => (
                    <TableRow key={item.eqpId}>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={searchSelectionIds.includes(item.eqpId)}
                          onChange={() => handleToggleSearchSelection(item.eqpId)}
                          className="size-4 accent-[#1C7F59]"
                          aria-label={`${item.eqpId} 선택`}
                        />
                      </TableCell>
                      <TableCell>{item.eqpId}</TableCell>
                      <TableCell>{item.modelName ?? '-'}</TableCell>
                      <TableCell>
                        {item.modelVersion && item.modelStatus
                          ? `${item.modelVersion} / ${item.modelStatus}`
                          : '-'}
                      </TableCell>
                      <TableCell>{item.businessJarFileName ?? '-'}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-[#EEF4F0] px-2 py-1 text-xs font-medium text-[#335244]">
                          {item.commInterface}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddSelected}
              className="rounded-full border-[#D8E1DB] bg-white px-5 text-[#405149]"
            >
              Add to Selected
            </Button>
          </div>

          {feedbackMessage ? <p className="text-sm text-[#567062]">{feedbackMessage}</p> : null}
        </div>
      </section>

      <section className={cardClassName}>
        <div className="border-b border-[#EDF1EE] px-6 py-4">
          <h2 className="text-sm font-semibold text-[#243129]">Selected Equipments</h2>
        </div>

        <div className="overflow-x-auto px-6 py-5">
          <Table>
            <TableHeader className="bg-[#F6F8F6]">
              <TableRow className="hover:bg-[#F6F8F6]">
                <TableHead>Eqp ID</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Selected Version</TableHead>
                <TableHead>Business Jar File</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead className="min-w-[180px]">Eqp Param Version</TableHead>
                <TableHead className="w-16 text-center">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedEqpItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-[#7B8781]">
                    아직 선택된 설비가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                selectedEqpItems.map((item) => (
                  <SelectedEquipmentRow
                    key={item.eqpId}
                    item={item}
                    selectedEqpParamVersion={selectedEqpParamVersions[item.eqpId]}
                    onChangeEqpParamVersion={setSelectedEqpParamVersion}
                    onRemove={removeSelectedEqp}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className={cardClassName}>
        <div className="flex flex-col gap-4 border-b border-[#EDF1EE] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-sm font-semibold text-[#243129]">Configuration &amp; Deploy</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => void handleDeploy()}
              disabled={
                createDeployMutation.isPending ||
                selectedEqpItems.length === 0 ||
                selectedInterfaceType === null ||
                selectedModelVersionKey === null
              }
              className="h-10 rounded-xl bg-[#243E33] px-5 text-white hover:bg-[#1D332B]"
            >
              {createDeployMutation.isPending ? 'Deploy 중...' : 'Deploy'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearRegister}
              className="h-10 rounded-xl border-[#D8E1DB] bg-[#F8FBF9] text-[#526058]"
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="grid gap-3 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_96px]">
          <Select
            value={selectedModelName ?? EMPTY_SELECT_VALUE}
            onValueChange={handleChangeSelectedModelName}
          >
            <SelectTrigger>
              <SelectValue placeholder="New Model 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>New Model 선택</SelectItem>
              {availableModelOptions.map((option) => (
                <SelectItem key={`${option.modelName}-${option.commInterface}`} value={option.modelName}>
                  {option.modelName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedModelVersionKey ? String(selectedModelVersionKey) : EMPTY_SELECT_VALUE}
            onValueChange={handleChangeModelVersionKey}
          >
            <SelectTrigger>
              <SelectValue placeholder="New Model Version 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>New Model Version 선택</SelectItem>
              {availableModelVersionOptions.map((option) => (
                <SelectItem key={option.modelVersionKey} value={String(option.modelVersionKey)}>
                  {option.modelVersion} / {option.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedBusinessJarRef ? String(selectedBusinessJarRef) : EMPTY_SELECT_VALUE}
            onValueChange={(value) =>
              setSelectedBusinessJarRef(value === EMPTY_SELECT_VALUE ? null : Number(value))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Business Jar File 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>Business Jar File 선택</SelectItem>
              {businessJarOptions.map((option) => (
                <SelectItem key={option.jarRef} value={String(option.jarRef)}>
                  {option.jarFileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            disabled
            className="h-11 rounded-xl border-[#D8E1DB] bg-[#F6F8F7] text-[#90A097]"
            title="추후 연동 예정"
          >
            Upload
          </Button>
        </div>

        {registerOptionsQuery.isError || meQuery.isError ? (
          <div className="px-6 pb-3 text-sm text-[#C5534B]">
            {registerOptionsQuery.isError
              ? getErrorMessage(registerOptionsQuery.error, '설정 옵션을 조회하지 못했습니다.')
              : null}
            {registerOptionsQuery.isError && meQuery.isError ? ' ' : null}
            {meQuery.isError
              ? getErrorMessage(meQuery.error, '현재 사용자 정보를 조회하지 못했습니다.')
              : null}
          </div>
        ) : null}

        {selectedInterfaceType ? (
          <div className="px-6 pb-5 text-sm text-[#567062]">
            현재 선택 가능한 Interface Type: <span className="font-semibold">{selectedInterfaceType}</span>
          </div>
        ) : selectedEqpItems.length > 1 ? (
          <div className="px-6 pb-5 text-sm text-[#567062]">
            여러 Interface Type 설비가 함께 선택되어 있습니다.
          </div>
        ) : null}
      </section>
    </div>
  )
}
