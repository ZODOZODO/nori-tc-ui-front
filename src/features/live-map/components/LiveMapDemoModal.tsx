import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Beaker, ChevronRight, Cpu, Play, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import { useCancelLiveMapDemoJob } from '../hooks/useCancelLiveMapDemoJob'
import { useCreateLiveMapDemoJobs } from '../hooks/useCreateLiveMapDemoJobs'
import { useLiveMapDemoJobs } from '../hooks/useLiveMapDemoJobs'
import { useLiveMapDemoScenarios } from '../hooks/useLiveMapDemoScenarios'
import {
  buildLiveMapDemoTree,
  collectLiveMapDemoEquipmentsByEqpIds,
  collectLiveMapDemoExpandableNodeIds,
  collectLiveMapDemoTreeEqpIds,
  filterLiveMapDemoTree,
  mergeLiveMapDemoTargetEquipments,
} from '../lib/live-map-demo'
import type {
  LiveMapClusterItem,
  LiveMapDemoTargetEquipment,
  LiveMapDemoTestType,
  LiveMapDemoTreeNode,
  LiveMapEquipmentNode,
} from '../types/live-map.types'

interface LiveMapDemoModalProps {
  open: boolean
  equipmentNodes: readonly LiveMapEquipmentNode[]
  clusterItems: readonly LiveMapClusterItem[]
  onClose: () => void
}

const DEFAULT_EXPANDED_NODE_IDS = ['line:A_LINE'] as const
const ACTIVE_DEMO_JOB_STATES =
  'QUEUED,PREPARING,SYNCING_SPEC,CONNECTING,AWAITING_TRIGGER,RUNNING,CLEANING_UP,CANCEL_REQUESTED,COMPLETED,FAILED,CANCELED'
const DEMO_TEST_TYPES = ['SOCKET_ONLY', 'MES_ONLY', 'E2E'] as const satisfies readonly LiveMapDemoTestType[]
const TEST_TYPE_I18N_KEY: Record<LiveMapDemoTestType, string> = {
  SOCKET_ONLY: 'livemap.demo.testType.socket',
  MES_ONLY: 'livemap.demo.testType.mes',
  E2E: 'livemap.demo.testType.e2e',
}
const TERMINAL_DEMO_JOB_STATES = new Set(['COMPLETED', 'FAILED', 'CANCELED'])

const TREE_NODE_STYLE_BY_DEPTH = {
  0: 'border-border bg-muted/50 text-foreground',
  1: 'border-border bg-card text-foreground',
  2: 'border-transparent bg-transparent text-muted-foreground',
} as const

const resolveJobBadgeVariant = (state: string) => {
  if (state === 'COMPLETED') {
    return 'default' as const
  }
  if (state === 'FAILED' || state === 'CANCELED') {
    return 'warning' as const
  }
  if (state === 'RUNNING') {
    return 'info' as const
  }
  if (state === 'QUEUED') {
    return 'secondary' as const
  }
  if (state === 'AWAITING_TRIGGER') {
    return 'outline' as const
  }
  return 'outline' as const
}

type TreeCheckState = 'checked' | 'unchecked' | 'indeterminate'

interface TriStateCheckboxProps {
  state: TreeCheckState
  ariaLabel: string
  onChange: () => void
}

function TriStateCheckbox({ state, ariaLabel, onChange }: TriStateCheckboxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = state === 'indeterminate'
    }
  }, [state])

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={state === 'checked'}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
      aria-label={ariaLabel}
      className="size-4 shrink-0 cursor-pointer rounded border-input accent-brand-primary"
    />
  )
}

export function LiveMapDemoModal({
  open,
  equipmentNodes,
  clusterItems,
  onClose,
}: LiveMapDemoModalProps) {
  const { t } = useI18n()
  const [selectedEqpIds, setSelectedEqpIds] = useState<string[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [targetEquipments, setTargetEquipments] = useState<LiveMapDemoTargetEquipment[]>([])
  const [selectedTestType, setSelectedTestType] = useState<LiveMapDemoTestType>('E2E')
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [startMessage, setStartMessage] = useState<string | null>(null)
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([...DEFAULT_EXPANDED_NODE_IDS])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const {
    data: scenarioOptions = [],
    isLoading: isScenarioLoading,
    refetch: refetchScenarios,
  } = useLiveMapDemoScenarios(selectedTestType, open)
  const {
    data: demoJobs = [],
    isLoading: isJobsLoading,
    refetch: refetchJobs,
  } = useLiveMapDemoJobs(open, ACTIVE_DEMO_JOB_STATES, 100)
  const createDemoJobsMutation = useCreateLiveMapDemoJobs()
  const cancelDemoJobMutation = useCancelLiveMapDemoJob()

  const demoTree = useMemo(
    () => buildLiveMapDemoTree(equipmentNodes, clusterItems),
    [clusterItems, equipmentNodes],
  )

  const visibleDemoTree = useMemo(
    () => filterLiveMapDemoTree(demoTree, searchKeyword),
    [demoTree, searchKeyword],
  )

  const isSearchActive = searchKeyword.trim() !== ''

  const autoExpandedNodeIds = useMemo(
    () => (isSearchActive ? collectLiveMapDemoExpandableNodeIds(visibleDemoTree) : null),
    [isSearchActive, visibleDemoTree],
  )

  const effectiveExpandedNodeIds = useMemo(
    () => new Set(autoExpandedNodeIds ?? expandedNodeIds),
    [autoExpandedNodeIds, expandedNodeIds],
  )

  const selectedEqpIdSet = useMemo(() => new Set(selectedEqpIds), [selectedEqpIds])

  const effectiveSelectedScenarioId = useMemo(() => {
    if (scenarioOptions.some((scenarioOption) => scenarioOption.scenarioId === selectedScenarioId)) {
      return selectedScenarioId
    }
    return scenarioOptions[0]?.scenarioId ?? ''
  }, [scenarioOptions, selectedScenarioId])

  const selectedScenario = useMemo(
    () =>
      scenarioOptions.find(
        (scenarioOption) => scenarioOption.scenarioId === effectiveSelectedScenarioId,
      ) ?? null,
    [effectiveSelectedScenarioId, scenarioOptions],
  )

  const candidateEquipments = useMemo(
    () => collectLiveMapDemoEquipmentsByEqpIds(selectedEqpIds, equipmentNodes),
    [equipmentNodes, selectedEqpIds],
  )

  const refreshDemoData = useCallback(async () => {
    setIsRefreshing(true)
    setStartMessage(null)

    try {
      const [scenarioResult, jobsResult] = await Promise.allSettled([refetchScenarios(), refetchJobs()])

      const failure =
        (scenarioResult.status === 'rejected' && scenarioResult.reason) ||
        (jobsResult.status === 'rejected' && jobsResult.reason)

      if (failure instanceof Error) {
        setStartMessage(failure.message)
        return
      }

      if (failure) {
        setStartMessage('Demo 정보를 새로고침하지 못했습니다.')
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [refetchJobs, refetchScenarios])

  useEffect(() => {
    if (!open) {
      return
    }

    void refreshDemoData()
  }, [open, refreshDemoData])

  const handleClose = () => {
    setSelectedEqpIds([])
    setSearchKeyword('')
    setTargetEquipments([])
    setSelectedTestType('E2E')
    setSelectedScenarioId('')
    setStartMessage(null)
    setExpandedNodeIds([...DEFAULT_EXPANDED_NODE_IDS])
    createDemoJobsMutation.reset()
    cancelDemoJobMutation.reset()
    onClose()
  }

  const handleToggleExpanded = (nodeId: string) => {
    if (isSearchActive) {
      return
    }

    setExpandedNodeIds((currentNodeIds) =>
      currentNodeIds.includes(nodeId)
        ? currentNodeIds.filter((currentNodeId) => currentNodeId !== nodeId)
        : [...currentNodeIds, nodeId],
    )
  }

  const handleToggleEquipment = (eqpId: string) => {
    setSelectedEqpIds((currentEqpIds) =>
      currentEqpIds.includes(eqpId)
        ? currentEqpIds.filter((currentEqpId) => currentEqpId !== eqpId)
        : [...currentEqpIds, eqpId],
    )
  }

  const handleToggleGroup = (node: LiveMapDemoTreeNode) => {
    const groupEqpIds = collectLiveMapDemoTreeEqpIds(node)

    if (groupEqpIds.length === 0) {
      return
    }

    const allChecked = groupEqpIds.every((groupEqpId) => selectedEqpIdSet.has(groupEqpId))

    setSelectedEqpIds((currentEqpIds) => {
      if (allChecked) {
        const groupEqpIdSet = new Set(groupEqpIds)
        return currentEqpIds.filter((currentEqpId) => !groupEqpIdSet.has(currentEqpId))
      }

      const nextEqpIdSet = new Set(currentEqpIds)
      groupEqpIds.forEach((groupEqpId) => nextEqpIdSet.add(groupEqpId))
      return Array.from(nextEqpIdSet)
    })
  }

  const handleAddTargetEquipments = () => {
    if (candidateEquipments.length === 0) {
      return
    }

    setTargetEquipments((currentRows) =>
      mergeLiveMapDemoTargetEquipments(currentRows, candidateEquipments),
    )
    setSelectedEqpIds([])
  }

  const handleRemoveTargetEquipment = (eqpId: string) => {
    setTargetEquipments((currentRows) =>
      currentRows.filter((currentRow) => currentRow.eqpId !== eqpId),
    )
  }

  const handleStartRun = async () => {
    if (!selectedScenario || targetEquipments.length === 0) {
      return
    }

    setStartMessage(null)
    try {
      const result = await createDemoJobsMutation.mutateAsync({
        testType: selectedTestType,
        scenarioId: selectedScenario.scenarioId,
        scenarioVersion: selectedScenario.version,
        eqpIds: targetEquipments.map((targetEquipment) => targetEquipment.eqpId),
        requestedBy: 'LIVE_MAP_UI',
      })
      setStartMessage(
        `요청 완료: ${result.acceptedJobs.length}대 시작, ${result.rejectedEquipments.length}대 제외`,
      )
    } catch (error) {
      setStartMessage(error instanceof Error ? error.message : 'Demo 테스트 시작에 실패했습니다.')
    }
  }

  const handleCancelJob = async (jobId: string, testType: LiveMapDemoTestType) => {
    const testTypeLabel = t(TEST_TYPE_I18N_KEY[testType])
    setStartMessage(null)
    try {
      await cancelDemoJobMutation.mutateAsync(jobId)
      setStartMessage(`${testTypeLabel} 테스트 종료를 요청했습니다.`)
    } catch (error) {
      setStartMessage(
        error instanceof Error
          ? error.message
          : `${testTypeLabel} 테스트 종료 요청에 실패했습니다.`,
      )
    }
  }

  const resolveGroupCheckState = (node: LiveMapDemoTreeNode): TreeCheckState => {
    const groupEqpIds = collectLiveMapDemoTreeEqpIds(node)

    if (groupEqpIds.length === 0) {
      return 'unchecked'
    }

    const checkedCount = groupEqpIds.reduce(
      (count, groupEqpId) => count + (selectedEqpIdSet.has(groupEqpId) ? 1 : 0),
      0,
    )

    if (checkedCount === 0) {
      return 'unchecked'
    }

    if (checkedCount === groupEqpIds.length) {
      return 'checked'
    }

    return 'indeterminate'
  }

  const renderTreeNodes = (nodes: readonly LiveMapDemoTreeNode[], depth = 0) =>
    nodes.map((node) => {
      const isExpanded = effectiveExpandedNodeIds.has(node.id)
      const hasChildren = node.children.length > 0
      const nodeStyle =
        TREE_NODE_STYLE_BY_DEPTH[
          depth as keyof typeof TREE_NODE_STYLE_BY_DEPTH
        ] ?? TREE_NODE_STYLE_BY_DEPTH[2]

      if (node.type === 'EQUIPMENT') {
        const isChecked = node.eqpId ? selectedEqpIdSet.has(node.eqpId) : false

        return (
          <div key={node.id} className="space-y-2">
            <div className="flex items-center gap-2" style={{ marginLeft: `${depth * 16}px` }}>
              <span className="size-5 shrink-0" aria-hidden="true" />
              <label
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  isChecked
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary shadow-soft-sm'
                    : nodeStyle
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => node.eqpId && handleToggleEquipment(node.eqpId)}
                  aria-label={`${node.label} ${t('livemap.node.selectSuffix')}`}
                  className="size-4 shrink-0 cursor-pointer rounded border-input accent-brand-primary"
                />
                <Cpu className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate text-sm font-medium">{node.label}</span>
                {node.eqpName && node.eqpName !== node.label ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{node.eqpName}</span>
                ) : null}
              </label>
            </div>
          </div>
        )
      }

      const groupCheckState = resolveGroupCheckState(node)
      const groupLabel =
        node.type === 'LINE' ? `${node.label} 라인 일괄 선택` : `${node.label} 공정 일괄 선택`

      return (
        <div key={node.id} className="space-y-2">
          <div className="flex items-center gap-2" style={{ marginLeft: `${depth * 16}px` }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => handleToggleExpanded(node.id)}
                disabled={isSearchActive}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`${node.label} ${isExpanded ? '접기' : '펼치기'}`}
              >
                <ChevronRight
                  className={`size-4 transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                />
              </button>
            ) : (
              <span className="size-5 shrink-0" aria-hidden="true" />
            )}

            <div
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 ${nodeStyle}`}
            >
              <TriStateCheckbox
                state={groupCheckState}
                ariaLabel={groupLabel}
                onChange={() => handleToggleGroup(node)}
              />
              <span className="flex-1 truncate text-sm font-medium">{node.label}</span>
              {node.type === 'PROCESS' ? (
                <span className="shrink-0 text-xs text-muted-foreground">{node.children.length}대</span>
              ) : null}
            </div>
          </div>
          {hasChildren && isExpanded ? renderTreeNodes(node.children, depth + 1) : null}
        </div>
      )
    })

  const completedCount = demoJobs.filter((job) => job.state === 'COMPLETED').length

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-[1360px] flex-col gap-0 overflow-hidden border-border bg-background p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-[20px] font-bold text-foreground">
            <Beaker className="size-5 text-brand-primary" />
            {t('livemap.demo.title')}
          </DialogTitle>
          <DialogDescription>{t('livemap.demo.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid items-stretch gap-4 p-6 xl:grid-cols-[minmax(0,1.2fr)_88px_minmax(0,1.45fr)]">
            <section className="flex h-full min-h-[400px] max-h-[430px] flex-col rounded-[22px] border border-border bg-card p-5 shadow-soft-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t('livemap.demo.treeTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('livemap.demo.treeSubtitle')}
                  </p>
                </div>
                <Badge variant="outline">
                  {t('livemap.demo.treeTitle')} {selectedEqpIds.length}
                </Badge>
              </div>

              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder={t('livemap.demo.searchPlaceholder')}
                  className="h-10 pl-9"
                  aria-label={t('livemap.demo.searchAria')}
                />
              </div>

              <div className="mt-3 flex-1 overflow-y-auto rounded-[18px] bg-muted/40 p-3">
                {visibleDemoTree.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    {t('livemap.demo.searchEmpty')}
                  </p>
                ) : (
                  <div className="space-y-2">{renderTreeNodes(visibleDemoTree)}</div>
                )}
              </div>
            </section>

            <div className="flex h-full min-h-[400px] max-h-[430px] items-center justify-center">
              <Button
                type="button"
                onClick={handleAddTargetEquipments}
                disabled={candidateEquipments.length === 0}
                className="h-12 w-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label={t('livemap.demo.addAria')}
              >
                <ArrowRight className="size-5" />
              </Button>
            </div>

            <section className="flex h-full min-h-[400px] max-h-[430px] flex-col rounded-[22px] border border-border bg-card p-5 shadow-soft-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t('livemap.demo.targetTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('livemap.demo.targetSubtitle')}
                  </p>
                </div>
                <Badge>{targetEquipments.length}</Badge>
              </div>

              <div className="mt-4 flex-1 overflow-hidden rounded-[18px] border border-border">
                <div className="h-full overflow-auto">
                  <Table className="min-w-[520px]">
                    <TableHeader>
                      <TableRow className="bg-muted hover:bg-muted">
                        <TableHead>{t('livemap.demo.colEqp')}</TableHead>
                        <TableHead>{t('livemap.demo.colProcess')}</TableHead>
                        <TableHead>{t('livemap.demo.colWaferMode')}</TableHead>
                        <TableHead>{t('livemap.demo.colStatus')}</TableHead>
                        <TableHead className="w-[70px] text-center">
                          {t('livemap.demo.colDelete')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {targetEquipments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                            {t('livemap.demo.targetEmpty')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        targetEquipments.map((targetEquipment) => (
                          <TableRow key={targetEquipment.eqpId}>
                            <TableCell className="font-semibold text-foreground">
                              {targetEquipment.eqpId}
                            </TableCell>
                            <TableCell>{targetEquipment.clusterName}</TableCell>
                            <TableCell>{targetEquipment.processingTypeLabel}</TableCell>
                            <TableCell>{targetEquipment.statusLabel}</TableCell>
                            <TableCell className="text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTargetEquipment(targetEquipment.eqpId)}
                                className="inline-flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-danger hover:bg-danger/10 hover:text-danger"
                                aria-label={`${targetEquipment.eqpId} ${t('livemap.demo.colDelete')}`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </section>
          </div>

          <section className="px-6 pb-6">
            <div className="rounded-[22px] border border-border bg-card p-5 shadow-soft-md">
              <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t('livemap.demo.runTitle')}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('livemap.demo.runSubtitle')}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:min-w-[420px]">
                  <div className="flex flex-wrap items-center gap-2">
                    {DEMO_TEST_TYPES.map((testType) => (
                      <button
                        key={testType}
                        type="button"
                        onClick={() => {
                          setSelectedTestType(testType)
                          setSelectedScenarioId('')
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          selectedTestType === testType
                            ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-brand-primary/40'
                        }`}
                      >
                        {t(TEST_TYPE_I18N_KEY[testType])}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={effectiveSelectedScenarioId}
                      onChange={(event) => setSelectedScenarioId(event.target.value)}
                      className="h-10 min-w-[260px] rounded-[14px] border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-brand-primary"
                      disabled={isScenarioLoading || scenarioOptions.length === 0}
                    >
                      {scenarioOptions.length === 0 ? (
                        <option value="">{t('livemap.demo.scenarioEmpty')}</option>
                      ) : null}
                      {scenarioOptions.map((scenarioOption) => (
                        <option
                          key={`${scenarioOption.scenarioId}:${scenarioOption.version}`}
                          value={scenarioOption.scenarioId}
                        >
                          {scenarioOption.name} (v{scenarioOption.version})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        void refreshDemoData()
                      }}
                      disabled={isRefreshing}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-card text-muted-foreground transition hover:border-brand-primary/40 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={t('livemap.demo.refreshAria')}
                      title={t('livemap.demo.refreshTitle')}
                    >
                      <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>

                    <Button
                      type="button"
                      onClick={() => {
                        void handleStartRun()
                      }}
                      disabled={targetEquipments.length === 0 || !selectedScenario || createDemoJobsMutation.isPending}
                      className="h-10 rounded-[14px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Play className="size-4" />
                      {createDemoJobsMutation.isPending
                        ? t('livemap.demo.startPending')
                        : t('livemap.demo.start')}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="info">{selectedScenario?.name ?? t('livemap.demo.scenarioUnselected')}</Badge>
                {selectedScenario ? (
                  <Badge variant="secondary">{selectedScenario.description}</Badge>
                ) : null}
                <Badge variant="outline">{completedCount}/{demoJobs.length}</Badge>
                {startMessage ? <Badge variant="secondary">{startMessage}</Badge> : null}
              </div>

              <div className="mt-4 overflow-hidden rounded-[18px] border border-border">
                <div className="max-h-[360px] overflow-auto">
                  <Table className="min-w-[1180px]">
                    <TableHeader>
                      <TableRow className="bg-muted hover:bg-muted">
                        <TableHead>{t('livemap.demo.colEqp')}</TableHead>
                        <TableHead>{t('livemap.demo.colProcess')}</TableHead>
                        <TableHead>{t('livemap.demo.colScenario')}</TableHead>
                        <TableHead>{t('livemap.demo.colTestType')}</TableHead>
                        <TableHead>{t('livemap.demo.colStage')}</TableHead>
                        <TableHead>{t('livemap.demo.colStatus')}</TableHead>
                        <TableHead className="min-w-[220px]">{t('livemap.demo.colProgress')}</TableHead>
                        <TableHead className="w-[96px] text-center">{t('livemap.demo.colEnd')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isJobsLoading && demoJobs.length === 0 ? (
                        Array.from({ length: 5 }).map((_, rowIndex) => (
                          <TableRow key={`live-map-demo-jobs-skeleton-${rowIndex}`} data-testid="live-map-demo-jobs-skeleton">
                            {Array.from({ length: 8 }).map((_, cellIndex) => (
                              <TableCell key={cellIndex}>
                                <Skeleton className="h-4 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : demoJobs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                            {t('livemap.demo.jobsEmpty')}
                          </TableCell>
                        </TableRow>
                      ) : (
                        demoJobs.map((job) => (
                          <TableRow key={job.jobId}>
                            <TableCell className="font-semibold text-foreground">{job.eqpId}</TableCell>
                            <TableCell>{job.processType ?? 'ETC'}</TableCell>
                            <TableCell>{job.scenarioName}</TableCell>
                            <TableCell>{t(TEST_TYPE_I18N_KEY[job.testType]) || job.testType}</TableCell>
                            <TableCell>{job.currentStageName ?? job.currentStageCode ?? '-'}</TableCell>
                            <TableCell>
                              <Badge variant={resolveJobBadgeVariant(job.state)}>{job.state}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={`h-full rounded-full transition-[width] duration-500 ${
                                      job.progressPercent >= 100 ? 'bg-success' : 'bg-brand-primary'
                                    }`}
                                    style={{ width: `${job.progressPercent}%` }}
                                  />
                                </div>
                                <span className="min-w-[44px] text-right text-xs font-semibold text-muted-foreground">
                                  {job.progressPercent}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-[10px] border-border px-3 text-xs font-semibold text-foreground hover:border-danger hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={
                                  TERMINAL_DEMO_JOB_STATES.has(job.state) ||
                                  cancelDemoJobMutation.isPending
                                }
                                onClick={() => {
                                  void handleCancelJob(job.jobId, job.testType)
                                }}
                              >
                                {t('livemap.demo.end')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
