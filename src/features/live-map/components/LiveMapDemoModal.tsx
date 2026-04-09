import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Beaker, ChevronRight, Cpu, Play, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCreateLiveMapDemoJobs } from '../hooks/useCreateLiveMapDemoJobs'
import { useLiveMapDemoJobs } from '../hooks/useLiveMapDemoJobs'
import { useLiveMapDemoScenarios } from '../hooks/useLiveMapDemoScenarios'
import {
  buildLiveMapDemoTree,
  collectLiveMapDemoSelectionEquipments,
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
  'QUEUED,PREPARING,SYNCING_SPEC,CONNECTING,RUNNING,CLEANING_UP,CANCEL_REQUESTED,COMPLETED,FAILED,CANCELED'
const DEMO_TEST_TYPE_OPTIONS: readonly { value: LiveMapDemoTestType; label: string }[] = [
  { value: 'SOCKET_ONLY', label: '설비만 연결' },
  { value: 'MES_ONLY', label: 'MES만 연결' },
  { value: 'E2E', label: '모두 연결' },
] as const

const TREE_NODE_STYLE_BY_DEPTH = {
  0: 'border-[#D4E1DA] bg-[#F5FBF7] text-[#1F3429]',
  1: 'border-[#E1EAE4] bg-white text-[#27362E]',
  2: 'border-transparent bg-transparent text-[#4A5A52]',
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
  return 'outline' as const
}

export function LiveMapDemoModal({
  open,
  equipmentNodes,
  clusterItems,
  onClose,
}: LiveMapDemoModalProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
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

  const demoTree = useMemo(
    () => buildLiveMapDemoTree(equipmentNodes, clusterItems),
    [clusterItems, equipmentNodes],
  )

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

  const effectiveSelectedNodeId = selectedNodeId ?? demoTree[0]?.id ?? null

  const candidateEquipments = useMemo(
    () => collectLiveMapDemoSelectionEquipments(effectiveSelectedNodeId, equipmentNodes),
    [effectiveSelectedNodeId, equipmentNodes],
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
    setSelectedNodeId(null)
    setTargetEquipments([])
    setSelectedTestType('E2E')
    setSelectedScenarioId('')
    setStartMessage(null)
    setExpandedNodeIds([...DEFAULT_EXPANDED_NODE_IDS])
    createDemoJobsMutation.reset()
    onClose()
  }

  const handleToggleExpanded = (nodeId: string) => {
    setExpandedNodeIds((currentNodeIds) =>
      currentNodeIds.includes(nodeId)
        ? currentNodeIds.filter((currentNodeId) => currentNodeId !== nodeId)
        : [...currentNodeIds, nodeId],
    )
  }

  const handleAddTargetEquipments = () => {
    if (candidateEquipments.length === 0) {
      return
    }

    setTargetEquipments((currentRows) =>
      mergeLiveMapDemoTargetEquipments(currentRows, candidateEquipments),
    )
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

  const renderTreeNodes = (nodes: readonly LiveMapDemoTreeNode[], depth = 0) =>
    nodes.map((node) => {
      const isSelected = effectiveSelectedNodeId === node.id
      const isExpanded = expandedNodeIds.includes(node.id)
      const hasChildren = node.children.length > 0
      const nodeStyle =
        TREE_NODE_STYLE_BY_DEPTH[
          depth as keyof typeof TREE_NODE_STYLE_BY_DEPTH
        ] ?? TREE_NODE_STYLE_BY_DEPTH[2]
      const selectionLabel =
        node.type === 'LINE'
          ? `${node.label} 라인 선택`
          : node.type === 'PROCESS'
            ? `${node.label} 공정 선택`
            : `${node.label} 설비 선택`

      return (
        <div key={node.id} className="space-y-2">
          <div className="flex items-center gap-2" style={{ marginLeft: `${depth * 16}px` }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => handleToggleExpanded(node.id)}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[#66766E] transition hover:bg-[#E8F2EC]"
                aria-label={`${node.label} ${isExpanded ? '접기' : '펼치기'}`}
              >
                <ChevronRight
                  className={`size-4 transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                />
              </button>
            ) : (
              <span className="size-5 shrink-0" aria-hidden="true" />
            )}

            <button
              type="button"
              onClick={() => setSelectedNodeId(node.id)}
              aria-label={selectionLabel}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                isSelected
                  ? 'border-[#2A7A55] bg-[#EAF6EE] text-[#15492F] shadow-[0_8px_18px_rgba(34,104,70,0.12)]'
                  : nodeStyle
              }`}
            >
              {node.type === 'EQUIPMENT' ? (
                <Cpu className="size-4 shrink-0 text-[#6B7B73]" aria-hidden="true" />
              ) : null}
              <span className="flex-1 truncate text-sm font-medium">{node.label}</span>
              {node.type === 'PROCESS' ? (
                <span className="shrink-0 text-xs text-[#73817A]">{node.children.length}대</span>
              ) : null}
            </button>
          </div>
          {hasChildren && isExpanded ? renderTreeNodes(node.children, depth + 1) : null}
        </div>
      )
    })

  const completedCount = demoJobs.filter((job) => job.state === 'COMPLETED').length

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-[1360px] flex-col gap-0 overflow-hidden border-[#DCE7E0] bg-[#F7FAF8] p-0">
        <DialogHeader className="border-b border-[#E1EAE4] px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-[20px] font-bold">
            <Beaker className="size-5 text-[#1C7F59]" />
            Demo
          </DialogTitle>
          <DialogDescription>
            설비 선택, 시나리오 실행, 진행 상황을 한 화면에서 확인할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid items-stretch gap-4 p-6 xl:grid-cols-[minmax(0,1.2fr)_88px_minmax(0,1.45fr)]">
            <section className="flex h-full min-h-[400px] max-h-[430px] flex-col rounded-[22px] border border-[#DCE7E0] bg-white p-5 shadow-[0_12px_28px_rgba(29,56,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#22332A]">라인 트리</h3>
                  <p className="mt-1 text-xs text-[#6D7A73]">
                    Line &gt; 공정 &gt; 설비 순서로 선택할 수 있습니다.
                  </p>
                </div>
                <Badge variant="outline">선택 후보 {candidateEquipments.length}대</Badge>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto rounded-[18px] bg-[#F8FBF9] p-3">
                <div className="space-y-2">{renderTreeNodes(demoTree)}</div>
              </div>
            </section>

            <div className="flex h-full min-h-[400px] max-h-[430px] items-center justify-center">
              <Button
                type="button"
                onClick={handleAddTargetEquipments}
                disabled={candidateEquipments.length === 0}
                className="h-12 w-12 rounded-full bg-[#1A7A55] text-white hover:bg-[#176748]"
                aria-label="선택 설비 추가"
              >
                <ArrowRight className="size-5" />
              </Button>
            </div>

            <section className="flex h-full min-h-[400px] max-h-[430px] flex-col rounded-[22px] border border-[#DCE7E0] bg-white p-5 shadow-[0_12px_28px_rgba(29,56,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#22332A]">대상 설비</h3>
                  <p className="mt-1 text-xs text-[#6D7A73]">
                    중복 없이 설비가 누적되며, 공정 선택 시 해당 공정 설비 전체가 추가됩니다.
                  </p>
                </div>
                <Badge>{targetEquipments.length}대 선택됨</Badge>
              </div>

              <div className="mt-4 flex-1 overflow-hidden rounded-[18px] border border-[#E5ECE7]">
                <div className="h-full overflow-auto">
                  <Table className="min-w-[520px]">
                    <TableHeader>
                      <TableRow className="bg-[#F6F9F7] hover:bg-[#F6F9F7]">
                        <TableHead>Eqp ID</TableHead>
                        <TableHead>공정</TableHead>
                        <TableHead>웨이퍼 모드</TableHead>
                        <TableHead>현재 상태</TableHead>
                        <TableHead className="w-[70px] text-center">삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {targetEquipments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-sm text-[#708078]">
                            좌측 트리에서 Line, 공정 또는 설비를 선택한 뒤 화살표 버튼으로 추가해 주세요.
                          </TableCell>
                        </TableRow>
                      ) : (
                        targetEquipments.map((targetEquipment) => (
                          <TableRow key={targetEquipment.eqpId}>
                            <TableCell className="font-semibold text-[#21332A]">
                              {targetEquipment.eqpId}
                            </TableCell>
                            <TableCell>{targetEquipment.clusterName}</TableCell>
                            <TableCell>{targetEquipment.processingTypeLabel}</TableCell>
                            <TableCell>{targetEquipment.statusLabel}</TableCell>
                            <TableCell className="text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTargetEquipment(targetEquipment.eqpId)}
                                className="inline-flex size-8 items-center justify-center rounded-full border border-[#E0E8E3] text-[#6E7B74] transition hover:border-[#D65454] hover:bg-[#FFF4F4] hover:text-[#C64040]"
                                aria-label={`${targetEquipment.eqpId} 삭제`}
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
            <div className="rounded-[22px] border border-[#DCE7E0] bg-white p-5 shadow-[0_12px_28px_rgba(29,56,42,0.06)]">
              <div className="flex flex-col gap-3 border-b border-[#E8EFEB] pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#22332A]">시뮬레이션 진행 현황</h3>
                  <p className="mt-1 text-xs text-[#6D7A73]">
                    선택한 설비를 시나리오로 실행하면 진행률과 현재 단계를 실시간으로 확인할 수 있습니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:min-w-[420px]">
                  <div className="flex flex-wrap items-center gap-2">
                    {DEMO_TEST_TYPE_OPTIONS.map((testTypeOption) => (
                      <button
                        key={testTypeOption.value}
                        type="button"
                        onClick={() => {
                          setSelectedTestType(testTypeOption.value)
                          setSelectedScenarioId('')
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          selectedTestType === testTypeOption.value
                            ? 'border-[#1A7A55] bg-[#EAF6EE] text-[#19553B]'
                            : 'border-[#D7E2DC] bg-white text-[#5F6D66] hover:border-[#A9C9B7]'
                        }`}
                      >
                        {testTypeOption.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={effectiveSelectedScenarioId}
                      onChange={(event) => setSelectedScenarioId(event.target.value)}
                      className="h-10 min-w-[260px] rounded-[14px] border border-[#D7E2DC] bg-white px-3 text-sm text-[#22332A] outline-none focus:border-[#1A7A55]"
                      disabled={isScenarioLoading || scenarioOptions.length === 0}
                    >
                      {scenarioOptions.length === 0 ? (
                        <option value="">시나리오 없음</option>
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
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#D7E2DC] bg-white text-[#4D5A53] transition hover:border-[#A9C9B7] hover:bg-[#F4FAF6] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="시나리오 및 진행 현황 새로고침"
                      title="새로고침"
                    >
                      <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>

                    <Button
                      type="button"
                      onClick={() => {
                        void handleStartRun()
                      }}
                      disabled={targetEquipments.length === 0 || !selectedScenario || createDemoJobsMutation.isPending}
                      className="h-10 rounded-[14px] bg-[#16211C] px-4 text-sm font-semibold text-white hover:bg-[#223127]"
                    >
                      <Play className="size-4" />
                      {createDemoJobsMutation.isPending ? '시작 요청 중...' : '테스트 시작'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="info">{selectedScenario?.name ?? '시나리오 미선택'}</Badge>
                {selectedScenario ? (
                  <Badge variant="secondary">{selectedScenario.description}</Badge>
                ) : null}
                <Badge variant="outline">완료 {completedCount}/{demoJobs.length}</Badge>
                {startMessage ? <Badge variant="secondary">{startMessage}</Badge> : null}
              </div>

              <div className="mt-4 overflow-hidden rounded-[18px] border border-[#E5ECE7]">
                <div className="max-h-[360px] overflow-auto">
                  <Table className="min-w-[1100px]">
                    <TableHeader>
                      <TableRow className="bg-[#F6F9F7] hover:bg-[#F6F9F7]">
                        <TableHead>Eqp ID</TableHead>
                        <TableHead>공정</TableHead>
                        <TableHead>시나리오</TableHead>
                        <TableHead>테스트 타입</TableHead>
                        <TableHead>현재 단계</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead className="min-w-[220px]">진행률</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demoJobs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-12 text-center text-sm text-[#708078]">
                            {isJobsLoading
                              ? 'Demo job 목록을 불러오는 중입니다.'
                              : '우상단에서 설비를 선택하고 시나리오를 지정한 뒤 테스트를 시작해 주세요.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        demoJobs.map((job) => (
                          <TableRow key={job.jobId}>
                            <TableCell className="font-semibold text-[#21332A]">{job.eqpId}</TableCell>
                            <TableCell>{job.processType ?? 'ETC'}</TableCell>
                            <TableCell>{job.scenarioName}</TableCell>
                            <TableCell>
                              {DEMO_TEST_TYPE_OPTIONS.find((option) => option.value === job.testType)?.label ??
                                job.testType}
                            </TableCell>
                            <TableCell>{job.currentStageName ?? job.currentStageCode ?? '-'}</TableCell>
                            <TableCell>
                              <Badge variant={resolveJobBadgeVariant(job.state)}>{job.state}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E4ECE7]">
                                  <div
                                    className={`h-full rounded-full transition-[width] duration-500 ${
                                      job.progressPercent >= 100 ? 'bg-[#1C8B5E]' : 'bg-[#5C9BFF]'
                                    }`}
                                    style={{ width: `${job.progressPercent}%` }}
                                  />
                                </div>
                                <span className="min-w-[44px] text-right text-xs font-semibold text-[#516059]">
                                  {job.progressPercent}%
                                </span>
                              </div>
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
