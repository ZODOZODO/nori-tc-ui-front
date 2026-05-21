import type { ModelFlowSummary } from '../types/model.types.ts'

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
 *   (백엔드가 flowId ASC 정렬을 보장하지만 messageName 도 사전 정렬해
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

