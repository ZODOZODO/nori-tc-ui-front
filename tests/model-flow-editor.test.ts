import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DRAFT_FLOW_ID_SENTINEL,
  buildFlowDraft,
  createEmptyFlowDraft,
  draftToFlow,
  serializeFlowDraft,
  shouldRenderTriggerSection,
} from '../src/features/model/lib/model-flow-editor.ts'
import type { ModelFlow } from '../src/features/model/types/model.types.ts'

const WORKFLOW_FILTER_JSON = `{
  "and": [
    {
      "from": "data",
      "path": "status",
      "comparison": "equals",
      "expected": "OK"
    }
  ]
}`

const ACTION_DATA_INDEX_JSON = `{
  "mdfTemplateName": "TOOL_CONDITION_REPLY_MES",
  "fields": {
    "EQPID": {
      "from": "data",
      "path": "eqpId"
    }
  }
}`

const buildSecsFlow = (): ModelFlow => ({
  flowId: 11,
  workflowName: 'TOOL_CONDITION',
  messageName: 'S6F11',
  eventId: 'CEID_1001',
  transactionId: 'TXN_42',
  workflowFilter: WORKFLOW_FILTER_JSON,
  actionName: 'TOOL_CONDITION_REPLY',
  actionDataIndex: ACTION_DATA_INDEX_JSON,
  dcopItems: [
    {
      dcopItemKey: 7,
      modelVersionKey: 100,
      dcopItemName: 'TOOL_CONDITION_DCOP',
      eventId: 'CEID_1001',
      variableId: 'VID_2002',
      collectionRule: 'LAST',
      calculationRule: null,
      orderRule: 1,
      updatedAt: '2026-05-19T10:00:00Z',
    },
  ],
  dcopItemKeys: [7],
})

const buildSocketFlow = (): ModelFlow => ({
  flowId: 22,
  workflowName: 'SOCKET_FLOW',
  messageName: 'SOCKET_MSG_A',
  eventId: null,
  transactionId: null,
  workflowFilter: null,
  actionName: 'SOCKET_REPLY',
  actionDataIndex: null,
  dcopItems: [],
  dcopItemKeys: [],
})

test('buildFlowDraft: SECS Flow의 workflowFilter가 parsed structured draft로 변환됩니다', () => {
  const flow = buildSecsFlow()
  const draft = buildFlowDraft(flow)

  assert.equal(draft.flowId, 11)
  assert.equal(draft.workflowName, 'TOOL_CONDITION')
  assert.equal(draft.messageName, 'S6F11')
  assert.equal(draft.eventId, 'CEID_1001')
  assert.equal(draft.transactionId, 'TXN_42')
  assert.equal(draft.actionName, 'TOOL_CONDITION_REPLY')

  assert.notEqual(draft.workflowFilter, null)
  assert.equal(draft.workflowFilter?.mode, 'structured')
  assert.equal(draft.workflowFilter?.rootGroup.groupType, 'and')
  assert.equal(draft.workflowFilter?.rootGroup.children.length, 1)
})

test('buildFlowDraft: Socket Flow는 Trigger 3 필드를 null로 유지합니다', () => {
  const flow = buildSocketFlow()
  const draft = buildFlowDraft(flow)

  assert.equal(draft.flowId, 22)
  assert.equal(draft.eventId, null)
  assert.equal(draft.transactionId, null)
  assert.equal(draft.workflowFilter, null)
  assert.equal(draft.actionDataIndex, null)
  assert.equal(draft.dcopItems.length, 0)
})

test('buildFlowDraft: actionDataIndex raw JSON이 parsed structured draft로 변환됩니다', () => {
  const flow = buildSecsFlow()
  const draft = buildFlowDraft(flow)

  assert.notEqual(draft.actionDataIndex, null)
  assert.equal(draft.actionDataIndex?.mode, 'structured')
  assert.equal(draft.actionDataIndex?.mdfTemplateName, 'TOOL_CONDITION_REPLY_MES')
  assert.equal(draft.actionDataIndex?.fields.length, 1)
  assert.equal(draft.actionDataIndex?.fields[0].fieldName, 'EQPID')
  assert.equal(draft.actionDataIndex?.fields[0].path, 'eqpId')
})

test('buildFlowDraft: actionDataIndex가 null이면 draft도 null입니다', () => {
  const flow = buildSocketFlow()
  const draft = buildFlowDraft(flow)

  assert.equal(draft.actionDataIndex, null)
})

test('serializeFlowDraft: structured workflowFilter draft가 JSON string으로 직렬화됩니다', () => {
  const flow = buildSecsFlow()
  const draft = buildFlowDraft(flow)
  const payload = serializeFlowDraft(draft)

  assert.equal(payload.workflowName, 'TOOL_CONDITION')
  assert.equal(payload.messageName, 'S6F11')
  assert.equal(payload.eventId, 'CEID_1001')
  assert.equal(payload.transactionId, 'TXN_42')
  assert.equal(payload.actionName, 'TOOL_CONDITION_REPLY')

  assert.notEqual(payload.workflowFilter, null)
  const parsedWorkflowFilter = JSON.parse(payload.workflowFilter as string)
  assert.deepEqual(parsedWorkflowFilter, JSON.parse(WORKFLOW_FILTER_JSON))
})

test('serializeFlowDraft: Socket draft는 Trigger 3 필드와 actionDataIndex가 모두 null로 직렬화됩니다', () => {
  const flow = buildSocketFlow()
  const draft = buildFlowDraft(flow)
  const payload = serializeFlowDraft(draft)

  assert.equal(payload.eventId, null)
  assert.equal(payload.transactionId, null)
  assert.equal(payload.workflowFilter, null)
  assert.equal(payload.actionDataIndex, null)
  assert.equal(payload.workflowName, 'SOCKET_FLOW')
  assert.equal(payload.actionName, 'SOCKET_REPLY')
})

test('serializeFlowDraft: Collect 섹션 dcopItemKeys 는 draft.dcopItems 의 PK 배열로 함께 직렬화됩니다', () => {
  // model-flow-save-unify: FlowCard 의 저장은 5 섹션 + Collect 를 한 번의 PUT 으로 갱신.
  // DcopItemPickerModal 의 "확인" 은 즉시 PUT 대신 draft.dcopItems 에 반영만 하고,
  // 사용자가 우상단 통합 Save 를 누른 시점의 dcopItems 가 PUT body 의 dcopItemKeys
  // 필드로 함께 전송됩니다.
  const flow = buildSecsFlow()
  const draft = buildFlowDraft(flow)
  const payload = serializeFlowDraft(draft)

  assert.ok(Array.isArray(payload.dcopItemKeys))
  assert.deepEqual(payload.dcopItemKeys, [7])
})

test('createEmptyFlowDraft: 신규 draft는 flowId=null과 빈 string/null 필드를 가집니다', () => {
  const draft = createEmptyFlowDraft()

  assert.equal(draft.flowId, null)
  assert.equal(draft.workflowName, '')
  assert.equal(draft.messageName, '')
  assert.equal(draft.eventId, null)
  assert.equal(draft.transactionId, null)
  assert.equal(draft.workflowFilter, null)
  assert.equal(draft.actionName, '')
  assert.equal(draft.actionDataIndex, null)
  assert.equal(draft.dcopItems.length, 0)
})

test('round-trip: SECS Flow는 buildFlowDraft + serializeFlowDraft를 거쳐도 4섹션이 보존됩니다', () => {
  const flow = buildSecsFlow()
  const payload = serializeFlowDraft(buildFlowDraft(flow))

  assert.equal(payload.workflowName, flow.workflowName)
  assert.equal(payload.messageName, flow.messageName)
  assert.equal(payload.eventId, flow.eventId)
  assert.equal(payload.transactionId, flow.transactionId)
  assert.equal(payload.actionName, flow.actionName)

  assert.deepEqual(
    JSON.parse(payload.workflowFilter as string),
    JSON.parse(flow.workflowFilter as string),
  )
  assert.deepEqual(
    JSON.parse(payload.actionDataIndex as string),
    JSON.parse(flow.actionDataIndex as string),
  )
})

test('draftToFlow: 빈 draft가 sentinel flowId를 가진 ModelFlow shape으로 변환됩니다', () => {
  const draft = createEmptyFlowDraft()
  const flow = draftToFlow(draft)

  assert.equal(flow.flowId, DRAFT_FLOW_ID_SENTINEL)
  assert.equal(flow.workflowName, '')
  assert.equal(flow.messageName, '')
  assert.equal(flow.eventId, null)
  assert.equal(flow.transactionId, null)
  assert.equal(flow.workflowFilter, null)
  assert.equal(flow.actionName, '')
  assert.equal(flow.actionDataIndex, null)
  assert.equal(flow.dcopItems.length, 0)
})

test('draftToFlow: Identity가 채워진 draft는 workflowName/messageName이 반영됩니다', () => {
  const draft = createEmptyFlowDraft()
  const filledDraft = {
    ...draft,
    workflowName: 'handleLotStart',
    messageName: 'S6F11',
    actionName: 'LOT_START_REPLY',
  }
  const flow = draftToFlow(filledDraft)

  assert.equal(flow.workflowName, 'handleLotStart')
  assert.equal(flow.messageName, 'S6F11')
  assert.equal(flow.actionName, 'LOT_START_REPLY')
  assert.equal(flow.flowId, DRAFT_FLOW_ID_SENTINEL)
})

test('draftToFlow: structured workflowFilter draft가 raw JSON string으로 직렬화되어 반영됩니다', () => {
  const baseFlow = buildSecsFlow()
  const draft = buildFlowDraft(baseFlow)
  const flow = draftToFlow({ ...draft, flowId: null })

  assert.notEqual(flow.workflowFilter, null)
  assert.deepEqual(
    JSON.parse(flow.workflowFilter as string),
    JSON.parse(WORKFLOW_FILTER_JSON),
  )
  assert.notEqual(flow.actionDataIndex, null)
  assert.deepEqual(
    JSON.parse(flow.actionDataIndex as string),
    JSON.parse(ACTION_DATA_INDEX_JSON),
  )
})

test('draftToFlow: Socket draft는 Trigger 3 필드와 actionDataIndex가 모두 null입니다', () => {
  const draft = buildFlowDraft(buildSocketFlow())
  const flow = draftToFlow({ ...draft, flowId: null })

  assert.equal(flow.eventId, null)
  assert.equal(flow.transactionId, null)
  assert.equal(flow.workflowFilter, null)
  assert.equal(flow.actionDataIndex, null)
})

test('draftToFlow: dcopItems는 readonly 빈 배열로 보존됩니다', () => {
  const draft = createEmptyFlowDraft()
  const flow = draftToFlow(draft)

  assert.ok(Array.isArray(flow.dcopItems))
  assert.equal(flow.dcopItems.length, 0)
  assert.ok(Array.isArray(flow.dcopItemKeys))
  assert.equal(flow.dcopItemKeys.length, 0)
})

test('draftToFlow: SECS Flow 의 dcopItems 가 있을 때 dcopItemKeys 가 그 PK 배열로 추출됩니다', () => {
  const draft = buildFlowDraft(buildSecsFlow())
  const flow = draftToFlow(draft)

  assert.deepEqual(flow.dcopItemKeys, [7])
})

test('DRAFT_FLOW_ID_SENTINEL: backend가 발급하지 않는 음수 값으로 충돌을 회피합니다', () => {
  // backend PK 는 양수 — 음수 sentinel 로 draft 와 real flow 구분.
  assert.ok(DRAFT_FLOW_ID_SENTINEL < 0)
})

test('shouldRenderTriggerSection: SECS 만 Trigger 섹션을 렌더하고 Socket/PLC 는 숨긴다', () => {
  // EventId/TransactionId 는 SECS 전용 — Socket 에 더해 PLC 도 Trigger 미렌더(plc-gateway L1348).
  assert.equal(shouldRenderTriggerSection('SECS'), true)
  assert.equal(shouldRenderTriggerSection('SOCKET'), false)
  assert.equal(shouldRenderTriggerSection('PLC'), false)
})
