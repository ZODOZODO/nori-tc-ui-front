import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  extractUnassignedDcopItems,
  groupFlowsByWorkflowName,
} from '../lib/model-flow-grouping.ts'
import type { ModelDcopItem, ModelFlowSummary } from '../types/model.types.ts'

interface ModelFlowSidebarProps {
  summaries: readonly ModelFlowSummary[]
  unassignedDcopItems: readonly ModelDcopItem[]
  selectedFlowId: number | null
  onSelectFlow: (flowId: number) => void
  onAddFlow: () => void
}

interface WorkflowGroupSectionProps {
  workflowName: string
  flows: ModelFlowSummary[]
  selectedFlowId: number | null
  onSelectFlow: (flowId: number) => void
}

/**
 * workflowName 한 그룹과 그 하위 messageName 행을 렌더링합니다.
 * 펼침 상태는 컴포넌트 로컬 useState — 1차 릴리즈에선 사용자 토글 가능하지만
 * 저장하지 않음 (페이지 재진입 시 기본 펼침).
 */
function WorkflowGroupSection({
  workflowName,
  flows,
  selectedFlowId,
  onSelectFlow,
}: WorkflowGroupSectionProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-1 rounded-sm px-1 py-1 text-left text-xs font-semibold text-[#315343] hover:bg-[#F1F6F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-[#6D7972]" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-[#6D7972]" aria-hidden="true" />
        )}
        <span className="truncate">{workflowName}</span>
      </button>
      {expanded ? (
        <div className="ml-3 space-y-0.5 border-l border-[#E1E9E4] pl-2">
          {flows.map((flow) => {
            const isSelected = selectedFlowId === flow.flowId
            return (
              <button
                key={flow.flowId}
                type="button"
                onClick={() => onSelectFlow(flow.flowId)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
                  isSelected
                    ? 'bg-[#EAF5EE] text-[#1F2D26]'
                    : 'text-[#51605A] hover:bg-[#F1F6F3]',
                )}
              >
                <span
                  className={cn(
                    'inline-block size-1.5 shrink-0 rounded-full',
                    isSelected ? 'bg-[#2AAE67]' : 'bg-[#9AACA2]',
                  )}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{flow.messageName}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Model 페이지 좌측 사이드바의 "Message Flows" 영역입니다.
 *
 * workflowName 1 단계 트리 + messageName 2 단계 행으로 Flow 목록을 렌더링하고,
 * 하단에 workflow_name=NULL 인 DCOP item 들을 read-only 로 표시합니다.
 *
 * 트리 그룹화 / Unassigned 필터링은 {@link groupFlowsByWorkflowName} /
 * {@link extractUnassignedDcopItems} pure helper 에 위임 — sidebar 자체는
 * 렌더 + 사용자 상호작용 (펼침 / 선택 / Add Flow) 만 담당합니다.
 *
 * Reference 영역 (Variable / Report / Event / MDF / SocketMessage / MesMessage /
 * Parameter) 은 F4 (ModelDetailPanel 재구성) 단계에서 같은 사이드바 컨테이너에
 * 통합됩니다 — F3 본 컴포넌트는 Message Flows + Unassigned DCOPs 영역만 책임.
 */
export const ModelFlowSidebar = memo(function ModelFlowSidebar({
  summaries,
  unassignedDcopItems,
  selectedFlowId,
  onSelectFlow,
  onAddFlow,
}: ModelFlowSidebarProps) {
  const groups = useMemo(() => groupFlowsByWorkflowName(summaries), [summaries])
  const unassigned = useMemo(
    () => extractUnassignedDcopItems(unassignedDcopItems),
    [unassignedDcopItems],
  )

  return (
    <section className="rounded-lg border border-[#DDE8E1] bg-[#FAFCFB] p-2">
      <header className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-[#243129]">Message Flows</span>
        <Button type="button" variant="outline" size="sm" onClick={onAddFlow}>
          <Plus className="size-3.5" aria-hidden="true" />
          Add Flow
        </Button>
      </header>

      <div className="space-y-1.5">
        {groups.length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-[#97A39C]">표시할 Flow 가 없습니다.</p>
        ) : (
          groups.map((group) => (
            <WorkflowGroupSection
              key={group.workflowName}
              workflowName={group.workflowName}
              flows={group.flows}
              selectedFlowId={selectedFlowId}
              onSelectFlow={onSelectFlow}
            />
          ))
        )}
      </div>

      {unassigned.length > 0 ? (
        <div className="mt-3 border-t border-[#E4EAE6] pt-2">
          <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#738078]">
            Unassigned DCOPs
          </p>
          <ul className="space-y-0.5 pl-1">
            {unassigned.map((item) => (
              <li
                key={`${item.dcopItemKey ?? item.dcopItemName}`}
                className="truncate px-2 py-1 text-xs text-[#51605A]"
              >
                {item.dcopItemName}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
})
