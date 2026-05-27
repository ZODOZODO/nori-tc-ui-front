import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
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
import {
  DRAFT_FLOW_ID_SENTINEL,
  type FlowDraft,
  buildFlowDraft,
  serializeFlowDraft,
  shouldRenderTriggerSection,
  summarizeFlowActionDataIndex,
  summarizeFlowFilter,
} from '../lib/model-flow-editor'
import {
  buildActionDataIndexValue,
  buildFlowFilterValue,
  parseActionDataIndexEditor,
  parseFlowFilterEditor,
} from '../lib/model-detail-editor'
import type {
  ModelDcopItem,
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
 * FlowCard 의 imperative handle.
 *
 * 우상단 통합 Save 버튼이 FlowCard 내부 draft state 에 접근하기 위해 노출하는
 * 진입점입니다 — 부모(ModelDetailPanel) 가 ref 를 통해 `save()` 를 호출하면
 * FlowCard 가 자기 draft 를 직렬화해 onSave prop 으로 전달합니다.
 *
 * draft state 를 lift up 하지 않는 이유는 FlowCard 가 5 섹션 + 모달 콜백 다수를
 * 내부에서 다루기 때문 — controlled component 전환 시 변경 표면적이 큽니다.
 */
export interface FlowCardHandle {
  save: () => void
  /**
   * 외부(DcopItemPickerModal) 가 picker 의 확인 결과를 카드의 draft 에 반영합니다.
   * 호출 후 DB 저장은 일어나지 않으며, 사용자가 우상단 통합 Save 를 눌렀을 때
   * dcopItemKeys 가 PUT body 의 한 필드로 함께 전송됩니다.
   */
  setDcopItems: (items: readonly ModelDcopItem[]) => void
}

interface FlowCardProps {
  flow: ModelFlow
  /**
   * 모델 통신 인터페이스 — F1 dev-report 권장에 따라 flow 의 3 필드 null 검사가
   * 아니라 부모가 명시적으로 주입 (Plan 위험표 관련).
   */
  protocol: 'SECS' | 'SOCKET'
  /**
   * 모델이 읽기 전용인지 (= `!isEditMode || isLockedByOtherUser`). 부모
   * (ModelDetailPanel) 의 `isReadOnly` 와 동일한 의미 — true 면 카드 내부의 모든
   * 편집 컨트롤 (입력 / dropdown / DCOP 추가 / [편집...] 버튼) 을 비활성화합니다.
   * draft 카드는 checkout 상태에서만 생성되므로 항상 false 로 주입됩니다.
   */
  readOnly: boolean
  messageOptions: readonly FlowCardMessageOption[]
  eventOptions: readonly FlowCardEventOption[]
  onSave: (payload: ModelFlowUpdateRequest) => void
  saveStatus: 'idle' | 'saving' | 'error'
  errorMessage: string | null
  /**
   * Filter 의 [편집...] 클릭 핸들러 (F8.1: Trigger 와 분리된 Filter 섹션). 현재
   * draft 의 raw JSON string 과 모달 결과를 다시 draft 에 반영할 onChange 콜백을
   * 부모에 전달합니다 — 부모는 추출된 모달의 open / value / onSave 만 wiring 하면 됩니다.
   */
  onEditFlowFilter: (currentRaw: string, onChange: (nextRaw: string) => void) => void
  /** Action 의 [편집...] 클릭 핸들러. 시그니처는 onEditFlowFilter 와 동일. */
  onEditActionDataIndex: (currentRaw: string, onChange: (nextRaw: string) => void) => void
  onAddDcopItem: () => void
  /**
   * draft 카드 (`flow.flowId === DRAFT_FLOW_ID_SENTINEL`) 의 Cancel 버튼 핸들러.
   * 호출 시 부모는 `useModelUiStore.clearDraftFlow()` 로 store.draftFlow 를 비워
   * FlowCard 가 자연스럽게 unmount 되도록 합니다.
   *
   * 저장된 Flow 의 카드 (sentinel 아님) 에는 Cancel 버튼이 미렌더 — `null` 가능.
   */
  onCancelDraft: (() => void) | null
}

/**
 * `(workflow_name, message_name)` 1 쌍을 5 섹션 (Identity / Trigger / Filter /
 * Action / Collect) 으로 default 펼친 상태로 노출하는 Flow 카드입니다.
 *
 * - Identity 의 workflowName 은 draft 모드에서만 editable (saved 카드는 read-only).
 * - SOCKET protocol 인 경우 Trigger 섹션 (EventId + TransactionId) 자체 미렌더
 *   (SPEC line 80-83). Filter 섹션은 SOCKET 도 표시 — workflow_filter 는 protocol
 *   무관 모든 Flow 에서 편집 가능 (F8.1 root cause fix).
 * - workflowFilter / actionDataIndex 인라인 트리 편집 도입 안 함 — 부모가 모달
 *   open 핸들러 (`onEditFlowFilter` / `onEditActionDataIndex`) 를 주입.
 * - Collect 의 DCOP 행 추가는 기존 `PUT /details/dcop-itemes` 노드로 위임 (Plan D4),
 *   `onAddDcopItem` 이 그 라우팅을 처리.
 *
 * 부모 계약: 다른 Flow 로 selection 이 바뀌면 `key={flow.flowId}` 로 컴포넌트를
 * 재마운트하여 draft 를 자연스럽게 reset 한다 (useEffect + setState 회피 — F1
 * dev-report 가 지적한 `react-hooks/set-state-in-effect` 룰 준수).
 */
export const FlowCard = forwardRef<FlowCardHandle, FlowCardProps>(function FlowCard(
  {
    flow,
    protocol,
    readOnly,
    messageOptions,
    eventOptions,
    onSave,
    saveStatus,
    errorMessage,
    onEditFlowFilter,
    onEditActionDataIndex,
    onAddDcopItem,
    onCancelDraft,
  },
  ref,
) {
  const [draft, setDraft] = useState<FlowDraft>(() => buildFlowDraft(flow))

  const isSaving = saveStatus === 'saving'
  const renderTrigger = shouldRenderTriggerSection(protocol)
  const isDraftCard = flow.flowId === DRAFT_FLOW_ID_SENTINEL

  // 우상단 통합 Save 버튼이 호출하는 진입점 — 현재 draft 를 PUT body 로 직렬화해
  // 부모가 주입한 onSave 콜백으로 전달합니다. draft 가 갱신될 때마다 deps 가 바뀌어
  // 항상 최신 값을 반영합니다.
  useImperativeHandle(
    ref,
    () => ({
      save: () => onSave(serializeFlowDraft(draft)),
      setDcopItems: (items) =>
        setDraft((previousDraft) => ({ ...previousDraft, dcopItems: items })),
    }),
    [draft, onSave],
  )

  const flowFilterSummary = useMemo(
    () => summarizeFlowFilter(draft.workflowFilter),
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

  // [편집...] 클릭 시 draft 의 structured workflowFilter 를 raw JSON 으로 직렬화해
  // 모달에 넘기고, 모달 onSave 결과를 다시 structured draft 로 역변환합니다.
  // raw 가 빈 문자열이면 null draft 로 — Socket / 빈 SECS Flow 의 의미와 일치.
  const handleClickEditFlowFilter = () => {
    const currentRaw =
      draft.workflowFilter === null ? '' : buildFlowFilterValue(draft.workflowFilter)
    onEditFlowFilter(currentRaw, (nextRaw) => {
      setDraft((previousDraft) => ({
        ...previousDraft,
        workflowFilter: nextRaw.length === 0 ? null : parseFlowFilterEditor(nextRaw),
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
            {draft.workflowName || '(flow 미지정)'} / {draft.messageName || '(message 미지정)'}
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
            <label className="text-xs font-semibold text-[#1E3D33]">Flow Name</label>
            <Input
              value={draft.workflowName}
              onChange={(event) =>
                setDraft((previousDraft) => ({
                  ...previousDraft,
                  workflowName: event.target.value,
                }))
              }
              readOnly={!isDraftCard}
              aria-readonly={isDraftCard ? 'false' : 'true'}
              placeholder={isDraftCard ? '신규 Flow 이름을 입력하세요' : undefined}
            />
            {!isDraftCard ? (
              <p className="text-[11px] text-[#97A39C]">
                저장된 Flow 의 Flow Name 은 변경 불가입니다. 변경이 필요하면 새 Flow 를 추가하고 기존 Flow 를 삭제하세요.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3D33]">Message Name</label>
            <Select
              value={messageDropdownValue}
              onValueChange={handleSelectMessageName}
              disabled={readOnly}
            >
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
                disabled={readOnly}
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
                readOnly={readOnly}
              />
              <p className="text-[11px] text-[#97A39C]">
                값을 비우면 모든 transactionId 에 매칭됩니다.
              </p>
            </div>
          </div>
        </FlowCardSection>
      ) : null}

      <FlowCardSection
        title="Filter"
        description="workflow_filter — data / event / context 조건 트리. 모든 protocol 에서 편집 가능."
      >
        <div className="space-y-2 rounded-xl border border-[#E7EEEA] bg-[#FAFCFB] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#1E3D33]">Flow Filter</p>
              <p className="text-[11px] text-[#738078]">
                data / event / context 의 조건 트리를 편집합니다.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClickEditFlowFilter}
              disabled={readOnly}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              편집...
            </Button>
          </div>
          <p
            className="rounded-lg border border-[#DCE5E0] bg-white px-3 py-2 text-xs text-[#22322B]"
            data-testid="flow-card-workflow-filter-summary"
          >
            {flowFilterSummary}
          </p>
        </div>
      </FlowCardSection>

      <FlowCardSection title="Action" description="이 Flow 가 실행하는 동작입니다.">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-[#1E3D33]">Action Name</label>
          <Input
            value={draft.actionName}
            onChange={(event) => handleChangeActionName(event.target.value)}
            placeholder="예: TOOL_CONDITION_REPLY"
            readOnly={readOnly}
          />
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
              disabled={readOnly}
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
        headerRight={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddDcopItem}
            disabled={readOnly || isDraftCard}
            aria-disabled={readOnly || isDraftCard ? 'true' : undefined}
            title={
              readOnly
                ? '편집 모드(Check Out)에서만 DCOP 추가 가능'
                : isDraftCard
                  ? 'Flow 저장 후 DCOP 추가 가능'
                  : undefined
            }
          >
            <Plus className="size-3.5" aria-hidden="true" />
            DCOP 추가
          </Button>
        }
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
      </FlowCardSection>

      {isDraftCard && onCancelDraft !== null ? (
        <footer className="flex items-center justify-end gap-2 border-t border-[#EEF3F0] pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancelDraft}
            disabled={isSaving}
          >
            취소
          </Button>
        </footer>
      ) : null}
    </section>
  )
})

interface FlowCardSectionProps {
  title: string
  description: string
  /** 헤더 우측에 표시할 액션 슬롯 (예: Collect 의 "DCOP 추가" 버튼). */
  headerRight?: React.ReactNode
  children: React.ReactNode
}

/**
 * Flow 카드 내부 5 섹션의 공통 헤더 + 본문 래퍼입니다 (F8.1: Filter 섹션 분리).
 *
 * 1차 릴리즈에서는 collapse 토글 없음 — 모두 default 펼친 상태로 노출 (SPEC line 122).
 */
function FlowCardSection({ title, description, headerRight, children }: FlowCardSectionProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-[#E7EEEA] bg-[#FBFDFC] p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1E3D33]">{title}</h3>
          <p className="text-[11px] text-[#738078]">{description}</p>
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </header>
      <div>{children}</div>
    </section>
  )
}
