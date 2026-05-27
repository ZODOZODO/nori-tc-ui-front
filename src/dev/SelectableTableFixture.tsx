import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'

/**
 * R6 (정렬 / 리사이즈 / 가상화) e2e 전용 fixture.
 *
 * 11 production 호출처는 `rangeCopy` 만 사용하므로 (SPEC L67-71 호출처 변경 0 제약)
 * sortable / resizable / virtualization 가 켜진 SelectableTable 을 렌더하는 화면이
 * production 에 없다. 이 fixture 는 그 features 를 켠 결정적 데이터셋을 띄워
 * R6 e2e / fps 측정의 진입점을 제공한다. Router 에서 `import.meta.env.DEV` 가드로만
 * 등록되어 production 번들에는 포함되지 않는다.
 *
 * query 파라미터:
 *   rows    렌더 행 수 (기본 3 — 정렬/리사이즈 결정적 데이터, 1000 = fps 측정)
 *   sort    '0' 이면 sortable off (기본 on)
 *   resize  '0' 이면 resizable off (기본 on)
 *   virtual '1' 이면 virtualization on (기본 off)
 */

interface FixtureRow {
  id: string
  name: string
  value: string
  note: string
}

// 정렬 단언이 결정적이도록 name 의 사전순(Apple < Banana < Cherry)과
// 초기 순서(Cherry, Apple, Banana)가 모두 다르게 잡는다.
const BASE_ROWS: readonly FixtureRow[] = [
  { id: 'r0', name: 'Cherry', value: '30', note: 'gamma' },
  { id: 'r1', name: 'Apple', value: '10', note: 'alpha' },
  { id: 'r2', name: 'Banana', value: '20', note: 'beta' },
]

const buildRows = (count: number): FixtureRow[] => {
  if (count <= BASE_ROWS.length) {
    return BASE_ROWS.slice(0, Math.max(count, 1))
  }
  const rows: FixtureRow[] = []
  for (let index = 0; index < count; index += 1) {
    rows.push({
      id: `row-${index}`,
      name: `Item ${String(index).padStart(5, '0')}`,
      value: String(index),
      note: `note-${index % 7}`,
    })
  }
  return rows
}

const COLUMNS: readonly ColumnDef<FixtureRow>[] = [
  { key: 'name', header: 'name', accessor: (row) => row.name, sortable: true, resizable: true, width: '160px', sticky: true },
  { key: 'value', header: 'value', accessor: (row) => row.value, sortable: true, resizable: true, width: '120px' },
  { key: 'note', header: 'note', accessor: (row) => row.note, sortable: true, resizable: true, width: '160px' },
]

export function SelectableTableFixture() {
  const params = new URLSearchParams(window.location.search)
  const rowCount = Number(params.get('rows') ?? '3')
  const rows = buildRows(Number.isFinite(rowCount) ? rowCount : 3)

  const features = {
    rangeCopy: true,
    sortable: params.get('sort') !== '0',
    resizable: params.get('resize') !== '0',
    virtualization: params.get('virtual') === '1',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 400, padding: 16 }}>
      <SelectableTable
        testId="selectable-table-fixture"
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        features={features}
      />
    </div>
  )
}
