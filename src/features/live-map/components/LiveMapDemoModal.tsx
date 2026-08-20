import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Beaker, ChevronRight, CircleStop, Cpu, Play, RefreshCw, Search, Trash2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SELECT_EMPTY_VALUE,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import type { SimulatorRunTarget } from '../api/live-map-demo-run.api'
import { useI18n } from '@/i18n/i18n-context'
import { useCreateSimulatorRun } from '../hooks/useCreateSimulatorRun'
import { isTerminalRunState } from '../hooks/useSimulatorRun'
import { useSimulatorRunList } from '../hooks/useSimulatorRunList'
import { useSimulatorRunScenarios } from '../hooks/useSimulatorRunScenarios'
import { useStopSimulatorRun } from '../hooks/useStopSimulatorRun'
import { useStopSimulatorTarget } from '../hooks/useStopSimulatorTarget'
import { buildRunHistoryGroups } from '../lib/live-map-demo-run-history'
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
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message'
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
  return (
    <Checkbox
      checked={state === 'indeterminate' ? 'indeterminate' : state === 'checked'}
      onCheckedChange={() => onChange()}
      onClick={(event) => event.stopPropagation()}
      aria-label={ariaLabel}
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
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([...DEFAULT_EXPANDED_NODE_IDS])
  // 종료 진행 중인 설비 — 전역 mutation pending 대신 per-eqpId 추적으로 해당 행만 비활성한다(H3).
  const [stoppingEqpIds, setStoppingEqpIds] = useState<Set<string>>(new Set())
  // run 전체 종료 진행 중 — 카드별 버튼을 pending 동안 비활성한다(설비별 stoppingEqpIds 와 동일 패턴).
  const [stoppingRunIds, setStoppingRunIds] = useState<Set<string>>(new Set())
  // '시뮬레이션 진행 현황' run 그룹 접기/펴기 — 기본 접힘(헤더만). 정보량이 많아 헤더 클릭 시에만 설비 상세를 편다.
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set())
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
    data: runList = [],
    isLoading: isRunLoading,
    isFetching: isRunFetching,
    refetch: refetchRunList,
  } = useSimulatorRunList(open)
  // 수동 플래그 대신 쿼리 fetching 상태에서 파생 — effect 안 sync setState 를 없앤다.
  const isRefreshing = isScenarioFetching || isRunFetching
  const createRunMutation = useCreateSimulatorRun()
  const stopTargetMutation = useStopSimulatorTarget()
  const stopRunMutation = useStopSimulatorRun()
  // 목록 → 최신순 run 그룹(과거·실행중 모두, 재부착 포함). 데이터 출처는 서버 목록이라 로컬 activeRunId 불요.
  const runGroups = useMemo(() => buildRunHistoryGroups(runList), [runList])

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
      refetchRunList(),
    ])

    const failure =
      (scenarioResult.status === 'rejected' && scenarioResult.reason) ||
      (runResult.status === 'rejected' && runResult.reason)

    return failure ? resolveErrorMessage(failure, t('livemap.demo.refreshFailed')) : null
  }, [refetchRunList, refetchScenarios, t])

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
    // 모달 닫기는 시뮬레이션에 영향을 주지 않는다 — run 은 백그라운드에서 계속 실행되고,
    // 종료는 '시뮬레이션 진행 현황' 테이블의 per-target 종료 버튼으로만 수행한다.
    setSelectedEqpIds([])
    setSearchKeyword('')
    setTargetEquipments([])
    setSelectedTestType('E2E')
    setSelectedScenarioId('')
    setStartMessage(null)
    setStartError(null)
    setExpandedNodeIds([...DEFAULT_EXPANDED_NODE_IDS])
    setStoppingEqpIds(new Set())
    setStoppingRunIds(new Set())
    setExpandedRunIds(new Set())
    createRunMutation.reset()
    stopTargetMutation.reset()
    stopRunMutation.reset()
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

  const handleToggleRunGroup = (runId: string) => {
    setExpandedRunIds((currentRunIds) => {
      const nextRunIds = new Set(currentRunIds)
      if (nextRunIds.has(runId)) {
        nextRunIds.delete(runId)
      } else {
        nextRunIds.add(runId)
      }
      return nextRunIds
    })
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
      // 진행 현황은 서버 목록 폴링에서 이 run 을 픽업한다(로컬 activeRunId 바인딩 없음 — 재부착 원천 해소).
      void refetchRunList()
      setStartMessage(
        t('livemap.demo.runStarted', {
          runId: response.runId,
          count: response.targets.length,
        }),
      )
    } catch (error) {
      // 시작 실패는 배지가 아니라 팝업으로 강조(409=이미 점유 등 사용자가 놓치면 안 되는 메시지).
      setStartError(resolveErrorMessage(error, t('error.livemap.demoStart')))
    }
  }

  const handleStopTarget = async (runId: string, eqpId: string) => {
    setStartMessage(null)
    setStoppingEqpIds((prev) => new Set(prev).add(eqpId))
    try {
      await stopTargetMutation.mutateAsync({ runId, eqpId })
      // M8: 어느 설비를 종료했는지 메시지에 eqpId 포함(다중 설비 run 식별).
      setStartMessage(`${eqpId} — ${t('livemap.demo.stopRequested')}`)
    } catch (error) {
      setStartMessage(resolveErrorMessage(error, `${eqpId} — ${t('livemap.demo.stopFailed')}`))
    } finally {
      setStoppingEqpIds((prev) => {
        const next = new Set(prev)
        next.delete(eqpId)
        return next
      })
    }
  }

  // run 카드의 '전체 종료' — 해당 run 의 모든 설비를 한 번에 stop(orchestrator stopRun). 설비별 종료(handleStopTarget)의 run 단위 대응.
  const handleStopRun = async (runId: string) => {
    setStartMessage(null)
    setStoppingRunIds((prev) => new Set(prev).add(runId))
    try {
      await stopRunMutation.mutateAsync(runId)
      setStartMessage(t('livemap.demo.stopRunAllRequested', { runId }))
    } catch (error) {
      setStartMessage(resolveErrorMessage(error, t('livemap.demo.stopFailed')))
    } finally {
      setStoppingRunIds((prev) => {
        const next = new Set(prev)
        next.delete(runId)
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
      setStartError(resolveErrorMessage(error, t('error.livemap.scenarioUpload')))
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
      setStartError(resolveErrorMessage(error, t('error.livemap.scenarioDelete')))
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
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => node.eqpId && handleToggleEquipment(node.eqpId)}
                  aria-label={`${node.label} ${t('livemap.node.selectSuffix')}`}
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
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
              </Button>
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

  // scenarioId → 시나리오 명(카탈로그 조회). 과거/재시작 run 은 create-side selectedScenario 로 복원 불가라
  // 서버 run.scenarioId 가 유일 출처 — 카탈로그에 없으면(삭제됨 등) scenarioId 를 그대로 노출한다.
  const scenarioNameById = useMemo(
    () => new Map(scenarioOptions.map((scenarioOption) => [scenarioOption.scenarioId, scenarioOption.name])),
    [scenarioOptions],
  )
  const resolveScenarioName = (scenarioId: string) => scenarioNameById.get(scenarioId) ?? scenarioId

  // 연결 유형(모두/설비만/MES만)은 run 단위 값 — run.mode 를 라벨로 매핑(미지정 모드는 원문 노출).
  const resolveConnectionTypeLabel = (mode: string) => {
    const connectionTypeKey = RUN_MODE_TEST_TYPE_I18N_KEY[mode]
    return connectionTypeKey ? t(connectionTypeKey) : mode
  }

  // ISO-8601(UTC) 시작시각을 로컬 표기로. 파싱 불가(빈/기형)면 원문 그대로 노출(방어).
  const formatStartedAt = (iso: string) => {
    const parsed = new Date(iso)
    return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString()
  }

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

  // 연결 유형은 run 그룹 단위라 컬럼 accessor 가 그룹 라벨을 클로저로 받는다(기존 컬럼 구성 재사용, 그룹별 생성).
  const buildRunTargetColumns = (connectionTypeLabel: string): ColumnDef<SimulatorRunTarget>[] => [
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveTargetEquipment(targetEquipment.eqpId)}
                        className="inline-flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-danger hover:bg-danger/10 hover:text-danger"
                        aria-label={`${targetEquipment.eqpId} ${t('livemap.demo.colDelete')}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
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
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {DEMO_TEST_TYPES.map((testType) => (
                        <Button
                          key={testType}
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => setSelectedTestType(testType)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            selectedTestType === testType
                              ? 'border-brand-primary bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/10'
                              : 'border-border bg-card text-muted-foreground hover:border-brand-primary/40 hover:bg-card'
                          }`}
                        >
                          {t(TEST_TYPE_I18N_KEY[testType])}
                        </Button>
                      ))}
                    </div>

                    {/* 선택된 시나리오 표기(이름+통신유형) — 테스트 타입 버튼 오른쪽 고정폭. 이름이 길어도(모드버스 등)
                        레이아웃이 흔들리지 않게 폭을 고정하고 넘치면 말줄임한다. */}
                    <div className="ml-auto flex w-52 shrink-0 items-center gap-1.5">
                      <Badge variant="info" className="min-w-0 flex-1 overflow-hidden">
                        <span className="min-w-0 flex-1 truncate">
                          {selectedScenario?.name ?? t('livemap.demo.scenarioUnselected')}
                        </span>
                      </Badge>
                      {selectedScenario ? (
                        <Badge variant="secondary" className="shrink-0">
                          {selectedScenario.commInterface}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={effectiveSelectedScenarioId === '' ? SELECT_EMPTY_VALUE : effectiveSelectedScenarioId}
                      onValueChange={(next) => setSelectedScenarioId(next === SELECT_EMPTY_VALUE ? '' : next)}
                      disabled={isScenarioLoading || scenarioOptions.length === 0}
                    >
                      <SelectTrigger className="h-10 w-auto min-w-65 rounded-[14px] border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-brand-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {scenarioOptions.length === 0 ? (
                          <SelectItem value={SELECT_EMPTY_VALUE}>{t('livemap.demo.scenarioEmpty')}</SelectItem>
                        ) : null}
                        {scenarioOptions.map((scenarioOption) => (
                          <SelectItem
                            key={`${scenarioOption.scenarioId}:${scenarioOption.version}`}
                            value={scenarioOption.scenarioId}
                          >
                            {scenarioOption.name} (v{scenarioOption.version})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="default"
                      size="sm"
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
                    </Button>

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
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isScenarioMutating}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-card text-muted-foreground transition hover:border-brand-primary/40 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={t('livemap.demo.uploadAria')}
                      title={isScenarioMutating ? t('livemap.demo.uploadPending') : t('livemap.demo.uploadScenario')}
                      data-testid="scenario-upload-button"
                    >
                      <Upload className="size-4" />
                    </Button>

                    {/* 시나리오 삭제(R-8) — 삭제 권한 미보유 시 비표시, 시드 시나리오는 비활성(SEED_PROTECTED). */}
                    {canDeleteScenario ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
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
                      </Button>
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

              {startMessage ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{startMessage}</Badge>
                </div>
              ) : null}

              {isRunLoading && runGroups.length === 0 ? (
                <div className="mt-4 space-y-2 rounded-[18px] border border-border p-3">
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <Skeleton
                      key={`live-map-demo-run-skeleton-${rowIndex}`}
                      data-testid="live-map-demo-run-skeleton"
                      className="h-9 w-full"
                    />
                  ))}
                </div>
              ) : runGroups.length === 0 ? (
                <p className="mt-4 rounded-[18px] border border-border p-6 text-center text-sm text-muted-foreground">
                  {t('livemap.demo.jobsEmpty')}
                </p>
              ) : (
                <div className="mt-4 max-h-90 space-y-4 overflow-y-auto">
                  {runGroups.map((group) => {
                    const isRunExpanded = expandedRunIds.has(group.runId)
                    return (
                    <div key={group.runId} className="rounded-[18px] border border-border">
                      <div
                        className={`flex items-center ${isRunExpanded ? 'border-b border-border' : ''}`}
                      >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleRunGroup(group.runId)}
                        aria-expanded={isRunExpanded}
                        className="flex h-auto flex-1 flex-wrap items-center justify-start gap-2 whitespace-normal rounded-none px-4 py-3 text-left transition hover:bg-muted/40"
                      >
                        <ChevronRight
                          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                            isRunExpanded ? 'rotate-90' : 'rotate-0'
                          }`}
                        />
                        <span className="font-mono text-sm font-semibold text-foreground">{group.runId}</span>
                        <Badge variant="secondary">{resolveConnectionTypeLabel(group.mode)}</Badge>
                        <Badge variant="info">{resolveScenarioName(group.scenarioId)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {t('livemap.demo.runStartedAt')}: {formatStartedAt(group.createdAt)}
                        </span>
                        <Badge className={resolveRunStateChipClass(group.state)}>{group.state}</Badge>
                        <Badge variant="outline">
                          {group.completedCount}/{group.totalCount}
                        </Badge>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void handleStopRun(group.runId)
                        }}
                        disabled={isTerminalRunState(group.state) || stoppingRunIds.has(group.runId)}
                        className="mr-3 inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={t('livemap.demo.stopRunAll', { runId: group.runId })}
                      >
                        <CircleStop className="size-4" />
                        {t('livemap.demo.stopRunAllLabel')}
                      </Button>
                      </div>
                      {isRunExpanded ? (
                      <SelectableTable<SimulatorRunTarget>
                        columns={buildRunTargetColumns(resolveConnectionTypeLabel(group.mode))}
                        rows={group.targets}
                        rowKey={(target) => target.eqpId}
                        actionColumn={{
                          header: t('livemap.demo.colEnd'),
                          width: '4.375rem',
                          render: (target) => (
                            <div className="flex justify-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  void handleStopTarget(group.runId, target.eqpId)
                                }}
                                disabled={
                                  isTerminalRunState(group.state) ||
                                  isTerminalTargetState(target.state) ||
                                  stoppingEqpIds.has(target.eqpId)
                                }
                                className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`${target.eqpId} ${t('livemap.demo.colEnd')}`}
                              >
                                <CircleStop className="size-5" />
                              </Button>
                            </div>
                          ),
                        }}
                        emptyState={t('livemap.demo.jobsEmpty')}
                        containerClassName="rounded-b-[18px]"
                        tableClassName="min-w-130"
                      />
                      ) : null}
                    </div>
                    )
                  })}
                </div>
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
