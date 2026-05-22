import type { ModelDcopItem, ModelFlow, ModelFlowUpdateRequest } from '../types/model.types.ts'
import {
  type ActionDataIndexEditorDraft,
  type FlowFilterEditorDraft,
  buildActionDataIndexValue,
  buildFlowFilterValue,
  parseActionDataIndexEditor,
  parseFlowFilterEditor,
  summarizeActionDataIndexValue,
  summarizeFlowFilterValue,
} from './model-detail-editor.ts'

/**
 * Unsaved draft Flow 에 부여하는 placeholder flowId 입니다.
 *
 * backend 의 `tc_model_message_flow.message_flow_key` 는 양수 PK 이므로 음수 sentinel 은
 * 실 데이터와 충돌하지 않습니다. FlowCard 가 ModelFlow shape 을 요구하므로
 * draftToFlow 어댑터가 이 값을 사용합니다 — 헤더 / 키 등 표시는 호출자가
 * sentinel 여부를 분기해 "신규" 등으로 처리합니다.
 */
export const DRAFT_FLOW_ID_SENTINEL = -1

/**
 * FlowCard 의 5 섹션 편집 상태입니다 (F8.1: Filter 가 Trigger 와 분리).
 *
 * - Filter 의 workflowFilter / Action 의 actionDataIndex 는 JSON string 대신
 *   structured editor draft 로 보관 (기존 model-detail-editor 의 draft 타입 재사용).
 * - dcopItems 는 별도 모달에서만 편집되므로 FlowCard 안에서는 readonly.
 */
export interface FlowDraft {
  flowId: number | null
  workflowName: string
  messageName: string
  eventId: string | null
  transactionId: string | null
  workflowFilter: FlowFilterEditorDraft | null
  actionName: string
  actionDataIndex: ActionDataIndexEditorDraft | null
  dcopItems: readonly ModelDcopItem[]
}

/**
 * Backend 응답 ModelFlow 를 화면 편집용 FlowDraft 로 변환합니다.
 *
 * workflowFilter / actionDataIndex 가 null 인 경우 draft 도 null —
 * Socket 모델 / 비어 있는 Action 을 그대로 표현하기 위함.
 */
export const buildFlowDraft = (flow: ModelFlow): FlowDraft => ({
  flowId: flow.flowId,
  workflowName: flow.workflowName,
  messageName: flow.messageName,
  eventId: flow.eventId,
  transactionId: flow.transactionId,
  workflowFilter:
    flow.workflowFilter === null ? null : parseFlowFilterEditor(flow.workflowFilter),
  actionName: flow.actionName,
  actionDataIndex:
    flow.actionDataIndex === null ? null : parseActionDataIndexEditor(flow.actionDataIndex),
  dcopItems: flow.dcopItems,
})

/**
 * FlowDraft 를 PUT 요청 바디로 직렬화합니다.
 *
 * draft 의 workflowFilter / actionDataIndex 가 null 이거나 serialize 결과가
 * 빈 문자열인 경우 payload 에서도 null — backend 가 nullable 컬럼으로 저장합니다.
 */
export const serializeFlowDraft = (draft: FlowDraft): ModelFlowUpdateRequest => {
  const workflowFilterValue =
    draft.workflowFilter === null ? null : buildFlowFilterValue(draft.workflowFilter)
  const actionDataIndexValue =
    draft.actionDataIndex === null ? null : buildActionDataIndexValue(draft.actionDataIndex)

  return {
    workflowName: draft.workflowName,
    messageName: draft.messageName,
    eventId: draft.eventId,
    transactionId: draft.transactionId,
    workflowFilter:
      workflowFilterValue !== null && workflowFilterValue.length > 0 ? workflowFilterValue : null,
    actionName: draft.actionName,
    actionDataIndex:
      actionDataIndexValue !== null && actionDataIndexValue.length > 0
        ? actionDataIndexValue
        : null,
    // FlowCard 의 저장은 Identity / Trigger / Filter / Action 4 섹션만 갱신 —
    // Collect 의 dcop_item binding 은 DcopItemPickerModal 이 별 PUT 으로 송신하므로
    // null 로 두어 BE 에서 Collect 미갱신으로 해석되도록 한다.
    dcopItemKeys: null,
  }
}

/**
 * Sidebar 의 "Flow 추가" 버튼 클릭 시 사용하는 빈 draft 입니다.
 *
 * flowId 가 null 이면 unsaved 상태 — POST /flows 로 생성 후 응답 flowId 를
 * 좌측 트리 selection 으로 이어 사용합니다.
 */
export const createEmptyFlowDraft = (): FlowDraft => ({
  flowId: null,
  workflowName: '',
  messageName: '',
  eventId: null,
  transactionId: null,
  workflowFilter: null,
  actionName: '',
  actionDataIndex: null,
  dcopItems: [],
})

/**
 * Filter 섹션의 workflow_filter summary 텍스트입니다 (F8.1: Trigger 와 분리된 Filter).
 *
 * draft 의 structured root group 을 1 줄 요약. raw 모드면 첫 줄을 그대로 노출.
 * draft 가 null 이면 "필터 없음" — protocol 무관 비어 있는 Flow.
 */
export const summarizeFlowFilter = (
  draft: FlowFilterEditorDraft | null,
): string => {
  if (draft === null) {
    return '필터 없음'
  }

  const serialized = buildFlowFilterValue(draft)
  if (serialized.length === 0) {
    return '필터 없음'
  }

  const summary = summarizeFlowFilterValue(serialized)
  return summary.length > 0 ? summary : '필터 없음'
}

/**
 * Action 섹션의 action_data_index summary 텍스트입니다.
 *
 * mdfTemplateName + 첫 field 매핑을 한 줄로 표시. draft 가 null 이거나 결과가
 * 비어 있으면 "매핑 없음".
 */
export const summarizeFlowActionDataIndex = (
  draft: ActionDataIndexEditorDraft | null,
): string => {
  if (draft === null) {
    return '매핑 없음'
  }

  const serialized = buildActionDataIndexValue(draft)
  if (serialized.length === 0) {
    return '매핑 없음'
  }

  const summary = summarizeActionDataIndexValue(serialized)
  return summary.length > 0 ? summary : '매핑 없음'
}

/**
 * FlowCard 가 Trigger 섹션 (EventId + TransactionId) 을 렌더할지 결정합니다.
 *
 * SPEC line 80-83: Socket 모델은 Trigger 섹션 자체 미렌더 — EventId / TransactionId
 * 가 SECS 전용이기 때문. workflow_filter 는 protocol 무관 모든 Flow 에서 편집
 * 가능하므로 Filter 섹션이 따로 분리되어 항상 렌더 (F8.1 root cause fix).
 *
 * F1 dev-report 권장에 따라 model 의 commInterface 값으로 명시 분기
 * (flow 의 3 필드 null 검사 X).
 */
export const shouldRenderTriggerSection = (protocol: 'SECS' | 'SOCKET'): boolean => {
  return protocol === 'SECS'
}

/**
 * Draft 상태의 FlowDraft 를 FlowCard 가 요구하는 ModelFlow shape 으로 변환합니다.
 *
 * draft 의 flowId 가 null (= unsaved) 인 경우 {@link DRAFT_FLOW_ID_SENTINEL} 로
 * 치환합니다. workflowFilter / actionDataIndex 의 structured draft 는 raw JSON
 * string 으로 직렬화되며, 빈 결과는 null 로 유지됩니다.
 *
 * 이 어댑터는 store.draftFlow 가 채워졌을 때 FlowCard 에 그대로 주입하기 위해
 * 사용됩니다 — 첫 저장은 POST /flows (Identity 만) 로 처리되며, Trigger / Action
 * 은 후속 PUT 으로 저장합니다.
 */
export const draftToFlow = (draft: FlowDraft): ModelFlow => {
  const workflowFilterValue =
    draft.workflowFilter === null ? null : buildFlowFilterValue(draft.workflowFilter)
  const actionDataIndexValue =
    draft.actionDataIndex === null ? null : buildActionDataIndexValue(draft.actionDataIndex)

  return {
    flowId: draft.flowId ?? DRAFT_FLOW_ID_SENTINEL,
    workflowName: draft.workflowName,
    messageName: draft.messageName,
    eventId: draft.eventId,
    transactionId: draft.transactionId,
    workflowFilter:
      workflowFilterValue !== null && workflowFilterValue.length > 0 ? workflowFilterValue : null,
    actionName: draft.actionName,
    actionDataIndex:
      actionDataIndexValue !== null && actionDataIndexValue.length > 0
        ? actionDataIndexValue
        : null,
    dcopItems: [...draft.dcopItems],
    dcopItemKeys: draft.dcopItems
      .map((item) => item.dcopItemKey)
      .filter((key): key is number => key !== null),
  }
}
