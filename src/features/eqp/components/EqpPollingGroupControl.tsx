import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'

interface EqpPollingGroupControlProps {
  eqpId: string
  isPending: boolean
  onStartGroup: (eqpId: string, groupMessageName: string) => Promise<void>
  onEndGroup: (eqpId: string, groupMessageName: string) => Promise<void>
}

type PollingGroupResult =
  | { kind: 'success'; message: string }
  | { kind: 'failure'; message: string }
  | null

/**
 * PLC 설비 전용 폴링 그룹 start/end 컨트롤입니다.
 *
 * 그룹 messageName 을 입력하고 Start/End 를 누르면 EQP_PLC_GROUP_START/END 명령을 발행합니다
 * (202 + traceId → /api/async 폴링은 부모가 담당). PoC 는 그룹 스펙 조회 백엔드가 없어
 * 사용자가 messageName 을 직접 입력합니다(별 SPEC 에서 모델 그룹 연동).
 */
export function EqpPollingGroupControl({
  eqpId,
  isPending,
  onStartGroup,
  onEndGroup,
}: EqpPollingGroupControlProps) {
  const { t } = useI18n()
  const [groupMessageName, setGroupMessageName] = useState('')
  const [result, setResult] = useState<PollingGroupResult>(null)

  const runCommand = async (action: 'start' | 'end') => {
    const trimmedGroupMessageName = groupMessageName.trim()
    if (!trimmedGroupMessageName) {
      setResult({ kind: 'failure', message: t('eqp.pollingGroup.nameRequired') })
      return
    }

    setResult(null)
    try {
      if (action === 'start') {
        await onStartGroup(eqpId, trimmedGroupMessageName)
        setResult({
          kind: 'success',
          message: t('eqp.pollingGroup.startSuccess', { group: trimmedGroupMessageName }),
        })
        return
      }

      await onEndGroup(eqpId, trimmedGroupMessageName)
      setResult({
        kind: 'success',
        message: t('eqp.pollingGroup.endSuccess', { group: trimmedGroupMessageName }),
      })
    } catch (error) {
      setResult({
        kind: 'failure',
        message: error instanceof Error && error.message ? error.message : t('eqp.pollingGroup.failed'),
      })
    }
  }

  return (
    <section
      className="mt-3 rounded-2xl border border-border bg-card p-4"
      data-testid="eqp-polling-group-control"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">Polling Group</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('eqp.pollingGroup.desc')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={groupMessageName}
          onChange={(event) => setGroupMessageName(event.target.value)}
          disabled={isPending}
          placeholder={t('eqp.pollingGroup.inputPlaceholder')}
          className="h-10 w-full max-w-70"
          data-testid="eqp-polling-group-input"
        />
        <Button
          type="button"
          className="h-10 rounded-full px-4 text-xs font-semibold"
          disabled={isPending}
          onClick={() => void runCommand('start')}
          data-testid="eqp-polling-group-start"
        >
          {isPending ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden="true" /> : null}
          Start
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-border px-4 text-xs font-semibold"
          disabled={isPending}
          onClick={() => void runCommand('end')}
          data-testid="eqp-polling-group-end"
        >
          End
        </Button>
      </div>

      {result ? (
        <p
          className={
            result.kind === 'success'
              ? 'mt-3 rounded-xl border border-emerald-300/40 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-700'
              : 'mt-3 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger'
          }
          data-testid="eqp-polling-group-result"
        >
          {result.message}
        </p>
      ) : null}
    </section>
  )
}
