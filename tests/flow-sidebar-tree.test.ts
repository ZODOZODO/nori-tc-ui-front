import assert from 'node:assert/strict'
import test from 'node:test'
import { groupFlowsByWorkflowName } from '../src/features/model/lib/model-flow-grouping.ts'
import type { ModelFlowSummary } from '../src/features/model/types/model.types.ts'

/**
 * ModelFlowSidebar 의 pure helper 단위 테스트입니다.
 *
 * 컴포넌트 자체의 DOM 렌더 검증 (RTL) 은 워크스페이스에 vitest/jsdom 미설치이며
 * `*.test.tsx` 형제 0 개 — 별 SPEC 에서 인프라 도입 후 추가합니다 (F2 결정 답습).
 * 본 파일은 sidebar 가 의존하는 workflowName 트리 그룹화 helper 의 시나리오를
 * node native test 로 검증합니다.
 *
 * dcop-flow-binding v4 에서 미매핑 dcop 추출 helper 는 폐기 — N:M 모델에서 Flow 0 개
 * 매핑은 자연 상태이며 picker 모달이 좌측 disabled 배지로 binding 상태를 시각화한다.
 */

function makeSummary(
  flowId: number,
  workflowName: string,
  messageName: string,
  actionName = 'doNothing',
): ModelFlowSummary {
  return { flowId, workflowName, messageName, actionName }
}

test('groupFlowsByWorkflowName: 빈 입력은 빈 배열을 반환한다', () => {
  const result = groupFlowsByWorkflowName([])
  assert.deepEqual(result, [])
})

test('groupFlowsByWorkflowName: 단일 flow 는 단일 그룹으로 묶인다', () => {
  const result = groupFlowsByWorkflowName([makeSummary(1, 'handleLotStart', 'S6F11')])
  assert.equal(result.length, 1)
  assert.equal(result[0].workflowName, 'handleLotStart')
  assert.equal(result[0].flows.length, 1)
  assert.equal(result[0].flows[0].flowId, 1)
})

test('groupFlowsByWorkflowName: 같은 workflowName 의 여러 messageName 은 한 그룹으로 합쳐진다', () => {
  const result = groupFlowsByWorkflowName([
    makeSummary(1, 'handleLotStart', 'S6F11'),
    makeSummary(2, 'handleLotStart', 'S6F13'),
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].workflowName, 'handleLotStart')
  assert.deepEqual(
    result[0].flows.map((flow) => flow.messageName),
    ['S6F11', 'S6F13'],
  )
})

test('groupFlowsByWorkflowName: 다른 workflowName 들은 각각 별 그룹을 만든다', () => {
  const result = groupFlowsByWorkflowName([
    makeSummary(1, 'handleLotStart', 'S6F11'),
    makeSummary(2, 'reportToMes', 'S6F11'),
  ])
  assert.equal(result.length, 2)
  assert.deepEqual(
    result.map((group) => group.workflowName),
    ['handleLotStart', 'reportToMes'],
  )
})

test('groupFlowsByWorkflowName: workflowName 사전순 / 그룹 내부 messageName 사전순으로 정렬한다', () => {
  const result = groupFlowsByWorkflowName([
    makeSummary(3, 'reportToMes', 'S6F11'),
    makeSummary(1, 'handleLotStart', 'S6F13'),
    makeSummary(2, 'handleLotStart', 'S6F11'),
  ])
  assert.deepEqual(
    result.map((group) => group.workflowName),
    ['handleLotStart', 'reportToMes'],
  )
  assert.deepEqual(
    result[0].flows.map((flow) => flow.messageName),
    ['S6F11', 'S6F13'],
  )
})
