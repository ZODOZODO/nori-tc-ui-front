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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
          <DialogTitle>변경사항 미리보기</DialogTitle>
          <DialogDescription>
            이전 버전과 현재 편집 내용의 차이입니다. 확인 후 OK를 누르면 버전 저장 단계로 이동합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#647169]">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              이전 버전 데이터를 불러오는 중입니다.
            </div>
          ) : !hasDiff ? (
            <p className="py-10 text-center text-sm text-[#647169]">
              이전 버전과 비교하여 변경된 내용이 없습니다.
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
                <div key={section.detailNode} className="rounded-2xl border border-[#E4EAE6] overflow-hidden">
                  <div className="bg-[#F6F9F7] px-4 py-2.5">
                    <span className="text-sm font-semibold text-[#1E3D33]">{nodeLabel}</span>
                    <span className="ml-2 text-xs text-[#647169]">
                      추가 {section.added.length} / 변경 {section.changed.length} / 삭제 {section.deleted.length}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <Table className="min-w-max">
                    <TableHeader>
                      <TableRow className="bg-[#FAFCFB]">
                        <TableHead className="w-24">구분</TableHead>
                        <TableHead className="w-40">식별자</TableHead>
                        {section.columns.map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* 추가된 항목: 이전 버전에 없고 현재 버전에 있음 */}
                      {section.added.map((item) => (
                        <TableRow key={`added-${item.identity}`} className="bg-[#F0FFF7]">
                          <TableCell>
                            <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-[#D1F5E7] text-[#1C7F59]">
                              추가
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-[#22322B]">{item.identity}</TableCell>
                          {item.branchValues.map((value, index) => (
                            <TableCell key={index} className="text-xs text-[#22322B]">
                              <DiffCellValue value={value} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}

                      {/* 변경된 항목: 이전 버전과 현재 버전 모두에 있지만 값이 다름 */}
                      {section.changed.map((item) => (
                        <TableRow key={`changed-${item.identity}`} className="bg-[#FFFDF0]">
                          <TableCell>
                            <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-[#FFF0C0] text-[#7A5800]">
                              변경
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-[#22322B]">{item.identity}</TableCell>
                          {section.columns.map((_, index) => {
                            const current = item.branchValues[index] ?? ''
                            const previous = item.parentValues[index] ?? ''
                            const isChanged = current !== previous
                            return (
                              <TableCell key={index} className="text-xs">
                                {isChanged ? (
                                  <div className="space-y-1">
                                    {/* 이전 값 */}
                                    <div className="text-[#97A39C] line-through">
                                      <DiffCellValue value={previous} />
                                    </div>
                                    {/* 현재 값 */}
                                    <div className="text-[#1C7F59] font-medium">
                                      <DiffCellValue value={current} />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[#22322B]">
                                    <DiffCellValue value={current} />
                                  </span>
                                )}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}

                      {/* 삭제된 항목: 이전 버전에 있고 현재 버전에 없음 */}
                      {section.deleted.map((item) => (
                        <TableRow key={`deleted-${item.identity}`} className="bg-[#FFF7F7]">
                          <TableCell>
                            <span className="rounded px-1.5 py-0.5 text-xs font-semibold bg-[#FAD9D7] text-[#B4483F]">
                              삭제
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-[#97A39C] line-through">{item.identity}</TableCell>
                          {item.parentValues.map((value, index) => (
                            <TableCell key={index} className="text-xs text-[#97A39C] line-through">
                              <DiffCellValue value={value} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
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
            className="h-9 rounded-full border-[#D7E1DB] px-4 text-xs font-semibold"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 rounded-full bg-[#1C7F59] px-4 text-xs font-semibold text-white hover:bg-[#166749]"
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
    return <span className="text-[#97A39C]">—</span>
  }
  const MAX_LENGTH = 100
  if (value.length <= MAX_LENGTH) {
    return <span>{value}</span>
  }
  return (
    <span title={value}>
      {value.slice(0, MAX_LENGTH)}
      <span className="text-[#97A39C]">…</span>
    </span>
  )
}
