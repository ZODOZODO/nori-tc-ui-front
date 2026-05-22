import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { groupFlowsByFlowName } from '../lib/model-flow-grouping.ts'
import type { ModelFlowSummary } from '../types/model.types.ts'

interface ModelFlowSidebarProps {
  summaries: readonly ModelFlowSummary[]
  selectedFlowId: number | null
  onSelectFlow: (flowId: number) => void
  onAddFlow: () => void
  /**
   * 모델 편집 가능 여부 (= checkout 상태). false 면 `Add Flow` 버튼 미렌더.
   * 형제 패턴: `ModelDetailPanel` 의 `canEditTableRows` 가드 (line 929).
   */
  isEditable: boolean
}

interface FlowGroupSectionProps {
  workflowName: string
  flows: ModelFlowSummary[]
  selectedFlowId: number | null
  onSelectFlow: (flowId: number) => void
}

/**
 * workflowName 한 그룹과 그 하위 messageName 행을 렌더링합니다.
 * 펼침 상태는 컴포넌트 로컬 useState — 사용자 토글 가능하지만 저장하지 않음
 * (페이지 재진입 시 기본 닫힘). 사용자가 명시적으로 클릭해서 펼침 시점에만 하위
 * messageName 행이 노출됩니다.
 */
function FlowGroupSection({
  workflowName,
  flows,
  selectedFlowId,
  onSelectFlow,
}: FlowGroupSectionProps) {
  const [expanded, setExpanded] = useState(false)

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
 * workflowName 1 단계 트리 + messageName 2 단계 행으로 Flow 목록을 렌더링합니다.
 *
 * dcop-flow-binding v4 에서 미매핑 dcop 전용 영역은 폐기됨 — N:M 모델에서 Flow 0 개
 * 매핑은 자연 상태이며, picker 모달이 좌측 disabled 배지로 binding 상태를 직접 시각화함.
 *
 * 트리 그룹화는 {@link groupFlowsByFlowName} pure helper 에 위임 — sidebar 자체는
 * 렌더 + 사용자 상호작용 (펼침 / 선택 / Add Flow) 만 담당합니다.
 */
export const ModelFlowSidebar = memo(function ModelFlowSidebar({
  summaries,
  selectedFlowId,
  onSelectFlow,
  onAddFlow,
  isEditable,
}: ModelFlowSidebarProps) {
  const groups = useMemo(() => groupFlowsByFlowName(summaries), [summaries])

  return (
    <section className="rounded-lg border border-[#DDE8E1] bg-[#FAFCFB] p-2">
      <header className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-[#243129]">Message Flows</span>
        {isEditable ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="px-1 text-[10px]"
            data-testid="add-flow-button"
            onClick={onAddFlow}
          >
            <Plus className="size-3" aria-hidden="true" />
            Add Flow
          </Button>
        ) : null}
      </header>

      <div className="space-y-1.5">
        {groups.length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-[#97A39C]">표시할 Flow 가 없습니다.</p>
        ) : (
          groups.map((group) => (
            <FlowGroupSection
              key={group.workflowName}
              workflowName={group.workflowName}
              flows={group.flows}
              selectedFlowId={selectedFlowId}
              onSelectFlow={onSelectFlow}
            />
          ))
        )}
      </div>

    </section>
  )
})
