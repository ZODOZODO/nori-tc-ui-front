import { useI18n } from '@/i18n/i18n-context'
import {
  OPERATION_RESULT_PRESENTATION,
  type EqpOperationResultStatus,
} from '../lib/eqp-operation-result-presentation'

interface EqpOperationResultBodyProps {
  status: EqpOperationResultStatus
  message: string | null
  operationId: string | null
}

/**
 * operation 결과 본문입니다 — PASS / FAIL / REPAIR_REQUIRED / 확인 지연 4 상태를 구분해 보여줍니다.
 *
 * <p>`repair` 와 `delayed` 를 실패 문구로 합치지 않습니다(§14.1). 전자는 운영자가 확인해야 하는
 * 중단이고, 후자는 아직 결과를 모르는 상태다 — 둘 다 "실패했다" 로 읽히면 운영자가 이미 적용된
 * 변경을 되돌리려 한다.</p>
 */
export function EqpOperationResultBody({
  status,
  message,
  operationId,
}: EqpOperationResultBodyProps) {
  const { t } = useI18n()
  const { boxClass } = OPERATION_RESULT_PRESENTATION[status]

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${boxClass}`}>
      <p>{message}</p>
      {status === 'delayed' && (
        <p className="mt-2 text-xs text-muted-foreground">{t('eqp.operation.delayedHint')}</p>
      )}
      {status === 'repair' && (
        <p className="mt-2 text-xs text-muted-foreground">{t('eqp.operation.repairHint')}</p>
      )}
      {operationId !== null && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {t('eqp.operation.idLabel')}: {operationId}
        </p>
      )}
    </div>
  )
}
