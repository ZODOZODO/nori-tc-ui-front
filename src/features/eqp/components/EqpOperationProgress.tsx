import { Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n/i18n-context'
import type { OperationPhase } from '@/shared/lib/operation-status'

interface EqpOperationProgressProps {
  /** 진행 중 operation 의 현재 phase. `null` 이면 아무것도 그리지 않는다. */
  phase: OperationPhase | null
}

/** 백엔드 phase → 진행 문구 i18n 키. */
const PHASE_MESSAGE_KEYS: Record<string, string> = {
  ACCEPTED: 'eqp.operation.phaseAccepted',
  PREPARING: 'eqp.operation.phasePreparing',
  QUIESCING: 'eqp.operation.phaseQuiescing',
  PREPARED: 'eqp.operation.phasePrepared',
  COMMITTED: 'eqp.operation.phaseCommitted',
  APPLYING: 'eqp.operation.phaseApplying',
  FINALIZING: 'eqp.operation.phaseFinalizing',
  BARRIER_OPEN: 'eqp.operation.phaseBarrierOpen',
  RECONCILING: 'eqp.operation.phaseReconciling',
  COMPENSATING: 'eqp.operation.phaseCompensating',
  ABORTED: 'eqp.operation.phaseAborted',
}

/**
 * 접수된 operation 의 진행 phase 를 확인 다이얼로그 안에 표시합니다(§14.1 — 접수 ≠ 완료).
 *
 * <p>모르는 phase 를 실패나 완료로 바꾸지 않습니다 — 진행 중 문구를 유지하고 phase 원문을 함께
 * 노출합니다. 알 수 없는 값을 성공/실패로 추정하면 운영자가 잘못된 조치를 하게 됩니다.</p>
 */
export function EqpOperationProgress({ phase }: EqpOperationProgressProps) {
  const { t } = useI18n()

  if (phase === null) {
    return null
  }

  const messageKey = PHASE_MESSAGE_KEYS[phase] ?? null

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        <span>{messageKey === null ? t('eqp.operation.phaseUnknown') : t(messageKey)}</span>
      </div>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {t('eqp.operation.phaseLabel')}: {phase}
      </p>
    </div>
  )
}
