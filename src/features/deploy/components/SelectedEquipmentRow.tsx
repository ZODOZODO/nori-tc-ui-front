import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableCell, TableRow } from '@/components/ui/table'
import { useDeployEqpParamVersions } from '../hooks/useDeployEqpParamVersions'
import { EMPTY_SELECT_VALUE, formatActiveDeployHint, getErrorMessage } from '../lib/deploy-register-utils'
import type { DeployRegisterTargetItem } from '../types/deploy.types'

interface SelectedEquipmentRowProps {
  item: DeployRegisterTargetItem
  selectedEqpParamVersion?: string
  onChangeEqpParamVersion: (eqpId: string, eqpParamVersion: string) => void
  onRemove: (eqpId: string) => void
}

export function SelectedEquipmentRow({
  item,
  selectedEqpParamVersion,
  onChangeEqpParamVersion,
  onRemove,
}: SelectedEquipmentRowProps) {
  const paramVersionsQuery = useDeployEqpParamVersions(item.eqpId)

  const paramVersionOptions = useMemo(() => {
    const apiVersions = paramVersionsQuery.data ?? []
    const versionSet = new Set<string>(apiVersions)

    // 현재 선택된 버전이 API 목록에 없더라도 드롭다운에 유지합니다.
    if (selectedEqpParamVersion && !versionSet.has(selectedEqpParamVersion)) {
      versionSet.add(selectedEqpParamVersion)
    }

    // API 순서(백엔드 정렬: createdAt 최신순)를 유지합니다.
    return apiVersions.filter(v => versionSet.has(v)).concat(
      selectedEqpParamVersion && !paramVersionsQuery.data?.includes(selectedEqpParamVersion)
        ? [selectedEqpParamVersion]
        : []
    )
  }, [paramVersionsQuery.data, selectedEqpParamVersion])

  const apiVersionSet = new Set(paramVersionsQuery.data ?? [])
  const resolvedParamVersionValue =
    selectedEqpParamVersion ?? (item.appliedParamVersion && apiVersionSet.has(item.appliedParamVersion) ? item.appliedParamVersion : null) ?? EMPTY_SELECT_VALUE

  return (
      <TableRow>
        <TableCell>
          <div className="flex flex-wrap items-center gap-2">
            <span>{item.eqpId}</span>
            {item.blockedByActiveDeploy ? (
              <Badge variant="warning">
                {item.activeDeployStatus ? `ACTIVE ${item.activeDeployStatus}` : 'ACTIVE'}
              </Badge>
            ) : null}
          </div>
          {item.blockedByActiveDeploy ? (
            <p className="mt-1 text-xs text-[#A66518]">
              {formatActiveDeployHint(item) ?? '이미 active Deploy에 포함된 설비입니다.'}
            </p>
          ) : null}
        </TableCell>
        <TableCell>{item.modelName ?? '-'}</TableCell>
        <TableCell>{item.modelVersion ?? '-'}</TableCell>
        <TableCell>{item.businessJarFileName ?? '-'}</TableCell>
      <TableCell>{item.commInterface}</TableCell>
      <TableCell>
        <Select
          value={resolvedParamVersionValue}
          onValueChange={(value) => {
            if (value !== EMPTY_SELECT_VALUE) {
              onChangeEqpParamVersion(item.eqpId, value)
            }
          }}
        >
          <SelectTrigger className="h-9 min-w-[160px]">
            <SelectValue placeholder="Eqp Param Version 선택" />
          </SelectTrigger>
          <SelectContent>
            {paramVersionOptions.length === 0 ? (
              <SelectItem value={EMPTY_SELECT_VALUE} disabled>
                {paramVersionsQuery.isLoading ? '버전 조회 중...' : '사용 가능한 버전이 없습니다.'}
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
          <p className="mt-1 text-xs text-[#C5534B]">
            {getErrorMessage(
              paramVersionsQuery.error,
              '설비 파라미터 버전 목록을 조회하지 못했습니다.',
            )}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-lg text-[#6A7971] hover:bg-[#F3F7F5] hover:text-[#C5534B]"
          onClick={() => onRemove(item.eqpId)}
          aria-label={`${item.eqpId} 삭제`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
