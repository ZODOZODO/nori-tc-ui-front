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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
): string[] => {
  const normalizedColumns = columns.length > 0 ? columns : ['Value']
  const visibleColumns = visibleColumnIndexes.map((index) => normalizedColumns[index] ?? 'Value')

  if (mode === 'changed') {
    return [
      '항목',
      ...visibleColumns.map((columnName) => `Parent ${columnName}`),
      ...visibleColumns.map((columnName) => `Branch ${columnName}`),
    ]
  }

  return ['항목', ...visibleColumns]
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
      badgeClassName: 'bg-[#D1F5E7] text-[#1C7F59]',
      rowClassName: 'bg-[#F0FFF7] hover:bg-[#F0FFF7]',
      valueClassName: 'text-[#22322B]',
    }
  }

  if (mode === 'changed') {
    return {
      badgeClassName: 'bg-[#FFF0C0] text-[#7A5800]',
      rowClassName: 'bg-[#FFFDF0] hover:bg-[#FFFDF0]',
      valueClassName: 'text-[#22322B]',
    }
  }

  return {
    badgeClassName: 'bg-[#FAD9D7] text-[#B4483F]',
    rowClassName: 'bg-[#FFF7F7] hover:bg-[#FFF7F7]',
    valueClassName: 'text-[#97A39C] line-through',
  }
}

/**
 * diff 테이블 단일 블록입니다.
 */
function DiffTable({ title, mode, columns, items, hiddenColumns = [] }: DiffTableProps) {
  if (items.length === 0) {
    return null
  }

  const visibleColumnIndexes = resolveVisibleColumnIndexes(columns, hiddenColumns)
  const tableColumns = resolveDiffTableColumns(columns, mode, visibleColumnIndexes)
  const tableRows = resolveDiffTableRows(items, mode, visibleColumnIndexes)
  const tone = resolveDiffTableTone(mode)
  const diffValueColumnCount = visibleColumnIndexes.length

  return (
    <div className="rounded-xl border border-[#E4EAE6] bg-white">
      <div className="border-b border-[#EEF3F0] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#22322B]">{title}</p>
          <Badge variant="secondary" className={tone.badgeClassName}>
            {items.length}건
          </Badge>
        </div>
      </div>

      <div className="overflow-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="bg-[#F6F9F7]">
              {tableColumns.map((columnName) => (
                <TableHead key={`${title}-${columnName}`}>{columnName}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((row, rowIndex) => (
              <TableRow key={`${title}-${rowIndex}`} className={tone.rowClassName}>
                {tableColumns.map((_, columnIndex) => (
                  <TableCell
                    key={`${title}-${rowIndex}-${columnIndex}`}
                    className={
                      mode !== 'changed'
                        ? tone.valueClassName
                        : columnIndex > diffValueColumnCount
                          ? 'font-medium text-[#1C7F59]'
                          : columnIndex > 0
                            ? 'text-[#97A39C] line-through'
                            : 'text-[#22322B]'
                    }
                  >
                    {row[columnIndex] || '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
      setFormErrorMessage('새 parent version을 입력해 주세요.')
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
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="border-b border-[#EEF3F0] px-6 py-5">
            <DialogTitle>Parent Model Commit</DialogTitle>
            <DialogDescription>
              branch 최신 버전과 parent 최신 버전의 diff를 검토한 뒤 parent 새 버전을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <section className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
              <div className="rounded-xl border border-[#E4EAE6] bg-[#FAFCFB] px-3 py-3">
                <p className="text-[11px] font-semibold text-[#738078]">Branch Model</p>
                <p className="mt-1 text-sm font-semibold text-[#22322B]">
                  {previewResult?.branchModelName ?? branchModel?.modelName ?? '-'}
                </p>
              </div>
              <div className="rounded-xl border border-[#E4EAE6] bg-[#FAFCFB] px-3 py-3">
                <p className="text-[11px] font-semibold text-[#738078]">Branch Latest Version</p>
                <p className="mt-1 text-sm text-[#22322B]">
                  {previewResult?.branchLatestVersion ?? branchModel?.modelVersion ?? '-'}
                </p>
              </div>
              <div className="rounded-xl border border-[#E4EAE6] bg-[#FAFCFB] px-3 py-3">
                <p className="text-[11px] font-semibold text-[#738078]">Parent Model</p>
                <p className="mt-1 text-sm font-semibold text-[#22322B]">
                  {previewResult?.parentModelName ?? branchModel?.parentModel ?? '-'}
                </p>
              </div>
              <div className="rounded-xl border border-[#E4EAE6] bg-[#FAFCFB] px-3 py-3">
                <p className="text-[11px] font-semibold text-[#738078]">Parent Latest Version</p>
                <p className="mt-1 text-sm text-[#22322B]">
                  {previewResult?.parentLatestVersion ?? '-'}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-[#E4EAE6] bg-[#FAFCFB] p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-[#1F2D26]">새 Parent Version</h3>
                <p className="mt-1 text-xs text-[#65726B]">
                  Commit 완료 시 parent 새 version이 생성되고 branch 모든 version status는 DEPRECATED로 전환됩니다.
                </p>
              </div>

              <div className="max-w-[320px]">
                <Input
                  value={newParentVersion}
                  onChange={(event) => setNewParentVersion(event.target.value)}
                  placeholder={defaultNewParentVersion}
                />
              </div>
            </section>

            {formErrorMessage ? (
              <p className="rounded-xl border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
                {formErrorMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-xl border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
                {errorMessage}
              </p>
            ) : null}

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#1F2D26]">Diff Preview</h3>
                  <p className="mt-1 text-xs text-[#65726B]">
                    추가, 변경, 삭제 항목을 모두 검토한 뒤 commit 하십시오.
                  </p>
                </div>
                {isPreviewLoading ? (
                  <span className="inline-flex items-center gap-2 text-xs text-[#65726B]">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    diff를 계산하는 중입니다.
                  </span>
                ) : null}
              </div>

              {!isPreviewLoading && !errorMessage && !hasDiffItems ? (
                <div className="rounded-2xl border border-dashed border-[#D6E0DA] bg-white px-4 py-6 text-sm text-[#65726B]">
                  표시할 diff가 없습니다. 그래도 새 parent version을 생성하려면 Commit을 진행할 수 있습니다.
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
                    className="space-y-3 rounded-2xl border border-[#E4EAE6] bg-[#FAFCFB] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-[#1F2D26]">{sectionLabel}</h4>
                        <p className="mt-1 text-xs text-[#65726B]">
                          Added {section.added.length} / Changed {section.changed.length} / Deleted{' '}
                          {section.deleted.length}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <DiffTable
                        title="추가 항목"
                        mode="added"
                        columns={section.columns}
                        items={section.added}
                        hiddenColumns={hiddenDiffColumns}
                      />
                      <DiffTable
                        title="변경 항목"
                        mode="changed"
                        columns={section.columns}
                        items={section.changed}
                        hiddenColumns={hiddenDiffColumns}
                      />
                      <DiffTable
                        title="삭제 항목"
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

          <DialogFooter className="shrink-0 border-t border-[#EEF3F0] px-6 py-4">
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
