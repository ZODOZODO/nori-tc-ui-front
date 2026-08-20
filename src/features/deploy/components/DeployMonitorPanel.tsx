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
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message'
import { PageCard } from '@/shared/layout/PageCard'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import type { EqpModelOption } from '@/features/eqp/types/eqp.types'
import { useDeployRegisterOptions } from '../hooks/useDeployRegisterOptions'
import { useDeployHistoryList } from '../hooks/useDeployHistoryList'
import { useDeploySummary } from '../hooks/useDeploySummary'
import { useDeployTargets } from '../hooks/useDeployTargets'
import { useDeleteDeploy } from '../hooks/useDeleteDeploy'
import { useHoldDeploy } from '../hooks/useHoldDeploy'
import { useRedeployDeploy } from '../hooks/useRedeployDeploy'
import { useStartDeploy } from '../hooks/useStartDeploy'
import { useMe, useUsers } from '@/features/profile/hooks/useProfile'
import { formatDateTime, resolveStatusVariant } from '../lib/deploy-monitor-format'
import { createDefaultMonitorFilters } from '../lib/deploy-ui-state'
import { useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployHistoryItem } from '../types/deploy.types'
import { DeployMonitorViewModal } from './DeployMonitorViewModal'

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
      setFeedbackMessage(resolveErrorMessage(error, t('error.deploy.redeploy')))
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
        setFeedbackMessage(resolveErrorMessage(error, t('deploy.monitor.deleteError')))
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
      setFeedbackMessage(resolveErrorMessage(error, t('error.deploy.start')))
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
      setFeedbackMessage(resolveErrorMessage(error, t('error.deploy.hold')))
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

      <DeployMonitorViewModal
        deployKey={commentDeployKey}
        historyItem={commentHistoryItem}
        isServerBacked={isCommentServerBacked}
        onClose={() => setCommentDeployKey(null)}
      />

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
