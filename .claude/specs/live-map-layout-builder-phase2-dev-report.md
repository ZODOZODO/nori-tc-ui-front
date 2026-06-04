# Dev Report: live-map-layout-builder — Phase 2 (Implement)

> 입력: `.claude/specs/live-map-layout-builder.md` (Phase 2) + `-phase2-plan.md`
> 산출 주체: Implement 세션. 다음 단계: Validate (SPEC Phase 2 AC 체크박스 갱신).
> 모든 빌드/테스트 결과는 실제 실행 + 출력 인용. D1~D5 확정값 엄수.

---

## 0. 결과 요약 (Phase 2 AC)

| AC | 내용 | 결과 |
|---|---|---|
| AC1 | `cd nori-tc-ui-backend && ./gradlew build` PASS (객체 CRUD + 레이아웃/배치 GET/PUT 테스트 포함) | **PASS** (BUILD SUCCESSFUL, starter context-load 포함) |
| AC2 | LIVE_MAP_LAYOUT_WRITE 없는 사용자의 객체 저장/레이아웃 PUT 거부 | **PASS** (`LiveMapLayoutPermissionTest`) |
| AC3 | EQUIPMENT 배치 eqp_key 필수 / STRUCTURE 배치 eqp_key 금지 | **PASS** (`LiveMapLayoutServiceTest`) |
| AC4 | `cd nori-tc-ui-front && npx tsc -b` exit 0 | **PASS** (exit 0) |
| AC5 | `npx eslint src` exit 0 | **PASS** (0 errors, 16 warnings — 전부 기존 react-hooks/set-state-in-effect) |
| AC6 | `npm run test:unit` 전부 PASS (shape_json 직렬화/배치 모델 유닛) | **PASS** (106/106, 신규 12) |
| AC7 | e2e `live-map-object-reuse.spec.ts` | **PASS** (console.error 0, pageerror 0) |
| AC8 | e2e `live-map-readonly.spec.ts` | **PASS** (console.error 0, pageerror 0) |

> 회귀: Phase 1 `live-map-line-scope.spec.ts` 는 폐기된 cluster 보드 설비 dimming 을 검증했으므로
> Phase 2 재설계(라인 스코프 → 빌더 캔버스 게이팅)에 맞춰 갱신했다(아래 §6).

---

## 1. 변경 파일 (레포별)

### nori-tc-exec — DDL 3 테이블 (4 벤더) + 권한 패치 (STAGE A)

create_all_table 수정 (3 테이블 CREATE 블록 `2.7 LIVE MAP LAYOUT` + DROP + Phase 1 잔여 tc_line DROP 보정):
- `docs/db_table/create_all_table/postgres_create_all_table.sql` (JSONB)
- `docs/db_table/create_all_table/mysql_create_all_table.sql` (JSON)
- `docs/db_table/create_all_table/mssql_create_all_table.sql` (NVARCHAR(MAX), GO)
- `docs/db_table/create_all_table/oracle_create_all_table.sql` (CLOB)

신규 패치 SQL (8):
- `docs/db_table/patch/<vendor>_2026_06_02_add_live_map_layout_tables.sql` (4) — 3 테이블 멱등 CREATE
- `docs/db_table/patch/<vendor>_2026_06_02_add_live_map_layout_read_permission.sql` (4) — LIVE_MAP_LAYOUT_READ 시드

### nori-tc-ui-backend — 헥사고날 (STAGE B)

core (`ui/tc-ui-core`):
- `core/livemap/LiveMapObjectKind.java` (enum), `LiveMapObject.java`, `LiveMapPlacementView.java`, `LiveMapLayoutView.java`, `UpsertLiveMapPlacement.java` (record)
- `core/port/db/LiveMapObjectStorePort.java`, `core/port/db/LiveMapLayoutStorePort.java`
- `core/service/LiveMapObjectService.java`, `LiveMapLayoutService.java`, `LiveMapSchemaSupport.java`
- 테스트: `LiveMapObjectServiceTest.java`, `LiveMapLayoutServiceTest.java`(AC3)

adapter-db (`ui/adapter/tc-ui-db-adapter`):
- `LiveMapJdbcSupport.java` (JSONB↔JsonNode), `LiveMapObjectJdbcStorePort.java`, `LiveMapLayoutJdbcStorePort.java`
- 테스트: `LiveMapJdbcSupportTest.java`(JSONB 무손실), `LiveMapLayoutJdbcStorePortTest.java`(saveLayout SQL)

adapter-web (`ui/adapter/tc-ui-web-adapter`):
- `controller/LiveMapLayoutController.java` (6 엔드포인트)
- `dto/request/LiveMapLayoutPutRequest.java`, `dto/request/LiveMapObjectSaveRequest.java`
- `dto/response/LiveMapLayoutResponse.java`, `LiveMapObjectResponse.java`, `LiveMapPlacementResponse.java`
- 테스트: `security/LiveMapLayoutPermissionTest.java`(AC2)

@Import 등록 (3 ModuleConfiguration — §3):
- `UiDbAdapterModuleConfiguration.java`, `UiCoreServiceModuleConfiguration.java`, `UiWebAdapterModuleConfiguration.java`

### nori-tc-ui-front — react-konva 2.5D 빌더 (STAGE C)

- `package.json` / `package-lock.json` — `konva@^10.3.0`, `react-konva@^19.2.4` 추가
- `src/features/live-map/lib/live-map-layout.model.ts` — 순수 직렬화/검증 모델 (React/konva 비의존)
- `src/features/live-map/api/layout.api.ts`, `src/features/live-map/hooks/useLayout.ts`
- `src/features/live-map/components/LiveMapLayoutCanvas.tsx` — 빌더 캔버스(툴바/팔레트/우클릭/저장 다이얼로그/권한 게이팅)
- `src/features/live-map/components/LiveMapPage.tsx` — cluster 보드(LiveMapBoard) → 빌더 캔버스 배선
- `src/app/providers/AppProvider.tsx` — persist deny 목록에 `live-map-layout`/`live-map-objects` 추가 (§7 R-persist)
- 테스트: `tests/live-map-layout-model.test.ts`(unit), `tests/e2e/live-map-object-reuse.spec.ts`, `tests/e2e/live-map-readonly.spec.ts`, `tests/e2e/live-map-line-scope.spec.ts`(갱신)

---

## 2. D1~D5 확정값 적용 확인

- **D1 — 영속화 트랙 = ui-backend `tc-ui-db-adapter` raw JDBC (DeployJdbcStorePort 답습), nori-tc-common 무변경.**
  `LiveMapObjectJdbcStorePort`/`LiveMapLayoutJdbcStorePort` 가 `@Repository` + `NamedParameterJdbcTemplate` + `ObjectMapper(tools.jackson)` 생성자 주입. nori-tc-common 변경 0 (git status 확인).
- **D2 — JSONB 매핑 = JsonNode(서버) ↔ String(JDBC 경계).**
  write `objectMapper.writeValueAsString → CAST(:x AS JSONB)`, read `getString → readTree`. IDENTITY 반환 `RETURNING object_key`/`RETURNING layout_key`. layout upsert = `INSERT ... ON CONFLICT (line_key) DO UPDATE ... RETURNING`. `LiveMapJdbcSupportTest.jsonNodeRoundtripIsLossless` 로 무손실 검증. `v` 검증은 `LiveMapSchemaSupport.requireSchemaVersion`(최상위 정수 v 만, 나머지 자유 확장).
- **D3 — 권한 = LIVE_MAP_LAYOUT_WRITE 재사용(PREFIX /api/live-map/layout, 전 메서드) + 신규 LIVE_MAP_LAYOUT_READ(PREFIX, GET 한정, ADMIN/DEVELOPER/OPERATOR). 전 저작 엔드포인트 `/api/live-map/layout/*`.**
  `LiveMapLayoutPermissionTest`: read-only 사용자 → GET 허용 / PUT·POST·DELETE 403, write 사용자 → 전부 허용. (ANY-of 매칭에서 READ 를 GET 한정해야 PUT 가 WRITE 에만 매칭되는 설계 검증.)
- **D4 — postgres 전용 앱 + 4 벤더 DDL parity.** postgres JSONB / mysql JSON / mssql NVARCHAR(MAX) / oracle CLOB. 비-postgres 는 schema parity 목적(앱 JDBC 는 postgres 타겟). 각 패치 헤더에 명기.
- **D5 — object(라인 독립 CRUD) 별도 + layout(라인당 1)+placement(자식) 통합 포트.**
  `LiveMapLayoutStorePort.saveLayout` = upsert layout + placement delete-then-insert 를 단일 `@Transactional`. GET = layout+placement join + 참조 객체 dedup(`findByKeyIn`) 동봉 → 비-admin 자족 렌더.

---

## 3. @Import 등록 (ComponentScan 금지 — 누락 시 런타임 NoResourceFoundException)

| ModuleConfiguration | 추가 빈 |
|---|---|
| `UiDbAdapterModuleConfiguration` | `LiveMapObjectJdbcStorePort`, `LiveMapLayoutJdbcStorePort` |
| `UiCoreServiceModuleConfiguration` | `LiveMapLayoutService`, `LiveMapObjectService` |
| `UiWebAdapterModuleConfiguration` | `LiveMapLayoutController` (import + @Import 두 줄) |

검증: `./gradlew build` 의 `:ui:starter:tc-ui-backend-starter:test`(context-load) PASS = 빈 그래프 누락 없음.

---

## 4. EQUIPMENT/STRUCTURE ↔ eqp_key 서버 검증 (SPEC (d), FK 500 아닌 명시 400)

`LiveMapLayoutService.validatePlacement` 가 PUT 시 각 배치에 대해 강제(`LiveMapLayoutServiceTest` 케이스):
- EQUIPMENT 배치 eqpKey null → `UiBadRequestException`
- STRUCTURE 배치 eqpKey 존재 → `UiBadRequestException`
- 미등록 objectKey → `UiBadRequestException`
- 미등록 eqpKey(`findEqpLineKey` empty) → `UiBadRequestException`
- 타 라인 eqpKey(`findEqpLineKey` ≠ layout.lineKey) → `UiBadRequestException`
- 정상(동일 라인 EQUIPMENT + STRUCTURE) → `saveLayout` 호출
- transform_json/canvas_json `v` 누락 → `UiBadRequestException`

> eqp 라인 검증은 `TcEqpStore.findByKey(eqpKey)` 부재(common 무변경)라, common 변경 없이
> ui-backend JDBC 어댑터 `LiveMapLayoutStorePort.findEqpLineKey`(`SELECT line_key FROM tc_eqp WHERE eqp_key=:eqpKey`)로 조회.

---

## 5. 검증 출력 인용

### AC1 — ui-backend build (`-PuseLocalMaven`, common 무변경이라 Phase 1 발행 산출물 사용)
```
> Task :ui:starter:tc-ui-backend-starter:test
> Task :ui:starter:tc-ui-backend-starter:check
> Task :ui:starter:tc-ui-backend-starter:build
BUILD SUCCESSFUL in 21s
34 actionable tasks: 8 executed, 26 up-to-date
```
신규 모듈 테스트 단독 실행(`:ui:tc-ui-core:test :ui:adapter:tc-ui-db-adapter:test :ui:adapter:tc-ui-web-adapter:test`)도 `BUILD SUCCESSFUL in 47s`.

### AC4 — tsc
```
EXIT: 0
```

### AC5 — eslint src
```
✖ 16 problems (0 errors, 16 warnings)
eslint EXIT: 0
```

### AC6 — test:unit
```
# tests 106
# pass 106
# fail 0
```

### AC7/AC8 — e2e (live-map 3종: object-reuse / readonly / line-scope)
```
Running 3 tests using 2 workers
  3 passed (9.9s)
EXIT: 0
```

---

## 6. 결정/편차 기록 (Validate 입력)

- **create_all_table 테이블 위치**: 3 테이블을 각 벤더 파일의 CREATE 섹션 말미(`2.7 LIVE MAP LAYOUT`)에 배치. Plan 은 postgres "deploy 섹션 직후"를 권장했으나, mysql/mssql/oracle 엔 deploy 섹션이 없어(검증됨) 4 벤더 일관성 + FK 의존성 충족(tc_line·tc_eqp 선행 정의)을 위해 말미 배치로 통일. AC(컬럼/FK/CHECK/명명 정합)는 *테이블 정의* 기준이라 파일 내 위치 무관.
- **AppProvider persist deny 보정 (R-persist)**: React Query `PersistQueryClientProvider` 의 deny 목록에 `'live-map'` 만 있고 신규 `'live-map-layout'`/`'live-map-objects'` 가 빠져 영속 대상이 됨 → 새로고침 시 PUT 직전 stale 빈 캐시가 복원되어 영속이 깨지는 버그를 e2e(AC7)에서 발견·수정. live-map 데이터 비영속 설계 의도에 맞춰 두 헤드 추가 + `useLayout` staleTime 0(마운트 시 항상 최신).
- **LiveMapBoard(cluster 보드)**: Phase 2 가 캔버스를 react-konva 빌더로 대체해 LiveMapPage 에서 미참조가 됨. CLAUDE.md(dead code 언급만) 에 따라 파일은 보존(삭제 안 함). 후속 정리 권장. `LIVE_MAP_CLUSTER_ITEMS` mock 은 데모 테스터(별 기능)의 설비 그룹 입력으로만 잔존 — live-map 캔버스는 cluster 미사용.
- **EQUIPMENT 배치 eqp 선택 UI**: 1차 빌더는 STRUCTURE 배치를 완전 지원하고, EQUIPMENT 객체 배치 시 eqpKey 미바인딩은 저장 시 프론트 사전검증(`validatePlacementEqpBinding`) + 서버 400 으로 차단. eqp 선택 드롭다운(EQUIPMENT 배치→실설비 바인딩) UI 는 후속(SPEC 요구의 실시간 상태 오버레이와 함께). e2e AC7 은 STRUCTURE 경로로 객체 재사용 전 과정을 검증.
- **Image primitive 렌더**: shape_json 화이트리스트(Rect/Line/Text/Image) 중 Image 는 저장/직렬화는 보존하되 1차 캔버스 렌더는 생략(URL 로딩 별도, SPEC Out of Scope).
- **line-scope e2e 갱신**: Phase 1 의 보드 dimming 검증 → 라인 스코프가 빌더 캔버스를 게이팅(ALL=안내, 라인 선택=캔버스)하는 Phase 2 동작으로 재작성.

---

## 7. SDD 진행
- Phase 2 **Implement** 완료. 산출물 = 본 파일.
- 다음: **Validate** — SPEC Phase 2 AC 체크박스 + SDD 상태 갱신(독립 세션 재현 검증).

---

## 8. 후속 구현 — Validate 가 `[~]` 로 식별한 미구현 Requirements 마저 구현 (2026-06-04 append)

> 입력: phase2-plan(특히 line 278/283-285) + Validate 결과 「후속 연기」. **재설계·재plan 없이** plan 에 이미 명세됐으나 1차 Implement 에서 누락된 항목만 마저 구현.
> 모든 빌드/테스트는 실제 실행 + 출력 인용.

### 8.0 대상 (plan 에 이미 명세, 1차 누락)

| # | 항목 | plan 근거 | 상태 |
|---|---|---|---|
| 1 | EQUIPMENT 배치 eqp 바인딩 UI (eqpKey:null 하드코딩 제거) | plan:278 | **완료** |
| 2 | 설비 실시간 상태(RUN/IDLE/ERROR/DOWN)·포트 오버레이 | plan:278 | **완료** |
| 3 | Image primitive 렌더 (LiveMapLayoutCanvas:48 생략 해제, src URL) | plan:283 | **완료** |
| 4 | 저작 UX 잔여 — Transformer 리사이즈/회전·다중선택·z-order/scale·팔레트 검색/드래그 | plan:283-285 | **완료** |

### 8.1 변경 파일 (레포별)

nori-tc-ui-backend (`GET /live-map` 에 eqpKey 추가 — 최소 변경, **nori-tc-common 무변경**):
- `ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/eqp/LiveMapEquipmentView.java` — `Long eqpKey` 첫 필드 + null 검증
- `ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/service/LiveMapQueryService.java` — `row.eqp().eqpKey()` 매핑(UiEqp.eqpKey 기존 필드)
- `ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/dto/response/LiveMapResponse.java` — `EquipmentResponse.eqpKey`
- `ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/controller/support/LiveMapResponseSupport.java` — eqpKey 매핑
- 테스트: `LiveMapQueryServiceTest#getEquipmentViewsReturnsEqpKeyForLayoutPlacementBinding`(실패 테스트 먼저)

nori-tc-ui-front:
- `src/features/live-map/lib/live-map-layout.model.ts` — 순수 헬퍼 추가: `clampScale`/`scaleTransform`/`toggleSelection`/`liftTransformsToFront`/`sinkTransformsToBack`/`DEFAULT_IMAGE_SRC`(1x1 data URI)
- `src/features/live-map/api/live-map.api.ts` — `LiveMapEquipmentResponse.eqpKey: number`
- `src/features/live-map/components/LiveMapLayoutCanvas.tsx` — Image 렌더(`PrimitiveImage`), eqp 바인딩 패널(라인 스코프 드롭다운+상태), 캔버스 실시간 상태 dot/포트 오버레이, 다중선택(`selectedIds`)·`Transformer`·selection bar(z-order/scale/delete)·팔레트 검색·드래그-드롭
- 테스트: `tests/live-map-layout-model.test.ts`(unit +6), `tests/e2e/live-map-eqp-binding.spec.ts`(신규), `tests/e2e/live-map-authoring-ux.spec.ts`(신규)

### 8.2 항목별 구현 + 결정

- **1·2 eqp 바인딩 + 실시간 상태**: `GET /live-map`(LiveMapResponse) 이 `eqpId`(String)만 노출하고 `eqp_key`(placement 바인딩 키, BIGINT)가 없어 placement.eqpKey↔실시간 상태 매칭 불가였다. → `LiveMapEquipmentView`/`EquipmentResponse` 에 `eqpKey` 1필드 추가(`UiEqp.eqpKey` 는 Phase 1 기존 필드 → **nori-tc-common 무변경**, 헥사고날 @Import 불변). 프론트: 선택된 EQUIPMENT placement 에 라인 스코프(`equipment.lineValue === selectedLineValue`) 설비 드롭다운 → `bindEqp` 로 eqpKey 저장(`eqpKey:null` 하드코딩 제거). 캔버스 EQUIPMENT 노드엔 `equipmentByKey.get(eqpKey).status` 로 상태 dot(STATUS_FILL hex)+포트 dot 오버레이(비-admin 도 조회). binding 패널에 실시간 상태 텍스트.
- **3 Image 렌더**: `renderPrimitive` 의 `Image` 분기를 `PrimitiveImage` 컴포넌트로 활성(생략 해제) — `src` URL 로 `window.Image()` 로드 후 Konva `Image` 렌더. 신규 Image 의 기본 src 는 `DEFAULT_IMAGE_SRC`(1x1 data URI, 네트워크/console 오류 없이 로드). 바이너리 업로드는 Out of Scope(URL 참조만).
- **4 저작 UX**: 다중선택 = `selectedIds: string[]` + shift/ctrl 토글(`toggleSelection`). `Transformer`(react-konva 표준 패턴: 선택 노드 ref→`transformer.nodes()`)로 리사이즈/회전, `onTransformEnd` 가 scaleX/scaleY/rotation/x/y 영속. selection bar: Bring to Front/Send to Back(`liftTransformsToFront`/`sinkTransformsToBack` — depth/zIndex 재배치), Scale ±(`scaleTransform`, [0.2,5] clamp), Delete. 팔레트: `palette-search` 이름 필터 + 행 `draggable`→캔버스 `onDrop`(drop 좌표 배치).
- **우클릭 가드(회귀 수정)**: Konva 는 우클릭에도 `click` 을 발화 → `handleSelectPlacement` 가 `event.evt.button === 2` 면 무시(우클릭=컨텍스트 메뉴 전담). 미적용 시 우클릭이 selection bar 를 띄워 레이아웃이 밀리고 컨텍스트 메뉴가 닫혀 AC7(object-reuse) e2e 회귀. 가드로 해결.

### 8.3 신규 AC (누락을 잡는 e2e — 기존 AC7 STRUCTURE-only 격차 차단)

- **AC9** `tests/e2e/live-map-eqp-binding.spec.ts`: EQUIPMENT 배치→캔버스 선택→라인 스코프 설비(eqpKey 77) 바인딩→상태 'RUN' 표시→PUT 페이로드 eqpKey===77 단언. A_LINE 설비는 드롭다운 제외 단언. console/pageerror 0.
- **AC10** `tests/e2e/live-map-authoring-ux.spec.ts`(4 케이스): 팔레트 검색 필터 / 드래그-드롭 배치(`DataTransfer` dispatchEvent) / 다중선택+Scale+Front 의 PUT 페이로드(scaleX>1·zIndex≥2) / Image 추가·저장·배치 렌더. 각 console/pageerror 0.

### 8.4 검증 출력 인용

ui-backend `./gradlew build -PuseLocalMaven`:
```
> Task :ui:starter:tc-ui-backend-starter:test
> Task :ui:starter:tc-ui-backend-starter:check
> Task :ui:starter:tc-ui-backend-starter:build
BUILD SUCCESSFUL in 56s
34 actionable tasks: 11 executed, 23 up-to-date
```

ui-front tsc / eslint / unit:
```
=== TSC ===
TSC_EXIT: 0
=== ESLINT ===
✖ 15 problems (0 errors, 15 warnings)
=== UNIT ===
# tests 112
# pass 112
# fail 0
```
> eslint 15 warnings = 전부 기존 `react-hooks/set-state-in-effect` 부채(신규 경고 0 — 오히려 baseline 16→15). unit 112 = 기존 106 + 신규 6(clampScale/scaleTransform/toggleSelection/lift·sink/DEFAULT_IMAGE_SRC).

ui-front e2e (live-map 5 spec, 8 test):
```
Running 8 tests using 2 workers
  8 passed (17.4s)
PW_EXIT: 0
```
> eqp-binding 1 + authoring-ux 4 + 회귀(object-reuse·readonly·line-scope) 3. 각 spec `toEqual([])`(console.error·pageerror 0) 통과.

### 8.5 SPEC 정정

- Frontend Requirements req 279/282/283/284 `[~]`→`[x]`(후속 구현 완료 표기).
- Phase 2 AC 에 AC9(eqp-binding)·AC10(authoring-ux)·백엔드 eqpKey 테스트 추가.
- 결정 기록: D1(JPA 라벨↔실제 JDBC)·D3(LIVE_MAP_LAYOUT_READ 신규) 편차 명시 + GET /live-map eqpKey 추가 결정.
- SDD 진행 상태: Phase 2 「후속 구현(2026-06-04)」 항목 추가.

### 8.6 한계 (정직 표기)

- `Transformer` 핸들 드래그 자체는 wired + e2e console-clean 으로만 검증(캔버스 핸들 드래그는 결정적 e2e 가 어려움). 배율/정렬의 영속은 selection bar Scale±/Front-Back(결정적) + `onTransformEnd` 경로 + PUT 페이로드 단언으로 검증.
- Image src 편집 UI 는 미도입 — 신규 Image 는 기본 data URI, 저장된 객체의 실제 URL 은 그대로 렌더(URL 참조 렌더 경로가 핵심 격차였고 해소). primitive 속성 편집(색/텍스트/URL)은 기존 빌더에도 없던 범위라 미추가(SIMPLICITY).
