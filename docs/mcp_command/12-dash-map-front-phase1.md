# Dash Map Front Phase 1 Draft

이번 문서는 `design.pen` 의 `dash_map frame` 을 실제 앱 페이지로 옮기기 위한
**front 1차 구현 문서 초안**입니다.

본 단계의 목적은 backend 연결 없이 `설비 Live Map` 화면의 UI/상호작용을 먼저 구현하고,
UI 구조가 안정된 뒤 backend 연동 단계를 별도 문서로 분리하는 것입니다.

문서 방향은 아래 기존 문서를 참고합니다.

- [04-deploy-frame.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/04-deploy-frame.md)
- [07-deploy-register-front-phase1.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/07-deploy-register-front-phase1.md)
- [08-deploy-create-phase2.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/08-deploy-create-phase2.md)

즉, 이번 문서는 아래 원칙을 따릅니다.

1. `design.pen` 기준으로 실제 페이지를 먼저 만든다.
2. 이번 단계에서는 backend 를 연결하지 않는다.
3. local mock data + client state 로 UI와 상호작용을 완성한다.
4. 이후 backend 연동은 별도 단계 문서로 분리한다.

─────────────────────────────
📌 이번 단계 목표
─────────────────────────────

front 1차 구현의 목표는 아래 5가지입니다.

1. `design.pen` 의 `dash_map frame` 을 실제 React 페이지로 옮깁니다.
2. 신규 route 를 추가해 앱에서 실제 페이지로 접근 가능하게 만듭니다.
3. 상단 공통 topbar 에 `Dash` 메뉴를 추가하고, 다른 주요 페이지에서도 동일하게 노출되도록 정리합니다.
4. `설비 Live Map` 화면의 검색, 필터, 선택, 줌, tooltip 상호작용을 local state 로 완성합니다.
5. 지도 내부 설비/버퍼/반송 레인/상태 요약을 mock 데이터 기반으로 렌더링합니다.
6. 추후 backend 연동 시 화면 구조를 다시 뜯지 않도록 데이터 경계를 미리 정리합니다.

이 단계가 끝나면 `/eqp/live-map` 은 아래 상태가 됩니다.

1. 실제 앱 라우트에서 열 수 있음
2. `design.pen` 과 유사한 시각 구조를 가짐
3. mock 데이터 기준 검색/필터/선택이 가능함
4. 아직 실제 설비 runtime / websocket / backend API 와는 연결되지 않음

─────────────────────────────
🚫 이번 단계 비목표
─────────────────────────────

이번 단계에서 하지 않을 것:

1. backend 조회 API 추가
2. websocket / SSE / polling 기반 실시간 상태 연동
3. 실제 설비 runtime 상태 반영
4. line 목록, 상태 집계, tooltip 상세를 서버 응답 기준으로 전환
5. `dash_card frame` 구현
6. 기존 `Eqp` / `Deploy` / `Model` 화면의 대규모 공통 레이아웃 리팩토링
7. 권한 정책, 인증 흐름, 로그인 진입 경로 변경

중요:

- 이번 단계의 핵심은 **UI 선구현**입니다.
- “실시간처럼 보이는 경험”은 local mock 과 client state 로만 구성합니다.
- 실제 live 데이터 소스 전환은 다음 단계에서 진행합니다.

─────────────────────────────
🧭 기준 디자인 자산
─────────────────────────────

이번 문서가 기준으로 삼는 `design.pen` 자산은 아래입니다.

1. top-level frame: `dash_map frame`
   - node id: `8XWkc`
2. 지도 내 설비 표현용 reusable component: `MapMachineNode`
   - node id: `rmW8s`
3. 상단 헤더/메뉴 톤
   - 기존 `EqpPage`, `DeployPage` 의 현재 app shell 과 최대한 동일한 방향 유지

`dash_map frame` 에서 실제로 확인된 핵심 UI 블록:

1. 페이지 타이틀: `설비 Live Map`
2. 요약 카드: `TOTAL`, `RUN`, `ERROR`, `IDLE`
3. 툴바
   - 검색 입력
   - 라인 선택 chip
   - 상태 선택 chip
   - `Map Live` view chip
4. 어두운 맵 보드
   - sync chip
   - 범례
   - cluster/sector 영역
   - buffer zone
   - transport / AMHS zone
   - rail / carrier 표현
   - 하단 status bar
   - zoom control
   - 선택 설비 tooltip

즉, 이번 구현은 단순 카드 목록이 아니라
**지도형 설비 상태 모니터링 페이지**를 앱 내부에 독립 화면으로 옮기는 작업입니다.

─────────────────────────────
🧱 권장 route / feature 경계
─────────────────────────────

## 권장 route

- `GET` 개념이 아니라 프론트 route 기준으로 `'/eqp/live-map'`

권장 이유:

1. 화면 제목이 `설비 Live Map` 이라서 `Eqp` 도메인과의 연관성이 높습니다.
2. 현재 로그인 기본 진입은 `/eqp` 이므로, 같은 상위 메뉴 축 안에서 관리하는 편이 자연스럽습니다.
3. topbar 에는 `Dash` 라벨을 노출하되, 실제 진입 route 는 이 경로로 연결합니다.

중요:

- 상단 공통 메뉴에는 `Live Map` 이 아니라 `Dash` 라벨을 사용합니다.
- `Dash` 클릭 시 `'/eqp/live-map'` 으로 이동하는 방식으로 정리합니다.
- 이 메뉴는 dash 화면에만 생기는 것이 아니라, `Eqp`, `Model`, `Deploy` 같은 기존 주요 페이지 topbar 에도 동일하게 추가되어야 합니다.

## 권장 feature 폴더

- `src/features/live-map`

권장 이유:

1. 현재 `EqpPage.tsx` 는 이미 역할이 큽니다.
2. 지도형 화면은 상태/레이아웃/tooltip/zoom 로직이 별도 축입니다.
3. 추후 backend 연동 시에도 `eqp` feature 를 과도하게 비대하게 만들지 않는 편이 안전합니다.

즉, route 는 `/eqp/live-map` 이지만 구현 폴더는 `live-map` 으로 분리하는 것을 권장합니다.

─────────────────────────────
📁 예상 변경 파일
─────────────────────────────

## 필수 추가 파일

1. `src/features/live-map/types/live-map.types.ts`
2. `src/features/live-map/mocks/live-map.mock.ts`
3. `src/features/live-map/stores/live-map-ui.store.ts`
4. `src/features/live-map/components/LiveMapPage.tsx`
5. `src/features/live-map/components/LiveMapHeader.tsx`
6. `src/features/live-map/components/LiveMapToolbar.tsx`
7. `src/features/live-map/components/LiveMapBoard.tsx`
8. `src/features/live-map/components/LiveMapLegend.tsx`
9. `src/features/live-map/components/LiveMapTooltipCard.tsx`

## 필수 수정 파일

1. `src/app/Router.tsx`
2. `src/features/eqp/components/EqpPage.tsx`
3. `src/features/model/components/ModelPage.tsx`
4. `src/features/deploy/components/DeployPage.tsx`

## 선택적 추가 파일

1. `src/features/live-map/lib/live-map-selectors.ts`
2. `src/features/live-map/lib/live-map-layout.ts`

중요:

- geometry 계산, summary 계산, filter 계산은 JSX 안에 직접 뭉치지 말고 selector/helper 로 분리하는 편이 좋습니다.
- 하지만 이번 단계에서 hook/API 레이어까지 미리 만들 필요는 없습니다.

─────────────────────────────
🧩 페이지 shell 요구사항
─────────────────────────────

전체 shell 은 기존 [DeployPage.tsx](/home/donggeon/workspace_nori/nori-tc-ui-front/src/features/deploy/components/DeployPage.tsx)
와 [EqpPage.tsx](/home/donggeon/workspace_nori/nori-tc-ui-front/src/features/eqp/components/EqpPage.tsx)
의 현재 톤을 우선 재사용합니다.

## 상단 header

유지할 요소:

1. 좌측 `Nori-TC` 로고
2. 중앙 top navigation
   - `Eqp`
   - `Model`
   - `Dash`
   - `Deploy`
   - `Dlq`
   - `User`
3. 우측
   - 로그아웃 버튼
   - 프로필 버튼

구현 원칙:

1. `dash_map frame` 의 상단 시각 톤은 따르되,
   실제 구현은 기존 앱 header 패턴을 최대한 재사용합니다.
2. `Dash` 는 공통 전역 메뉴로 취급합니다.
3. 따라서 `LiveMapPage` 뿐 아니라 기존 `EqpPage`, `ModelPage`, `DeployPage` topbar 에도 같은 항목이 있어야 합니다.
4. `Dash` 클릭 시 `'/eqp/live-map'` 으로 이동합니다.
5. 새로운 공통 top bar component 추출은 이번 단계 필수가 아닙니다.

권장 메뉴 순서:

1. `Eqp`
2. `Model`
3. `Dash`
4. `Deploy`
5. `Dlq`
6. `User`

## 본문 wrapper

권장 레이아웃:

1. 배경: 밝은 neutral tone
2. 콘텐츠 padding: `24px`
3. 세로 gap: `16px`
4. 맵 보드는 가로 폭을 충분히 차지하되, 작은 폭에서는 내부 scroll 을 허용

중요:

- `design.pen` 기준 기본 화면은 `1440x900` 입니다.
- 현재 앱 특성을 고려하면 desktop 우선 구현이 자연스럽습니다.
- 다만 viewport 가 좁아질 때 전체 페이지가 깨지기보다, 보드 영역 내부 스크롤로 버티는 쪽이 낫습니다.

─────────────────────────────
🗂 화면 구성 요구사항
─────────────────────────────

## 1. LiveMapHeader

좌측:

1. 제목: `설비 Live Map`
2. 설명: `실시간 상태를 지도 기반으로 탐색하고 이상 설비를 빠르게 식별합니다.`

우측 summary 카드:

1. `TOTAL`
2. `RUN`
3. `ERROR`
4. `IDLE`

구현 원칙:

1. summary 값은 mock 데이터에서 파생 계산합니다.
2. summary 는 현재 line / 상태 filter 결과 기준으로 다시 계산해도 됩니다.
3. 숫자 포맷과 색상 강조는 `design.pen` 톤을 최대한 유지합니다.

## 2. LiveMapToolbar

필수 요소:

1. 검색 입력
   - placeholder: `설비명 / Eqp ID / 라인 검색`
2. line filter chip
3. state filter chip
4. `Map Live` 상태 chip

front-only 규칙:

1. 검색은 local mock 데이터 기준 부분 일치 처리
2. line filter 는 mock line 목록 기준 선택
3. state filter 는 아래 옵션을 권장
   - `ALL`
   - `RUN`
   - `IDLE`
   - `ERROR`
   - `OFF`
4. `Map Live` chip 은 실제 서버 live 상태가 아니라 정적 활성 표시로 둡니다

## 3. LiveMapBoard

보드 내부 필수 구성:

1. sync chip
   - 예: `1.2s live sync`
2. legend
   - `RUN`
   - `IDLE`
   - `ERROR`
   - `OFF`
3. floor canvas
4. zoom control row
5. tooltip card
6. 하단 status bar

### floor canvas 내부

반영할 요소:

1. cluster shell 3개
   - 전처리 클러스터
   - 핵심 공정군
   - 검사/반출 클러스터
2. sector deck 다수
3. 설비 machine node 다수
4. buffer zone
5. transport equipment zone
6. rail line / carrier
7. focused equipment ring

구현 원칙:

1. machine node 좌표는 mock geometry 데이터로 관리합니다.
2. 좌표/크기/상태색을 JSX 안에 직접 하드코딩하기보다 데이터 모델로 분리합니다.
3. `MapMachineNode` 의 시각 구조를 React component 로 옮기되, pen component 자체를 가져오는 것이 아니라 코드로 재구성합니다.

## 4. TooltipCard

기본 표시 정보:

1. 설비 ID
2. sector / cluster 메타 정보
3. 현재 상태
4. alert / 특이사항 요약

front-only 규칙:

1. tooltip 내용은 선택된 설비 mock 데이터에서 읽습니다.
2. 초기 기본 선택값은 `ERROR` 상태 설비 1건으로 두는 것을 권장합니다.
3. 선택된 설비가 없으면
   - 첫 번째 `ERROR`
   - 없으면 첫 번째 visible 설비
   순으로 fallback 합니다.

─────────────────────────────
🖱 상호작용 규칙
─────────────────────────────

## 1. 검색

검색 대상 권장 필드:

1. `eqpId`
2. `eqpName`
3. `lineName`
4. `sectorName`

동작 규칙:

1. 입력 중 즉시 filter 하거나
2. debounce 150ms ~ 300ms 를 둬도 됩니다.

이번 단계에서는 별도 검색 버튼이 없어도 됩니다.

## 2. 설비 선택

1. machine node 클릭 시 해당 설비를 선택 상태로 전환
2. 선택된 설비는 focused ring 또는 강조 stroke 로 표현
3. tooltip card 내용도 즉시 갱신

## 3. 상태 필터

1. 상태 필터는 visible node 를 줄이는 역할로 사용
2. filter 결과에서 제외된 설비는 숨기거나 낮은 opacity 처리
3. summary 카드도 같은 visible 기준으로 재계산 가능

## 4. line 필터

1. mock 에 line 이 1개뿐이어도 상태값은 구조적으로 분리합니다.
2. 추후 backend 에서 다중 line 이 들어와도 page 구조를 다시 바꾸지 않도록 합니다.

## 5. zoom control

권장 버튼 매핑:

1. `maximize`: 보드 fit
2. `locate-fixed`: 선택 설비 기준 위치 재정렬
3. `plus`: zoom in
4. `minus`: zoom out

front-only 규칙:

1. 최소 구현은 CSS transform 기반 scale 만으로 충분합니다.
2. 복잡한 pan/drag 는 이번 단계 필수가 아닙니다.
3. zoom 상태는 store 에 두고 버튼으로만 제어하는 편이 안전합니다.

## 6. sync chip

권장 구현:

1. local interval 로 `lastSyncAt` 또는 `n.n초 전` 텍스트만 갱신
2. 실제 설비 상태를 주기적으로 랜덤 변경하는 동작은 필수가 아님

이유:

1. UI가 불필요하게 흔들리지 않습니다.
2. backend 연결 전 단계에서 시각적 live 느낌만 유지할 수 있습니다.

─────────────────────────────
🧠 타입 / 상태 설계 권장안
─────────────────────────────

## `live-map.types.ts`

권장 타입 예시:

```ts
export type LiveMapEqpStatus = 'RUN' | 'IDLE' | 'ERROR' | 'OFF'

export interface LiveMapEquipmentNode {
  eqpId: string
  eqpName: string
  lineName: string
  clusterId: string
  clusterName: string
  sectorId: string
  sectorName: string
  status: LiveMapEqpStatus
  statusLabel: string
  alertMessage: string | null
  x: number
  y: number
}

export interface LiveMapSummary {
  total: number
  run: number
  idle: number
  error: number
  off: number
}
```

핵심 원칙:

1. node 시각 배치에 필요한 geometry 와
2. tooltip / summary 계산에 필요한 domain 정보를
3. 동일한 mock row 안에 두되, UI 전용 파생값은 selector 에서 계산합니다.

## `live-map-ui.store.ts`

store 에 두는 값:

1. `searchKeyword`
2. `selectedLine`
3. `selectedStatus`
4. `selectedEqpId`
5. `zoomLevel`
6. `lastSyncAt`

store 에 두지 않아도 되는 값:

1. 설비 원본 mock 배열
2. summary 계산 결과
3. visible node 목록

즉, 이번 단계에서도 **원본 데이터는 mock 파일**, **선택 상태만 store** 로 두는 방향이 적절합니다.

─────────────────────────────
🗃 mock 데이터 구성 권장안
─────────────────────────────

`live-map.mock.ts` 는 최소한 아래 데이터를 분리해 두는 것을 권장합니다.

1. `LIVE_MAP_LINE_OPTIONS`
2. `LIVE_MAP_STATE_OPTIONS`
3. `LIVE_MAP_CLUSTER_ITEMS`
4. `LIVE_MAP_EQUIPMENT_NODES`
5. `LIVE_MAP_BUFFER_ITEMS`
6. `LIVE_MAP_TRANSPORT_ITEMS`

중요:

- 처음부터 모든 geometry 를 완전히 일반화할 필요는 없습니다.
- 다만 적어도 “설비 노드 배열”은 독립 데이터로 꺼내 두는 편이 backend 전환에 유리합니다.

후속 backend 연동 시 교체 대상:

1. summary 숫자
2. 설비 상태
3. alert 메시지
4. line 목록
5. tooltip 상세
6. last sync 정보

─────────────────────────────
🔌 backend 연동을 위한 선행 경계
─────────────────────────────

이번 단계에서는 backend 를 붙이지 않지만,
다음 단계를 위해 아래 경계는 미리 지켜두는 것이 좋습니다.

1. component 는 `mock 상수` 를 직접 여기저기 import 하지 않고
   page 또는 selector 경유로 읽습니다.
2. tooltip card 는 “선택된 eqp 상세 모델”을 props 로 받도록 둡니다.
3. summary 계산 로직은 selector 로 분리합니다.
4. 검색/필터 입력값은 server query 로 바뀌어도 그대로 재사용 가능한 이름으로 둡니다.

즉, 다음 단계에서는 아래 전환만 일어나야 합니다.

1. mock data → query result
2. local sync label → server sync metadata
3. mock tooltip detail → server detail

반대로 아래는 그대로 유지되는 것이 이상적입니다.

1. route
2. page shell
3. component tree
4. store 의 선택 상태 구조

─────────────────────────────
✅ 완료 기준
─────────────────────────────

이번 문서 기준 `front 1차 완료`는 아래를 의미합니다.

1. `Router.tsx` 에 `/eqp/live-map` route 가 추가됨
2. 기존 주요 페이지 topbar 에 `Dash` 메뉴가 공통으로 추가됨
3. 실제 페이지에서 `설비 Live Map` 화면이 렌더링됨
4. `design.pen` 의 `dash_map frame` 주요 시각 구조가 반영됨
5. 검색 / line filter / state filter / 설비 선택 / tooltip / zoom 버튼이 local state 기준으로 동작함
6. 어떤 backend API 도 호출하지 않음
7. 추후 backend 연결 시 data source 교체 범위가 명확히 분리되어 있음

─────────────────────────────
🧪 권장 검증
─────────────────────────────

구현 후 최소 확인 권장:

1. `pnpm lint`
2. `pnpm build`
3. `design.pen` 스크린샷과 실제 페이지를 나란히 비교
4. 아래 시나리오 수동 확인
   - 초기 진입 시 기본 tooltip 표시
   - 검색어 입력 시 visible node 변화
   - 상태 필터 변경 시 summary/visible 결과 확인
   - node 클릭 시 tooltip 및 강조 상태 갱신
   - zoom in/out/fit 동작 확인

─────────────────────────────
➡️ 다음 단계 예고
─────────────────────────────

이번 문서 다음 단계는 별도 문서로 분리하는 것을 권장합니다.

후속 문서에서 다룰 내용:

1. live map summary 조회 API
2. line / state / search server filter 계약
3. 설비 runtime 상태 조회 또는 subscribe 계약
4. tooltip 상세 조회 계약
5. 실제 sync 시간 표시 계약

즉, 이번 12번 문서는
**`dash_map frame` 을 실제 프론트 페이지로 옮기는 선구현 문서**이고,
backend 연결은 그 다음 단계에서 이어가는 것이 맞습니다.
