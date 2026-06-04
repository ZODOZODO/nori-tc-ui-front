import { useMemo, type ReactNode } from 'react'
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
import { SelectableTable, type ColumnDef } from '@/shared/components/SelectableTable'
import { useI18n } from '@/i18n/i18n-context'
import { MODEL_DETAIL_NODE_LABELS } from '../types/model.types'
import type { ModelDiffSection } from '../types/model.types'

interface ModelCheckInDiffModalProps {
  open: boolean
  /** 이전 버전 데이터를 로딩 중인지 여부 */
  isPending: boolean
  /** 노드별 diff 결과. 비어있으면 변경사항 없음 */
  diffSections: ModelDiffSection[]
  onOpenChange: (open: boolean) => void
  onCancel: () => void
  /** OK 버튼 클릭 시 호출. version/description 입력 모달로 이동합니다. */
  onOk: () => void
}

type CheckInDiffRowKind = 'added' | 'changed' | 'deleted'

/**
 * section 별 added/changed/deleted 를 한 배열로 정규화한 row 모델입니다.
 * SelectableTable 의 단일 rows prop 에 맞추기 위한 로컬 표현.
 */
interface NormalizedCheckInDiffRow {
  kind: CheckInDiffRowKind
  identity: string
  branchValues: string[]
  parentValues: string[]
}

// 모듈 상수라 컴포넌트 밖에서 t() 불가 — i18n 키만 담고 렌더 시점 t(key) 로 번역.
const KIND_BADGE_LABEL_KEYS: Record<CheckInDiffRowKind, string> = {
  added: 'model.checkin.diffAdded',
  changed: 'model.checkin.diffChanged',
  deleted: 'model.checkin.diffDeleted',
}

const KIND_BADGE_CLASS: Record<CheckInDiffRowKind, string> = {
  added: 'bg-success/20 text-success',
  changed: 'bg-warning/20 text-warning',
  deleted: 'bg-danger/20 text-danger',
}

const KIND_ROW_CLASS: Record<CheckInDiffRowKind, string> = {
  added: 'bg-success/10 hover:bg-success/10',
  changed: 'bg-warning/10 hover:bg-warning/10',
  deleted: 'bg-danger/5 hover:bg-danger/5',
}

const normalizeSectionRows = (section: ModelDiffSection): NormalizedCheckInDiffRow[] => [
  ...section.added.map<NormalizedCheckInDiffRow>((item) => ({
    kind: 'added',
    identity: item.identity,
    branchValues: item.branchValues,
    parentValues: item.parentValues,
  })),
  ...section.changed.map<NormalizedCheckInDiffRow>((item) => ({
    kind: 'changed',
    identity: item.identity,
    branchValues: item.branchValues,
    parentValues: item.parentValues,
  })),
  ...section.deleted.map<NormalizedCheckInDiffRow>((item) => ({
    kind: 'deleted',
    identity: item.identity,
    branchValues: item.branchValues,
    parentValues: item.parentValues,
  })),
]

/**
 * 단일 section 의 SelectableTable 을 렌더링합니다. ColumnDef 는 inline useMemo —
 * section.columns 가 동적이라 다른 모달과 공유 불가 (Plan W-FAC1 = B inline 결정).
 */
function CheckInDiffSectionTable({ section }: { section: ModelDiffSection }) {
  const { t } = useI18n()
  const normalizedRows = useMemo(() => normalizeSectionRows(section), [section])
  const sectionColumns = section.columns

  const columns = useMemo<ColumnDef<NormalizedCheckInDiffRow>[]>(() => {
    const kindColumn: ColumnDef<NormalizedCheckInDiffRow> = {
      key: 'kind',
      header: t('model.checkin.diffKind'),
      width: '6rem',
      accessor: (row) => t(KIND_BADGE_LABEL_KEYS[row.kind]),
      renderCell: (row) => (
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${KIND_BADGE_CLASS[row.kind]}`}
        >
          {t(KIND_BADGE_LABEL_KEYS[row.kind])}
        </span>
      ),
    }

    const identityColumn: ColumnDef<NormalizedCheckInDiffRow> = {
      key: 'identity',
      header: t('model.checkin.diffIdentity'),
      width: '10rem',
      accessor: (row) => row.identity,
      renderCell: (row) => (
        <span
          className={
            row.kind === 'deleted'
              ? 'text-xs text-muted-foreground line-through'
              : 'text-xs text-foreground'
          }
        >
          {row.identity}
        </span>
      ),
    }

    const valueColumns: ColumnDef<NormalizedCheckInDiffRow>[] = sectionColumns.map(
      (columnName, columnIndex) => ({
        key: `${columnName}-${columnIndex}`,
        header: columnName,
        // accessor 는 truncate 전 full string — TSV copy 는 디스플레이 축약과 분리 (Plan W-DIFF-TRUNCATE)
        accessor: (row) => {
          if (row.kind === 'deleted') {
            return row.parentValues[columnIndex] ?? ''
          }
          return row.branchValues[columnIndex] ?? ''
        },
        renderCell: (row) => {
          if (row.kind === 'added') {
            const value = row.branchValues[columnIndex] ?? ''
            return (
              <span className="text-xs text-foreground">
                <DiffCellValue value={value} />
              </span>
            )
          }
          if (row.kind === 'deleted') {
            const value = row.parentValues[columnIndex] ?? ''
            return (
              <span className="text-xs text-muted-foreground line-through">
                <DiffCellValue value={value} />
              </span>
            )
          }
          const current = row.branchValues[columnIndex] ?? ''
          const previous = row.parentValues[columnIndex] ?? ''
          const isChanged = current !== previous
          if (!isChanged) {
            return (
              <span className="text-xs text-foreground">
                <DiffCellValue value={current} />
              </span>
            )
          }
          return (
            <div className="space-y-1 text-xs">
              <div className="text-muted-foreground line-through">
                <DiffCellValue value={previous} />
              </div>
              <div className="text-success font-medium">
                <DiffCellValue value={current} />
              </div>
            </div>
          )
        },
      }),
    )

    return [kindColumn, identityColumn, ...valueColumns]
  }, [sectionColumns, t])

  const wrapRow = (
    row: NormalizedCheckInDiffRow,
    _rowIdx: number,
    children: ReactNode,
  ): ReactNode => (
    <TableRow
      data-testid={`check-in-diff-row-${row.kind}-${row.identity}`}
      className={KIND_ROW_CLASS[row.kind]}
    >
      {children}
    </TableRow>
  )

  return (
    <SelectableTable<NormalizedCheckInDiffRow>
      testId={`selectable-table-check-in-diff-${section.detailNode}`}
      columns={columns}
      rows={normalizedRows}
      rowKey={(row) => `${row.kind}-${row.identity}`}
      features={{ rangeCopy: true }}
      tableClassName="min-w-max"
      wrapRow={wrapRow}
    />
  )
}

/**
 * Check In 전 현재 편집 데이터와 이전 버전 데이터의 차이를 보여주는 모달입니다.
 *
 * - branchValues: 현재 편집(EDIT) 버전의 값
 * - parentValues: 이전 저장 버전의 값
 * - OK: version/description 입력 모달로 이동
 * - Cancel: 모달 닫기
 */
export function ModelCheckInDiffModal({
  open,
  isPending,
  diffSections,
  onOpenChange,
  onCancel,
  onOk,
}: ModelCheckInDiffModalProps) {
  const { t } = useI18n()
  const hasDiff = diffSections.some(
    (section) => section.added.length > 0 || section.changed.length > 0 || section.deleted.length > 0,
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) {
          return
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="z-[60] max-w-4xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t('model.checkin.diffTitle')}</DialogTitle>
          <DialogDescription>
            {t('model.checkin.diffDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t('model.checkin.diffLoading')}
            </div>
          ) : !hasDiff ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t('model.checkin.diffEmpty')}
            </p>
          ) : (
            diffSections.map((section) => {
              const hasItems =
                section.added.length > 0 || section.changed.length > 0 || section.deleted.length > 0
              if (!hasItems) {
                return null
              }

              // 노드 레이블: 정의된 것은 번역된 이름을, 아니면 원본 사용
              const nodeLabel =
                MODEL_DETAIL_NODE_LABELS[section.detailNode as keyof typeof MODEL_DETAIL_NODE_LABELS] ??
                section.detailNode

              return (
                <div key={section.detailNode} className="rounded-2xl border border-border overflow-hidden">
                  <div className="bg-muted px-4 py-2.5">
                    <span className="text-sm font-semibold text-foreground">{nodeLabel}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t('model.checkin.diffCounts', {
                        added: section.added.length,
                        changed: section.changed.length,
                        deleted: section.deleted.length,
                      })}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <CheckInDiffSectionTable section={section} />
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full border-border px-4 text-xs font-semibold"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={onOk}
            disabled={isPending}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * diff 셀에서 긴 값을 truncate하여 표시합니다.
 * JSON 등 긴 문자열은 앞 100자만 표시하고 말줄임표를 붙입니다.
 */
function DiffCellValue({ value }: { value: string }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>
  }
  const MAX_LENGTH = 100
  if (value.length <= MAX_LENGTH) {
    return <span>{value}</span>
  }
  return (
    <span title={value}>
      {value.slice(0, MAX_LENGTH)}
      <span className="text-muted-foreground">…</span>
    </span>
  )
}
