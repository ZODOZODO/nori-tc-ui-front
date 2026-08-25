import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n/i18n-context'
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useDeployScenarios } from '../hooks/useDeployScenarios'
import { useDeploySummary } from '../hooks/useDeploySummary'
import { useDeployTargets } from '../hooks/useDeployTargets'
import {
  formatDateTime,
  resolveDeployStatusLabel,
  resolveStatusVariant,
} from '../lib/deploy-monitor-format'
import { resolveDeployTaskLabel } from '../lib/deploy-utils'
import { useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployHistoryItem, DeployTargetItem } from '../types/deploy.types'

interface DeployMonitorViewModalProps {
  deployKey: number | null
  historyItem: DeployHistoryItem | null
  isServerBacked: boolean
  onClose: () => void
}

/**
 * target 상태를 결과 라벨로 바꾼다.
 *
 * <p>모르는 status 를 `PENDING` 으로 바꾸지 않는다(§14.3) — 그렇게 하면 복구가 필요한 target 이
 * "아직 시작 전" 으로 보여 운영자가 방치하게 된다. `COMPENSATION_FAILED` 는 Plan B2 대로
 * `REPAIR_REQUIRED` 와 같은 "처리 중단·운영 확인 필요" 계열로 매핑한다.</p>
 */
const resolveTargetResultLabel = (targetStatus: string, unknownLabel: string) => {
  switch (targetStatus) {
    case 'COMPLETED':
    case 'NO_CHANGE':
      return 'PASS'
    case 'FAILED':
      return 'FAIL'
    case 'COMPENSATION_FAILED':
    case 'REPAIR_REQUIRED':
      return 'REPAIR_REQUIRED'
    case 'ROLLING_BACK':
    case 'ROLLED_BACK':
      return 'ROLLBACK'
    case 'RUNNING':
      return 'RUNNING'
    case 'RECONCILING':
      return 'RECONCILING'
    case 'FINALIZING':
      return 'FINALIZING'
    case 'CANCELED':
      return 'CANCELED'
    case 'PENDING':
      return 'PENDING'
    default:
      return unknownLabel
  }
}

const resolveTargetResultVariant = (targetStatus: string) => {
  switch (targetStatus) {
    case 'FAILED':
    case 'COMPENSATION_FAILED':
    case 'REPAIR_REQUIRED':
      return 'warning'
    case 'RUNNING':
    case 'RECONCILING':
    case 'FINALIZING':
      return 'info'
    case 'COMPLETED':
    case 'NO_CHANGE':
      return 'default'
    default:
      return 'secondary'
  }
}

export function DeployMonitorViewModal({
  deployKey,
  historyItem,
  isServerBacked,
  onClose,
}: DeployMonitorViewModalProps) {
  const { t } = useI18n()
  const localTargetsByDeployKey = useDeployUiStore((state) => state.localTargetsByDeployKey)
  const unknownStatusLabel = t('deploy.status.unknown')

  const targetPageSize = Math.max(historyItem?.targetSummary.total ?? 0, 50)

  const summaryQuery = useDeploySummary(
    deployKey,
    deployKey !== null && isServerBacked,
    historyItem?.deployStatus ?? null,
  )
  const targetsQuery = useDeployTargets(
    deployKey,
    deployKey !== null && isServerBacked,
    0,
    targetPageSize,
    null,
    null,
    historyItem?.deployStatus ?? null,
  )
  const scenarioCatalogQuery = useDeployScenarios(
    summaryQuery.data?.eventType ?? historyItem?.eventType ?? 'EQP_REGISTER_DEPLOY',
    deployKey !== null && historyItem !== null,
  )

  const summaryErrorMessage = summaryQuery.isError
    ? resolveErrorMessage(summaryQuery.error, t('deploy.monitor.commentSummaryError'))
    : null
  const targetsErrorMessage = targetsQuery.isError
    ? resolveErrorMessage(targetsQuery.error, t('deploy.monitor.commentTargetsError'))
    : null

  const targets = useMemo(() => {
    if (deployKey === null) {
      return []
    }

    if (isServerBacked) {
      return targetsQuery.data?.targets ?? []
    }

    return localTargetsByDeployKey[deployKey] ?? []
  }, [deployKey, targetsQuery.data?.targets, isServerBacked, localTargetsByDeployKey])
  const failureTargets = useMemo(
    () =>
      [...targets]
        .filter(
          (target) =>
            target.targetStatus === 'FAILED' ||
            target.targetStatus === 'COMPENSATION_FAILED' ||
            Boolean(target.lastErrorCode) ||
            Boolean(target.lastErrorMessage),
        )
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    [targets],
  )
  const resultMessage = summaryQuery.data?.resultMessage?.message?.trim() ?? null
  const resultTitle = summaryQuery.data?.resultMessage?.title?.trim() ?? null
  // resolveDeployTaskLabel 은 i18n 키를 반환한다 — 렌더 시점에 t(key) 로 번역.
  const taskTypeLabelKey = useMemo(
    () =>
      resolveDeployTaskLabel(
        summaryQuery.data?.resolvedScenarioCode ?? null,
        summaryQuery.data?.eventType ?? historyItem?.eventType ?? null,
      ),
    [historyItem?.eventType, summaryQuery.data?.eventType, summaryQuery.data?.resolvedScenarioCode],
  )
  const scenario = useMemo(() => {
    const resolvedScenarioCode = summaryQuery.data?.resolvedScenarioCode?.trim()
    if (!resolvedScenarioCode) {
      return null
    }

    return (
      scenarioCatalogQuery.data?.scenarios.find((item) => item.code === resolvedScenarioCode) ?? null
    )
  }, [scenarioCatalogQuery.data?.scenarios, summaryQuery.data?.resolvedScenarioCode])
  const isLoading =
    isServerBacked &&
    (summaryQuery.isPending || targetsQuery.isPending || scenarioCatalogQuery.isPending)
  const toBeLines = useMemo(() => {
    const lines: string[] = []

    if (historyItem?.selectedModelName || historyItem?.selectedModelVersion) {
      lines.push(
        t('deploy.monitor.lineModel', {
          name: historyItem?.selectedModelName ?? '-',
          version: historyItem?.selectedModelVersion ?? '-',
        }),
      )
    }

    if (historyItem?.selectedBusinessJarName) {
      lines.push(`Business JAR: ${historyItem.selectedBusinessJarName}`)
    }

    if (scenario?.name ?? summaryQuery.data?.resolvedScenarioCode) {
      lines.push(
        t('deploy.monitor.lineScenario', {
          name: scenario?.name ?? summaryQuery.data?.resolvedScenarioCode ?? '-',
        }),
      )
    }

    return lines
  }, [historyItem, scenario?.name, summaryQuery.data?.resolvedScenarioCode, t])
  const asIsLines = useMemo(() => {
    const lines: string[] = []
    const asIsState = summaryQuery.data?.asIsState

    if (!asIsState) {
      return lines
    }

    if (asIsState.interfaceType) {
      lines.push(t('deploy.monitor.lineInterface', { type: asIsState.interfaceType }))
    }
    if (asIsState.modelName || asIsState.modelVersion) {
      lines.push(
        t('deploy.monitor.lineModel', {
          name: asIsState.modelName ?? '-',
          version: asIsState.modelVersion ?? '-',
        }),
      )
    }
    if (asIsState.businessJarName) {
      lines.push(`Business JAR: ${asIsState.businessJarName}`)
    }
    if (asIsState.eqpParamVersion) {
      lines.push(`EQP PARAM: ${asIsState.eqpParamVersion}`)
    }

    return lines
  }, [summaryQuery.data?.asIsState, t])

  const targetColumns: ColumnDef<DeployTargetItem>[] = [
    {
      key: 'eqpId',
      header: 'EQP ID',
      accessor: (target) => target.eqpId,
      renderCell: (target) => <span className="font-medium text-foreground">{target.eqpId}</span>,
    },
    {
      key: 'task',
      header: t('deploy.monitor.colTask'),
      accessor: () => t(taskTypeLabelKey),
      renderCell: () => (
        <div className="min-w-45">
          <p className="font-medium text-foreground">{t(taskTypeLabelKey)}</p>
          <p className="text-xs text-muted-foreground">
            {scenario?.name ?? summaryQuery.data?.resolvedScenarioCode ?? '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'result',
      header: t('deploy.monitor.colResult'),
      accessor: (target) => resolveTargetResultLabel(target.targetStatus, unknownStatusLabel),
      renderCell: (target) => (
        <Badge variant={resolveTargetResultVariant(target.targetStatus)}>
          {resolveTargetResultLabel(target.targetStatus, unknownStatusLabel)}
        </Badge>
      ),
    },
    {
      key: 'detailStatus',
      header: t('deploy.monitor.colDetailStatus'),
      accessor: (target) => resolveDeployStatusLabel(target.targetStatus),
      renderCell: (target) => (
        <Badge variant={resolveTargetResultVariant(target.targetStatus)}>
          {resolveDeployStatusLabel(target.targetStatus)}
        </Badge>
      ),
    },
    {
      key: 'currentStep',
      width: '8rem',
      header: t('deploy.monitor.colCurrentStep'),
      accessor: (target) => target.currentStepCode || '-',
      // 긴 step code(예: 'APPLY_MODEL_VERSION')가 한 줄로 펼쳐져 테이블을 넓히지 않게 줄바꿈.
      renderCell: (target) => (
        <span className="block min-w-0 whitespace-normal break-all text-xs text-muted-foreground">
          {target.currentStepCode || '-'}
        </span>
      ),
    },
    {
      key: 'stepStatus',
      header: t('deploy.monitor.colStepStatus'),
      accessor: (target) =>
        target.currentStepStatus ? resolveDeployStatusLabel(target.currentStepStatus) : '-',
      renderCell: (target) =>
        target.currentStepStatus ? (
          <Badge variant={resolveTargetResultVariant(target.currentStepStatus)}>
            {resolveDeployStatusLabel(target.currentStepStatus)}
          </Badge>
        ) : (
          '-'
        ),
    },
    {
      key: 'errorSummary',
      header: t('deploy.monitor.colErrorSummary'),
      maxWidth: '17.5rem',
      accessor: (target) => target.lastErrorMessage || target.lastErrorCode || '-',
      renderCell: (target) => (
        <span className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {target.lastErrorMessage || target.lastErrorCode || '-'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      width: '8rem',
      header: t('deploy.monitor.colUpdatedAt'),
      accessor: (target) => formatDateTime(target.updatedAt),
      // 날짜 문자열이 한 줄로 펼쳐지지 않게 고정 폭 안에서 줄바꿈.
      renderCell: (target) => (
        <span className="block min-w-0 whitespace-normal break-words text-xs text-muted-foreground">
          {formatDateTime(target.updatedAt)}
        </span>
      ),
    },
  ]

  return (
    <Dialog
      open={deployKey !== null && historyItem !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      {historyItem ? (
        <DialogContent className="max-h-[85vh] max-w-300 overflow-hidden rounded-2xl p-0">
          <div className="flex max-h-[85vh] flex-col">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-foreground">
                <span>Deploy View</span>
                <span className="text-sm font-medium text-muted-foreground">#{historyItem.deployKey}</span>
                <Badge variant={resolveStatusVariant(historyItem.deployStatus)}>
                  {historyItem.deployStatus}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t('deploy.monitor.viewDialogDesc')}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{t('deploy.monitor.targetProgressTitle')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('deploy.monitor.targetProgressCount', {
                      total: targets.length,
                      failed: failureTargets.length,
                    })}
                  </p>
                </div>

                {isLoading ? (
                  <div className="mt-3 rounded-2xl border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
                    {t('deploy.monitor.targetProgressLoading')}
                  </div>
                ) : targets.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
                    {t('deploy.monitor.targetProgressEmpty')}
                  </div>
                ) : (
                  <SelectableTable<DeployTargetItem>
                    testId="deploy-monitor-target-progress-table"
                    columns={targetColumns}
                    rows={targets}
                    rowKey={(target) => target.deployTargetKey}
                    containerClassName="mt-3 rounded-2xl border border-border bg-card"
                    // 기본 min-w-max 는 8개 컬럼을 한 줄로 편 폭을 테이블 최소너비로 강제해 모달(overflow-hidden) 밖으로
                    // 밀어낸다 → min-w-full 로 덮어, 컬럼 width + 긴 컬럼 줄바꿈이 모달 폭 안에서 동작하게 한다.
                    tableClassName="min-w-full"
                  />
                )}
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-border bg-muted p-4">
                  <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">{t('deploy.overview.summaryTitle')}</p>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>{t('deploy.monitor.summaryTotal', { count: historyItem.targetSummary.total })}</p>
                    <p>{t('deploy.monitor.summaryCompleted', { count: historyItem.targetSummary.completed })}</p>
                    <p>{t('deploy.monitor.summaryFailed', { count: historyItem.targetSummary.failed })}</p>
                    <p>{t('deploy.monitor.summaryCompensationFailed', { count: historyItem.targetSummary.compensationFailed })}</p>
                  </div>
                  {historyItem.selectedModelName || historyItem.selectedModelVersion ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t('deploy.monitor.lineModel', {
                        name: historyItem.selectedModelName ?? '-',
                        version: historyItem.selectedModelVersion ?? '-',
                      })}
                    </p>
                  ) : null}
                  {historyItem.selectedBusinessJarName ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Business JAR: {historyItem.selectedBusinessJarName}
                    </p>
                  ) : null}
                  {resultTitle || summaryQuery.data?.resultCode || resultMessage ? (
                    <div className="mt-3 rounded-xl border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
                      {resultTitle ? (
                        <p className="font-semibold text-foreground">{resultTitle}</p>
                      ) : null}
                      {summaryQuery.data?.resultCode ? (
                        <p className="mt-1">{t('deploy.monitor.resultCode', { code: summaryQuery.data.resultCode })}</p>
                      ) : null}
                      {resultMessage ? (
                        <p className="mt-1 whitespace-pre-wrap break-words">{resultMessage}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border bg-muted p-4">
                  <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground">{t('deploy.monitor.colTask')}</p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {t(taskTypeLabelKey)}
                  </p>
                  <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                    <div>
                      <p className="font-semibold text-foreground">AS-IS</p>
                      <div className="mt-1 space-y-1">
                        {asIsLines.length > 0 ? (
                          asIsLines.map((line) => <p key={line}>{line}</p>)
                        ) : (
                          <>
                            <p>{t('deploy.monitor.asIsUnavailable')}</p>
                            <p>{t('deploy.monitor.asIsNoSnapshot')}</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">TO-BE</p>
                      <div className="mt-1 space-y-1">
                        {toBeLines.length > 0 ? (
                          toBeLines.map((line) => <p key={line}>{line}</p>)
                        ) : (
                          <p>{t('deploy.monitor.toBeEmpty')}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 border-t border-border pt-3">
                      <p>{t('deploy.monitor.taskName', { name: historyItem.deployName })}</p>
                      <p>{t('deploy.monitor.scenarioCode', { code: summaryQuery.data?.resolvedScenarioCode ?? '-' })}</p>
                      {scenario?.summary ? <p>{t('deploy.monitor.scenarioSummary', { summary: scenario.summary })}</p> : null}
                      <p>{t('deploy.monitor.requestedByDetail', { user: historyItem.requestedBy })}</p>
                      <p>{t('deploy.monitor.createdAtDetail', { time: formatDateTime(historyItem.createdAt) })}</p>
                      <p>{t('deploy.monitor.startedAtDetail', { time: formatDateTime(historyItem.startedAt) })}</p>
                      <p>{t('deploy.monitor.finishedAtDetail', { time: formatDateTime(historyItem.finishedAt) })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="mt-4 rounded-2xl border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
                  {t('deploy.monitor.detailLoading')}
                </div>
              ) : null}
              {summaryErrorMessage ? (
                <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {summaryErrorMessage}
                </div>
              ) : null}
              {targetsErrorMessage ? (
                <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                  {targetsErrorMessage}
                </div>
              ) : null}

            </div>

            <DialogFooter className="border-t border-border px-6 py-4">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.close')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
