import type { ModelDcopItem, ModelFlowSummary } from '../types/model.types.ts'

/**
 * `groupFlowsByWorkflowName` 의 결과 한 그룹입니다.
 *
 * 배열 형태로 반환하므로 ModelFlowSidebar 의 렌더 순서가 정렬과 함께 보장됩니다
 * (객체 key 순서 의존 회피).
 */
export interface FlowWorkflowGroup {
  workflowName: string
  flows: ModelFlowSummary[]
}

/**
 * Backend 의 GET /flows flat 응답을 workflowName 기준 2 단계 트리로 그룹화합니다.
 *
 * - 1 단계 = workflowName, 2 단계 = messageName.
 * - workflowName 사전순, 그룹 내부 flows 는 messageName 사전순으로 정렬합니다.
 *   (백엔드가 workflowKey ASC 정렬을 보장하지만 messageName 도 사전 정렬해
 *    같은 workflowName 안에서 메시지 순서를 안정화합니다.)
 */
export const groupFlowsByWorkflowName = (
  summaries: readonly ModelFlowSummary[],
): FlowWorkflowGroup[] => {
  const buckets = new Map<string, ModelFlowSummary[]>()
  for (const summary of summaries) {
    const list = buckets.get(summary.workflowName)
    if (list === undefined) {
      buckets.set(summary.workflowName, [summary])
    } else {
      list.push(summary)
    }
  }

  return Array.from(buckets.entries())
    .map(([workflowName, flows]) => ({
      workflowName,
      flows: [...flows].sort((a, b) => a.messageName.localeCompare(b.messageName)),
    }))
    .sort((a, b) => a.workflowName.localeCompare(b.workflowName))
}

/**
 * dcop-itemes 응답 row 중 workflow_name 이 NULL 인 행만 추출합니다.
 *
 * 백엔드 {@code ModelFlowQueryService.findUnassignedDcopItems} 와 동일한 의미 —
 * 어느 Flow 의 Collect 섹션에도 속하지 않는 DCOP item 만 sidebar 하단의
 * "Unassigned DCOPs" 영역에 read-only 로 노출합니다.
 *
 * 백엔드 record 는 nullable workflowName 을 직렬화하지만 FE 타입은 string 으로
 * 좁혀져 있어 비교 시 unknown cast 로 받습니다 (별 SPEC 에서 ModelDcopItem
 * 타입 수정 권고).
 */
export const extractUnassignedDcopItems = (
  items: readonly ModelDcopItem[],
): ModelDcopItem[] =>
  items.filter((item) => (item.workflowName as unknown) === null)
