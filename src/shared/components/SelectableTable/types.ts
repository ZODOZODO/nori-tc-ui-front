import type { ReactNode } from 'react'

/**
 * 그리드 좌표 — 0-based.
 */
export interface GridCoord {
  rowIdx: number
  colIdx: number
}

/**
 * 사각형 영역 — normalize 된 inclusive 경계.
 */
export interface GridRange {
  startRowIdx: number
  endRowIdx: number
  startColIdx: number
  endColIdx: number
}

/**
 * `renderCell` 에 전달되는 helper — Excel 처럼 평소엔 read view (span),
 * 더블클릭 시에만 편집 view (Input) 로 전환하는 패턴을 위해 노출됩니다.
 */
export interface SelectableTableRenderCellHelpers {
  isEditing: boolean
  beginEdit: () => void
  endEdit: () => void
}

/**
 * SelectableTable 의 한 컬럼 정의. `accessor` 는 TSV 복사의 단일 진입점,
 * `renderCell` 은 행 단위 ReactNode 렌더 (modal/select/Input 같은 페이지별 분기 위임).
 */
export interface ColumnDef<TRow> {
  key: string
  // ReactNode 허용 — 헤더에 select-all 체크박스 같은 인터랙티브 노드를 넣기 위함(deploy register).
  // 문자열은 ReactNode 의 부분집합이라 기존 소비처는 그대로 호환된다.
  header: ReactNode
  accessor: (row: TRow) => string
  renderCell?: (
    row: TRow,
    rowIdx: number,
    colIdx: number,
    helpers: SelectableTableRenderCellHelpers,
  ) => ReactNode
  editable?: boolean
  width?: string
  maxWidth?: string
  sticky?: boolean
  // R6 에서 활성화. R1 시점에는 type 만 선언.
  sortable?: boolean
  resizable?: boolean
}

/**
 * SelectableTable 의 기능 플래그. R1 시점에는 `rangeCopy` / `rangePaste` 만 의미를 갖고,
 * 나머지는 R6 / R4 PR 에서 구현 활성화됩니다.
 */
export interface SelectableTableFeatures {
  rangeCopy?: boolean
  rangePaste?: boolean
  // R6
  sortable?: boolean
  resizable?: boolean
  virtualization?: boolean
}

/**
 * `editable` 컬럼에 대해 paste 가 발생했을 때 호출되는 콜백.
 */
export type SelectableTablePasteHandler<TRow> = (
  row: TRow,
  columnIndex: number,
  value: string,
) => void

/**
 * 행 단위 "작업" 컬럼 (삭제 버튼 등) — range 선택에서 제외됩니다.
 */
export interface SelectableTableActionColumn<TRow> {
  header?: string
  width?: string
  render: (row: TRow, rowIdx: number) => ReactNode
}
