import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TableRow } from '@/components/ui/table'
import { useI18n } from '@/i18n/i18n-context'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { formatChangeKinds } from '../lib/deploy-register-utils'
import type { DeployRegisterScenarioPreviewResult } from '../types/deploy.types'

type ScenarioRow = DeployRegisterScenarioPreviewResult['scenarios'][number]

interface DeployRegisterScenarioModalProps {
  open: boolean
  preview: DeployRegisterScenarioPreviewResult | null
  selectedScenarioCode: string
  isDeploying: boolean
  onSelectScenarioCode: (scenarioCode: string) => void
  onDeploy: () => void
  onClose: () => void
}

export function DeployRegisterScenarioModal({
  open,
  preview,
  selectedScenarioCode,
  isDeploying,
  onSelectScenarioCode,
  onDeploy,
  onClose,
}: DeployRegisterScenarioModalProps) {
  const { t } = useI18n()

  const scenarioColumns: ColumnDef<ScenarioRow>[] = [
    {
      key: 'select',
      width: '4rem',
      header: <div className="flex justify-center">{t('deploy.register.colSelect')}</div>,
      accessor: () => '',
      renderCell: (scenario) => (
        <div className="flex w-full justify-center">
          <input
            type="radio"
            name="deploy-register-scenario"
            checked={scenario.code === selectedScenarioCode}
            onChange={() => onSelectScenarioCode(scenario.code)}
            className="size-4 accent-brand-primary"
            aria-label={t('deploy.register.scenarioSelectAria', { code: scenario.code })}
          />
        </div>
      ),
    },
    {
      key: 'recommended',
      width: '5rem',
      header: <div className="flex justify-center">{t('deploy.register.colRecommended')}</div>,
      accessor: (scenario) => (scenario.recommended ? t('deploy.register.colRecommended') : '-'),
      renderCell: (scenario) => (
        <div className="flex w-full justify-center">
          {scenario.recommended ? (
            <span className="rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-brand-primary">
              {t('deploy.register.colRecommended')}
            </span>
          ) : (
            '-'
          )}
        </div>
      ),
    },
    {
      key: 'scenarioName',
      width: '11rem',
      header: t('deploy.register.colScenarioName'),
      accessor: (scenario) => scenario.name,
      // 긴 시나리오명(예: 'Model + Business Jar + Eqp Param 변경')이 한 줄로 펼쳐져 테이블을 넓히지 않게 줄바꿈.
      renderCell: (scenario) => (
        <span className="block min-w-0 whitespace-normal break-words font-medium text-foreground">{scenario.name}</span>
      ),
    },
    {
      key: 'code',
      width: '12rem',
      header: t('deploy.register.colCode'),
      accessor: (scenario) => scenario.code,
      // 긴 코드(예: 'REGISTER_MODEL_BUSINESS_JAR_EQP_PARAM')는 단어 경계가 없어 break-words 로 안 끊기므로 break-all.
      renderCell: (scenario) => (
        <span className="block min-w-0 whitespace-normal break-all text-xs text-muted-foreground">{scenario.code}</span>
      ),
    },
    {
      key: 'coversChanges',
      width: '9rem',
      header: t('deploy.register.colCoversChanges'),
      accessor: (scenario) => formatChangeKinds(scenario.coversChangeKinds),
      renderCell: (scenario) => (
        // 셀 기본이 whitespace-nowrap 이라 가변 길이 변경종류 나열이 한 줄로 펼쳐져 테이블을 넓힌다 →
        // 고정 폭 안에서 줄바꿈(normal/break-words)해 모달 폭을 넘지 않게 한다.
        <span className="block min-w-0 whitespace-normal break-words text-xs text-muted-foreground">
          {formatChangeKinds(scenario.coversChangeKinds)}
        </span>
      ),
    },
    {
      key: 'stepCount',
      width: '6rem',
      header: <div className="flex justify-center">{t('deploy.register.colStepCount')}</div>,
      accessor: (scenario) => String(scenario.stepCount),
      renderCell: (scenario) => (
        <div className="flex w-full justify-center text-sm text-muted-foreground">
          {scenario.stepCount}
        </div>
      ),
    },
    {
      key: 'description',
      width: '16rem',
      header: t('deploy.register.colDescription'),
      accessor: (scenario) => scenario.summary,
      renderCell: (scenario) => (
        // 요약+사유는 백엔드 가변 길이 문구 → 고정 폭 안에서 줄바꿈해 테이블이 모달을 넘지 않게 한다.
        <div className="min-w-0 whitespace-normal break-words text-xs text-muted-foreground">
          <p>{scenario.summary}</p>
          <p className="mt-1 text-muted-foreground">{scenario.reason}</p>
        </div>
      ),
    },
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-280 rounded-2xl p-0">
        <div className="border-b border-border px-6 py-5">
          <DialogHeader className="p-0">
            <DialogTitle>{t('deploy.register.scenarioDialogTitle')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('deploy.register.scenarioDialogDesc')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {preview ? (
            <>
              <div className="grid gap-3 rounded-xl bg-muted p-4 text-sm text-muted-foreground md:grid-cols-2">
                <div>
                  <p className="font-semibold text-foreground">{t('deploy.register.deployTarget')}</p>
                  <p className="mt-1">
                    {t('deploy.register.targetCountSummary', {
                      count: preview.remainingEqpIds.length,
                    })}
                    {preview.removedEqpIds.length > 0
                      ? t('deploy.register.targetExcludedSuffix', {
                          count: preview.removedEqpIds.length,
                        })
                      : ''}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{t('deploy.register.detectedChanges')}</p>
                  <p className="mt-1">
                    {formatChangeKinds(preview.unionChangeKinds)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <p className="font-semibold text-foreground">{t('deploy.register.recommendedScenario')}</p>
                  <p className="mt-1">
                    {preview.recommendedScenarioCode ??
                      t('deploy.register.noRecommendedScenario')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {preview.recommendedReason}
                  </p>
                </div>
              </div>

              {preview.scenarios.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
                  {t('deploy.register.noSelectableScenario')}
                </div>
              ) : (
                <SelectableTable<ScenarioRow>
                  testId="deploy-register-scenario-table"
                  columns={scenarioColumns}
                  rows={preview.scenarios}
                  rowKey={(scenario) => scenario.code}
                  wrapRow={(scenario, _rowIdx, children) => (
                    <TableRow
                      className={
                        scenario.code === selectedScenarioCode
                          ? 'bg-brand-primary/5'
                          : undefined
                      }
                    >
                      {children}
                    </TableRow>
                  )}
                  containerClassName="rounded-[14px] border border-border"
                  // 기본 min-w-max 는 모든 셀을 한 줄로 편 폭을 테이블 최소너비로 강제해 설명 컬럼 줄바꿈을
                  // 무력화한다 → min-w-full 로 덮어, 컬럼 width + whitespace-normal 이 모달 폭 안에서 줄바꿈되게 한다.
                  tableClassName="min-w-full"
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-border bg-muted py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              {t('deploy.register.preparingPreview')}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 rounded-xl border-border bg-card text-muted-foreground"
          >
            {t('common.close')}
          </Button>
          <Button
            type="button"
            onClick={onDeploy}
            disabled={isDeploying || !selectedScenarioCode}
            className="h-10 rounded-xl bg-primary px-5 text-primary-foreground hover:bg-primary/90"
          >
            {isDeploying
              ? t('deploy.register.deployingScenario')
              : t('deploy.register.deployWithScenario')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
