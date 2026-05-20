import type { ModelDcopItem, ModelFlow, ModelFlowUpdateRequest } from '../types/model.types.ts'
import {
  type ActionDataIndexEditorDraft,
  type WorkflowFilterEditorDraft,
  buildActionDataIndexValue,
  buildWorkflowFilterValue,
  parseActionDataIndexEditor,
  parseWorkflowFilterEditor,
} from './model-detail-editor.ts'

/**
 * FlowCard 의 4 섹션 편집 상태입니다.
 *
 * - Trigger 의 workflowFilter / Action 의 actionDataIndex 는 JSON string 대신
 *   structured editor draft 로 보관 (기존 model-detail-editor 의 draft 타입 재사용).
 * - dcopItems 는 별도 모달에서만 편집되므로 FlowCard 안에서는 readonly.
 */
export interface FlowDraft {
  flowId: number | null
  workflowName: string
  messageName: string
  eventId: string | null
  transactionId: string | null
  workflowFilter: WorkflowFilterEditorDraft | null
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
    flow.workflowFilter === null ? null : parseWorkflowFilterEditor(flow.workflowFilter),
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
    draft.workflowFilter === null ? null : buildWorkflowFilterValue(draft.workflowFilter)
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
