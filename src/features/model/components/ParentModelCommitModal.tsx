import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { TableRow } from '@/components/ui/table'
import { SelectableTable, type ColumnDef } from '@/shared/components/SelectableTable'
import { useI18n } from '@/i18n/i18n-context'
import {
  MODEL_DETAIL_NODE_LABELS,
  type ModelDiffItem,
  type ModelDiffSection,
  type ModelInfo,
  type ModelParentCommitResult,
} from '../types/model.types'
import { createNextDailyModelVersion } from '../lib/model-version'

interface ParentModelCommitModalProps {
  open: boolean
  branchModel: ModelInfo | null
  parentVersions: ModelInfo[]
  previewResult: ModelParentCommitResult | null
  isPreviewLoading: boolean
  isCommitPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onCommit: (request: { newParentVersion: string }) => void | Promise<void>
}

type DiffTableMode = 'added' | 'changed' | 'deleted'

interface DiffTableProps {
  title: string
  mode: DiffTableMode
  columns: string[]
  items: ModelDiffItem[]
  hiddenColumns?: readonly string[]
}

/**
 * detail node 라벨을 사람이 읽을 수 있는 제목으로 변환합니다.
 */
const resolveSectionLabel = (section: ModelDiffSection): string =>
  MODEL_DETAIL_NODE_LABELS[section.detailNode as keyof typeof MODEL_DETAIL_NODE_LABELS] ??
  section.detailNode

/**
 * diff 테이블 컬럼명을 mode에 맞게 생성합니다.
 */
const normalizeColumnName = (columnName: string): string => columnName.trim().toLowerCase()

const resolveVisibleColumnIndexes = (
  columns: string[],
  hiddenColumns: readonly string[],
): number[] => {
  const normalizedColumns = columns.length > 0 ? columns : ['Value']
  const hiddenColumnSet = new Set(hiddenColumns.map(normalizeColumnName))

  return normalizedColumns.flatMap((columnName, index) =>
    hiddenColumnSet.has(normalizeColumnName(columnName)) ? [] : [index],
  )
}

const resolveDiffTableColumns = (
  columns: string[],
  mode: DiffTableMode,
  visibleColumnIndexes: number[],
  itemLabel: string,
): string[] => {
  const normalizedColumns = columns.length > 0 ? columns : ['Value']
  const visibleColumns = visibleColumnIndexes.map((index) => normalizedColumns[index] ?? 'Value')

  if (mode === 'changed') {
    return [
      itemLabel,
      ...visibleColumns.map((columnName) => `Parent ${columnName}`),
      ...visibleColumns.map((columnName) => `Branch ${columnName}`),
    ]
  }

  return [itemLabel, ...visibleColumns]
}

/**
 * diff 항목을 테이블 행 문자열 집합으로 정규화합니다.
 */
const resolveDiffTableRows = (
  items: ModelDiffItem[],
  mode: DiffTableMode,
  visibleColumnIndexes: number[],
): string[][] =>
  items.map((item) => {
    const parentValues = visibleColumnIndexes.map((index) => item.parentValues[index] ?? '')
    const branchValues = visibleColumnIndexes.map((index) => item.branchValues[index] ?? '')

    if (mode === 'added') {
      return [item.identity, ...branchValues]
    }

    if (mode === 'deleted') {
      return [item.identity, ...parentValues]
    }

    return [item.identity, ...parentValues, ...branchValues]
  })

const resolveDiffTableTone = (
  mode: DiffTableMode,
): {
  badgeClassName: string
  rowClassName: string
  valueClassName: string
} => {
  if (mode === 'added') {
    return {
      badgeClassName: 'bg-success/20 text-success',
      rowClassName: 'bg-success/10 hover:bg-success/10',
      valueClassName: 'text-foreground',
    }
  }

  if (mode === 'changed') {
    return {
      badgeClassName: 'bg-warning/20 text-warning',
      rowClassName: 'bg-warning/10 hover:bg-warning/10',
      valueClassName: 'text-foreground',
    }
  }

  return {
    badgeClassName: 'bg-danger/20 text-danger',
    rowClassName: 'bg-danger/5 hover:bg-danger/5',
    valueClassName: 'text-muted-foreground line-through',
  }
}

/**
 * diff 테이블 단일 블록입니다.
 */
function DiffTable({ title, mode, columns, items, hiddenColumns = [] }: DiffTableProps) {
  const { t } = useI18n()
  const visibleColumnIndexes = useMemo(
    () => resolveVisibleColumnIndexes(columns, hiddenColumns),
    [columns, hiddenColumns],
  )
  const tableColumns = useMemo(
    () => resolveDiffTableColumns(columns, mode, visibleColumnIndexes, t('model.parent.diffItem')),
    [columns, mode, visibleColumnIndexes, t],
  )
  const tableRows = useMemo(
    () => resolveDiffTableRows(items, mode, visibleColumnIndexes),
    [items, mode, visibleColumnIndexes],
  )
  const tone = useMemo(() => resolveDiffTableTone(mode), [mode])
  const diffValueColumnCount = visibleColumnIndexes.length

  // changed 모드는 columnIndex 위치별로 셀 className 이 달라진다 (0='항목' default,
  // 1..diffValueColumnCount=Parent strikethrough, diffValueColumnCount+1..=Branch green).
  // added/deleted 는 tone.valueClassName 단일.
  const selectableColumns = useMemo<ColumnDef<string[]>[]>(
    () =>
      tableColumns.map((columnName, columnIndex) => ({
        key: `${columnName}-${columnIndex}`,
        header: columnName,
        accessor: (row) => row[columnIndex] ?? '',
        renderCell: (row) => {
          const value = row[columnIndex] || '—'
          const cellClassName =
            mode !== 'changed'
              ? tone.valueClassName
              : columnIndex > diffValueColumnCount
                ? 'font-medium text-success'
                : columnIndex > 0
                  ? 'text-muted-foreground line-through'
                  : 'text-foreground'
          return <span className={cellClassName}>{value}</span>
        },
      })),
    [tableColumns, mode, tone.valueClassName, diffValueColumnCount],
  )

  if (items.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <Badge variant="secondary" className={tone.badgeClassName}>
            {t('model.parent.itemCount', { count: items.length })}
          </Badge>
        </div>
      </div>

      <div className="overflow-auto">
        <SelectableTable<string[]>
          testId={`parent-commit-diff-table-${mode}`}
          columns={selectableColumns}
          rows={tableRows}
          rowKey={(_row, rowIndex) => `${title}-${rowIndex}`}
          features={{ rangeCopy: true }}
          tableClassName="min-w-180"
          wrapRow={(_row, rowIdx, children) => (
            <TableRow
              data-testid={`parent-commit-diff-row-${mode}-${rowIdx}`}
              className={tone.rowClassName}
            >
              {children}
            </TableRow>
          )}
        />
      </div>
    </div>
  )
}

/**
 * branch → parent commit diff를 보여주고 새 parent version 입력을 받는 모달입니다.
 */
export function ParentModelCommitModal({
  open,
  branchModel,
  parentVersions,
  previewResult,
  isPreviewLoading,
  isCommitPending,
  errorMessage,
  onOpenChange,
  onCommit,
}: ParentModelCommitModalProps) {
  const { t } = useI18n()
  const defaultNewParentVersion = useMemo(() => {
    const parentModelName = previewResult?.parentModelName ?? branchModel?.parentModel ?? ''
    return createNextDailyModelVersion(parentModelName, parentVersions)
  }, [branchModel?.parentModel, parentVersions, previewResult?.parentModelName])
  const [newParentVersion, setNewParentVersion] = useState(defaultNewParentVersion)
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)

  const hasDiffItems = useMemo(
    () =>
      (previewResult?.sections ?? []).some(
        (section) =>
          section.added.length > 0 || section.changed.length > 0 || section.deleted.length > 0,
      ),
    [previewResult?.sections],
  )

  const handleCommit = async () => {
    const normalizedNewParentVersion = newParentVersion.trim()
    if (!normalizedNewParentVersion) {
      setFormErrorMessage(t('model.parent.versionRequired'))
      return
    }

    setFormErrorMessage(null)
    await onCommit({ newParentVersion: normalizedNewParentVersion })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPreviewLoading && !isCommitPending) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent className="!left-4 !right-4 !top-4 !bottom-4 !w-auto !max-w-none !translate-x-0 !translate-y-0 overflow-hidden p-0">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>Parent Model Commit</DialogTitle>
            <DialogDescription>
              {t('model.parent.desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <section className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted px-3 py-3">
                <p className="text-[11px] font-semibold text-muted-foreground">Branch Model</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {previewResult?.branchModelName ?? branchModel?.modelName ?? '-'}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted px-3 py-3">
                <p className="text-[11px] font-semibold text-muted-foreground">Branch Latest Version</p>
                <p className="mt-1 text-sm text-foreground">
                  {previewResult?.branchLatestVersion ?? branchModel?.modelVersion ?? '-'}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted px-3 py-3">
                <p className="text-[11px] font-semibold text-muted-foreground">Parent Model</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {previewResult?.parentModelName ?? branchModel?.parentModel ?? '-'}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted px-3 py-3">
                <p className="text-[11px] font-semibold text-muted-foreground">Parent Latest Version</p>
                <p className="mt-1 text-sm text-foreground">
                  {previewResult?.parentLatestVersion ?? '-'}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-muted p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-foreground">{t('model.parent.newVersionLabel')}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('model.parent.newVersionHint')}
                </p>
              </div>

              <div className="max-w-80">
                <Input
                  value={newParentVersion}
                  onChange={(event) => setNewParentVersion(event.target.value)}
                  placeholder={defaultNewParentVersion}
                />
              </div>
            </section>

            {formErrorMessage ? (
              <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {formErrorMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {errorMessage}
              </p>
            ) : null}

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Diff Preview</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('model.parent.reviewHint')}
                  </p>
                </div>
                {isPreviewLoading ? (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    {t('model.parent.diffCalculating')}
                  </span>
                ) : null}
              </div>

              {!isPreviewLoading && !errorMessage && !hasDiffItems ? (
                <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                  {t('model.parent.diffEmpty')}
                </div>
              ) : null}

              {(previewResult?.sections ?? []).map((section) => {
                const hasSectionItems =
                  section.added.length > 0 ||
                  section.changed.length > 0 ||
                  section.deleted.length > 0

                if (!hasSectionItems) {
                  return null
                }

                const sectionLabel = resolveSectionLabel(section)
                const hiddenDiffColumns = section.detailNode === 'mdf' ? ['MDF Name'] : []

                return (
                  <section
                    key={`${section.detailNode}-${sectionLabel}`}
                    className="space-y-3 rounded-2xl border border-border bg-muted p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{sectionLabel}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Added {section.added.length} / Changed {section.changed.length} / Deleted{' '}
                          {section.deleted.length}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <DiffTable
                        title={t('model.parent.diffAddedTitle')}
                        mode="added"
                        columns={section.columns}
                        items={section.added}
                        hiddenColumns={hiddenDiffColumns}
                      />
                      <DiffTable
                        title={t('model.parent.diffChangedTitle')}
                        mode="changed"
                        columns={section.columns}
                        items={section.changed}
                        hiddenColumns={hiddenDiffColumns}
                      />
                      <DiffTable
                        title={t('model.parent.diffDeletedTitle')}
                        mode="deleted"
                        columns={section.columns}
                        items={section.deleted}
                        hiddenColumns={hiddenDiffColumns}
                      />
                    </div>
                  </section>
                )
              })}
            </section>
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPreviewLoading || isCommitPending}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleCommit()} disabled={isPreviewLoading || isCommitPending}>
              {isCommitPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Commit
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
