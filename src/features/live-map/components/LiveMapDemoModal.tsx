import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Beaker, ChevronRight, Cpu, Play, RefreshCw, Search, Square, Trash2, Upload } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import type { SimulatorRunTarget } from '../api/live-map-demo-run.api'
import { useI18n } from '@/i18n/i18n-context'
import { useCreateSimulatorRun } from '../hooks/useCreateSimulatorRun'
import { useSimulatorRun, isTerminalRunState } from '../hooks/useSimulatorRun'
import { useSimulatorRunScenarios } from '../hooks/useSimulatorRunScenarios'
import { useStopSimulatorRun } from '../hooks/useStopSimulatorRun'
import { useStopSimulatorTarget } from '../hooks/useStopSimulatorTarget'
import {
  buildLiveMapDemoTree,
  collectLiveMapDemoEquipmentsByEqpIds,
  collectLiveMapDemoExpandableNodeIds,
  collectLiveMapDemoTreeEqpIds,
  filterLiveMapDemoTree,
  mergeLiveMapDemoTargetEquipments,
} from '../lib/live-map-demo'
import { resolveRunStateChipClass } from '../lib/live-map-status-theme'
import { liveMapDemoRunApi } from '../api/live-map-demo-run.api'
import { useMe } from '@/features/profile/hooks/useProfile'
import { hasPermission, LIVE_MAP_DEMO_RUN_SCENARIO_DELETE_PERMISSION } from '@/shared/lib/permission'
import type {
  LiveMapDemoTargetEquipment,
  LiveMapDemoTestType,
  LiveMapDemoTreeNode,
  LiveMapEquipmentNode,
} from '../types/live-map.types'

interface LiveMapDemoModalProps {
  open: boolean
  equipmentNodes: readonly LiveMapEquipmentNode[]
  onClose: () => void
}

const DEFAULT_EXPANDED_NODE_IDS = ['line:A_LINE'] as const
const DEMO_TEST_TYPES = ['SOCKET_ONLY', 'MES_ONLY', 'E2E'] as const satisfies readonly LiveMapDemoTestType[]
const TEST_TYPE_I18N_KEY: Record<LiveMapDemoTestType, string> = {
  SOCKET_ONLY: 'livemap.demo.testType.socket',
  MES_ONLY: 'livemap.demo.testType.mes',
  E2E: 'livemap.demo.testType.e2e',
}
// run.mode(orchestrator SimulatorMode) → 연결 유형 라벨 i18n 키. 테스트타입 버튼 라벨과 동일 출처라 표기 일관.
const RUN_MODE_TEST_TYPE_I18N_KEY: Record<string, string> = {
  ALL: 'livemap.demo.testType.e2e',
  EQUIPMENT_ONLY: 'livemap.demo.testType.socket',
  UPSTREAM_ONLY: 'livemap.demo.testType.mes',
}

const TREE_NODE_STYLE_BY_DEPTH = {
  0: 'border-border bg-muted/50 text-foreground',
  1: 'border-border bg-card text-foreground',
  2: 'border-transparent bg-transparent text-muted-foreground',
} as const

const TERMINAL_TARGET_STATES = new Set(['COMPLETED', 'CANCELED', 'FAILED'])
const isTerminalTargetState = (state: string) => TERMINAL_TARGET_STATES.has(state)

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
  onClose,
}: LiveMapDemoModalProps) {
  const { t } = useI18n()
  const [selectedEqpIds, setSelectedEqpIds] = useState<string[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [targetEquipments, setTargetEquipments] = useState<LiveMapDemoTargetEquipment[]>([])
  const [selectedTestType, setSelectedTestType] = useState<LiveMapDemoTestType>('E2E')
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [startMessage, setStartMessage] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([...DEFAULT_EXPANDED_NODE_IDS])
  // 종료 진행 중인 설비 — 전역 mutation pending 대신 per-eqpId 추적으로 해당 행만 비활성한다(H3).
  const [stoppingEqpIds, setStoppingEqpIds] = useState<Set<string>>(new Set())
  // 시작 실패(409 등)는 작은 배지로는 잘 안 보여 모달 팝업으로 강조한다.
  const [startError, setStartError] = useState<string | null>(null)
  // 시나리오 업로드/삭제 진행 상태(R-8). 파일 입력은 hidden — 업로드 버튼이 트리거한다.
  const [isScenarioMutating, setIsScenarioMutating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const meQuery = useMe()
  const canDeleteScenario = hasPermission(
    meQuery.data?.permissionCodes,
    LIVE_MAP_DEMO_RUN_SCENARIO_DELETE_PERMISSION,
  )
  const {
    data: scenarioOptions = [],
    isLoading: isScenarioLoading,
    isFetching: isScenarioFetching,
    refetch: refetchScenarios,
  } = useSimulatorRunScenarios(open)
  const {
    data: run,
    isLoading: isRunLoading,
    isFetching: isRunFetching,
    refetch: refetchRun,
  } = useSimulatorRun(activeRunId, open)
  // 수동 플래그 대신 쿼리 fetching 상태에서 파생 — effect 안 sync setState 를 없앤다.
  const isRefreshing = isScenarioFetching || isRunFetching
  const createRunMutation = useCreateSimulatorRun()
  const stopTargetMutation = useStopSimulatorTarget()
  const stopRunMutation = useStopSimulatorRun()
  const runTargets = run?.targets ?? []

  const demoTree = useMemo(() => buildLiveMapDemoTree(equipmentNodes), [equipmentNodes])

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

  /**
   * 시나리오/작업 목록을 다시 불러오고 실패 메시지를 반환합니다 (성공 시 null).
   * setState 를 직접 하지 않아 effect/handler 어디서든 호출 가능하고, 호출자가
   * 콜백에서 메시지를 반영합니다.
   */
  const refreshDemoData = useCallback(async (): Promise<string | null> => {
    const [scenarioResult, runResult] = await Promise.allSettled([
      refetchScenarios(),
      activeRunId ? refetchRun() : Promise.resolve(null),
    ])

    const failure =
      (scenarioResult.status === 'rejected' && scenarioResult.reason) ||
      (runResult.status === 'rejected' && runResult.reason)

    if (failure instanceof Error) {
      return failure.message
    }

    return failure ? t('livemap.demo.refreshFailed') : null
  }, [activeRunId, refetchRun, refetchScenarios, t])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    void refreshDemoData().then((failureMessage) => {
      if (!cancelled && failureMessage) {
        setStartMessage(failureMessage)
      }
    })

    return () => {
      cancelled = true
    }
  }, [open, refreshDemoData])

  const handleClose = () => {
    // 진행 중 run 을 고아로 두지 않도록 전체 종료한다(H4). per-target 모델엔 run-level 종료 버튼이 없어 모달 닫기가
    // UNTIL_STOPPED 설비 누수(lease/포트/워커 loop 영구 점유)를 막는 유일 경로다. best-effort — 닫기를 막지 않는다.
    if (activeRunId && !isTerminalRunState(run?.state)) {
      stopRunMutation.mutate(activeRunId)
    }
    setSelectedEqpIds([])
    setSearchKeyword('')
    setTargetEquipments([])
    setSelectedTestType('E2E')
    setSelectedScenarioId('')
    setStartMessage(null)
    setStartError(null)
    setActiveRunId(null)
    setExpandedNodeIds([...DEFAULT_EXPANDED_NODE_IDS])
    setStoppingEqpIds(new Set())
    createRunMutation.reset()
    stopTargetMutation.reset()
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
      const response = await createRunMutation.mutateAsync({
        testType: selectedTestType,
        scenarioId: selectedScenario.scenarioId,
        eqpIds: targetEquipments.map((targetEquipment) => targetEquipment.eqpId),
      })
      setActiveRunId(response.runId)
      setStartMessage(
        t('livemap.demo.runStarted', {
          runId: response.runId,
          count: response.targets.length,
        }),
      )
    } catch (error) {
      // 시작 실패는 배지가 아니라 팝업으로 강조(409=이미 점유 등 사용자가 놓치면 안 되는 메시지).
      setStartError(error instanceof Error ? error.message : t('error.livemap.demoStart'))
    }
  }

  const handleStopTarget = async (eqpId: string) => {
    if (!activeRunId) {
      return
    }
    setStartMessage(null)
    setStoppingEqpIds((prev) => new Set(prev).add(eqpId))
    try {
      await stopTargetMutation.mutateAsync({ runId: activeRunId, eqpId })
      // M8: 어느 설비를 종료했는지 메시지에 eqpId 포함(다중 설비 run 식별).
      setStartMessage(`${eqpId} — ${t('livemap.demo.stopRequested')}`)
    } catch (error) {
      setStartMessage(error instanceof Error ? error.message : `${eqpId} — ${t('livemap.demo.stopFailed')}`)
    } finally {
      setStoppingEqpIds((prev) => {
        const next = new Set(prev)
        next.delete(eqpId)
        return next
      })
    }
  }

  const handleUploadScenarioFile = async (file: File | null) => {
    if (!file) {
      return
    }
    setStartMessage(null)
    setStartError(null)
    setIsScenarioMutating(true)
    try {
      const created = await liveMapDemoRunApi.uploadScenario(file)
      await refetchScenarios()
      setSelectedScenarioId(created.scenarioId)
      setStartMessage(t('livemap.demo.scenarioUploaded', { name: created.name }))
    } catch (error) {
      setStartError(error instanceof Error ? error.message : t('error.livemap.scenarioUpload'))
    } finally {
      setIsScenarioMutating(false)
    }
  }

  const handleDeleteSelectedScenario = async () => {
    // 시드(isSeed) 또는 권한 미보유면 호출 경로가 비활성이지만, 안전하게 가드한다(백엔드가 최종 강제).
    if (!selectedScenario || selectedScenario.isSeed || !canDeleteScenario) {
      return
    }
    setStartMessage(null)
    setStartError(null)
    setIsScenarioMutating(true)
    try {
      await liveMapDemoRunApi.deleteScenario(selectedScenario.scenarioId)
      await refetchScenarios()
      setSelectedScenarioId('')
      setStartMessage(t('livemap.demo.scenarioDeleted', { scenarioId: selectedScenario.scenarioId }))
    } catch (error) {
      setStartError(error instanceof Error ? error.message : t('error.livemap.scenarioDelete'))
    } finally {
      setIsScenarioMutating(false)
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
        node.type === 'LINE'
          ? t('livemap.demo.selectLine', { label: node.label })
          : t('livemap.demo.selectProcess', { label: node.label })

      return (
        <div key={node.id} className="space-y-2">
          <div className="flex items-center gap-2" style={{ marginLeft: `${depth * 16}px` }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => handleToggleExpanded(node.id)}
                disabled={isSearchActive}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={
                  isExpanded
                    ? t('livemap.demo.collapseAria', { label: node.label })
                    : t('livemap.demo.expandAria', { label: node.label })
                }
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
                <span className="shrink-0 text-xs text-muted-foreground">{t('livemap.demo.unitCount', { count: node.children.length })}</span>
              ) : null}
            </div>
          </div>
          {hasChildren && isExpanded ? renderTreeNodes(node.children, depth + 1) : null}
        </div>
      )
    })

  const completedCount = runTargets.filter((target) => target.state === 'COMPLETED').length

  // 연결 유형(모두/설비만/MES만)은 run 단위 값이라 모든 행에 동일 — run.mode 를 라벨로 매핑(미지정 모드는 원문 노출).
  const connectionTypeKey = run ? RUN_MODE_TEST_TYPE_I18N_KEY[run.mode] : undefined
  const connectionTypeLabel = run ? (connectionTypeKey ? t(connectionTypeKey) : run.mode) : '-'

  const targetEquipmentColumns: ColumnDef<LiveMapDemoTargetEquipment>[] = [
    {
      key: 'eqpId',
      header: t('livemap.demo.colEqp'),
      accessor: (targetEquipment) => targetEquipment.eqpId,
      renderCell: (targetEquipment) => (
        <span className="font-semibold text-foreground">{targetEquipment.eqpId}</span>
      ),
    },
    {
      key: 'process',
      header: t('livemap.demo.colProcess'),
      accessor: (targetEquipment) => targetEquipment.clusterName,
    },
    {
      key: 'waferMode',
      header: t('livemap.demo.colWaferMode'),
      accessor: (targetEquipment) => targetEquipment.processingTypeLabel,
    },
    {
      key: 'status',
      header: t('livemap.demo.colStatus'),
      accessor: (targetEquipment) => targetEquipment.statusLabel,
    },
  ]

  const runTargetColumns: ColumnDef<SimulatorRunTarget>[] = [
    {
      key: 'eqpId',
      header: t('livemap.demo.colEqp'),
      accessor: (target) => target.eqpId,
      renderCell: (target) => (
        <span className="font-semibold text-foreground">{target.eqpId}</span>
      ),
    },
    {
      key: 'connection',
      header: t('livemap.demo.colConnection'),
      accessor: () => connectionTypeLabel,
    },
    {
      key: 'commInterface',
      header: t('livemap.demo.colCommInterface'),
      accessor: (target) => target.commInterface || '-',
    },
    {
      key: 'status',
      header: t('livemap.demo.colStatus'),
      accessor: (target) => target.state,
      renderCell: (target) => (
        <Badge className={resolveRunStateChipClass(target.state)}>{target.state}</Badge>
      ),
    },
    {
      key: 'result',
      header: t('livemap.demo.colResult'),
      width: '13.75rem',
      accessor: (target) => `${target.completedCycleCount} / ${target.erroredCycleCount}`,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-340 flex-col gap-0 overflow-hidden border-border bg-background p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-[20px] font-bold text-foreground">
            <Beaker className="size-5 text-brand-primary" />
            {t('livemap.demo.title')}
          </DialogTitle>
          <DialogDescription>{t('livemap.demo.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid items-stretch gap-4 p-6 xl:grid-cols-[minmax(0,1.2fr)_88px_minmax(0,1.45fr)]">
            <section className="flex h-full min-h-100 max-h-107.5 flex-col rounded-[22px] border border-border bg-card p-5 shadow-soft-md">
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

            <div className="flex h-full min-h-100 max-h-107.5 items-center justify-center">
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

            <section className="flex h-full min-h-100 max-h-107.5 flex-col rounded-[22px] border border-border bg-card p-5 shadow-soft-md">
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

              <SelectableTable<LiveMapDemoTargetEquipment>
                columns={targetEquipmentColumns}
                rows={targetEquipments}
                rowKey={(targetEquipment) => targetEquipment.eqpId}
                actionColumn={{
                  header: t('livemap.demo.colDelete'),
                  width: '4.375rem',
                  render: (targetEquipment) => (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveTargetEquipment(targetEquipment.eqpId)}
                        className="inline-flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-danger hover:bg-danger/10 hover:text-danger"
                        aria-label={`${targetEquipment.eqpId} ${t('livemap.demo.colDelete')}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ),
                }}
                emptyState={t('livemap.demo.targetEmpty')}
                containerClassName="mt-4 min-h-0 flex-1 rounded-[18px] border border-border"
                tableClassName="min-w-130"
              />
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

                <div className="flex flex-col gap-2 sm:min-w-105">
                  <div className="flex flex-wrap items-center gap-2">
                    {DEMO_TEST_TYPES.map((testType) => (
                      <button
                        key={testType}
                        type="button"
                        onClick={() => setSelectedTestType(testType)}
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
                      className="h-10 min-w-65 rounded-[14px] border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-brand-primary"
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
                        // 새로고침 시작 시 이전 메시지를 정리하고, 완료 시 실패 메시지를 반영한다.
                        setStartMessage(null)
                        void refreshDemoData().then(setStartMessage)
                      }}
                      disabled={isRefreshing}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-card text-muted-foreground transition hover:border-brand-primary/40 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={t('livemap.demo.refreshAria')}
                      title={t('livemap.demo.refreshTitle')}
                    >
                      <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>

                    {/* 시나리오 업로드(R-8) — hidden file input 을 업로드 버튼이 트리거. 권한 무관(업로드는 기존 WRITE). */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.scenario.md,text/markdown,text/plain"
                      className="hidden"
                      data-testid="scenario-upload-input"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null
                        void handleUploadScenarioFile(file)
                        event.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isScenarioMutating}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-card text-muted-foreground transition hover:border-brand-primary/40 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={t('livemap.demo.uploadAria')}
                      title={isScenarioMutating ? t('livemap.demo.uploadPending') : t('livemap.demo.uploadScenario')}
                      data-testid="scenario-upload-button"
                    >
                      <Upload className="size-4" />
                    </button>

                    {/* 시나리오 삭제(R-8) — 삭제 권한 미보유 시 비표시, 시드 시나리오는 비활성(SEED_PROTECTED). */}
                    {canDeleteScenario ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteSelectedScenario()
                        }}
                        disabled={isScenarioMutating || !selectedScenario || selectedScenario.isSeed}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-card text-muted-foreground transition hover:border-destructive/40 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={t('livemap.demo.deleteScenarioAria')}
                        title={
                          selectedScenario?.isSeed
                            ? t('livemap.demo.seedProtected')
                            : t('livemap.demo.deleteScenario')
                        }
                        data-testid="scenario-delete-button"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}

                    <Button
                      type="button"
                      onClick={() => {
                        void handleStartRun()
                      }}
                      disabled={targetEquipments.length === 0 || !selectedScenario || createRunMutation.isPending}
                      className="h-10 rounded-[14px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Play className="size-4" />
                      {createRunMutation.isPending
                        ? t('livemap.demo.startPending')
                        : t('livemap.demo.start')}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="info">{selectedScenario?.name ?? t('livemap.demo.scenarioUnselected')}</Badge>
                {selectedScenario ? (
                  <Badge variant="secondary">{selectedScenario.commInterface}</Badge>
                ) : null}
                {run ? (
                  <Badge className={resolveRunStateChipClass(run.state)}>{run.state}</Badge>
                ) : null}
                <Badge variant="outline">{completedCount}/{runTargets.length}</Badge>
                {startMessage ? <Badge variant="secondary">{startMessage}</Badge> : null}
              </div>

              {isRunLoading && runTargets.length === 0 ? (
                <div className="mt-4 space-y-2 rounded-[18px] border border-border p-3">
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <Skeleton
                      key={`live-map-demo-run-skeleton-${rowIndex}`}
                      data-testid="live-map-demo-run-skeleton"
                      className="h-9 w-full"
                    />
                  ))}
                </div>
              ) : (
                <SelectableTable<SimulatorRunTarget>
                  columns={runTargetColumns}
                  rows={runTargets}
                  rowKey={(target) => target.eqpId}
                  actionColumn={{
                    header: t('livemap.demo.colEnd'),
                    width: '4.375rem',
                    render: (target) => (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            void handleStopTarget(target.eqpId)
                          }}
                          disabled={
                            !activeRunId ||
                            isTerminalRunState(run?.state) ||
                            isTerminalTargetState(target.state) ||
                            stoppingEqpIds.has(target.eqpId)
                          }
                          className="inline-flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-danger hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`${target.eqpId} ${t('livemap.demo.colEnd')}`}
                        >
                          <Square className="size-4" />
                        </button>
                      </div>
                    ),
                  }}
                  emptyState={t('livemap.demo.jobsEmpty')}
                  containerClassName="mt-4 max-h-90 rounded-[18px] border border-border"
                  tableClassName="min-w-130"
                />
              )}
            </div>
          </section>
        </div>
      </DialogContent>

      <Dialog open={startError !== null} onOpenChange={(nextOpen) => !nextOpen && setStartError(null)}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="size-5" aria-hidden="true" />
              {t('livemap.demo.startErrorTitle')}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-wrap break-words text-sm text-foreground">
              {startError}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setStartError(null)}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
