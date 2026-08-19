import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
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
import { useI18n } from '@/i18n/i18n-context'
import { resolveDateLocale } from '@/shared/lib/date-locale'
import { PageCard } from '@/shared/layout/PageCard'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import type { EqpModelOption } from '@/features/eqp/types/eqp.types'
import { useDeployRegisterOptions } from '../hooks/useDeployRegisterOptions'
import { useDeployHistoryList } from '../hooks/useDeployHistoryList'
import { useDeployScenarios } from '../hooks/useDeployScenarios'
import { useDeploySummary } from '../hooks/useDeploySummary'
import { useDeployTargets } from '../hooks/useDeployTargets'
import { useDeleteDeploy } from '../hooks/useDeleteDeploy'
import { useHoldDeploy } from '../hooks/useHoldDeploy'
import { useRedeployDeploy } from '../hooks/useRedeployDeploy'
import { useStartDeploy } from '../hooks/useStartDeploy'
import { useMe, useUsers } from '@/features/profile/hooks/useProfile'
import { resolveDeployTaskLabel } from '../lib/deploy-utils'
import { createDefaultMonitorFilters, useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployHistoryItem, DeployStatus, DeployTargetItem } from '../types/deploy.types'

interface DeployMonitorPanelProps {
  historyOnly?: boolean
}

type FeedbackTone = 'info' | 'success' | 'error'
type DeleteDialogState = {
  deployKey: number
  deployName: string
  deleteHistory: boolean
} | null

const EMPTY_SELECT_VALUE = '__all__'
const EMPTY_MODEL_OPTIONS: EqpModelOption[] = []

const MONITOR_PAGE_SIZE = 50

const resolveStatusVariant = (status: DeployStatus) => {
  switch (status) {
    case 'FAILED':
    case 'PARTIAL_FAILED':
      return 'warning'
    case 'RUNNING':
      return 'info'
    case 'READY':
    case 'PLANNING':
      return 'secondary'
    default:
      return 'default'
  }
}

const resolveTargetResultLabel = (targetStatus: string) => {
  switch (targetStatus) {
    case 'COMPLETED':
    case 'NO_CHANGE':
      return 'PASS'
    case 'FAILED':
    case 'COMPENSATION_FAILED':
      return 'FAIL'
    case 'ROLLING_BACK':
    case 'ROLLED_BACK':
      return 'ROLLBACK'
    case 'RUNNING':
      return 'RUNNING'
    case 'CANCELED':
      return 'CANCELED'
    default:
      return 'PENDING'
  }
}

const resolveTargetResultVariant = (targetStatus: string) => {
  switch (targetStatus) {
    case 'FAILED':
    case 'COMPENSATION_FAILED':
      return 'warning'
    case 'RUNNING':
      return 'info'
    case 'COMPLETED':
    case 'NO_CHANGE':
      return 'default'
    default:
      return 'secondary'
  }
}

const toInclusiveEndTime = (dateText: string): number | null => {
  if (!dateText) {
    return null
  }

  return Date.parse(`${dateText}T23:59:59.999Z`)
}

const toStartTime = (dateText: string): number | null => {
  if (!dateText) {
    return null
  }

  return Date.parse(`${dateText}T00:00:00.000Z`)
}

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat(resolveDateLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const isTerminalHistoryItem = (item: DeployHistoryItem): boolean =>
  item.deployStatus === 'COMPLETED' ||
  item.deployStatus === 'PARTIAL_FAILED' ||
  item.deployStatus === 'FAILED' ||
  item.deployStatus === 'CANCELED'

const isServerDeleteAllowed = (item: DeployHistoryItem | null): boolean =>
  item !== null &&
  (item.deployStatus === 'PLANNING' ||
    item.deployStatus === 'READY' ||
    isTerminalHistoryItem(item))

const matchesMonitorFilters = (
  item: DeployHistoryItem,
  historyOnly: boolean,
  modelName: string,
  requestedBy: string,
  fromDate: string,
  toDate: string,
) => {
  if (historyOnly && !isTerminalHistoryItem(item)) {
    return false
  }

  if (
    modelName &&
    !item.deployName.toLowerCase().includes(modelName.toLowerCase()) &&
    !(item.selectedModelName?.toLowerCase().includes(modelName.toLowerCase()) ?? false)
  ) {
    return false
  }

  if (requestedBy && !item.requestedBy.toLowerCase().includes(requestedBy.toLowerCase())) {
    return false
  }

  const fromTime = toStartTime(fromDate)
  const toTime = toInclusiveEndTime(toDate)
  const createdAtTime = Date.parse(item.createdAt)

  if (fromTime !== null && createdAtTime < fromTime) {
    return false
  }

  if (toTime !== null && createdAtTime > toTime) {
    return false
  }

  return true
}

const sortHistoryItems = (items: DeployHistoryItem[]) =>
  [...items].sort((left, right) => {
    const createdAtCompare = Date.parse(right.createdAt) - Date.parse(left.createdAt)
    if (createdAtCompare !== 0) {
      return createdAtCompare
    }
    return right.deployKey - left.deployKey
  })

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

export function DeployMonitorPanel({ historyOnly = false }: DeployMonitorPanelProps) {
  const { t } = useI18n()
  const localHistory = useDeployUiStore((state) => state.localHistory)
  const activeDeployKey = useDeployUiStore((state) => state.activeDeployKey)
  const deployListOffset = useDeployUiStore((state) => state.deployListOffset)
  const historyListOffset = useDeployUiStore((state) => state.historyListOffset)
  const serverBackedDeployKeys = useDeployUiStore((state) => state.serverBackedDeployKeys)
  const localTargetsByDeployKey = useDeployUiStore((state) => state.localTargetsByDeployKey)
  const deployFilters = useDeployUiStore((state) => state.deployFilters)
  const historyFilters = useDeployUiStore((state) => state.historyFilters)
  const setMonitorFilters = useDeployUiStore((state) => state.setMonitorFilters)
  const resetMonitorFilters = useDeployUiStore((state) => state.resetMonitorFilters)
  // 배포 / 배포이력은 각각 독립된 조회 필터를 갖는다 (모드 전환 시 패널 remount → draft 재초기화).
  const monitorFilters = historyOnly ? historyFilters : deployFilters
  const setMonitorListOffset = useDeployUiStore((state) => state.setMonitorListOffset)
  const resetMonitorListOffsets = useDeployUiStore((state) => state.resetMonitorListOffsets)
  const setActiveDeployKey = useDeployUiStore((state) => state.setActiveDeployKey)
  const applyDeploySummary = useDeployUiStore((state) => state.applyDeploySummary)
  const applyDeployTargets = useDeployUiStore((state) => state.applyDeployTargets)
  const reconcileServerHistory = useDeployUiStore((state) => state.reconcileServerHistory)
  const markDeployStatus = useDeployUiStore((state) => state.markDeployStatus)
  const redeployLocalHistoryItem = useDeployUiStore((state) => state.redeployLocalHistoryItem)
  const deleteLocalDeploy = useDeployUiStore((state) => state.deleteLocalDeploy)
  const createServerDeployBridge = useDeployUiStore((state) => state.createServerDeployBridge)

  const navigate = useNavigate()
  const meQuery = useMe(true)
  const monitorOptionsQuery = useDeployRegisterOptions()
  const userListQuery = useUsers(true)
  const startDeployMutation = useStartDeploy()
  const holdDeployMutation = useHoldDeploy()
  const redeployDeployMutation = useRedeployDeploy()
  const deleteDeployMutation = useDeleteDeploy()

  const [draftModelName, setDraftModelName] = useState(monitorFilters.modelName)
  const [draftRequestedBy, setDraftRequestedBy] = useState(monitorFilters.requestedBy)
  const [draftFromDate, setDraftFromDate] = useState(monitorFilters.fromDate)
  const [draftToDate, setDraftToDate] = useState(monitorFilters.toDate)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('info')
  const [commentDeployKey, setCommentDeployKey] = useState<number | null>(null)
  const [deleteDialogState, setDeleteDialogState] = useState<DeleteDialogState>(null)
  const [redeployDialogKey, setRedeployDialogKey] = useState<number | null>(null)

  const modelOptions = useMemo(() => {
    const mergedModelVersionOptions = mergeModelOptions(
      monitorOptionsQuery.data?.developModelOptions ?? EMPTY_MODEL_OPTIONS,
      monitorOptionsQuery.data?.operateModelOptions ?? EMPTY_MODEL_OPTIONS,
    )

    return toUniqueModelOptions(mergedModelVersionOptions).sort((left, right) =>
      left.modelName.localeCompare(right.modelName),
    )
  }, [monitorOptionsQuery.data?.developModelOptions, monitorOptionsQuery.data?.operateModelOptions])

  const userOptions = useMemo(() => {
    const userIdOptionMap = new Map<string, string>()

    for (const user of userListQuery.data ?? []) {
      if (typeof user.userId === 'string' && user.userId.trim().length > 0) {
        userIdOptionMap.set(user.userId, user.userName)
      }
    }

    const options = [...userIdOptionMap.entries()].map(([userId, userName]) => ({
      userId,
      label: userName ? `${userName} (${userId})` : userId,
      sortKey: userName || userId,
    }))

    return options
      .sort((left, right) => {
        const leftSortKey = left.sortKey.trim()
        const rightSortKey = right.sortKey.trim()

        const nameCompare = leftSortKey.localeCompare(rightSortKey, 'ko')
        if (nameCompare !== 0) {
          return nameCompare
        }

        return left.userId.localeCompare(right.userId)
      })
      .map(({ userId, label }) => ({ userId, label }))
  }, [userListQuery.data])

  const currentOffset = historyOnly ? historyListOffset : deployListOffset

  const deployHistoryQuery = useDeployHistoryList(
    monitorFilters,
    historyOnly,
    currentOffset,
    MONITOR_PAGE_SIZE,
  )

  const historyErrorMessage =
    deployHistoryQuery.isError
      ? deployHistoryQuery.error instanceof Error
        ? deployHistoryQuery.error.message
        : t('deploy.monitor.historyLoadError')
      : null

  const serverHistoryItems = useMemo(
    () => deployHistoryQuery.data?.items ?? [],
    [deployHistoryQuery.data?.items],
  )

  const serverHistoryKeySet = useMemo(
    () => new Set(serverHistoryItems.map((item) => item.deployKey)),
    [serverHistoryItems],
  )

  const bridgeHistoryItems = useMemo(() => {
    if (historyOnly || currentOffset > 0) {
      return []
    }

    return sortHistoryItems(
      localHistory.filter(
        (item) =>
          serverBackedDeployKeys.includes(item.deployKey) &&
          !item.terminal &&
          !serverHistoryKeySet.has(item.deployKey) &&
          matchesMonitorFilters(
            item,
            false,
            monitorFilters.modelName,
            monitorFilters.requestedBy,
            monitorFilters.fromDate,
            monitorFilters.toDate,
          ),
      ),
    )
  }, [currentOffset, historyOnly, localHistory, monitorFilters, serverBackedDeployKeys, serverHistoryKeySet])

  const resolvedHistoryItems = useMemo(
    () => sortHistoryItems([...bridgeHistoryItems, ...serverHistoryItems]),
    [bridgeHistoryItems, serverHistoryItems],
  )

  const activeHistoryItem = useMemo(
    () => resolvedHistoryItems.find((item) => item.deployKey === activeDeployKey) ?? null,
    [activeDeployKey, resolvedHistoryItems],
  )

  const isServerBackedRow = (deployKey: number) =>
    serverHistoryKeySet.has(deployKey) || serverBackedDeployKeys.includes(deployKey)

  // react-compiler 활성 환경 — 컴포넌트 내부 deps (isServerBackedRow) closure 캡처는
  // 자동 memoization 에 위임한다. 명시 useMemo 는 manual/inferred deps 불일치로
  // react-hooks/preserve-manual-memoization 위반 (compile skip).
  const deployHistoryColumns: ReadonlyArray<ColumnDef<DeployHistoryItem>> = [
    {
      key: 'deployName',
      header: 'Deploy Name',
      accessor: (row) => row.deployName,
      renderCell: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <span>{row.deployName}</span>
          <Badge variant={isServerBackedRow(row.deployKey) ? 'info' : 'secondary'}>
            {isServerBackedRow(row.deployKey) ? 'SERVER' : 'LOCAL'}
          </Badge>
        </div>
      ),
    },
    { key: 'eventType', header: 'Event Type', accessor: (row) => row.eventType },
    {
      key: 'deployStatus',
      header: 'Status',
      accessor: (row) => row.deployStatus,
      renderCell: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={resolveStatusVariant(row.deployStatus)}>{row.deployStatus}</Badge>
          {row.pauseRequested ? <Badge variant="warning">{t('deploy.monitor.holdRequested')}</Badge> : null}
        </div>
      ),
    },
    {
      key: 'targetTotal',
      header: 'Target Count',
      accessor: (row) => row.targetSummary.total.toString(),
    },
    {
      key: 'targetCompleted',
      header: 'Completed',
      accessor: (row) => row.targetSummary.completed.toString(),
    },
    {
      key: 'targetFailed',
      header: 'Failed',
      accessor: (row) => row.targetSummary.failed.toString(),
    },
    { key: 'requestedBy', header: 'Requested By', accessor: (row) => row.requestedBy },
    { key: 'createdAt', header: 'Created At', accessor: (row) => formatDateTime(row.createdAt) },
  ]

  const commentHistoryItem = useMemo(
    () => resolvedHistoryItems.find((item) => item.deployKey === commentDeployKey) ?? null,
    [commentDeployKey, resolvedHistoryItems],
  )
  const isCommentServerBacked =
    commentHistoryItem !== null && isServerBackedRow(commentHistoryItem.deployKey)
  const commentTargetPageSize = Math.max(commentHistoryItem?.targetSummary.total ?? 0, 50)

  const isActiveServerDeploy =
    activeDeployKey !== null &&
    isServerBackedRow(activeDeployKey) &&
    !historyOnly &&
    !activeHistoryItem?.terminal

  const deploySummaryQuery = useDeploySummary(
    activeDeployKey,
    isActiveServerDeploy,
    activeHistoryItem?.deployStatus ?? null,
  )
  const deployTargetsQuery = useDeployTargets(
    activeDeployKey,
    isActiveServerDeploy,
    0,
    50,
    null,
    null,
    activeHistoryItem?.deployStatus ?? null,
  )
  const commentSummaryQuery = useDeploySummary(
    commentDeployKey,
    commentDeployKey !== null && isCommentServerBacked,
    commentHistoryItem?.deployStatus ?? null,
  )
  const commentTargetsQuery = useDeployTargets(
    commentDeployKey,
    commentDeployKey !== null && isCommentServerBacked,
    0,
    commentTargetPageSize,
    null,
    null,
    commentHistoryItem?.deployStatus ?? null,
  )
  const commentScenarioCatalogQuery = useDeployScenarios(
    commentSummaryQuery.data?.eventType ?? commentHistoryItem?.eventType ?? 'EQP_REGISTER_DEPLOY',
    commentDeployKey !== null && commentHistoryItem !== null,
  )

  useEffect(() => {
    if (deployHistoryQuery.isSuccess) {
      reconcileServerHistory(serverHistoryItems.map((item) => item.deployKey))
    }
  }, [deployHistoryQuery.isSuccess, reconcileServerHistory, serverHistoryItems])

  useEffect(() => {
    if (!deploySummaryQuery.data) {
      return
    }

    applyDeploySummary(deploySummaryQuery.data)
  }, [applyDeploySummary, deploySummaryQuery.data])

  useEffect(() => {
    if (activeDeployKey === null || !deployTargetsQuery.data) {
      return
    }

    applyDeployTargets(activeDeployKey, deployTargetsQuery.data.targets)
  }, [activeDeployKey, applyDeployTargets, deployTargetsQuery.data])

  useEffect(() => {
    if (historyOnly || deployHistoryQuery.isPending) {
      return
    }

    if (resolvedHistoryItems.length === 0) {
      if (activeDeployKey !== null) {
        setActiveDeployKey(null)
      }
      return
    }

    if (activeDeployKey === null) {
      setActiveDeployKey(resolvedHistoryItems[0].deployKey)
      return
    }

    if (activeHistoryItem === null) {
      setActiveDeployKey(resolvedHistoryItems[0].deployKey)
      return
    }

    if (!activeHistoryItem.terminal) {
      return
    }

    const nextActiveDeployKey =
      resolvedHistoryItems.find(
        (item) => !item.terminal && item.deployKey !== activeHistoryItem.deployKey,
      )?.deployKey ?? null

    if (nextActiveDeployKey !== activeDeployKey) {
      setActiveDeployKey(nextActiveDeployKey)
    }
  }, [
    activeDeployKey,
    activeHistoryItem,
    deployHistoryQuery.isPending,
    historyOnly,
    resolvedHistoryItems,
    setActiveDeployKey,
  ])

  const summaryErrorMessage =
    deploySummaryQuery.isError && !historyOnly
      ? deploySummaryQuery.error instanceof Error
        ? deploySummaryQuery.error.message
        : t('deploy.monitor.summaryLoadError')
      : null

  const targetsErrorMessage =
    deployTargetsQuery.isError && !historyOnly
      ? deployTargetsQuery.error instanceof Error
        ? deployTargetsQuery.error.message
        : t('deploy.monitor.targetsLoadError')
      : null
  const monitorOptionsErrorMessage =
    monitorOptionsQuery.isError && monitorOptionsQuery.error instanceof Error
      ? monitorOptionsQuery.error.message
      : null
  const userListErrorMessage =
    userListQuery.isError && userListQuery.error instanceof Error
      ? userListQuery.error.message
      : null
  const commentSummaryErrorMessage =
    commentSummaryQuery.isError && commentSummaryQuery.error instanceof Error
      ? commentSummaryQuery.error.message
      : commentSummaryQuery.isError
        ? t('deploy.monitor.commentSummaryError')
        : null
  const commentTargetsErrorMessage =
    commentTargetsQuery.isError && commentTargetsQuery.error instanceof Error
      ? commentTargetsQuery.error.message
      : commentTargetsQuery.isError
        ? t('deploy.monitor.commentTargetsError')
        : null
  const commentTargets = useMemo(() => {
    if (commentDeployKey === null) {
      return []
    }

    if (isCommentServerBacked) {
      return commentTargetsQuery.data?.targets ?? []
    }

    return localTargetsByDeployKey[commentDeployKey] ?? []
  }, [commentDeployKey, commentTargetsQuery.data?.targets, isCommentServerBacked, localTargetsByDeployKey])
  const commentFailureTargets = useMemo(
    () =>
      [...commentTargets]
        .filter(
          (target) =>
            target.targetStatus === 'FAILED' ||
            target.targetStatus === 'COMPENSATION_FAILED' ||
            Boolean(target.lastErrorCode) ||
            Boolean(target.lastErrorMessage),
        )
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    [commentTargets],
  )
  const commentResultMessage = commentSummaryQuery.data?.resultMessage?.message?.trim() ?? null
  const commentResultTitle = commentSummaryQuery.data?.resultMessage?.title?.trim() ?? null
  // resolveDeployTaskLabel 은 i18n 키를 반환한다 — 렌더 시점에 t(key) 로 번역.
  const commentTaskTypeLabelKey = useMemo(
    () =>
      resolveDeployTaskLabel(
        commentSummaryQuery.data?.resolvedScenarioCode ?? null,
        commentSummaryQuery.data?.eventType ?? commentHistoryItem?.eventType ?? null,
      ),
    [
      commentHistoryItem?.eventType,
      commentSummaryQuery.data?.eventType,
      commentSummaryQuery.data?.resolvedScenarioCode,
    ],
  )
  const commentScenario = useMemo(() => {
    const resolvedScenarioCode = commentSummaryQuery.data?.resolvedScenarioCode?.trim()
    if (!resolvedScenarioCode) {
      return null
    }

    return (
      commentScenarioCatalogQuery.data?.scenarios.find((scenario) => scenario.code === resolvedScenarioCode) ?? null
    )
  }, [commentScenarioCatalogQuery.data?.scenarios, commentSummaryQuery.data?.resolvedScenarioCode])
  const isCommentLoading =
    isCommentServerBacked &&
    (commentSummaryQuery.isPending ||
      commentTargetsQuery.isPending ||
      commentScenarioCatalogQuery.isPending)
  const commentToBeLines = useMemo(() => {
    const lines: string[] = []

    if (commentHistoryItem?.selectedModelName || commentHistoryItem?.selectedModelVersion) {
      lines.push(
        t('deploy.monitor.lineModel', {
          name: commentHistoryItem?.selectedModelName ?? '-',
          version: commentHistoryItem?.selectedModelVersion ?? '-',
        }),
      )
    }

    if (commentHistoryItem?.selectedBusinessJarName) {
      lines.push(`Business JAR: ${commentHistoryItem.selectedBusinessJarName}`)
    }

    if (commentScenario?.name ?? commentSummaryQuery.data?.resolvedScenarioCode) {
      lines.push(
        t('deploy.monitor.lineScenario', {
          name: commentScenario?.name ?? commentSummaryQuery.data?.resolvedScenarioCode ?? '-',
        }),
      )
    }

    return lines
  }, [
    commentHistoryItem,
    commentScenario?.name,
    commentSummaryQuery.data?.resolvedScenarioCode,
    t,
  ])
  const commentAsIsLines = useMemo(() => {
    const lines: string[] = []
    const asIsState = commentSummaryQuery.data?.asIsState

    if (!asIsState) {
      return lines
    }

    if (asIsState.interfaceType) {
      lines.push(t('deploy.monitor.lineInterface', { type: asIsState.interfaceType }))
    }
    if (asIsState.modelName || asIsState.modelVersion) {
      lines.push(
        t('deploy.monitor.lineModel', {
          name: asIsState.modelName ?? '-',
          version: asIsState.modelVersion ?? '-',
        }),
      )
    }
    if (asIsState.businessJarName) {
      lines.push(`Business JAR: ${asIsState.businessJarName}`)
    }
    if (asIsState.eqpParamVersion) {
      lines.push(`EQP PARAM: ${asIsState.eqpParamVersion}`)
    }

    return lines
  }, [commentSummaryQuery.data?.asIsState, t])

  const serverTotalCount = deployHistoryQuery.data?.count ?? 0
  const displayTotalCount = serverTotalCount + bridgeHistoryItems.length
  const currentPage = Math.floor(currentOffset / MONITOR_PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(Math.max(serverTotalCount, 1) / MONITOR_PAGE_SIZE))
  const canGoPrev = currentOffset > 0
  const canGoNext = currentOffset + MONITOR_PAGE_SIZE < serverTotalCount

  const handleSearch = () => {
    setMonitorFilters(historyOnly, {
      modelName: draftModelName === EMPTY_SELECT_VALUE ? '' : draftModelName.trim(),
      requestedBy: draftRequestedBy === EMPTY_SELECT_VALUE ? '' : draftRequestedBy.trim(),
      fromDate: draftFromDate,
      toDate: draftToDate,
    })
    resetMonitorListOffsets()
    setFeedbackMessage(null)
    setFeedbackTone('info')
  }

  const handleClear = () => {
    const defaultMonitorFilters = createDefaultMonitorFilters()
    setDraftModelName('')
    setDraftRequestedBy('')
    setDraftFromDate(defaultMonitorFilters.fromDate)
    setDraftToDate(defaultMonitorFilters.toDate)
    resetMonitorFilters(historyOnly)
    resetMonitorListOffsets()
    setFeedbackMessage(null)
    setFeedbackTone('info')
  }

  const handleRedeploy = (deployKey: number) => {
    if (isServerBackedRow(deployKey)) {
      if (!historyOnly) {
        setFeedbackMessage(t('deploy.monitor.redeployRunningBlocked'))
        setFeedbackTone('error')
        return
      }

      setRedeployDialogKey(deployKey)
      return
    }

    const nextDeployKey = redeployLocalHistoryItem(deployKey)

    if (nextDeployKey === null) {
      setFeedbackMessage(t('deploy.monitor.redeployLocalBlocked'))
      setFeedbackTone('error')
      return
    }

    navigate('/deploy/deploy')
    setFeedbackMessage(t('deploy.monitor.redeployLocalSuccess', { key: nextDeployKey }))
    setFeedbackTone('success')
  }

  const handleConfirmRedeploy = async () => {
    if (redeployDialogKey === null) {
      return
    }

    const deployKey = redeployDialogKey
    const sourceHistoryItem = resolvedHistoryItems.find((item) => item.deployKey === deployKey) ?? null

    // 네이티브 확인창이 즉시 닫힌 뒤 요청이 나가던 종전 흐름을 유지한다 (피드백 메시지는 패널에 표시된다).
    setRedeployDialogKey(null)

    try {
      const result = await redeployDeployMutation.mutateAsync(deployKey)
      createServerDeployBridge({
        deployKey: result.deployKey,
        deployStatus: result.deployStatus,
        requestedBy: meQuery.data?.userId?.trim() || sourceHistoryItem?.requestedBy || 'SYSTEM',
        selectedModelName: sourceHistoryItem?.selectedModelName ?? null,
        selectedModelVersion: sourceHistoryItem?.selectedModelVersion ?? null,
        selectedBusinessJarName: sourceHistoryItem?.selectedBusinessJarName ?? null,
        interfaceType: sourceHistoryItem?.interfaceType ?? null,
        targetCount: sourceHistoryItem?.targetSummary.total ?? 0,
      })
      navigate('/deploy/deploy')
      setFeedbackMessage(
        result.resultMessage?.message || t('deploy.monitor.redeployServerSuccess'),
      )
      setFeedbackTone('success')
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : t('error.deploy.redeploy'),
      )
      setFeedbackTone('error')
    }
  }

  const handleRequestDelete = (deployKey: number) => {
    const targetHistoryItem =
      resolvedHistoryItems.find((item) => item.deployKey === deployKey) ?? null

    if (targetHistoryItem === null) {
      setFeedbackMessage(t('deploy.monitor.deployNotFound'))
      setFeedbackTone('error')
      return
    }

    if (isServerBackedRow(deployKey) && !isServerDeleteAllowed(targetHistoryItem)) {
      setFeedbackMessage(t('deploy.monitor.deleteRunningBlocked'))
      setFeedbackTone('error')
      return
    }

    setDeleteDialogState({
      deployKey,
      deployName: targetHistoryItem.deployName,
      deleteHistory: historyOnly || targetHistoryItem.terminal,
    })
  }

  const handleDelete = async () => {
    if (deleteDialogState === null) {
      return
    }

    const deployKey = deleteDialogState.deployKey

    if (isServerBackedRow(deployKey)) {
      const targetHistoryItem =
        resolvedHistoryItems.find((item) => item.deployKey === deployKey) ?? null

      if (targetHistoryItem === null) {
        setFeedbackMessage(t('deploy.monitor.deployNotFound'))
        setFeedbackTone('error')
        setDeleteDialogState(null)
        return
      }

      try {
        const result = await deleteDeployMutation.mutateAsync(deployKey)
        deleteLocalDeploy(deployKey)
        if (activeDeployKey === deployKey) {
          setActiveDeployKey(null)
        }
        setFeedbackMessage(
          result.resultMessage?.message || t('deploy.monitor.deleteServerSuccess', { key: deployKey }),
        )
        setFeedbackTone('success')
        setDeleteDialogState(null)
      } catch (error) {
        setFeedbackMessage(error instanceof Error ? error.message : t('deploy.monitor.deleteError'))
        setFeedbackTone('error')
      }
      return
    }

    deleteLocalDeploy(deployKey)
    setFeedbackMessage(t('deploy.monitor.deleteLocalSuccess', { key: deployKey }))
    setFeedbackTone('success')
    setDeleteDialogState(null)
  }

  const handleStart = async (deployKey: number) => {
    if (!isServerBackedRow(deployKey) || historyOnly) {
      return
    }

    try {
      const result = await startDeployMutation.mutateAsync(deployKey)
      if (result.deployStatus) {
        markDeployStatus(deployKey, result.deployStatus, result.pauseRequested ?? false)
      }
      setFeedbackMessage(result.resultMessage?.message || t('deploy.monitor.startSuccess'))
      setFeedbackTone('success')
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : t('error.deploy.start'))
      setFeedbackTone('error')
    }
  }

  const handleHold = async (deployKey: number) => {
    if (!isServerBackedRow(deployKey) || historyOnly) {
      return
    }

    try {
      const result = await holdDeployMutation.mutateAsync(deployKey)
      if (result.deployStatus) {
        markDeployStatus(deployKey, result.deployStatus, result.pauseRequested ?? true)
      }
      setFeedbackMessage(result.resultMessage?.message || t('deploy.monitor.holdSuccess'))
      setFeedbackTone('success')
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : t('error.deploy.hold'))
      setFeedbackTone('error')
    }
  }

  const handleMovePage = (nextOffset: number) => {
    setMonitorListOffset(historyOnly, nextOffset)
  }

  const handleOpenComment = (deployKey: number) => {
    setActiveDeployKey(deployKey)
    setCommentDeployKey(deployKey)
  }

  const commentTargetColumns: ColumnDef<DeployTargetItem>[] = [
    {
      key: 'eqpId',
      header: 'EQP ID',
      accessor: (target) => target.eqpId,
      renderCell: (target) => <span className="font-medium text-foreground">{target.eqpId}</span>,
    },
    {
      key: 'task',
      header: t('deploy.monitor.colTask'),
      accessor: () => t(commentTaskTypeLabelKey),
      renderCell: () => (
        <div className="min-w-45">
          <p className="font-medium text-foreground">{t(commentTaskTypeLabelKey)}</p>
          <p className="text-xs text-muted-foreground">
            {commentScenario?.name ?? commentSummaryQuery.data?.resolvedScenarioCode ?? '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'result',
      header: t('deploy.monitor.colResult'),
      accessor: (target) => resolveTargetResultLabel(target.targetStatus),
      renderCell: (target) => (
        <Badge variant={resolveTargetResultVariant(target.targetStatus)}>
          {resolveTargetResultLabel(target.targetStatus)}
        </Badge>
      ),
    },
    {
      key: 'detailStatus',
      header: t('deploy.monitor.colDetailStatus'),
      accessor: (target) => target.targetStatus,
      renderCell: (target) => (
        <Badge variant={resolveTargetResultVariant(target.targetStatus)}>{target.targetStatus}</Badge>
      ),
    },
    {
      key: 'currentStep',
      width: '8rem',
      header: t('deploy.monitor.colCurrentStep'),
      accessor: (target) => target.currentStepCode || '-',
      // 긴 step code(예: 'APPLY_MODEL_VERSION')가 한 줄로 펼쳐져 테이블을 넓히지 않게 줄바꿈.
      renderCell: (target) => (
        <span className="block min-w-0 whitespace-normal break-all text-xs text-muted-foreground">
          {target.currentStepCode || '-'}
        </span>
      ),
    },
    {
      key: 'stepStatus',
      header: t('deploy.monitor.colStepStatus'),
      accessor: (target) => target.currentStepStatus ?? '-',
      renderCell: (target) =>
        target.currentStepStatus ? (
          <Badge variant="secondary">{target.currentStepStatus}</Badge>
        ) : (
          '-'
        ),
    },
    {
      key: 'errorSummary',
      header: t('deploy.monitor.colErrorSummary'),
      maxWidth: '17.5rem',
      accessor: (target) => target.lastErrorMessage || target.lastErrorCode || '-',
      renderCell: (target) => (
        <span className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {target.lastErrorMessage || target.lastErrorCode || '-'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      width: '8rem',
      header: t('deploy.monitor.colUpdatedAt'),
      accessor: (target) => formatDateTime(target.updatedAt),
      // 날짜 문자열이 한 줄로 펼쳐지지 않게 고정 폭 안에서 줄바꿈.
      renderCell: (target) => (
        <span className="block min-w-0 whitespace-normal break-words text-xs text-muted-foreground">
          {formatDateTime(target.updatedAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-6">
      <ConfirmDialog
        open={deleteDialogState !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogState(null)
          }
        }}
        title={
          deleteDialogState?.deleteHistory
            ? t('deploy.monitor.deleteHistoryTitle')
            : t('deploy.monitor.deleteTitle')
        }
        description={
          deleteDialogState
            ? t('deploy.monitor.deleteDesc', {
                name: deleteDialogState.deployName,
                key: deleteDialogState.deployKey,
              })
            : undefined
        }
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        confirmVariant="destructive"
        isConfirming={deleteDeployMutation.isPending}
        onConfirm={() => void handleDelete()}
      />

      <ConfirmDialog
        open={redeployDialogKey !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRedeployDialogKey(null)
          }
        }}
        title={t('deploy.monitor.redeployConfirm')}
        onConfirm={() => void handleConfirmRedeploy()}
      />

      <Dialog
        open={commentDeployKey !== null && commentHistoryItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCommentDeployKey(null)
          }
        }}
      >
        {commentHistoryItem ? (
          <DialogContent className="max-h-[85vh] max-w-300 overflow-hidden rounded-2xl p-0">
            <div className="flex max-h-[85vh] flex-col">
              <DialogHeader className="border-b border-border px-6 py-5">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-foreground">
                  <span>Deploy View</span>
                  <span className="text-sm font-medium text-muted-foreground">#{commentHistoryItem.deployKey}</span>
                  <Badge variant={resolveStatusVariant(commentHistoryItem.deployStatus)}>
                    {commentHistoryItem.deployStatus}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {t('deploy.monitor.viewDialogDesc')}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{t('deploy.monitor.targetProgressTitle')}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('deploy.monitor.targetProgressCount', {
                        total: commentTargets.length,
                        failed: commentFailureTargets.length,
                      })}
                    </p>
                  </div>

                  {isCommentLoading ? (
                    <div className="mt-3 rounded-2xl border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
                      {t('deploy.monitor.targetProgressLoading')}
                    </div>
                  ) : commentTargets.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
                      {t('deploy.monitor.targetProgressEmpty')}
                    </div>
                  ) : (
                    <SelectableTable<DeployTargetItem>
                      testId="deploy-monitor-target-progress-table"
                      columns={commentTargetColumns}
                      rows={commentTargets}
                      rowKey={(target) => target.deployTargetKey}
                      containerClassName="mt-3 rounded-2xl border border-border bg-card"
                      // 기본 min-w-max 는 8개 컬럼을 한 줄로 편 폭을 테이블 최소너비로 강제해 모달(overflow-hidden) 밖으로
                      // 밀어낸다 → min-w-full 로 덮어, 컬럼 width + 긴 컬럼 줄바꿈이 모달 폭 안에서 동작하게 한다.
                      tableClassName="min-w-full"
                    />
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl border border-border bg-muted p-4">
                    <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">{t('deploy.overview.summaryTitle')}</p>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <p>{t('deploy.monitor.summaryTotal', { count: commentHistoryItem.targetSummary.total })}</p>
                      <p>{t('deploy.monitor.summaryCompleted', { count: commentHistoryItem.targetSummary.completed })}</p>
                      <p>{t('deploy.monitor.summaryFailed', { count: commentHistoryItem.targetSummary.failed })}</p>
                      <p>{t('deploy.monitor.summaryCompensationFailed', { count: commentHistoryItem.targetSummary.compensationFailed })}</p>
                    </div>
                    {commentHistoryItem.selectedModelName || commentHistoryItem.selectedModelVersion ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {t('deploy.monitor.lineModel', {
                          name: commentHistoryItem.selectedModelName ?? '-',
                          version: commentHistoryItem.selectedModelVersion ?? '-',
                        })}
                      </p>
                    ) : null}
                    {commentHistoryItem.selectedBusinessJarName ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Business JAR: {commentHistoryItem.selectedBusinessJarName}
                      </p>
                    ) : null}
                    {commentResultTitle || commentSummaryQuery.data?.resultCode || commentResultMessage ? (
                      <div className="mt-3 rounded-xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
                        {commentResultTitle ? (
                          <p className="font-semibold text-foreground">{commentResultTitle}</p>
                        ) : null}
                        {commentSummaryQuery.data?.resultCode ? (
                          <p className="mt-1">{t('deploy.monitor.resultCode', { code: commentSummaryQuery.data.resultCode })}</p>
                        ) : null}
                        {commentResultMessage ? (
                          <p className="mt-1 whitespace-pre-wrap break-words">{commentResultMessage}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-border bg-muted p-4">
                    <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">{t('deploy.monitor.colTask')}</p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {t(commentTaskTypeLabelKey)}
                    </p>
                    <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                      <div>
                        <p className="font-semibold text-foreground">AS-IS</p>
                        <div className="mt-1 space-y-1">
                          {commentAsIsLines.length > 0 ? (
                            commentAsIsLines.map((line) => <p key={line}>{line}</p>)
                          ) : (
                            <>
                              <p>{t('deploy.monitor.asIsUnavailable')}</p>
                              <p>{t('deploy.monitor.asIsNoSnapshot')}</p>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">TO-BE</p>
                        <div className="mt-1 space-y-1">
                          {commentToBeLines.length > 0 ? (
                            commentToBeLines.map((line) => <p key={line}>{line}</p>)
                          ) : (
                            <p>{t('deploy.monitor.toBeEmpty')}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 border-t border-border pt-3">
                        <p>{t('deploy.monitor.taskName', { name: commentHistoryItem.deployName })}</p>
                        <p>{t('deploy.monitor.scenarioCode', { code: commentSummaryQuery.data?.resolvedScenarioCode ?? '-' })}</p>
                        {commentScenario?.summary ? <p>{t('deploy.monitor.scenarioSummary', { summary: commentScenario.summary })}</p> : null}
                        <p>{t('deploy.monitor.requestedByDetail', { user: commentHistoryItem.requestedBy })}</p>
                        <p>{t('deploy.monitor.createdAtDetail', { time: formatDateTime(commentHistoryItem.createdAt) })}</p>
                        <p>{t('deploy.monitor.startedAtDetail', { time: formatDateTime(commentHistoryItem.startedAt) })}</p>
                        <p>{t('deploy.monitor.finishedAtDetail', { time: formatDateTime(commentHistoryItem.finishedAt) })}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {isCommentLoading ? (
                  <div className="mt-4 rounded-2xl border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
                    {t('deploy.monitor.detailLoading')}
                  </div>
                ) : null}
                {commentSummaryErrorMessage ? (
                  <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                    {commentSummaryErrorMessage}
                  </div>
                ) : null}
                {commentTargetsErrorMessage ? (
                  <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                    {commentTargetsErrorMessage}
                  </div>
                ) : null}

              </div>

              <DialogFooter className="border-t border-border px-6 py-4">
                <Button type="button" variant="outline" onClick={() => setCommentDeployKey(null)}>
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <PageCard
        title={historyOnly ? t('deploy.monitor.historySearchTitle') : t('deploy.monitor.searchTitle')}
        className="shrink-0"
        bodyClassName="p-0"
      >
        <div className="grid gap-3 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_180px_92px_92px]">
          <Select
            value={draftModelName || EMPTY_SELECT_VALUE}
            onValueChange={(value) => setDraftModelName(value === EMPTY_SELECT_VALUE ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('deploy.monitor.modelPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>{t('deploy.monitor.allModels')}</SelectItem>
              {modelOptions.map((option) => (
                <SelectItem key={option.modelName} value={option.modelName}>
                  {option.modelName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={draftRequestedBy || EMPTY_SELECT_VALUE}
            onValueChange={(value) =>
              setDraftRequestedBy(value === EMPTY_SELECT_VALUE ? '' : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t('deploy.monitor.userPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>{t('deploy.monitor.allUsers')}</SelectItem>
              {userOptions.map((option) => (
                <SelectItem key={option.userId} value={option.userId}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={draftFromDate}
            onChange={(event) => setDraftFromDate(event.target.value)}
            aria-label={t('deploy.monitor.fromDateAria')}
          />

          <Input
            type="date"
            value={draftToDate}
            onChange={(event) => setDraftToDate(event.target.value)}
            aria-label={t('deploy.monitor.toDateAria')}
          />

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
            onClick={handleClear}
            className="h-11 rounded-xl border-border bg-muted text-muted-foreground"
          >
            {t('deploy.common.clear')}
          </Button>
        </div>

        {feedbackMessage ? (
          <div
            className={`px-6 pb-3 text-sm ${
              feedbackTone === 'error'
                ? 'text-danger'
                : feedbackTone === 'success'
                  ? 'text-success'
                  : 'text-muted-foreground'
            }`}
          >
            {feedbackMessage}
          </div>
        ) : null}
        {summaryErrorMessage ? (
          <div className="px-6 pb-2 text-sm text-danger">{summaryErrorMessage}</div>
        ) : null}
        {targetsErrorMessage ? (
          <div className="px-6 pb-5 text-sm text-danger">{targetsErrorMessage}</div>
        ) : null}
        {monitorOptionsErrorMessage ? (
          <div className="px-6 pb-5 text-sm text-danger">{monitorOptionsErrorMessage}</div>
        ) : null}
        {userListErrorMessage ? (
          <div className="px-6 pb-5 text-sm text-danger">{userListErrorMessage}</div>
        ) : null}
        {historyErrorMessage ? (
          <div className="px-6 pb-5 text-sm text-danger">{historyErrorMessage}</div>
        ) : null}
      </PageCard>

      <PageCard
        title={historyOnly ? t('deploy.monitor.historyTitle') : t('deploy.monitor.deployTitle')}
        count={resolvedHistoryItems.length}
        className="shrink-0"
        bodyClassName="p-0"
      >
        {!historyOnly && activeHistoryItem ? (
          <div className="border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {t('deploy.monitor.currentSelection')} #{activeHistoryItem.deployKey}
              </span>
              <Badge variant={resolveStatusVariant(activeHistoryItem.deployStatus)}>
                {activeHistoryItem.deployStatus}
              </Badge>
              {activeHistoryItem.pauseRequested ? (
                <Badge variant="warning">{t('deploy.monitor.holdRequested')}</Badge>
              ) : null}
              <Badge variant={isServerBackedRow(activeHistoryItem.deployKey) ? 'info' : 'secondary'}>
                {isServerBackedRow(activeHistoryItem.deployKey) ? 'SERVER' : 'LOCAL'}
              </Badge>
              {isServerBackedRow(activeHistoryItem.deployKey) &&
              !activeHistoryItem.terminal &&
              activeHistoryItem.deployStatus === 'RUNNING' ? (
                <span>
                  {deploySummaryQuery.isFetching || deployTargetsQuery.isFetching
                    ? t('deploy.monitor.liveSyncing')
                    : t('deploy.monitor.liveSynced')}
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-lg border-border bg-card px-3 text-xs text-muted-foreground"
                onClick={() => handleOpenComment(activeHistoryItem.deployKey)}
              >
                {t('deploy.monitor.view')}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>
                {t('deploy.monitor.total')} {activeHistoryItem.targetSummary.total}
              </span>
              <span>
                {t('deploy.chart.completed')} {activeHistoryItem.targetSummary.completed}
              </span>
              <span>
                {t('deploy.chart.failed')} {activeHistoryItem.targetSummary.failed}
              </span>
              {isServerBackedRow(activeHistoryItem.deployKey) && deployTargetsQuery.data ? (
                <span>
                  {t('deploy.monitor.targetSync')} {deployTargetsQuery.data.targets.length}
                </span>
              ) : null}
              <span>
                {t('deploy.monitor.requestedBy')} {activeHistoryItem.requestedBy}
              </span>
              {deploySummaryQuery.data?.resultMessage?.message ? (
                <span className="text-muted-foreground">{deploySummaryQuery.data.resultMessage.message}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="px-6 py-5">
          {deployHistoryQuery.isLoading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead>Deploy Name</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Target Count</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, rowIndex) => (
                    <TableRow
                      key={`deploy-monitor-history-skeleton-${rowIndex}`}
                      data-testid="deploy-monitor-history-skeleton"
                    >
                      {Array.from({ length: 8 }).map((_, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : resolvedHistoryItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {historyOnly ? t('deploy.monitor.emptyHistory') : t('deploy.monitor.emptyDeploy')}
            </p>
          ) : (
            <SelectableTable<DeployHistoryItem>
              testId="deploy-monitor-history"
              containerClassName="max-h-[60vh]"
              columns={deployHistoryColumns}
              rows={resolvedHistoryItems}
              rowKey={(row) => row.deployKey}
              wrapRow={(item, _rowIdx, children) => (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setActiveDeployKey(item.deployKey)}
                      onContextMenu={() => setActiveDeployKey(item.deployKey)}
                    >
                      {children}
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-40">
                    {historyOnly ? (
                      <>
                        <ContextMenuItem onSelect={() => handleOpenComment(item.deployKey)}>
                          View
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => handleRedeploy(item.deployKey)}>
                          Redeploy
                        </ContextMenuItem>
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => handleRequestDelete(item.deployKey)}
                        >
                          Delete
                        </ContextMenuItem>
                      </>
                    ) : isServerBackedRow(item.deployKey) ? (
                      item.deployStatus === 'READY' ? (
                        <>
                          <ContextMenuItem onSelect={() => handleOpenComment(item.deployKey)}>
                            View
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={() => void handleStart(item.deployKey)}>
                            Deploy
                          </ContextMenuItem>
                          <ContextMenuItem
                            variant="destructive"
                            onSelect={() => handleRequestDelete(item.deployKey)}
                          >
                            Delete
                          </ContextMenuItem>
                        </>
                      ) : item.deployStatus === 'PLANNING' ? (
                        <>
                          <ContextMenuItem onSelect={() => handleOpenComment(item.deployKey)}>
                            View
                          </ContextMenuItem>
                          <ContextMenuItem
                            variant="destructive"
                            onSelect={() => handleRequestDelete(item.deployKey)}
                          >
                            Delete
                          </ContextMenuItem>
                        </>
                      ) : item.deployStatus === 'RUNNING' ? (
                        <>
                          <ContextMenuItem onSelect={() => handleOpenComment(item.deployKey)}>
                            View
                          </ContextMenuItem>
                          <ContextMenuItem
                            disabled={item.pauseRequested}
                            onSelect={() => void handleHold(item.deployKey)}
                          >
                            {item.pauseRequested ? t('deploy.monitor.holdRequested') : 'Hold'}
                          </ContextMenuItem>
                        </>
                      ) : (
                        <>
                          <ContextMenuItem onSelect={() => handleOpenComment(item.deployKey)}>
                            View
                          </ContextMenuItem>
                          <ContextMenuItem disabled>{t('deploy.monitor.noAction')}</ContextMenuItem>
                        </>
                      )
                    ) : (
                      <>
                        <ContextMenuItem onSelect={() => handleOpenComment(item.deployKey)}>
                          View
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => handleRedeploy(item.deployKey)}>
                          Deploy
                        </ContextMenuItem>
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => handleRequestDelete(item.deployKey)}
                        >
                          Delete
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              )}
            />
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>
            {t('deploy.monitor.pagination', {
              count: displayTotalCount,
              page: currentPage,
              total: totalPages,
            })}
          </span>

          <div className="flex items-center gap-2">
            {deployHistoryQuery.isFetching ? <span>{t('deploy.monitor.listSyncing')}</span> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => handleMovePage(Math.max(0, currentOffset - MONITOR_PAGE_SIZE))}
            >
              {t('deploy.common.prev')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canGoNext}
              onClick={() => handleMovePage(currentOffset + MONITOR_PAGE_SIZE)}
            >
              {t('deploy.common.next')}
            </Button>
          </div>
        </div>
      </PageCard>
    </div>
  )
}
