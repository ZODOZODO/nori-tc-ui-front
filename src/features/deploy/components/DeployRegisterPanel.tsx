import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { DeployApiError, deployApi } from '../api/deploy.api'
import { createDeployName } from '../lib/deploy-utils'
import { deployQueryKeys } from '../lib/deploy-query-keys'
import { useCreateDeploy } from '../hooks/useCreateDeploy'
import { useDeployEqpParamVersions } from '../hooks/useDeployEqpParamVersions'
import { useDeployRegisterOptions } from '../hooks/useDeployRegisterOptions'
import { useDeployRegisterScenarioPreview } from '../hooks/useDeployRegisterScenarioPreview'
import { useDeployRegisterTargets } from '../hooks/useDeployRegisterTargets'
import { useDeployUiStore } from '../stores/deploy-ui.store'
import type {
  DeployCreateRequest,
  DeployStatus,
  DeploySummary,
  DeployRegisterScenarioPreviewRequest,
  DeployRegisterScenarioPreviewResult,
  DeployRegisterTargetItem,
  DeployTargetItem,
} from '../types/deploy.types'

const EMPTY_SELECT_VALUE = '__empty__'
const EMPTY_REGISTER_TARGET_ITEMS: DeployRegisterTargetItem[] = []
const EMPTY_MODEL_OPTIONS: EqpModelOption[] = []
const EMPTY_JAR_OPTIONS: EqpJarOption[] = []
const DEPLOY_EVENT_TYPE = 'EQP_REGISTER_DEPLOY'

const cardClassName =
  'rounded-[18px] border border-[#E2E9E4] bg-white shadow-[0_10px_30px_-24px_rgba(30,54,40,0.35)]'

const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
  error instanceof Error && error.message ? error.message : fallbackMessage

const getDeployErrorDetail = (error: unknown): string | null => {
  if (!(error instanceof DeployApiError)) {
    return null
  }

  return error.payload.errorCode ? `오류 코드: ${error.payload.errorCode}` : null
}

const mergeModelOptions = (developModelOptions: EqpModelOption[], operateModelOptions: EqpModelOption[]) => {
  const mergedOptionMap = new Map<number, EqpModelOption>()

  for (const option of [...developModelOptions, ...operateModelOptions]) {
    mergedOptionMap.set(option.modelVersionKey, option)
  }

  return [...mergedOptionMap.values()]
}

const compareModelNames = (left: string, right: string) =>
  left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })

const toUniqueModelOptions = (modelOptions: EqpModelOption[]) => {
  const uniqueModelMap = new Map<string, EqpModelOption>()

  for (const option of modelOptions) {
    if (!uniqueModelMap.has(option.modelName)) {
      uniqueModelMap.set(option.modelName, option)
    }
  }

  return [...uniqueModelMap.values()].sort((left, right) =>
    compareModelNames(left.modelName, right.modelName),
  )
}

interface SelectedEquipmentRowProps {
  item: DeployRegisterTargetItem
  selectedEqpParamVersion?: string
  onChangeEqpParamVersion: (eqpId: string, eqpParamVersion: string) => void
  onRemove: (eqpId: string) => void
}

type DeployDialogState = {
  isSuccess: boolean
  title: string
  message: string
  detail: string | null
  nextMode: 'deploy' | 'history' | null
  nextDeployKey: number | null
}

type ScenarioDialogState = {
  isOpen: boolean
  selectedScenarioCode: string
  preview: DeployRegisterScenarioPreviewResult | null
}

const CHANGE_KIND_LABEL: Record<string, string> = {
  MODEL_CHANGED: 'Model',
  BUSINESS_JAR_CHANGED: 'Business Jar',
  EQP_PARAM_CHANGED: 'Eqp Param',
}

const formatChangeKinds = (changeKinds: string[]) =>
  changeKinds.map((kind) => CHANGE_KIND_LABEL[kind] ?? kind).join(', ')

const FAILED_DEPLOY_STATUSES = new Set<DeployStatus>(['FAILED', 'PARTIAL_FAILED', 'CANCELED'])
const FAILED_TARGET_STATUSES = new Set([
  'FAILED',
  'ROLLING_BACK',
  'ROLLED_BACK',
  'COMPENSATION_FAILED',
  'CANCELED',
])

const delay = (milliseconds: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })

const isFailedDeployOutcome = (summary: DeploySummary, targets: DeployTargetItem[]) =>
  FAILED_DEPLOY_STATUSES.has(summary.deployStatus) ||
  summary.targetSummary.failed > 0 ||
  summary.targetSummary.compensationFailed > 0 ||
  targets.some(
    (target) =>
      FAILED_TARGET_STATUSES.has(target.targetStatus) ||
      Boolean(target.lastErrorMessage) ||
      Boolean(target.lastErrorCode),
  )

const resolveFailureDetail = (targets: DeployTargetItem[]) => {
  const failedTarget = targets.find(
    (target) =>
      FAILED_TARGET_STATUSES.has(target.targetStatus) ||
      Boolean(target.lastErrorMessage) ||
      Boolean(target.lastErrorCode),
  )

  if (!failedTarget) {
    return null
  }

  if (failedTarget.lastErrorMessage?.trim()) {
    return `설비 ${failedTarget.eqpId}: ${failedTarget.lastErrorMessage.trim()}`
  }

  if (failedTarget.lastErrorCode?.trim()) {
    return `설비 ${failedTarget.eqpId}: ${failedTarget.lastErrorCode.trim()}`
  }

  return `설비 ${failedTarget.eqpId} 처리 상태: ${failedTarget.targetStatus}`
}

const formatDeployDetail = (
  deployKey: number,
  deployStatus: DeployStatus,
  extraDetail?: string | null,
) => {
  const baseDetail = `Deploy #${deployKey} · 상태 ${deployStatus}`
  return extraDetail ? `${baseDetail}\n${extraDetail}` : baseDetail
}

const formatActiveDeployHint = (item: DeployRegisterTargetItem) => {
  if (!item.blockedByActiveDeploy) {
    return null
  }

  const detailParts: string[] = []

  if (item.activeDeployKey !== null) {
    detailParts.push(`#${item.activeDeployKey}`)
  }

  if (item.activeDeployStatus) {
    detailParts.push(item.activeDeployStatus)
  }

  if (item.activeDeployName) {
    detailParts.push(item.activeDeployName)
  }

  if (item.activeRequestedBy) {
    detailParts.push(`요청자 ${item.activeRequestedBy}`)
  }

  return detailParts.join(' · ')
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
    selectedEqpParamVersion ?? item.appliedParamVersion ?? EMPTY_SELECT_VALUE

  return (
      <TableRow>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            <span>{item.eqpId}</span>
            {item.blockedByActiveDeploy ? (
              <Badge variant="warning">
                {item.activeDeployStatus ? `ACTIVE ${item.activeDeployStatus}` : 'ACTIVE'}
              </Badge>
            ) : null}
          </div>
          {item.blockedByActiveDeploy ? (
            <p className="mt-1 text-xs text-[#A66518]">
              {formatActiveDeployHint(item) ?? '이미 active Deploy에 포함된 설비입니다.'}
            </p>
          ) : null}
        </TableCell>
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
  const queryClient = useQueryClient()
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
  const resetMonitorFilters = useDeployUiStore((state) => state.resetMonitorFilters)
  const resetMonitorListOffsets = useDeployUiStore((state) => state.resetMonitorListOffsets)
  const addSelectedEqps = useDeployUiStore((state) => state.addSelectedEqps)
  const syncSelectedEqpTargets = useDeployUiStore((state) => state.syncSelectedEqpTargets)
  const removeSelectedEqp = useDeployUiStore((state) => state.removeSelectedEqp)
  const removeSelectedEqps = useDeployUiStore((state) => state.removeSelectedEqps)
  const setSelectedEqpParamVersion = useDeployUiStore((state) => state.setSelectedEqpParamVersion)
  const setSelectedModelName = useDeployUiStore((state) => state.setSelectedModelName)
  const setSelectedModelVersionKey = useDeployUiStore((state) => state.setSelectedModelVersionKey)
  const setSelectedBusinessJarRef = useDeployUiStore((state) => state.setSelectedBusinessJarRef)
  const setActiveDeployKey = useDeployUiStore((state) => state.setActiveDeployKey)
  const setMode = useDeployUiStore((state) => state.setMode)
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
    preview: null,
  })

  const registerTargetsQuery = useDeployRegisterTargets(
    registerFilters,
    hasSubmittedRegisterSearch,
    registerSearchRevision,
  )
  const registerOptionsQuery = useDeployRegisterOptions()
  const meQuery = useMe(true)
  const createDeployMutation = useCreateDeploy()
  const previewScenarioMutation = useDeployRegisterScenarioPreview()

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
    () => {
      if (!selectedModelName) {
        return []
      }

      return mergedModelVersionOptions.filter((option) => {
        if (selectedModelName && option.modelName !== selectedModelName) {
          return false
        }

        if (selectedInterfaceType && option.commInterface !== selectedInterfaceType) {
          return false
        }

        return true
      })
    },
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
  const blockedSelectedEqpItems = useMemo(
    () => selectedEqpItems.filter((item) => item.blockedByActiveDeploy),
    [selectedEqpItems],
  )
  const selectedSearchItems = useMemo(
    () =>
      searchSelectionIds
        .map((eqpId) => registerTargetMap.get(eqpId))
        .filter((item): item is DeployRegisterTargetItem => Boolean(item)),
    [registerTargetMap, searchSelectionIds],
  )
  const addableSearchItems = useMemo(
    () => selectedSearchItems.filter((item) => !item.blockedByActiveDeploy),
    [selectedSearchItems],
  )

  const deployNameContext = useMemo(() => {
    if (currentModelVersion) {
      return {
        modelName: currentModelVersion.modelName,
        modelVersion: currentModelVersion.modelVersion,
      }
    }

    const modelNames = [...new Set(selectedEqpItems.map((item) => item.modelName).filter(Boolean))]
    const modelVersions = [...new Set(selectedEqpItems.map((item) => item.modelVersion).filter(Boolean))]

    return {
      modelName: modelNames.length === 1 ? modelNames[0] : null,
      modelVersion: modelVersions.length === 1 ? modelVersions[0] : null,
    }
  }, [currentModelVersion, selectedEqpItems])

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
      preview: null,
    })
  }

  const closeDeployDialog = () => {
    setDeployDialogState(null)
  }

  const moveToNextMode = (nextMode: 'deploy' | 'history', deployKey: number | null) => {
    resetMonitorFilters()
    resetMonitorListOffsets()
    setActiveDeployKey(deployKey)
    setMode(nextMode)
    closeDeployDialog()
  }

  const loadCreatedDeploySnapshot = async (deployKey: number) => {
    let lastSummaryError: unknown = null

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const summary = await deployApi.getDeploySummary(deployKey)
        const targetsPage = await deployApi.getDeployTargets(deployKey, 0, 50)

        return {
          summary,
          targets: targetsPage.targets,
        }
      } catch (error) {
        lastSummaryError = error

        if (attempt < 2) {
          await delay(350)
        }
      }
    }

    throw lastSummaryError
  }

  const buildCommonUiMessage = () => {
    const uiMessage: Record<string, unknown> = {}

    if (currentModelVersion) {
      uiMessage.modelInfo = {
        modelVersionKey: currentModelVersion.modelVersionKey,
        modelName: currentModelVersion.modelName,
        modelVersion: currentModelVersion.modelVersion,
        modelKey: currentModelVersion.modelKey,
      }
    }

    if (selectedBusinessJarOption) {
      uiMessage.businessJar = {
        jarRef: selectedBusinessJarOption.jarRef,
        jarFileName: selectedBusinessJarOption.jarFileName,
      }
    }

    return uiMessage
  }

  const buildTargetRequests = (
    eqpItems: DeployRegisterTargetItem[] = selectedEqpItems,
  ): Array<{
    eqpId: string
    uiMessageOverride?: Record<string, unknown> | null
  }> =>
    eqpItems.map((item) => {
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
    })

  const buildScenarioPreviewRequest = (): DeployRegisterScenarioPreviewRequest => {
    if (!selectedInterfaceType) {
      throw new Error('Deploy interfaceType 이 선택되지 않았습니다.')
    }

    return {
      commonRequest: {
        interfaceType: selectedInterfaceType,
        uiMessage: buildCommonUiMessage(),
      },
      targets: buildTargetRequests(),
    }
  }

  const buildDeployRequest = (resolvedScenarioCode: string): DeployCreateRequest => {
    if (!selectedInterfaceType) {
      throw new Error('Deploy interfaceType 이 선택되지 않았습니다.')
    }

    return {
      deployName: createDeployName({
        resolvedScenarioCode,
        eventType: DEPLOY_EVENT_TYPE,
      }),
      eventType: DEPLOY_EVENT_TYPE,
      executionPolicy: 'BEST_EFFORT',
      commonRequest: {
        interfaceType: selectedInterfaceType,
        uiMessage: buildCommonUiMessage(),
        resolvedScenarioCode,
      },
      targets: buildTargetRequests(),
    }
  }

  const handleDeploy = async () => {
    if (selectedEqpItems.length === 0) {
      setFeedbackMessage('설비를 먼저 선택해 주세요.')
      openDeployDialog({
        isSuccess: false,
        title: 'Deploy 생성 실패',
        message: '설비를 먼저 선택해 주세요.',
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (!selectedInterfaceType) {
      setFeedbackMessage('서로 다른 Interface 의 설비는 한 번에 Deploy 할 수 없습니다.')
      openDeployDialog({
        isSuccess: false,
        title: 'Deploy 생성 실패',
        message: '서로 다른 Interface 의 설비는 한 번에 Deploy 할 수 없습니다.',
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (selectedModelVersionKey !== null && !currentModelVersion) {
      setFeedbackMessage('선택한 Model Version 정보를 확인할 수 없습니다.')
      openDeployDialog({
        isSuccess: false,
        title: 'Deploy 생성 실패',
        message: '선택한 Model Version 정보를 확인할 수 없습니다.',
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    try {
      const preview = await previewScenarioMutation.mutateAsync(buildScenarioPreviewRequest())

      if (preview.removedEqpIds.length > 0) {
        removeSelectedEqps(preview.removedEqpIds)
      }

      if (preview.remainingEqpIds.length === 0) {
        const emptyMessage = preview.recommendedReason || '변경 사항이 있는 설비가 없습니다.'
        setFeedbackMessage(emptyMessage)
        openDeployDialog({
          isSuccess: false,
          title: 'Deploy 생성 실패',
          message: emptyMessage,
          detail: null,
          nextMode: null,
          nextDeployKey: null,
        })
        return
      }

      const selectedScenarioCode =
        preview.recommendedScenarioCode ?? preview.scenarios[0]?.code ?? ''

      setScenarioDialogState({
        isOpen: true,
        selectedScenarioCode,
        preview,
      })
      setFeedbackMessage(
        preview.removedEqpIds.length > 0
          ? `변경이 없는 설비 ${preview.removedEqpIds.length}대를 Selected Equipments에서 제외했습니다.`
          : null,
      )
    } catch (error) {
      const errorMessage = getErrorMessage(error, '시나리오 preview를 생성하지 못했습니다.')
      setFeedbackMessage(errorMessage)
      openDeployDialog({
        isSuccess: false,
        title: '시나리오 Preview 실패',
        message: errorMessage,
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
    }
  }

  const handleDeployWithScenario = async () => {
    await executeDeploy(scenarioDialogState.selectedScenarioCode)
  }

  const executeDeploy = async (resolvedScenarioCode: string) => {
    if (selectedEqpItems.length === 0) {
      setFeedbackMessage('변경 사항이 있는 설비가 없습니다.')
      openDeployDialog({
        isSuccess: false,
        title: 'Deploy 생성 실패',
        message: '변경 사항이 있는 설비가 없습니다.',
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (!selectedInterfaceType) {
      setFeedbackMessage('서로 다른 Interface 의 설비는 한 번에 Deploy 할 수 없습니다.')
      openDeployDialog({
        isSuccess: false,
        title: 'Deploy 생성 실패',
        message: '서로 다른 Interface 의 설비는 한 번에 Deploy 할 수 없습니다.',
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (selectedModelVersionKey !== null && !currentModelVersion) {
      setFeedbackMessage('선택한 Model Version 정보를 확인할 수 없습니다.')
      openDeployDialog({
        isSuccess: false,
        title: 'Deploy 생성 실패',
        message: '선택한 Model Version 정보를 확인할 수 없습니다.',
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (!resolvedScenarioCode) {
      setFeedbackMessage('Deploy 에 사용할 시나리오를 먼저 선택해 주세요.')
      openDeployDialog({
        isSuccess: false,
        title: 'Deploy 생성 실패',
        message: 'Deploy 에 사용할 시나리오를 먼저 선택해 주세요.',
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    const request = buildDeployRequest(resolvedScenarioCode)

    try {
      const result = await createDeployMutation.mutateAsync(request)
      let resolvedSummary: DeploySummary | null = null
      let resolvedTargets: DeployTargetItem[] = []
      let snapshotLookupError: unknown = null

      try {
        const snapshot = await loadCreatedDeploySnapshot(result.deployKey)
        resolvedSummary = snapshot.summary
        resolvedTargets = snapshot.targets
      } catch (error) {
        snapshotLookupError = error
      }

      closeScenarioDialog()
      createServerDeployBridge({
        deployKey: result.deployKey,
        deployName: request.deployName,
        deployStatus: resolvedSummary?.deployStatus ?? result.deployStatus,
        requestedBy: meQuery.data?.userId?.trim() || 'SYSTEM',
        selectedModelName: deployNameContext.modelName,
        selectedModelVersion: deployNameContext.modelVersion,
        selectedBusinessJarName: selectedBusinessJarOption?.jarFileName ?? null,
        eventType: DEPLOY_EVENT_TYPE,
        targetCount: selectedEqpItems.length,
        eqpIds: selectedEqpItems.map((item) => item.eqpId),
        activateMode: false,
      })

      if (resolvedSummary) {
        queryClient.setQueryData(deployQueryKeys.summary(result.deployKey), resolvedSummary)
      }

      if (resolvedTargets.length > 0) {
        const targetsPayload = {
          deployKey: result.deployKey,
          page: 0,
          size: 50,
          totalElements: resolvedTargets.length,
          totalPages: 1,
          targets: resolvedTargets,
        }
        queryClient.setQueryData(deployQueryKeys.targets(result.deployKey, 0, 50), targetsPayload)
      }

      await queryClient.invalidateQueries({
        queryKey: deployQueryKeys.all,
        refetchType: 'active',
      })

      resetRegisterLayouts()

      if (resolvedSummary && isFailedDeployOutcome(resolvedSummary, resolvedTargets)) {
        const failureMessage =
          resolvedSummary.resultMessage?.message?.trim() || 'Deploy 처리 중 오류가 발생했습니다.'
        const failureDetail = resolveFailureDetail(resolvedTargets)

        openDeployDialog({
          isSuccess: false,
          title: 'Deploy 처리 실패',
          message: failureMessage,
          detail: formatDeployDetail(result.deployKey, resolvedSummary.deployStatus, failureDetail),
          nextMode: 'deploy',
          nextDeployKey: result.deployKey,
        })
        return
      }

      if (snapshotLookupError) {
        const acceptedMessage =
          result.resultMessage?.message?.trim() || 'Deploy 탭에서 실행해 주세요.'

        openDeployDialog({
          isSuccess: true,
          title: 'Deploy 생성 완료',
          message: acceptedMessage,
          detail: formatDeployDetail(
            result.deployKey,
            result.deployStatus,
            '생성 직후 상세 조회에 실패했습니다. Deploy 탭에서 상태를 확인해 주세요.',
          ),
          nextMode: 'deploy',
          nextDeployKey: result.deployKey,
        })
        return
      }

      openDeployDialog({
        isSuccess: true,
        title: 'Deploy 생성 완료',
        message: result.resultMessage?.message?.trim() || 'Deploy 탭에서 실행해 주세요.',
        detail: formatDeployDetail(
          result.deployKey,
          resolvedSummary?.deployStatus ?? result.deployStatus,
        ),
        nextMode: 'deploy',
        nextDeployKey: result.deployKey,
      })
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Deploy 생성에 실패했습니다.')
      setFeedbackMessage(errorMessage)
      openDeployDialog({
        isSuccess: false,
        title: 'Deploy 생성 실패',
        message: errorMessage,
        detail: getDeployErrorDetail(error),
        nextMode: null,
        nextDeployKey: null,
      })
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
    if (registerTargetMap.get(eqpId)?.blockedByActiveDeploy) {
      return
    }

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

    if (addableSearchItems.length === 0) {
      setSearchSelectionIds([])
      setFeedbackMessage('active Deploy에 포함된 설비는 Selected Equipments에 추가할 수 없습니다.')
      return
    }

    addSelectedEqps(addableSearchItems)
    setSearchSelectionIds([])
    setFeedbackMessage(
      '선택한 설비를 Selected Equipments에 추가했습니다. active 설비와 중복 설비는 제외됩니다.',
    )
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

  const openDeployDialog = (state: DeployDialogState) => {
    setDeployDialogState(state)
  }

  return (
    <div className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-6">
      <Dialog
        open={deployDialogState !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDeployDialog()
          }
        }}
      >
        {deployDialogState ? (
          <DialogContent className="max-w-[460px]">
            <DialogHeader>
              <DialogTitle>{deployDialogState.title}</DialogTitle>
              <DialogDescription
                className={
                  deployDialogState.isSuccess ? 'text-[#2D6B56]' : 'text-[#B33A33]'
                }
              >
                {deployDialogState.message}
              </DialogDescription>
            </DialogHeader>
            {deployDialogState.detail ? (
              <div className="rounded-xl bg-[#F6F9F7] px-4 py-3 text-sm whitespace-pre-line text-[#4D5D55]">
                {deployDialogState.detail}
              </div>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-end">
              {deployDialogState.nextMode ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-[#D8E1DB] bg-white px-4 text-[#54635D]"
                  onClick={closeDeployDialog}
                >
                  닫기
                </Button>
              ) : null}
              <Button
                type="button"
                className="h-9 rounded-full bg-[#243E33] px-4 text-white hover:bg-[#1D332B]"
                onClick={() =>
                  deployDialogState.nextMode
                    ? moveToNextMode(
                        deployDialogState.nextMode,
                        deployDialogState.nextDeployKey,
                      )
                    : closeDeployDialog()
                }
              >
                {deployDialogState.nextMode ? 'Deploy 탭으로 이동' : '확인'}
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
        <DialogContent className="max-w-[920px] rounded-2xl p-0">
          <div className="border-b border-[#EDF1EE] px-6 py-5">
            <DialogHeader className="p-0">
              <DialogTitle>시나리오 선택</DialogTitle>
              <DialogDescription className="text-[#56635C]">
                권장 시나리오를 확인한 뒤 원하는 시나리오를 선택하면 Deploy 가 생성됩니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            {scenarioDialogState.preview ? (
              <>
                <div className="grid gap-3 rounded-xl bg-[#F6F9F7] p-4 text-sm text-[#47605C] md:grid-cols-2">
                  <div>
                    <p className="font-semibold text-[#243129]">배포 대상</p>
                    <p className="mt-1">
                      {scenarioDialogState.preview.remainingEqpIds.length}대
                      {scenarioDialogState.preview.removedEqpIds.length > 0
                        ? ` · 변경 없음 ${scenarioDialogState.preview.removedEqpIds.length}대 제외`
                        : ''}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#243129]">감지된 변경</p>
                    <p className="mt-1">
                      {formatChangeKinds(scenarioDialogState.preview.unionChangeKinds)}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="font-semibold text-[#243129]">권장 시나리오</p>
                    <p className="mt-1">
                      {scenarioDialogState.preview.recommendedScenarioCode ?? '권장 시나리오 없음'}
                    </p>
                    <p className="mt-1 text-xs text-[#5B6963]">
                      {scenarioDialogState.preview.recommendedReason}
                    </p>
                  </div>
                </div>

                {scenarioDialogState.preview.scenarios.length === 0 ? (
                  <div className="rounded-xl border border-[#E5EDE9] bg-[#F8FAF9] p-3 text-sm text-[#67716C]">
                    선택 가능한 시나리오가 없습니다.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[14px] border border-[#E5EDE9]">
                    <Table>
                      <TableHeader className="bg-[#F6F8F6]">
                        <TableRow className="hover:bg-[#F6F8F6]">
                          <TableHead className="w-16 text-center">선택</TableHead>
                          <TableHead className="w-20 text-center">권장</TableHead>
                          <TableHead>시나리오명</TableHead>
                          <TableHead>코드</TableHead>
                          <TableHead>포함 변경</TableHead>
                          <TableHead className="text-center">단계 수</TableHead>
                          <TableHead>설명</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scenarioDialogState.preview.scenarios.map((scenario) => (
                          <TableRow
                            key={scenario.code}
                            className={
                              scenario.code === scenarioDialogState.selectedScenarioCode
                                ? 'bg-[#ECF5F0]'
                                : undefined
                            }
                          >
                            <TableCell className="text-center">
                              <input
                                type="radio"
                                name="deploy-register-scenario"
                                checked={scenario.code === scenarioDialogState.selectedScenarioCode}
                                onChange={() =>
                                  setScenarioDialogState((currentState) => ({
                                    ...currentState,
                                    selectedScenarioCode: scenario.code,
                                  }))
                                }
                                className="size-4 accent-[#1C7F59]"
                                aria-label={`${scenario.code} 선택`}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {scenario.recommended ? (
                                <span className="rounded-full bg-[#E8F3EC] px-2 py-1 text-xs font-medium text-[#1B7A57]">
                                  권장
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-[#243129]">{scenario.name}</TableCell>
                            <TableCell className="text-xs text-[#68726C]">{scenario.code}</TableCell>
                            <TableCell className="text-xs text-[#52635C]">
                              {formatChangeKinds(scenario.coversChangeKinds)}
                            </TableCell>
                            <TableCell className="text-center text-sm text-[#52635C]">
                              {scenario.stepCount}
                            </TableCell>
                            <TableCell className="text-xs text-[#5D6A63]">
                              <p>{scenario.summary}</p>
                              <p className="mt-1 text-[#7B8781]">{scenario.reason}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-[#E5EDE9] bg-[#FAFCFB] py-10 text-sm text-[#62716A]">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                시나리오 preview 결과를 준비하고 있습니다.
              </div>
            )}
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
                    <TableRow
                      key={item.eqpId}
                      className={item.blockedByActiveDeploy ? 'bg-[#FFF8EA]' : undefined}
                    >
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={
                            !item.blockedByActiveDeploy && searchSelectionIds.includes(item.eqpId)
                          }
                          onChange={() => handleToggleSearchSelection(item.eqpId)}
                          disabled={item.blockedByActiveDeploy}
                          className="size-4 accent-[#1C7F59]"
                          aria-label={`${item.eqpId} 선택`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{item.eqpId}</span>
                          {item.blockedByActiveDeploy ? (
                            <Badge variant="warning">
                              {item.activeDeployStatus
                                ? `ACTIVE ${item.activeDeployStatus}`
                                : 'ACTIVE'}
                            </Badge>
                          ) : null}
                        </div>
                        {item.blockedByActiveDeploy ? (
                          <p className="mt-1 text-xs text-[#A66518]">
                            {formatActiveDeployHint(item) ?? '이미 active Deploy에 포함된 설비입니다.'}
                          </p>
                        ) : null}
                      </TableCell>
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
              disabled={addableSearchItems.length === 0}
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

        {blockedSelectedEqpItems.length > 0 ? (
          <div className="px-6 pt-5">
            <div className="rounded-xl border border-[#F0D7A6] bg-[#FFF7E8] px-4 py-3 text-sm text-[#8A5A18]">
              이미 active Deploy에 포함된 설비가 Selected Equipments에 남아 있습니다.
              {' '}
              서버에서 최종 차단되므로 제거 후 다시 시도해 주세요.
              <ul className="mt-2 space-y-1 text-xs text-[#9A6520]">
                {blockedSelectedEqpItems.map((item) => (
                  <li key={`blocked-selected-${item.eqpId}`}>
                    {item.eqpId}
                    {formatActiveDeployHint(item) ? ` · ${formatActiveDeployHint(item)}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

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
                previewScenarioMutation.isPending ||
                selectedEqpItems.length === 0 ||
                selectedInterfaceType === null
              }
              className="h-10 rounded-xl bg-[#243E33] px-5 text-white hover:bg-[#1D332B]"
            >
              {previewScenarioMutation.isPending
                ? '시나리오 확인 중...'
                : createDeployMutation.isPending
                  ? 'Deploy 중...'
                  : 'Deploy'}
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
            <SelectTrigger disabled={!selectedModelName}>
              <SelectValue placeholder={selectedModelName ? 'New Model Version 선택' : 'Model 먼저 선택'} />
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
