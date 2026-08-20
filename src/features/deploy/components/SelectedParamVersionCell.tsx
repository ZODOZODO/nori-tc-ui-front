import { useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/i18n/i18n-context'
import { useDeployEqpParamVersions } from '../hooks/useDeployEqpParamVersions'
import { EMPTY_SELECT_VALUE } from '../lib/deploy-register-utils'
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message'
import type { DeployRegisterTargetItem } from '../types/deploy.types'

interface SelectedParamVersionCellProps {
  item: DeployRegisterTargetItem
  selectedEqpParamVersion?: string
  onChangeEqpParamVersion: (eqpId: string, eqpParamVersion: string) => void
}

/**
 * 선택된 설비 테이블의 "Eqp Param Version" 셀 — 설비별 param version 목록을 개별 조회(useDeployEqpParamVersions)
 * 해야 하므로 행 단위 훅을 쓰는 셀 컴포넌트로 분리한다. SelectableTable 의 renderCell 에서 이 컴포넌트를
 * 렌더하면 훅은 컴포넌트 내부에서 호출되어 Rules of Hooks 를 지킨다.
 */
export function SelectedParamVersionCell({
  item,
  selectedEqpParamVersion,
  onChangeEqpParamVersion,
}: SelectedParamVersionCellProps) {
  const { t } = useI18n()
  const paramVersionsQuery = useDeployEqpParamVersions(item.eqpId)

  const paramVersionOptions = useMemo(() => {
    const apiVersions = paramVersionsQuery.data ?? []
    const versionSet = new Set<string>(apiVersions)

    // 현재 선택된 버전이 API 목록에 없더라도 드롭다운에 유지합니다.
    if (selectedEqpParamVersion && !versionSet.has(selectedEqpParamVersion)) {
      versionSet.add(selectedEqpParamVersion)
    }

    // API 순서(백엔드 정렬: createdAt 최신순)를 유지합니다.
    return apiVersions.filter((v) => versionSet.has(v)).concat(
      selectedEqpParamVersion && !paramVersionsQuery.data?.includes(selectedEqpParamVersion)
        ? [selectedEqpParamVersion]
        : [],
    )
  }, [paramVersionsQuery.data, selectedEqpParamVersion])

  const apiVersionSet = new Set(paramVersionsQuery.data ?? [])
  const resolvedParamVersionValue =
    selectedEqpParamVersion ??
    (item.appliedParamVersion && apiVersionSet.has(item.appliedParamVersion)
      ? item.appliedParamVersion
      : null) ??
    EMPTY_SELECT_VALUE

  return (
    <div>
      <Select
        value={resolvedParamVersionValue}
        onValueChange={(value) => {
          if (value !== EMPTY_SELECT_VALUE) {
            onChangeEqpParamVersion(item.eqpId, value)
          }
        }}
      >
        <SelectTrigger className="h-9 min-w-40">
          <SelectValue placeholder={t('deploy.register.paramVersionPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {paramVersionOptions.length === 0 ? (
            <SelectItem value={EMPTY_SELECT_VALUE} disabled>
              {paramVersionsQuery.isLoading
                ? t('deploy.register.paramVersionLoading')
                : t('deploy.register.paramVersionEmpty')}
            </SelectItem>
          ) : (
            paramVersionOptions.map((version) => (
              <SelectItem key={`${item.eqpId}-${version}`} value={version}>
                {version}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {paramVersionsQuery.isError ? (
        <p className="mt-1 text-xs text-danger">
          {resolveErrorMessage(paramVersionsQuery.error, t('error.deploy.eqpParamVersions'))}
        </p>
      ) : null}
    </div>
  )
}
