import { useEffect, useMemo, useState } from 'react'
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
import { useDeleteDeploy } from '../hooks/useDeleteDeploy'
import { useHoldDeploy } from '../hooks/useHoldDeploy'
import { useRedeployDeploy } from '../hooks/useRedeployDeploy'
import { useStartDeploy } from '../hooks/useStartDeploy'
import { useMe, useUsers } from '@/features/profile/hooks/useProfile'
import { createDefaultMonitorFilters, useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployHistoryItem, DeployStatus } from '../types/deploy.types'

interface DeployMonitorPanelProps {
  historyOnly?: boolean
}

type FeedbackTone = 'info' | 'success' | 'error'
type DeleteDialogState = {
  deployKey: number
  deployName: string
  deleteHistory: boolean
} | null

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
  const localHistory = useDeployUiStore((state) => state.localHistory)
  const activeDeployKey = useDeployUiStore((state) => state.activeDeployKey)
  const deployListOffset = useDeployUiStore((state) => state.deployListOffset)
  const historyListOffset = useDeployUiStore((state) => state.historyListOffset)
  const serverBackedDeployKeys = useDeployUiStore((state) => state.serverBackedDeployKeys)
  const localTargetsByDeployKey = useDeployUiStore((state) => state.localTargetsByDeployKey)
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
  const commentSummaryErrorMessage =
    commentSummaryQuery.isError && commentSummaryQuery.error instanceof Error
      ? commentSummaryQuery.error.message
      : commentSummaryQuery.isError
        ? 'Deploy 상세 정보를 조회하지 못했습니다.'
        : null
  const commentTargetsErrorMessage =
    commentTargetsQuery.isError && commentTargetsQuery.error instanceof Error
      ? commentTargetsQuery.error.message
      : commentTargetsQuery.isError
        ? 'Deploy 실패 상세를 조회하지 못했습니다.'
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
  const isCommentLoading =
    isCommentServerBacked && (commentSummaryQuery.isPending || commentTargetsQuery.isPending)

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
        setMode('deploy')
        setFeedbackMessage(
          result.resultMessage?.message || '새 Deploy를 생성했습니다. Deploy 탭에서 실행해 주세요.',
        )
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

    setMode('deploy')
    setFeedbackMessage(`Deploy #${nextDeployKey} 를 대기 상태 로컬 항목으로 다시 생성했습니다.`)
    setFeedbackTone('success')
  }

  const handleRequestDelete = (deployKey: number) => {
    const targetHistoryItem =
      resolvedHistoryItems.find((item) => item.deployKey === deployKey) ?? null

    if (targetHistoryItem === null) {
      setFeedbackMessage('선택한 Deploy 정보를 찾을 수 없습니다.')
      setFeedbackTone('error')
      return
    }

    if (isServerBackedRow(deployKey) && !isServerDeleteAllowed(targetHistoryItem)) {
      setFeedbackMessage('실행 중 Deploy 는 삭제할 수 없습니다.')
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
        setFeedbackMessage('선택한 Deploy 정보를 찾을 수 없습니다.')
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
        setFeedbackMessage(result.resultMessage?.message || `Deploy #${deployKey} 항목을 삭제했습니다.`)
        setFeedbackTone('success')
        setDeleteDialogState(null)
      } catch (error) {
        setFeedbackMessage(error instanceof Error ? error.message : 'Deploy 삭제에 실패했습니다.')
        setFeedbackTone('error')
      }
      return
    }

    deleteLocalDeploy(deployKey)
    setFeedbackMessage(`Deploy #${deployKey} 항목을 목록에서 제거했습니다.`)
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
      setFeedbackMessage(result.resultMessage?.message || 'Deploy를 시작했습니다.')
      setFeedbackTone('success')
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : 'Deploy 실행에 실패했습니다.')
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
      setFeedbackMessage(result.resultMessage?.message || 'Hold 요청이 접수되었습니다.')
      setFeedbackTone('success')
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : 'Deploy hold 요청에 실패했습니다.')
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
            ? 'Deploy 이력을 삭제하시겠습니까?'
            : 'Deploy 를 삭제하시겠습니까?'
        }
        description={
          deleteDialogState
            ? `${deleteDialogState.deployName} (#${deleteDialogState.deployKey}) 항목이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
            : undefined
        }
        confirmText="삭제"
        cancelText="취소"
        confirmVariant="destructive"
        isConfirming={deleteDeployMutation.isPending}
        onConfirm={() => void handleDelete()}
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
          <DialogContent className="max-h-[85vh] max-w-[920px] overflow-hidden rounded-2xl p-0">
            <div className="flex max-h-[85vh] flex-col">
              <DialogHeader className="border-b border-[#EDF1EE] px-6 py-5">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-[#243129]">
                  <span>Deploy Comment</span>
                  <span className="text-sm font-medium text-[#607067]">#{commentHistoryItem.deployKey}</span>
                  <Badge variant={resolveStatusVariant(commentHistoryItem.deployStatus)}>
                    {commentHistoryItem.deployStatus}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-sm text-[#56635C]">
                  선택한 deploy의 실패 사유와 target 상세를 확인합니다.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#E7EDE8] bg-[#FAFCFA] p-4">
                    <p className="text-xs font-semibold tracking-[0.08em] text-[#6C7B72]">Deploy</p>
                    <p className="mt-2 text-base font-semibold text-[#243129]">
                      {commentHistoryItem.deployName}
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-[#526058]">
                      <p>요청자: {commentHistoryItem.requestedBy}</p>
                      <p>생성 시각: {formatDateTime(commentHistoryItem.createdAt)}</p>
                      <p>시작 시각: {formatDateTime(commentHistoryItem.startedAt)}</p>
                      <p>종료 시각: {formatDateTime(commentHistoryItem.finishedAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#E7EDE8] bg-[#FAFCFA] p-4">
                    <p className="text-xs font-semibold tracking-[0.08em] text-[#6C7B72]">요약</p>
                    <div className="mt-3 grid gap-2 text-sm text-[#526058] sm:grid-cols-2">
                      <p>전체 대상: {commentHistoryItem.targetSummary.total}대</p>
                      <p>완료: {commentHistoryItem.targetSummary.completed}대</p>
                      <p>실패: {commentHistoryItem.targetSummary.failed}대</p>
                      <p>보상 실패: {commentHistoryItem.targetSummary.compensationFailed}대</p>
                    </div>
                    {commentHistoryItem.selectedModelName || commentHistoryItem.selectedModelVersion ? (
                      <p className="mt-3 text-sm text-[#526058]">
                        모델: {commentHistoryItem.selectedModelName ?? '-'} /{' '}
                        {commentHistoryItem.selectedModelVersion ?? '-'}
                      </p>
                    ) : null}
                  </div>
                </div>

                {isCommentLoading ? (
                  <div className="mt-4 rounded-2xl border border-[#E7EDE8] bg-[#FAFCFA] px-4 py-6 text-sm text-[#607067]">
                    실패 상세를 불러오고 있습니다.
                  </div>
                ) : null}
                {commentSummaryErrorMessage ? (
                  <div className="mt-4 rounded-2xl border border-[#F4D5D2] bg-[#FFF7F6] px-4 py-3 text-sm text-[#B33A33]">
                    {commentSummaryErrorMessage}
                  </div>
                ) : null}
                {commentTargetsErrorMessage ? (
                  <div className="mt-4 rounded-2xl border border-[#F4D5D2] bg-[#FFF7F6] px-4 py-3 text-sm text-[#B33A33]">
                    {commentTargetsErrorMessage}
                  </div>
                ) : null}
                {commentResultMessage || commentResultTitle || commentSummaryQuery.data?.resultCode ? (
                  <div className="mt-4 rounded-2xl border border-[#E3EADF] bg-[#F8FBF9] p-4">
                    <p className="text-xs font-semibold tracking-[0.08em] text-[#6C7B72]">배포 결과</p>
                    <div className="mt-2 space-y-1 text-sm text-[#425149]">
                      {commentResultTitle ? <p className="font-semibold text-[#243129]">{commentResultTitle}</p> : null}
                      {commentSummaryQuery.data?.resultCode ? (
                        <p>결과 코드: {commentSummaryQuery.data.resultCode}</p>
                      ) : null}
                      {commentResultMessage ? (
                        <p className="whitespace-pre-wrap break-words">{commentResultMessage}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#243129]">실패 대상 상세</p>
                    <p className="text-xs text-[#6C7B72]">{commentFailureTargets.length}건</p>
                  </div>

                  {commentFailureTargets.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-[#E7EDE8] bg-[#FAFCFA] px-4 py-6 text-sm text-[#607067]">
                      확인 가능한 실패 사유가 없습니다.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {commentFailureTargets.map((target) => (
                        <div
                          key={target.deployTargetKey}
                          className="rounded-2xl border border-[#E7EDE8] bg-white p-4 shadow-[0_10px_24px_-24px_rgba(30,54,40,0.35)]"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[#243129]">{target.eqpId}</p>
                              <Badge variant="warning">{target.targetStatus}</Badge>
                              {target.currentStepStatus ? (
                                <Badge variant="secondary">{target.currentStepStatus}</Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-[#6C7B72]">갱신: {formatDateTime(target.updatedAt)}</p>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm text-[#526058]">
                            <p>현재 Step: {target.currentStepCode}</p>
                            <p>오류 코드: {target.lastErrorCode || '-'}</p>
                            <p className="whitespace-pre-wrap break-words">
                              오류 메시지: {target.lastErrorMessage || '상세 메시지가 기록되지 않았습니다.'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="border-t border-[#EDF1EE] px-6 py-4">
                <Button type="button" variant="outline" onClick={() => setCommentDeployKey(null)}>
                  닫기
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

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
                {activeHistoryItem.pauseRequested ? (
                  <Badge variant="warning">Hold 요청됨</Badge>
                ) : null}
                <Badge variant={isServerBackedRow(activeHistoryItem.deployKey) ? 'info' : 'secondary'}>
                  {isServerBackedRow(activeHistoryItem.deployKey) ? 'SERVER' : 'LOCAL'}
                </Badge>
                {isServerBackedRow(activeHistoryItem.deployKey) &&
                !activeHistoryItem.terminal &&
                activeHistoryItem.deployStatus === 'RUNNING' ? (
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={resolveStatusVariant(item.deployStatus)}>{item.deployStatus}</Badge>
                          {item.pauseRequested ? (
                            <Badge variant="warning">Hold 요청됨</Badge>
                          ) : null}
                        </div>
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
                            <ContextMenuItem onSelect={() => handleOpenComment(item.deployKey)}>
                              Comment
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => void handleRedeploy(item.deployKey)}>
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
                            <ContextMenuItem
                              variant="destructive"
                              onSelect={() => handleRequestDelete(item.deployKey)}
                            >
                              Delete
                            </ContextMenuItem>
                          ) : item.deployStatus === 'RUNNING' ? (
                            <ContextMenuItem
                              disabled={item.pauseRequested}
                              onSelect={() => void handleHold(item.deployKey)}
                            >
                              {item.pauseRequested ? 'Hold 요청됨' : 'Hold'}
                            </ContextMenuItem>
                          ) : (
                            <ContextMenuItem disabled>동작 없음</ContextMenuItem>
                          )
                        ) : (
                          <>
                            <ContextMenuItem onSelect={() => void handleRedeploy(item.deployKey)}>
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
