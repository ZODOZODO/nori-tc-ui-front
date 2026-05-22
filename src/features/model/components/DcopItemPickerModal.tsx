import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Search, Trash2 } from 'lucide-react'
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
import { useDcopItemPickerState } from '../hooks/useDcopItemPickerState'
import type { ModelDcopItem } from '../types/model.types'

interface DcopItemPickerModalProps {
  open: boolean
  /** picker 가 띄워진 Flow 의 ID. 표시용 라벨. */
  flowId: number
  /**
   * model_version 단위 dcop_item pool 전체 — 좌측 reference 영역에 노출됩니다.
   * 이미 현재 Flow 에 매핑된 항목은 좌측에서 disabled + "매핑됨" 배지 표시.
   * 사용자 결정: NULL 개념 폐기 — N:M 모델에서 picker 좌측 disabled 행이 곧
   * binding 시각화 역할을 담당.
   */
  referenceDcopItems: readonly ModelDcopItem[]
  /** 현재 Flow 에 binding 된 dcop_item 목록 (우측 초기값). */
  currentFlowDcopItems: readonly ModelDcopItem[]
  /**
   * 저장 클릭 시 호출되는 콜백 — 우측 누적 array (dcop_item_key 만) 가 인자.
   * 부모는 즉시 PUT 대신 FlowCard.draft.dcopItems 에 반영만 하고 모달을 닫습니다 —
   * 실제 DB 저장은 사용자가 우상단 통합 "Flow 저장" 을 눌렀을 때 5 섹션 + Collect 가
   * 한 번의 PUT 으로 전송됩니다.
   */
  onSave: (next: readonly number[]) => void
  onClose: () => void
}

/**
 * Flow 의 Collect 섹션 dcop_item binding 을 N:M 으로 편집하는 모달입니다.
 *
 * Layout 은 사용자 요구 ("demo 모달의 위부분처럼") 에 따라 3 col grid 로 구성됩니다:
 *   - 좌측 (Reference) : model 의 dcop_item pool 전체 + 검색 + 체크박스
 *   - 가운데 (→ 버튼) : 좌측 선택 항목을 우측에 추가
 *   - 우측 (Current)  : 현재 Flow 에 binding 된 항목 + Trash 행 제거
 *
 * 동일 dcop_item 은 한 Flow 안에 중복 binding 될 수 없으므로 좌측에서 이미
 * 매핑된 행은 disabled + "매핑됨" 배지로 표시. 다른 Flow 에 매핑돼 있어도
 * 좌측에는 빈 상태로 보여 N:M 매핑이 가능합니다 (= picker 가 Flow 별
 * 독립 binding 만 관리).
 *
 * PUT 시 송신되는 array 는 dcop_item_key 만 — 본체 fields 변경은 별도
 * dcop-itemes 노드의 평면 UI 가 담당.
 */
export function DcopItemPickerModal({
  open,
  flowId,
  referenceDcopItems,
  currentFlowDcopItems,
  onSave,
  onClose,
}: DcopItemPickerModalProps) {
  // referenceDcopItems 의 row 중 dcopItemKey 가 null 인 항목은 본 모달에서 다루지 않습니다 —
  // PUT body 의 `dcopItemKeys` 는 PK 가 필요하므로 신규 row 는 dcop-itemes 노드에서 먼저
  // 저장돼야 합니다. 따라서 PK 가 있는 행만 노출.
  const referenceItems = useMemo(
    () => referenceDcopItems.filter((item) => item.dcopItemKey !== null),
    [referenceDcopItems],
  )

  const initialRight = useMemo<readonly number[]>(
    () =>
      currentFlowDcopItems
        .map((item) => item.dcopItemKey)
        .filter((key): key is number => key !== null),
    [currentFlowDcopItems],
  )

  const {
    leftSelection,
    rightItems,
    toggleLeftSelection,
    selectKeys,
    deselectKeys,
    moveSelectedToRight,
    removeFromRight,
    clearRight,
    reset,
  } = useDcopItemPickerState(initialRight)

  // 모달이 다시 open 될 때 (또는 flowId 가 바뀔 때) 우측을 초기 binding 으로 reset.
  useEffect(() => {
    if (open) {
      reset(initialRight)
    }
  }, [open, initialRight, reset])

  const [searchKeyword, setSearchKeyword] = useState('')

  const rightItemSet = useMemo(() => new Set<number>(rightItems), [rightItems])

  const filteredReferenceItems = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    if (keyword.length === 0) {
      return referenceItems
    }
    return referenceItems.filter((item) => item.dcopItemName.toLowerCase().includes(keyword))
  }, [referenceItems, searchKeyword])

  // 우측 행을 ModelDcopItem 으로 다시 매핑해 본체 표시 (dcopItemName / variableId).
  // referenceItems 가 model 단위 권위 소스이므로 그 안에서 찾아 사용. 없으면 placeholder.
  const rightDisplayItems = useMemo(() => {
    return rightItems.map((key) => {
      const found = referenceItems.find((item) => item.dcopItemKey === key)
      return {
        dcopItemKey: key,
        dcopItemName: found?.dcopItemName ?? `(unknown #${key})`,
        variableId: found?.variableId ?? '',
      }
    })
  }, [rightItems, referenceItems])

  const hasLeftSelection = leftSelection.size > 0

  // "모두 선택" 토글 대상은 검색이 적용된 좌측 항목 중 *아직 우측에 매핑되지 않은*
  // 항목만. 이미 매핑된 항목은 disabled 라 체크 변경 자체가 무의미.
  const selectableFilteredKeys = useMemo(
    () =>
      filteredReferenceItems
        .map((item) => item.dcopItemKey as number)
        .filter((key) => !rightItemSet.has(key)),
    [filteredReferenceItems, rightItemSet],
  )

  const allSelectableChecked =
    selectableFilteredKeys.length > 0
    && selectableFilteredKeys.every((key) => leftSelection.has(key))

  const handleToggleSelectAll = () => {
    if (selectableFilteredKeys.length === 0) {
      return
    }
    if (allSelectableChecked) {
      deselectKeys(selectableFilteredKeys)
    } else {
      selectKeys(selectableFilteredKeys)
    }
  }

  const handleClickMove = () => {
    if (!hasLeftSelection) {
      return
    }
    moveSelectedToRight()
  }

  const handleClickSave = () => {
    onSave(rightItems)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-[960px]">
        <DialogHeader>
          <DialogTitle>DCOP Item 선택</DialogTitle>
          <DialogDescription>
            Flow #{flowId} 의 Collect 섹션에 binding 할 DCOP item 을 선택합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.2fr)_88px_minmax(0,1.45fr)]">
          <section
            className="flex h-[420px] min-h-[420px] flex-col rounded-[18px] border border-[#DCE7E0] bg-white p-4"
            data-testid="dcop-picker-left"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#22332A]">Reference DCOP</h3>
                <p className="mt-1 text-[11px] text-[#6D7A73]">
                  model 의 dcop_item pool 전체. 이미 매핑된 항목은 비활성화됩니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">선택 {leftSelection.size}건</Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleSelectAll}
                  disabled={selectableFilteredKeys.length === 0}
                  data-testid="dcop-picker-toggle-select-all"
                  className="h-6 px-2 text-[11px]"
                >
                  {allSelectableChecked ? '모두 해제' : '모두 선택'}
                </Button>
              </div>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#93A19A]" />
              <Input
                type="search"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="DCOP item 이름으로 검색"
                className="h-9 pl-9"
                aria-label="DCOP item 검색"
              />
            </div>

            <div className="mt-3 flex-1 overflow-y-auto rounded-[12px] bg-[#F8FBF9] p-2">
              {filteredReferenceItems.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-[#7B8A82]">
                  표시할 DCOP item 이 없습니다.
                </p>
              ) : (
                <ul className="space-y-1">
                  {filteredReferenceItems.map((item) => {
                    const key = item.dcopItemKey as number
                    const isAlreadyBound = rightItemSet.has(key)
                    const isChecked = leftSelection.has(key)
                    return (
                      <li key={key}>
                        <label
                          className={
                            'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-[#EEF4F0]' +
                            (isAlreadyBound ? ' cursor-not-allowed opacity-50 hover:bg-transparent' : '')
                          }
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isAlreadyBound}
                            onChange={() => toggleLeftSelection(key)}
                            aria-label={`${item.dcopItemName} 선택`}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-[#22322B]">
                            {item.dcopItemName}
                          </span>
                          {isAlreadyBound ? (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              매핑됨
                            </Badge>
                          ) : null}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          <div className="flex h-[420px] items-center justify-center">
            <Button
              type="button"
              onClick={handleClickMove}
              disabled={!hasLeftSelection}
              className="h-12 w-12 rounded-full bg-[#1A7A55] text-white hover:bg-[#176748]"
              aria-label="선택한 DCOP item 추가"
              data-testid="dcop-picker-move-button"
            >
              <ArrowRight className="size-5" />
            </Button>
          </div>

          <section
            className="flex h-[420px] min-h-[420px] flex-col rounded-[18px] border border-[#DCE7E0] bg-white p-4"
            data-testid="dcop-picker-right"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#22332A]">현재 Flow 의 DCOP</h3>
                <p className="mt-1 text-[11px] text-[#6D7A73]">
                  좌측에서 추가한 항목이 누적됩니다. Trash 로 1 행씩 제거할 수 있습니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{rightDisplayItems.length}개 매핑</Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearRight}
                  disabled={rightItems.length === 0}
                  data-testid="dcop-picker-clear-right"
                  className="h-6 px-2 text-[11px]"
                >
                  모두 제거
                </Button>
              </div>
            </div>

            <div className="mt-3 flex-1 overflow-hidden rounded-[12px] border border-[#E5ECE7]">
              <div className="h-full overflow-auto">
                <Table className="min-w-[360px]">
                  <TableHeader>
                    <TableRow className="bg-[#F6F9F7] hover:bg-[#F6F9F7]">
                      <TableHead>DCOP Item Name</TableHead>
                      <TableHead>Variable Id</TableHead>
                      <TableHead className="w-[70px] text-center">삭제</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rightDisplayItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-12 text-center text-xs text-[#708078]">
                          좌측에서 항목을 체크한 뒤 화살표로 추가해 주세요.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rightDisplayItems.map((item) => (
                        <TableRow key={item.dcopItemKey}>
                          <TableCell className="font-semibold text-[#21332A]">
                            {item.dcopItemName}
                          </TableCell>
                          <TableCell>{item.variableId}</TableCell>
                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={() => removeFromRight(item.dcopItemKey)}
                              className="inline-flex size-8 items-center justify-center rounded-full border border-[#E0E8E3] text-[#6E7B74] transition hover:border-[#D65454] hover:bg-[#FFF4F4] hover:text-[#C64040]"
                              aria-label={`${item.dcopItemName} 매핑 해제`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="button" onClick={handleClickSave} data-testid="dcop-picker-save-button">
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
