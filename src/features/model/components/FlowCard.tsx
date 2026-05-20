import { useMemo, useState } from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  DRAFT_FLOW_ID_SENTINEL,
  type FlowDraft,
  buildFlowDraft,
  serializeFlowDraft,
  shouldRenderTriggerSection,
  summarizeFlowActionDataIndex,
  summarizeFlowWorkflowFilter,
} from '../lib/model-flow-editor'
import {
  buildActionDataIndexValue,
  buildWorkflowFilterValue,
  parseActionDataIndexEditor,
  parseWorkflowFilterEditor,
} from '../lib/model-detail-editor'
import type {
  ModelFlow,
  ModelFlowUpdateRequest,
} from '../types/model.types'

const MESSAGE_NAME_PLACEHOLDER = '__empty__'

/**
 * Flow 카드의 Identity 섹션 dropdown 옵션입니다.
 *
 * messageName 은 SECS / Socket / MES 통합 namespace — workflow.message_name 컬럼은
 * 단일 string 이므로 부모(F3/F4) 가 protocol 별 옵션을 합쳐 주입합니다.
 */
export interface FlowCardMessageOption {
  name: string
}

/**
 * Trigger 섹션 EventId dropdown 옵션 (SECS only) 입니다.
 */
export interface FlowCardEventOption {
  id: string
  label: string
}

/**
 * Action 섹션 MDF Template dropdown 옵션입니다.
 *
 * 실제 mdfTemplateName 편집은 [편집...] 모달 (F4 에서 ModelDetailPanel 분리 예정)
 * 에서 이뤄지며, F2 단계에서는 summary 옆 readonly 표시 목적.
 */
export interface FlowCardMdfTemplateOption {
  name: string
}

interface FlowCardProps {
  flow: ModelFlow
  /**
   * 모델 통신 인터페이스 — F1 dev-report 권장에 따라 flow 의 3 필드 null 검사가
   * 아니라 부모가 명시적으로 주입 (Plan 위험표 관련).
   */
  protocol: 'SECS' | 'SOCKET'
  messageOptions: readonly FlowCardMessageOption[]
  eventOptions: readonly FlowCardEventOption[]
  mdfTemplateOptions: readonly FlowCardMdfTemplateOption[]
  onSave: (payload: ModelFlowUpdateRequest) => void
  saveStatus: 'idle' | 'saving' | 'error'
  errorMessage: string | null
  /**
   * Trigger 의 [편집...] 클릭 핸들러. 현재 draft 의 raw JSON string 과 모달 결과를
   * 다시 draft 에 반영할 onChange 콜백을 부모에 전달합니다 — 부모는 추출된 모달의
   * open / value / onSave 만 wiring 하면 됩니다.
   */
  onEditWorkflowFilter: (currentRaw: string, onChange: (nextRaw: string) => void) => void
  /** Action 의 [편집...] 클릭 핸들러. 시그니처는 onEditWorkflowFilter 와 동일. */
  onEditActionDataIndex: (currentRaw: string, onChange: (nextRaw: string) => void) => void
  onAddDcopItem: () => void
}

/**
 * `(workflow_name, message_name)` 1 쌍을 4 섹션 (Identity / Trigger / Action / Collect)
 * 으로 default 펼친 상태로 노출하는 Flow 카드입니다.
 *
 * - Identity 의 workflowName 은 read-only (Plan 위험표 #3 — DCOP cascade 미정).
 * - SOCKET protocol 인 경우 Trigger 섹션 자체 미렌더 (SPEC line 80-83).
 * - workflowFilter / actionDataIndex 인라인 트리 편집 도입 안 함 — 부모가 모달
 *   open 핸들러 (`onEditWorkflowFilter` / `onEditActionDataIndex`) 를 주입.
 * - Collect 의 DCOP 행 추가는 기존 `PUT /details/dcop-itemes` 노드로 위임 (Plan D4),
 *   `onAddDcopItem` 이 그 라우팅을 처리.
 *
 * 부모 계약: 다른 Flow 로 selection 이 바뀌면 `key={flow.flowId}` 로 컴포넌트를
 * 재마운트하여 draft 를 자연스럽게 reset 한다 (useEffect + setState 회피 — F1
 * dev-report 가 지적한 `react-hooks/set-state-in-effect` 룰 준수).
 */
export function FlowCard({
  flow,
  protocol,
  messageOptions,
  eventOptions,
  mdfTemplateOptions,
  onSave,
  saveStatus,
  errorMessage,
  onEditWorkflowFilter,
  onEditActionDataIndex,
  onAddDcopItem,
}: FlowCardProps) {
  const [draft, setDraft] = useState<FlowDraft>(() => buildFlowDraft(flow))

  const isSaving = saveStatus === 'saving'
  const renderTrigger = shouldRenderTriggerSection(protocol)

  const workflowFilterSummary = useMemo(
    () => summarizeFlowWorkflowFilter(draft.workflowFilter),
    [draft.workflowFilter],
  )

  const actionDataIndexSummary = useMemo(
    () => summarizeFlowActionDataIndex(draft.actionDataIndex),
    [draft.actionDataIndex],
  )

  const messageDropdownValue =
    draft.messageName.length > 0 ? draft.messageName : MESSAGE_NAME_PLACEHOLDER

  const handleSelectMessageName = (value: string) => {
    const nextMessageName = value === MESSAGE_NAME_PLACEHOLDER ? '' : value
    setDraft((previousDraft) => ({ ...previousDraft, messageName: nextMessageName }))
  }

  const handleSelectEventId = (value: string) => {
    const nextEventId = value === MESSAGE_NAME_PLACEHOLDER ? null : value
    setDraft((previousDraft) => ({ ...previousDraft, eventId: nextEventId }))
  }

  const handleChangeTransactionId = (rawInput: string) => {
    // 빈 string = wildcard (null) — BusinessWorkflowMatcherImpl.java:193-205 의 의미와 일치.
    const trimmed = rawInput.trim()
    setDraft((previousDraft) => ({
      ...previousDraft,
      transactionId: trimmed.length === 0 ? null : rawInput,
    }))
  }

  const handleChangeActionName = (rawInput: string) => {
    setDraft((previousDraft) => ({ ...previousDraft, actionName: rawInput }))
  }

  const handleSave = () => {
    onSave(serializeFlowDraft(draft))
  }

  // [편집...] 클릭 시 draft 의 structured workflowFilter 를 raw JSON 으로 직렬화해
  // 모달에 넘기고, 모달 onSave 결과를 다시 structured draft 로 역변환합니다.
  // raw 가 빈 문자열이면 null draft 로 — Socket / 빈 SECS Flow 의 의미와 일치.
  const handleClickEditWorkflowFilter = () => {
    const currentRaw =
      draft.workflowFilter === null ? '' : buildWorkflowFilterValue(draft.workflowFilter)
    onEditWorkflowFilter(currentRaw, (nextRaw) => {
      setDraft((previousDraft) => ({
        ...previousDraft,
        workflowFilter: nextRaw.length === 0 ? null : parseWorkflowFilterEditor(nextRaw),
      }))
    })
  }

  const handleClickEditActionDataIndex = () => {
    const currentRaw =
      draft.actionDataIndex === null ? '' : buildActionDataIndexValue(draft.actionDataIndex)
    onEditActionDataIndex(currentRaw, (nextRaw) => {
      setDraft((previousDraft) => ({
        ...previousDraft,
        actionDataIndex: nextRaw.length === 0 ? null : parseActionDataIndexEditor(nextRaw),
      }))
    })
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[#E4EAE6] bg-white p-5 shadow-[0_1px_2px_rgba(20,46,36,0.04)]">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#213028]">
            {draft.workflowName || '(workflow 미지정)'} / {draft.messageName || '(message 미지정)'}
          </h2>
          <p className="text-xs text-[#738078]">
            {flow.flowId === DRAFT_FLOW_ID_SENTINEL ? 'Flow ID #신규' : `Flow ID #${flow.flowId}`}
          </p>
        </div>
        {errorMessage ? (
          <p className="rounded-xl border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-1.5 text-xs text-[#B4483F]">
            {errorMessage}
          </p>
        ) : null}
      </header>

      <FlowCardSection title="Identity" description="Flow 의 고유 식별값입니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3D33]">Workflow Name</label>
            {/* Plan 위험표 #3: 1차 릴리즈 read-only. DCOP cascade 가 필요해지면 별 SPEC. */}
            <Input value={draft.workflowName} readOnly aria-readonly="true" />
            <p className="text-[11px] text-[#97A39C]">
              1차 릴리즈에서는 변경 불가입니다. 변경이 필요하면 새 Flow 를 추가하고 기존 Flow 를 삭제하세요.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3D33]">Message Name</label>
            <Select value={messageDropdownValue} onValueChange={handleSelectMessageName}>
              <SelectTrigger>
                <SelectValue placeholder="메시지를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MESSAGE_NAME_PLACEHOLDER}>(선택 안 함)</SelectItem>
                {messageOptions.map((option) => (
                  <SelectItem key={option.name} value={option.name}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FlowCardSection>

      {renderTrigger ? (
        <FlowCardSection
          title="Trigger"
          description="언제 이 Flow 가 실행되는지 (SECS 전용)."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1E3D33]">Event Id</label>
              <Select
                value={draft.eventId ?? MESSAGE_NAME_PLACEHOLDER}
                onValueChange={handleSelectEventId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="EventId 를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MESSAGE_NAME_PLACEHOLDER}>(선택 안 함)</SelectItem>
                  {eventOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#1E3D33]">Transaction Id</label>
              <Input
                value={draft.transactionId ?? ''}
                onChange={(event) => handleChangeTransactionId(event.target.value)}
                placeholder="(빈 값 = wildcard)"
              />
              <p className="text-[11px] text-[#97A39C]">
                값을 비우면 모든 transactionId 에 매칭됩니다.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-[#E7EEEA] bg-[#FAFCFB] p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#1E3D33]">Workflow Filter</p>
                <p className="text-[11px] text-[#738078]">
                  data / event / context 의 조건 트리를 편집합니다.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClickEditWorkflowFilter}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                편집...
              </Button>
            </div>
            <p
              className="rounded-lg border border-[#DCE5E0] bg-white px-3 py-2 text-xs text-[#22322B]"
              data-testid="flow-card-workflow-filter-summary"
            >
              {workflowFilterSummary}
            </p>
          </div>
        </FlowCardSection>
      ) : null}

      <FlowCardSection title="Action" description="이 Flow 가 실행하는 동작입니다.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3D33]">Action Name</label>
            <Input
              value={draft.actionName}
              onChange={(event) => handleChangeActionName(event.target.value)}
              placeholder="예: TOOL_CONDITION_REPLY"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3D33]">MDF Template</label>
            <Select
              value={draft.actionDataIndex?.mdfTemplateName?.trim() || MESSAGE_NAME_PLACEHOLDER}
              onValueChange={(value) => {
                /*
                 * MDF 변경은 fields 매핑을 함께 다뤄야 하므로 [편집...] 모달에서만 가능.
                 * 본 dropdown 은 현재 값 표시 + 모달 진입 트리거. 직접 선택 시
                 * 빠른 빈 매핑 entry 만 만들고 모달에서 fields 작성.
                 */
                handleClickEditActionDataIndex()
                void value
              }}
            >
              <SelectTrigger aria-label="MDF Template">
                <SelectValue placeholder="MDF Template 을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MESSAGE_NAME_PLACEHOLDER}>(선택 안 함)</SelectItem>
                {mdfTemplateOptions.map((option) => (
                  <SelectItem key={option.name} value={option.name}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-[#E7EEEA] bg-[#FAFCFB] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#1E3D33]">Action Data Index</p>
              <p className="text-[11px] text-[#738078]">
                mdfTemplateName 과 fields 매핑을 편집합니다.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClickEditActionDataIndex}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              편집...
            </Button>
          </div>
          <p
            className="rounded-lg border border-[#DCE5E0] bg-white px-3 py-2 text-xs text-[#22322B]"
            data-testid="flow-card-action-data-index-summary"
          >
            {actionDataIndexSummary}
          </p>
        </div>
      </FlowCardSection>

      <FlowCardSection
        title="Collect"
        description="해당 Flow 가 수집하는 DCOP 항목입니다."
      >
        <div className="rounded-xl border border-[#E4EAE6]">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-[#F6F9F7]">
                <TableHead>DCOP Item Name</TableHead>
                <TableHead>Variable Id</TableHead>
                <TableHead>Collection Rule</TableHead>
                <TableHead>Event Id</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.dcopItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-xs text-[#7A8680]"
                  >
                    수집 항목이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                draft.dcopItems.map((item) => (
                  <TableRow key={item.dcopItemKey ?? `${item.dcopItemName}-${item.variableId}`}>
                    <TableCell>{item.dcopItemName}</TableCell>
                    <TableCell>{item.variableId}</TableCell>
                    <TableCell>{item.collectionRule}</TableCell>
                    <TableCell>{item.eventId ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-2 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onAddDcopItem}>
            <Plus className="size-3.5" aria-hidden="true" />
            DCOP 추가
          </Button>
        </div>
      </FlowCardSection>

      <footer className="flex items-center justify-end gap-2 border-t border-[#EEF3F0] pt-4">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={cn(isSaving ? 'opacity-70' : null)}
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          저장
        </Button>
      </footer>
    </section>
  )
}

interface FlowCardSectionProps {
  title: string
  description: string
  children: React.ReactNode
}

/**
 * Flow 카드 내부 4 섹션의 공통 헤더 + 본문 래퍼입니다.
 *
 * 1차 릴리즈에서는 collapse 토글 없음 — 모두 default 펼친 상태로 노출 (SPEC line 122).
 */
function FlowCardSection({ title, description, children }: FlowCardSectionProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-[#E7EEEA] bg-[#FBFDFC] p-4">
      <header>
        <h3 className="text-sm font-semibold text-[#1E3D33]">{title}</h3>
        <p className="text-[11px] text-[#738078]">{description}</p>
      </header>
      <div>{children}</div>
    </section>
  )
}
