import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
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
import { deployApi } from '../api/deploy.api'
import { createDeployName } from '../lib/deploy-utils'
import {
  EMPTY_SELECT_VALUE,
  delay,
  formatActiveDeployHint,
  formatChangeKinds,
  formatDeployDetail,
  getDeployErrorDetail,
  getErrorMessage,
  isFailedDeployOutcome,
  mergeModelOptions,
  resolveFailureDetail,
  toUniqueModelOptions,
} from '../lib/deploy-register-utils'
import { useI18n } from '@/i18n/i18n-context'
import { PageCard } from '@/shared/layout/PageCard'
import { deployQueryKeys } from '../lib/deploy-query-keys'
import { SelectedEquipmentRow } from './SelectedEquipmentRow'
import { useCreateDeploy } from '../hooks/useCreateDeploy'
import { useDeployRegisterOptions } from '../hooks/useDeployRegisterOptions'
import { useDeployRegisterScenarioPreview } from '../hooks/useDeployRegisterScenarioPreview'
import { useDeployRegisterTargets } from '../hooks/useDeployRegisterTargets'
import { useDeployUiStore } from '../stores/deploy-ui.store'
import { useEqpList } from '@/features/eqp/hooks/useEqpList'
import { useLineList } from '@/shared/hooks/useLineList'
import { useLineScopeStore } from '@/shared/stores/line-scope.store'
import type {
  DeployCreateRequest,
  DeploySummary,
  DeployRegisterScenarioPreviewRequest,
  DeployRegisterScenarioPreviewResult,
  DeployRegisterTargetItem,
  DeployTargetItem,
} from '../types/deploy.types'

const EMPTY_REGISTER_TARGET_ITEMS: DeployRegisterTargetItem[] = []
const EMPTY_MODEL_OPTIONS: EqpModelOption[] = []
const EMPTY_JAR_OPTIONS: EqpJarOption[] = []
const DEPLOY_EVENT_TYPE = 'EQP_REGISTER_DEPLOY'

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

export function DeployRegisterPanel() {
  const { t } = useI18n()
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
  const [eqpDropdownOpen, setEqpDropdownOpen] = useState(false)
  const eqpSearchContainerRef = useRef<HTMLDivElement>(null)
  const [searchSelectionIds, setSearchSelectionIds] = useState<string[]>([])
  const searchSelectAllRef = useRef<HTMLInputElement>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [deployDialogState, setDeployDialogState] = useState<DeployDialogState | null>(null)
  const [scenarioDialogState, setScenarioDialogState] = useState<ScenarioDialogState>({
    isOpen: false,
    selectedScenarioCode: '',
    preview: null,
  })

  // 상단 라인 선택(lineCode)을 lineKey 로 해석 — register 대상 조회는 선택 라인 소속 설비로 한정한다.
  const lineListQuery = useLineList()
  const selectedLineValue = useLineScopeStore((state) => state.selectedLineValue)
  const selectedLineKey = useMemo(
    () => lineListQuery.data?.find((line) => line.lineCode === selectedLineValue)?.lineKey ?? null,
    [lineListQuery.data, selectedLineValue],
  )

  const registerTargetsQuery = useDeployRegisterTargets(
    registerFilters,
    selectedLineKey,
    hasSubmittedRegisterSearch && selectedLineKey !== null,
    registerSearchRevision,
  )
  const registerOptionsQuery = useDeployRegisterOptions()
  const eqpListQuery = useEqpList()
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
  const filteredEqpSuggestions = useMemo(() => {
    const keyword = draftEqpId.trim()
    if (!keyword) {
      return []
    }
    const allItems = eqpListQuery.data?.items ?? []
    return allItems
      .filter((item) => selectedLineKey !== null && item.lineKey === selectedLineKey)
      .filter((item) => item.eqpId.toLowerCase().includes(keyword.toLowerCase()))
      .slice(0, 30)
  }, [eqpListQuery.data?.items, draftEqpId, selectedLineKey])

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
  const selectableSearchItemIds = useMemo(
    () =>
      registerTargetItems
        .filter((item) => !item.blockedByActiveDeploy)
        .map((item) => item.eqpId),
    [registerTargetItems],
  )
  const selectedSearchItemIdSet = useMemo(
    () => new Set(searchSelectionIds),
    [searchSelectionIds],
  )
  const selectedSelectableSearchCount = useMemo(
    () => selectableSearchItemIds.filter((eqpId) => selectedSearchItemIdSet.has(eqpId)).length,
    [selectableSearchItemIds, selectedSearchItemIdSet],
  )
  const isAllSearchSelected =
    selectableSearchItemIds.length > 0 &&
    selectedSelectableSearchCount === selectableSearchItemIds.length
  const isPartiallySearchSelected =
    selectedSelectableSearchCount > 0 && !isAllSearchSelected
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

  useEffect(() => {
    if (!searchSelectAllRef.current) {
      return
    }

    searchSelectAllRef.current.indeterminate = isPartiallySearchSelected
  }, [isPartiallySearchSelected])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (eqpSearchContainerRef.current && !eqpSearchContainerRef.current.contains(e.target as Node)) {
        setEqpDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    resetMonitorFilters(nextMode === 'history')
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
      throw new Error(t('deploy.register.interfaceNotSelected'))
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
      throw new Error(t('deploy.register.interfaceNotSelected'))
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
      setFeedbackMessage(t('deploy.register.selectEqpFirst'))
      openDeployDialog({
        isSuccess: false,
        title: t('deploy.register.createFailTitle'),
        message: t('deploy.register.selectEqpFirst'),
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (!selectedInterfaceType) {
      setFeedbackMessage(t('deploy.register.mixedInterface'))
      openDeployDialog({
        isSuccess: false,
        title: t('deploy.register.createFailTitle'),
        message: t('deploy.register.mixedInterface'),
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (selectedModelVersionKey !== null && !currentModelVersion) {
      setFeedbackMessage(t('deploy.register.modelVersionUnknown'))
      openDeployDialog({
        isSuccess: false,
        title: t('deploy.register.createFailTitle'),
        message: t('deploy.register.modelVersionUnknown'),
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
        const emptyMessage = preview.recommendedReason || t('deploy.register.noChangedEqp')
        setFeedbackMessage(emptyMessage)
        openDeployDialog({
          isSuccess: false,
          title: t('deploy.register.createFailTitle'),
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
          ? t('deploy.register.removedNoChange', { count: preview.removedEqpIds.length })
          : null,
      )
    } catch (error) {
      const errorMessage = getErrorMessage(error, t('deploy.register.previewFailed'))
      setFeedbackMessage(errorMessage)
      openDeployDialog({
        isSuccess: false,
        title: t('deploy.register.previewFailTitle'),
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
      setFeedbackMessage(t('deploy.register.noChangedEqp'))
      openDeployDialog({
        isSuccess: false,
        title: t('deploy.register.createFailTitle'),
        message: t('deploy.register.noChangedEqp'),
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (!selectedInterfaceType) {
      setFeedbackMessage(t('deploy.register.mixedInterface'))
      openDeployDialog({
        isSuccess: false,
        title: t('deploy.register.createFailTitle'),
        message: t('deploy.register.mixedInterface'),
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (selectedModelVersionKey !== null && !currentModelVersion) {
      setFeedbackMessage(t('deploy.register.modelVersionUnknown'))
      openDeployDialog({
        isSuccess: false,
        title: t('deploy.register.createFailTitle'),
        message: t('deploy.register.modelVersionUnknown'),
        detail: null,
        nextMode: null,
        nextDeployKey: null,
      })
      return
    }

    if (!resolvedScenarioCode) {
      setFeedbackMessage(t('deploy.register.selectScenarioFirst'))
      openDeployDialog({
        isSuccess: false,
        title: t('deploy.register.createFailTitle'),
        message: t('deploy.register.selectScenarioFirst'),
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
          resolvedSummary.resultMessage?.message?.trim() || t('deploy.register.processError')
        const failureDetail = resolveFailureDetail(resolvedTargets)

        openDeployDialog({
          isSuccess: false,
          title: t('deploy.register.processFailTitle'),
          message: failureMessage,
          detail: formatDeployDetail(result.deployKey, resolvedSummary.deployStatus, failureDetail),
          nextMode: 'deploy',
          nextDeployKey: result.deployKey,
        })
        return
      }

      if (snapshotLookupError) {
        const acceptedMessage =
          result.resultMessage?.message?.trim() || t('deploy.register.deployTabHint')

        openDeployDialog({
          isSuccess: true,
          title: t('deploy.register.createSuccessTitle'),
          message: acceptedMessage,
          detail: formatDeployDetail(
            result.deployKey,
            result.deployStatus,
            t('deploy.register.snapshotFailDetail'),
          ),
          nextMode: 'deploy',
          nextDeployKey: result.deployKey,
        })
        return
      }

      openDeployDialog({
        isSuccess: true,
        title: t('deploy.register.createSuccessTitle'),
        message: result.resultMessage?.message?.trim() || t('deploy.register.deployTabHint'),
        detail: formatDeployDetail(
          result.deployKey,
          resolvedSummary?.deployStatus ?? result.deployStatus,
        ),
        nextMode: 'deploy',
        nextDeployKey: result.deployKey,
      })
    } catch (error) {
      const errorMessage = getErrorMessage(error, t('error.deploy.create'))
      setFeedbackMessage(errorMessage)
      openDeployDialog({
        isSuccess: false,
        title: t('deploy.register.createFailTitle'),
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

  const handleToggleAllSearchSelections = () => {
    if (selectableSearchItemIds.length === 0) {
      return
    }

    setSearchSelectionIds((currentIds) => {
      const selectableSearchItemIdSet = new Set(selectableSearchItemIds)

      if (isAllSearchSelected) {
        return currentIds.filter((eqpId) => !selectableSearchItemIdSet.has(eqpId))
      }

      return [...new Set([...currentIds, ...selectableSearchItemIds])]
    })
  }

  const handleAddSelected = () => {
    if (searchSelectionIds.length === 0) {
      setFeedbackMessage(t('deploy.register.selectToAddFirst'))
      return
    }

    if (addableSearchItems.length === 0) {
      setSearchSelectionIds([])
      setFeedbackMessage(t('deploy.register.activeCannotAdd'))
      return
    }

    addSelectedEqps(addableSearchItems)
    setSearchSelectionIds([])
    setFeedbackMessage(t('deploy.register.addedToSelected'))
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
          <DialogContent className="max-w-115">
            <DialogHeader>
              <DialogTitle>{deployDialogState.title}</DialogTitle>
              <DialogDescription
                className={
                  deployDialogState.isSuccess ? 'text-success' : 'text-danger'
                }
              >
                {deployDialogState.message}
              </DialogDescription>
            </DialogHeader>
            {deployDialogState.detail ? (
              <div className="rounded-xl bg-muted px-4 py-3 text-sm whitespace-pre-line text-muted-foreground">
                {deployDialogState.detail}
              </div>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-end">
              {deployDialogState.nextMode ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-border bg-card px-4 text-muted-foreground"
                  onClick={closeDeployDialog}
                >
                  {t('common.close')}
                </Button>
              ) : null}
              <Button
                type="button"
                className="h-9 rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                onClick={() =>
                  deployDialogState.nextMode
                    ? moveToNextMode(
                        deployDialogState.nextMode,
                        deployDialogState.nextDeployKey,
                      )
                    : closeDeployDialog()
                }
              >
                {deployDialogState.nextMode ? t('deploy.register.goToDeployTab') : t('common.confirm')}
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
        <DialogContent className="max-w-230 rounded-2xl p-0">
          <div className="border-b border-border px-6 py-5">
            <DialogHeader className="p-0">
              <DialogTitle>{t('deploy.register.scenarioDialogTitle')}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {t('deploy.register.scenarioDialogDesc')}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            {scenarioDialogState.preview ? (
              <>
                <div className="grid gap-3 rounded-xl bg-muted p-4 text-sm text-muted-foreground md:grid-cols-2">
                  <div>
                    <p className="font-semibold text-foreground">{t('deploy.register.deployTarget')}</p>
                    <p className="mt-1">
                      {t('deploy.register.targetCountSummary', {
                        count: scenarioDialogState.preview.remainingEqpIds.length,
                      })}
                      {scenarioDialogState.preview.removedEqpIds.length > 0
                        ? t('deploy.register.targetExcludedSuffix', {
                            count: scenarioDialogState.preview.removedEqpIds.length,
                          })
                        : ''}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t('deploy.register.detectedChanges')}</p>
                    <p className="mt-1">
                      {formatChangeKinds(scenarioDialogState.preview.unionChangeKinds)}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="font-semibold text-foreground">{t('deploy.register.recommendedScenario')}</p>
                    <p className="mt-1">
                      {scenarioDialogState.preview.recommendedScenarioCode ??
                        t('deploy.register.noRecommendedScenario')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {scenarioDialogState.preview.recommendedReason}
                    </p>
                  </div>
                </div>

                {scenarioDialogState.preview.scenarios.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
                    {t('deploy.register.noSelectableScenario')}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[14px] border border-border">
                    <Table>
                      <TableHeader className="bg-muted">
                        <TableRow className="bg-muted hover:bg-muted">
                          <TableHead className="w-16 text-center">{t('deploy.register.colSelect')}</TableHead>
                          <TableHead className="w-20 text-center">{t('deploy.register.colRecommended')}</TableHead>
                          <TableHead>{t('deploy.register.colScenarioName')}</TableHead>
                          <TableHead>{t('deploy.register.colCode')}</TableHead>
                          <TableHead>{t('deploy.register.colCoversChanges')}</TableHead>
                          <TableHead className="text-center">{t('deploy.register.colStepCount')}</TableHead>
                          <TableHead>{t('deploy.register.colDescription')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scenarioDialogState.preview.scenarios.map((scenario) => (
                          <TableRow
                            key={scenario.code}
                            className={
                              scenario.code === scenarioDialogState.selectedScenarioCode
                                ? 'bg-brand-primary/5'
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
                                className="size-4 accent-brand-primary"
                                aria-label={t('deploy.register.scenarioSelectAria', { code: scenario.code })}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {scenario.recommended ? (
                                <span className="rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-brand-primary">
                                  {t('deploy.register.colRecommended')}
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">{scenario.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{scenario.code}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatChangeKinds(scenario.coversChangeKinds)}
                            </TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {scenario.stepCount}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <p>{scenario.summary}</p>
                              <p className="mt-1 text-muted-foreground">{scenario.reason}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-border bg-muted py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {t('deploy.register.preparingPreview')}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeScenarioDialog}
              className="h-10 rounded-xl border-border bg-card text-muted-foreground"
            >
              {t('common.close')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleDeployWithScenario()}
              disabled={createDeployMutation.isPending || !scenarioDialogState.selectedScenarioCode}
              className="h-10 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
            >
              {createDeployMutation.isPending
                ? t('deploy.register.deployingScenario')
                : t('deploy.register.deployWithScenario')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageCard title={t('deploy.register.searchTitle')} className="shrink-0" bodyClassName="p-0">
        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_92px_92px]">
            <Select value={draftModelName || EMPTY_SELECT_VALUE} onValueChange={setDraftModelName}>
              <SelectTrigger>
                <SelectValue placeholder={t('deploy.register.modelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>{t('deploy.register.allModels')}</SelectItem>
                {searchModelOptions.map((option) => (
                  <SelectItem key={option.modelName} value={option.modelName}>
                    {option.modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={draftModelVersionKey} onValueChange={setDraftModelVersionKey}>
              <SelectTrigger>
                <SelectValue placeholder={t('deploy.register.versionPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>{t('deploy.register.allVersions')}</SelectItem>
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

            <div ref={eqpSearchContainerRef} className="relative">
              <Input
                value={draftEqpId}
                onChange={(e) => {
                  setDraftEqpId(e.target.value)
                  setEqpDropdownOpen(true)
                }}
                onFocus={() => setEqpDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setEqpDropdownOpen(false)
                    handleSearch()
                  } else if (e.key === 'Escape') {
                    setEqpDropdownOpen(false)
                  }
                }}
                placeholder={t('deploy.register.eqpPlaceholder')}
              />
              {eqpDropdownOpen && filteredEqpSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-md">
                  {filteredEqpSuggestions.map((item) => (
                    <button
                      key={item.eqpId}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setDraftEqpId(item.eqpId)
                        setEqpDropdownOpen(false)
                      }}
                    >
                      {item.eqpId}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={handleSearch}
              className="h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('deploy.common.search')}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleClearSearch}
              className="h-11 rounded-xl border-border bg-muted text-muted-foreground"
            >
              {t('deploy.common.clear')}
            </Button>
          </div>

          {!hasSubmittedRegisterSearch ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('deploy.register.searchPrompt')}
            </p>
          ) : registerTargetsQuery.isError ? (
            <p className="py-8 text-center text-sm text-danger">
              {getErrorMessage(registerTargetsQuery.error, t('deploy.register.targetsLoadError'))}
            </p>
          ) : !registerTargetsQuery.isLoading && registerTargetItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('deploy.register.searchEmpty')}
            </p>
          ) : (
          <div className="max-h-100 overflow-y-auto overflow-x-auto rounded-[14px] border border-border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="w-14 text-center">
                    <input
                      ref={searchSelectAllRef}
                      type="checkbox"
                      checked={isAllSearchSelected}
                      onChange={handleToggleAllSearchSelections}
                      disabled={selectableSearchItemIds.length === 0}
                      className="size-4 accent-brand-primary"
                      aria-label={
                        isAllSearchSelected
                          ? t('deploy.register.deselectAll')
                          : t('deploy.register.selectAll')
                      }
                    />
                  </TableHead>
                  <TableHead>Eqp ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Model Version / Status</TableHead>
                  <TableHead>Business Jar File</TableHead>
                  <TableHead>Interface</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registerTargetsQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, rowIndex) => (
                    <TableRow key={`deploy-register-skeleton-${rowIndex}`} data-testid="deploy-register-skeleton">
                      {Array.from({ length: 6 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  registerTargetItems.map((item) => (
                    <TableRow
                      key={item.eqpId}
                      className={item.blockedByActiveDeploy ? 'bg-warning/10' : undefined}
                    >
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={
                            !item.blockedByActiveDeploy && searchSelectionIds.includes(item.eqpId)
                          }
                          onChange={() => handleToggleSearchSelection(item.eqpId)}
                          disabled={item.blockedByActiveDeploy}
                          className="size-4 accent-brand-primary"
                          aria-label={t('deploy.register.eqpSelectAria', { eqpId: item.eqpId })}
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
                          <p className="mt-1 text-xs text-warning">
                            {formatActiveDeployHint(item) ?? t('deploy.register.activeFallback')}
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
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
                          {item.commInterface}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          )}

          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddSelected}
              disabled={addableSearchItems.length === 0}
              className="rounded-full border-border bg-card px-5 text-foreground"
            >
              {t('deploy.register.addToSelected')}
            </Button>
          </div>

          {feedbackMessage ? <p className="text-sm text-muted-foreground">{feedbackMessage}</p> : null}
        </div>
      </PageCard>

      <PageCard title={t('deploy.register.selectedTitle')} className="shrink-0" bodyClassName="p-0">
        {blockedSelectedEqpItems.length > 0 ? (
          <div className="px-6 pt-5">
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              {t('deploy.register.blockedNotice')}
              <ul className="mt-2 space-y-1 text-xs text-warning">
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

        <div className="px-6 py-5">
          <div className="max-h-100 overflow-y-auto overflow-x-auto rounded-[14px] border border-border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead>Eqp ID</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Selected Version</TableHead>
                  <TableHead>Business Jar File</TableHead>
                  <TableHead>Interface</TableHead>
                  <TableHead className="min-w-45">Eqp Param Version</TableHead>
                  <TableHead className="w-16 text-center">Remove</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedEqpItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      {t('deploy.register.selectedEmpty')}
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
        </div>
      </PageCard>

      <PageCard
        title={t('deploy.register.configTitle')}
        className="shrink-0"
        bodyClassName="p-0"
        action={
          <>
            <Button
              type="button"
              onClick={() => void handleDeploy()}
              disabled={
                createDeployMutation.isPending ||
                previewScenarioMutation.isPending ||
                selectedEqpItems.length === 0 ||
                selectedInterfaceType === null
              }
              className="h-10 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
            >
              {previewScenarioMutation.isPending
                ? t('deploy.register.checkingScenario')
                : createDeployMutation.isPending
                  ? t('deploy.register.deploying')
                  : t('deploy.common.deploy')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearRegister}
              className="h-10 rounded-xl border-border bg-muted text-muted-foreground"
            >
              {t('deploy.common.clear')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_96px]">
          <Select
            value={selectedModelName ?? EMPTY_SELECT_VALUE}
            onValueChange={handleChangeSelectedModelName}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('deploy.register.newModelPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>{t('deploy.register.newModelPlaceholder')}</SelectItem>
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
              <SelectValue
                placeholder={
                  selectedModelName
                    ? t('deploy.register.newVersionPlaceholder')
                    : t('deploy.register.selectModelFirst')
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>{t('deploy.register.newVersionPlaceholder')}</SelectItem>
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
              <SelectValue placeholder={t('deploy.register.jarPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>{t('deploy.register.jarPlaceholder')}</SelectItem>
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
            className="h-11 rounded-xl border-border bg-muted text-muted-foreground"
            title={t('deploy.register.uploadComingSoon')}
          >
            {t('deploy.register.upload')}
          </Button>
        </div>

        {registerOptionsQuery.isError || meQuery.isError ? (
          <div className="px-6 pb-3 text-sm text-danger">
            {registerOptionsQuery.isError
              ? getErrorMessage(registerOptionsQuery.error, t('deploy.register.optionsLoadError'))
              : null}
            {registerOptionsQuery.isError && meQuery.isError ? ' ' : null}
            {meQuery.isError
              ? getErrorMessage(meQuery.error, t('deploy.register.userLoadError'))
              : null}
          </div>
        ) : null}

        {selectedInterfaceType ? (
          <div className="px-6 pb-5 text-sm text-muted-foreground">
            {t('deploy.register.interfaceHint')}{' '}
            <span className="font-semibold">{selectedInterfaceType}</span>
          </div>
        ) : selectedEqpItems.length > 1 ? (
          <div className="px-6 pb-5 text-sm text-muted-foreground">
            {t('deploy.register.multiInterface')}
          </div>
        ) : null}
      </PageCard>
    </div>
  )
}
