import { CheckCircle2, Clock, ShieldAlert, XCircle, type LucideIcon } from 'lucide-react'

/**
 * operation 결과 다이얼로그가 구분하는 terminal 4 상태입니다(§14.1).
 *
 * `repair` 는 자동 실패가 아니라 "처리 중단·운영 확인 필요", `delayed` 는 "확인이 지연되고 있다"
 * 이며 **둘 다 실패로 뭉개지 않습니다**. 나머지 하나(접수/진행)는 확인 다이얼로그의 진행 표시로
 * 나타납니다.
 */
export type EqpOperationResultStatus = 'success' | 'failure' | 'repair' | 'delayed'

interface OperationResultPresentation {
  icon: LucideIcon
  iconClass: string
  boxClass: string
  /** "결과: …" 에 들어갈 라벨 i18n 키. */
  resultKey: string
}

/** 상태별 아이콘 · 강조 색 · 결과 라벨. 네 상태를 한 곳에서 매핑한다. */
export const OPERATION_RESULT_PRESENTATION: Record<
  EqpOperationResultStatus,
  OperationResultPresentation
> = {
  success: {
    icon: CheckCircle2,
    iconClass: 'size-5 text-success',
    boxClass: 'border-success/30 bg-success/10 text-foreground',
    resultKey: 'eqp.operation.resultPass',
  },
  failure: {
    icon: XCircle,
    iconClass: 'size-5 text-danger',
    boxClass: 'border-danger/30 bg-danger/5 text-danger',
    resultKey: 'eqp.operation.resultFail',
  },
  repair: {
    icon: ShieldAlert,
    iconClass: 'size-5 text-warning',
    boxClass: 'border-warning/30 bg-warning/10 text-foreground',
    resultKey: 'eqp.operation.resultRepairRequired',
  },
  delayed: {
    icon: Clock,
    iconClass: 'size-5 text-muted-foreground',
    boxClass: 'border-border bg-muted/40 text-foreground',
    resultKey: 'eqp.operation.resultDelayed',
  },
}
