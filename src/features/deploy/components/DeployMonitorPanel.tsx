import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { EqpModelOption } from '@/features/eqp/types/eqp.types'
import { useDeployRegisterOptions } from '../hooks/useDeployRegisterOptions'
import { useDeployHistoryList } from '../hooks/useDeployHistoryList'
import { useDeploySummary } from '../hooks/useDeploySummary'
import { useDeployTargets } from '../hooks/useDeployTargets'
import { useCancelDeploy } from '../hooks/useCancelDeploy'
import { useDeleteDeploy } from '../hooks/useDeleteDeploy'
import { useRedeployDeploy } from '../hooks/useRedeployDeploy'
import { useMe, useUsers } from '@/features/profile/hooks/useProfile'
import { createDefaultMonitorFilters, useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployHistoryItem, DeployStatus } from '../types/deploy.types'

interface DeployMonitorPanelProps {
  historyOnly?: boolean
}

type FeedbackTone = 'info' | 'success' | 'error'

const cardClassName =
  'rounded-[18px] border border-[#E2E9E4] bg-white shadow-[0_10px_30px_-24px_rgba(30,54,40,0.35)]'
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

  return new Intl.DateTimeFormat('ko-KR', {
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
  const localHistory = useDeployUiStore((state) => state.localHistory)
  const activeDeployKey = useDeployUiStore((state) => state.activeDeployKey)
  const deployListOffset = useDeployUiStore((state) => state.deployListOffset)
  const historyListOffset = useDeployUiStore((state) => state.historyListOffset)
  const serverBackedDeployKeys = useDeployUiStore((state) => state.serverBackedDeployKeys)
  const monitorFilters = useDeployUiStore((state) => state.monitorFilters)
  const setMonitorFilters = useDeployUiStore((state) => state.setMonitorFilters)
  const resetMonitorFilters = useDeployUiStore((state) => state.resetMonitorFilters)
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
  const setMode = useDeployUiStore((state) => state.setMode)

  const meQuery = useMe(true)
  const monitorOptionsQuery = useDeployRegisterOptions()
  const userListQuery = useUsers(true)
  const cancelDeployMutation = useCancelDeploy()
  const redeployDeployMutation = useRedeployDeploy()
  const deleteDeployMutation = useDeleteDeploy()

  const [draftModelName, setDraftModelName] = useState(monitorFilters.modelName)
  const [draftRequestedBy, setDraftRequestedBy] = useState(monitorFilters.requestedBy)
  const [draftFromDate, setDraftFromDate] = useState(monitorFilters.fromDate)
  const [draftToDate, setDraftToDate] = useState(monitorFilters.toDate)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>('info')

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
        : 'Deploy 목록을 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.'
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

  const isActiveServerDeploy =
    activeDeployKey !== null &&
    isServerBackedRow(activeDeployKey) &&
    !historyOnly &&
    !activeHistoryItem?.terminal

  const deploySummaryQuery = useDeploySummary(activeDeployKey, isActiveServerDeploy)
  const deployTargetsQuery = useDeployTargets(activeDeployKey, isActiveServerDeploy)

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
        : 'Deploy 정보 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.'
      : null

  const targetsErrorMessage =
    deployTargetsQuery.isError && !historyOnly
      ? deployTargetsQuery.error instanceof Error
        ? deployTargetsQuery.error.message
        : 'Deploy 대상 상태를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.'
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
    setMonitorFilters({
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
    resetMonitorFilters()
    resetMonitorListOffsets()
    setFeedbackMessage(null)
    setFeedbackTone('info')
  }

  const handleRedeploy = async (deployKey: number) => {
    const isServerBacked = isServerBackedRow(deployKey)
    const sourceHistoryItem = resolvedHistoryItems.find((item) => item.deployKey === deployKey) ?? null

    if (isServerBacked) {
      if (!historyOnly) {
        setFeedbackMessage('진행 중 Deploy 는 다시 실행할 수 없습니다.')
        setFeedbackTone('error')
        return
      }

      if (!window.confirm('선택한 Deploy를 다시 실행하시겠습니까?')) {
        return
      }

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
        setMode(
          result.deployStatus === 'COMPLETED' ||
            result.deployStatus === 'PARTIAL_FAILED' ||
            result.deployStatus === 'FAILED' ||
            result.deployStatus === 'CANCELED'
            ? 'history'
            : 'deploy',
        )
        setFeedbackMessage(result.resultMessage?.message || '선택한 Deploy를 다시 실행했습니다.')
        setFeedbackTone('success')
      } catch (error) {
        setFeedbackMessage(
          error instanceof Error ? error.message : 'Deploy 재실행에 실패했습니다.',
        )
        setFeedbackTone('error')
      }
      return
    }

    const nextDeployKey = redeployLocalHistoryItem(deployKey)

    if (nextDeployKey === null) {
      setFeedbackMessage('선택한 Deploy 를 다시 실행할 수 없습니다.')
      setFeedbackTone('error')
      return
    }

    setFeedbackMessage(`Deploy #${nextDeployKey} 를 로컬 항목으로 다시 생성했습니다.`)
    setFeedbackTone('success')
  }

  const handleDelete = async (deployKey: number) => {
    if (isServerBackedRow(deployKey)) {
      if (!historyOnly) {
        setFeedbackMessage('진행 중 Deploy 는 삭제할 수 없습니다.')
        setFeedbackTone('error')
        return
      }

      if (!window.confirm('선택한 Deploy 이력을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        return
      }

      try {
        const result = await deleteDeployMutation.mutateAsync(deployKey)
        deleteLocalDeploy(deployKey)
        if (activeDeployKey === deployKey) {
          setActiveDeployKey(null)
        }
        setFeedbackMessage(result.resultMessage?.message || `Deploy #${deployKey} 이력을 삭제했습니다.`)
        setFeedbackTone('success')
      } catch (error) {
        setFeedbackMessage(
          error instanceof Error ? error.message : 'Deploy 이력 삭제에 실패했습니다.',
        )
        setFeedbackTone('error')
      }
      return
    }

    deleteLocalDeploy(deployKey)
    setFeedbackMessage(`Deploy #${deployKey} 항목을 목록에서 제거했습니다.`)
    setFeedbackTone('success')
  }

  const handleCancel = async (deployKey: number) => {
    if (!isServerBackedRow(deployKey) || historyOnly) {
      return
    }

    if (!window.confirm('진행 중 Deploy를 취소하시겠습니까?')) {
      return
    }

    try {
      const result = await cancelDeployMutation.mutateAsync(deployKey)
      if (result.deployStatus) {
        markDeployStatus(deployKey, result.deployStatus)
      }
      setFeedbackMessage(result.resultMessage?.message || 'Deploy를 취소했습니다.')
      setFeedbackTone('success')
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : 'Deploy 취소에 실패했습니다.')
      setFeedbackTone('error')
    }
  }

  const handleMovePage = (nextOffset: number) => {
    setMonitorListOffset(historyOnly, nextOffset)
  }

  return (
    <div className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-6">
      <section className={cardClassName}>
        <div className="border-b border-[#EDF1EE] px-6 py-4">
          <h2 className="text-sm font-semibold text-[#243129]">
            {historyOnly ? 'Deploy History Search' : 'Deploy Search'}
          </h2>
        </div>

        <div className="grid gap-3 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_180px_92px_92px]">
          <Select
            value={draftModelName || EMPTY_SELECT_VALUE}
            onValueChange={(value) => setDraftModelName(value === EMPTY_SELECT_VALUE ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Model 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>전체 Model</SelectItem>
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
              <SelectValue placeholder="User 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>전체 User</SelectItem>
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
            aria-label="시작 기간"
          />

          <Input
            type="date"
            value={draftToDate}
            onChange={(event) => setDraftToDate(event.target.value)}
            aria-label="종료 기간"
          />

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
            onClick={handleClear}
            className="h-11 rounded-xl border-[#D8E1DB] bg-[#F8FBF9] text-[#526058]"
          >
            Clear
          </Button>
        </div>

        {feedbackMessage ? (
          <div
            className={`px-6 pb-3 text-sm ${
              feedbackTone === 'error'
                ? 'text-[#C5534B]'
                : feedbackTone === 'success'
                  ? 'text-[#215A43]'
                  : 'text-[#567062]'
            }`}
          >
            {feedbackMessage}
          </div>
        ) : null}
        {summaryErrorMessage ? (
          <div className="px-6 pb-2 text-sm text-[#C5534B]">{summaryErrorMessage}</div>
        ) : null}
        {targetsErrorMessage ? (
          <div className="px-6 pb-5 text-sm text-[#C5534B]">{targetsErrorMessage}</div>
        ) : null}
        {monitorOptionsErrorMessage ? (
          <div className="px-6 pb-5 text-sm text-[#C5534B]">{monitorOptionsErrorMessage}</div>
        ) : null}
        {userListErrorMessage ? (
          <div className="px-6 pb-5 text-sm text-[#C5534B]">{userListErrorMessage}</div>
        ) : null}
        {historyErrorMessage ? (
          <div className="px-6 pb-5 text-sm text-[#C5534B]">{historyErrorMessage}</div>
        ) : null}
      </section>

      <section className={cardClassName}>
        <div className="border-b border-[#EDF1EE] px-6 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-sm font-semibold text-[#243129]">
              {historyOnly ? 'Deploy History' : 'Deploy'}
            </h2>

            {!historyOnly && activeHistoryItem ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C6A63]">
                <span className="font-medium text-[#243129]">
                  현재 선택: #{activeHistoryItem.deployKey}
                </span>
                <Badge variant={resolveStatusVariant(activeHistoryItem.deployStatus)}>
                  {activeHistoryItem.deployStatus}
                </Badge>
                <Badge variant={isServerBackedRow(activeHistoryItem.deployKey) ? 'info' : 'secondary'}>
                  {isServerBackedRow(activeHistoryItem.deployKey) ? 'SERVER' : 'LOCAL'}
                </Badge>
                {isServerBackedRow(activeHistoryItem.deployKey) && !activeHistoryItem.terminal ? (
                  <span>
                    {deploySummaryQuery.isFetching || deployTargetsQuery.isFetching
                      ? '실시간 상태 동기화 중...'
                      : '실시간 상태를 반영하고 있습니다.'}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          {!historyOnly && activeHistoryItem ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#5C6A63]">
              <span>총 {activeHistoryItem.targetSummary.total}대</span>
              <span>완료 {activeHistoryItem.targetSummary.completed}대</span>
              <span>실패 {activeHistoryItem.targetSummary.failed}대</span>
              {isServerBackedRow(activeHistoryItem.deployKey) && deployTargetsQuery.data ? (
                <span>Target 동기화 {deployTargetsQuery.data.targets.length}건</span>
              ) : null}
              <span>실행자 {activeHistoryItem.requestedBy}</span>
              {deploySummaryQuery.data?.resultMessage?.message ? (
                <span className="text-[#425149]">{deploySummaryQuery.data.resultMessage.message}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto px-6 py-5">
          <Table>
            <TableHeader className="bg-[#F6F8F6]">
              <TableRow className="hover:bg-[#F6F8F6]">
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
              {resolvedHistoryItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-[#7B8781]">
                    {historyOnly ? '완료된 Deploy 이력이 없습니다.' : '표시할 Deploy 데이터가 없습니다.'}
                  </TableCell>
                </TableRow>
              ) : (
                resolvedHistoryItems.map((item) => {
                  const tableRow = (
                    <TableRow
                      key={item.deployKey}
                      data-state={activeDeployKey === item.deployKey ? 'selected' : undefined}
                      className="cursor-pointer"
                      onClick={() => setActiveDeployKey(item.deployKey)}
                      onContextMenu={() => setActiveDeployKey(item.deployKey)}
                    >
                      <TableCell className="min-w-[240px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{item.deployName}</span>
                          <Badge variant={isServerBackedRow(item.deployKey) ? 'info' : 'secondary'}>
                            {isServerBackedRow(item.deployKey) ? 'SERVER' : 'LOCAL'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{item.eventType}</TableCell>
                      <TableCell>
                        <Badge variant={resolveStatusVariant(item.deployStatus)}>{item.deployStatus}</Badge>
                      </TableCell>
                      <TableCell>{item.targetSummary.total}</TableCell>
                      <TableCell>{item.targetSummary.completed}</TableCell>
                      <TableCell>{item.targetSummary.failed}</TableCell>
                      <TableCell>{item.requestedBy}</TableCell>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    </TableRow>
                  )

                  return (
                    <ContextMenu key={item.deployKey}>
                      <ContextMenuTrigger asChild>{tableRow}</ContextMenuTrigger>
                      <ContextMenuContent className="w-40">
                        {historyOnly ? (
                          <>
                            <ContextMenuItem onSelect={() => void handleRedeploy(item.deployKey)}>
                              Redeploy
                            </ContextMenuItem>
                            <ContextMenuItem
                              variant="destructive"
                              onSelect={() => void handleDelete(item.deployKey)}
                            >
                              Delete
                            </ContextMenuItem>
                          </>
                        ) : isServerBackedRow(item.deployKey) ? (
                          <ContextMenuItem
                            disabled={item.terminal}
                            variant="destructive"
                            onSelect={() => void handleCancel(item.deployKey)}
                          >
                            Cancel
                          </ContextMenuItem>
                        ) : (
                          <>
                            <ContextMenuItem onSelect={() => void handleRedeploy(item.deployKey)}>
                              Deploy
                            </ContextMenuItem>
                            <ContextMenuItem
                              variant="destructive"
                              onSelect={() => void handleDelete(item.deployKey)}
                            >
                              Delete
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#EDF1EE] px-6 py-4 text-xs text-[#5C6A63] md:flex-row md:items-center md:justify-between">
          <span>
            총 {displayTotalCount}건 · {currentPage} / {totalPages} 페이지
          </span>

          <div className="flex items-center gap-2">
            {deployHistoryQuery.isFetching ? <span>목록 동기화 중...</span> : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => handleMovePage(Math.max(0, currentOffset - MONITOR_PAGE_SIZE))}
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canGoNext}
              onClick={() => handleMovePage(currentOffset + MONITOR_PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
