import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFlowDraft,
  createEmptyFlowDraft,
  shouldRenderTriggerSection,
  summarizeFlowActionDataIndex,
  summarizeFlowWorkflowFilter,
} from '../src/features/model/lib/model-flow-editor.ts'
import type { ModelFlow } from '../src/features/model/types/model.types.ts'

/**
 * FlowCard 컴포넌트의 pure logic 단위 테스트입니다.
 *
 * 컴포넌트 자체의 DOM 렌더 검증 (RTL) 은 워크스페이스에 vitest/jsdom 미설치이며
 * 형제 `*.test.tsx` 가 0 개 — 별 SPEC/Phase 에서 인프라 도입 후 추가합니다.
 * 본 파일에서는 FlowCard 가 의존하는 4 가지 helper (Trigger 분기 / summary 2 종 /
 * draft 변환) 의 시나리오 6+ 케이스를 node native test 로 검증합니다.
 */

const SECS_WORKFLOW_FILTER = `{
  "and": [
    {
      "from": "data",
      "path": "status",
      "comparison": "equals",
      "expected": "OK"
    }
  ]
}`

const SECS_ACTION_DATA_INDEX = `{
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
  workflowFilter: SECS_WORKFLOW_FILTER,
  actionName: 'TOOL_CONDITION_REPLY',
  actionDataIndex: SECS_ACTION_DATA_INDEX,
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

test('shouldRenderTriggerSection: SECS 모델은 Trigger 섹션을 렌더합니다', () => {
  // F8.1 root cause fix: messageName 인자 제거 — protocol 단독 분기.
  assert.equal(shouldRenderTriggerSection('SECS'), true)
})

test('shouldRenderTriggerSection: SOCKET 모델은 Trigger 섹션을 미렌더합니다', () => {
  // F8.1: SOCKET 은 messageName 무관 항상 미렌더 — workflow_filter 는 Filter 섹션이 별도 노출.
  assert.equal(shouldRenderTriggerSection('SOCKET'), false)
})

test('summarizeFlowWorkflowFilter: SECS draft의 structured root는 요약 문자열을 반환합니다', () => {
  const draft = buildFlowDraft(buildSecsFlow())
  const summary = summarizeFlowWorkflowFilter(draft.workflowFilter)

  assert.notEqual(summary, '필터 없음')
  // 'status' path가 요약에 포함되어야 합니다 (summarizeWorkflowFilterValue 동작 검증).
  assert.equal(summary.includes('status'), true)
})

test('summarizeFlowWorkflowFilter: Socket Flow의 null draft는 "필터 없음" 안내 문구를 반환합니다', () => {
  const draft = buildFlowDraft(buildSocketFlow())
  assert.equal(summarizeFlowWorkflowFilter(draft.workflowFilter), '필터 없음')
})

test('summarizeFlowActionDataIndex: SECS draft의 structured mdfTemplate은 요약 문자열을 반환합니다', () => {
  const draft = buildFlowDraft(buildSecsFlow())
  const summary = summarizeFlowActionDataIndex(draft.actionDataIndex)

  assert.notEqual(summary, '매핑 없음')
  // 'EQPID' 필드명이 요약에 포함되어야 합니다.
  assert.equal(summary.includes('EQPID'), true)
})

test('summarizeFlowActionDataIndex: Socket Flow의 null draft는 "매핑 없음" 안내 문구를 반환합니다', () => {
  const draft = buildFlowDraft(buildSocketFlow())
  assert.equal(summarizeFlowActionDataIndex(draft.actionDataIndex), '매핑 없음')
})

test('summarizeFlowWorkflowFilter: createEmptyFlowDraft의 null draft도 "필터 없음"을 반환합니다', () => {
  const draft = createEmptyFlowDraft()
  assert.equal(summarizeFlowWorkflowFilter(draft.workflowFilter), '필터 없음')
  assert.equal(summarizeFlowActionDataIndex(draft.actionDataIndex), '매핑 없음')
})

test('FlowCard Collect 섹션: SECS Flow는 dcopItems 1건을 노출합니다', () => {
  const draft = buildFlowDraft(buildSecsFlow())
  assert.equal(draft.dcopItems.length, 1)
  assert.equal(draft.dcopItems[0].dcopItemName, 'TOOL_CONDITION_DCOP')
})

test('FlowCard Collect 섹션: Socket Flow는 dcopItems가 빈 배열입니다', () => {
  const draft = buildFlowDraft(buildSocketFlow())
  assert.equal(draft.dcopItems.length, 0)
})
