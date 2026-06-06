# live-map 3D 등각 뷰어 + 객체 라이브러리 편집

## Status
Phase 1~4 구현 완료 — 2026-06-05. 검증: tsc 0 / eslint 0 errors / unit 116 pass / live-map e2e 8 passed.
(커밋: c1a810a SPEC, e707a34 P1, 3006fce P2+P3, + P4. 구 Konva 빌더 LiveMapLayoutCanvas 삭제 완료.)

### 후속 (2026-06-05~06, 미커밋)
- **설비 3D 모델 = 반도체 클러스터 공정 장비**(`LiveMap3DEquipment`): 메인프레임(후방 본체) + 상단 챔버 클러스터(트랜스퍼 허브 + 프로세스 모듈 3) + EFEM(전면 모듈, 글래스 패널) + **로드 포트(전면 도크 + FOUP 캐리어)** + 시그널 타워(적/황/녹 안돈). EQUIPMENT placement 는 도형 대신 이 장비로 렌더.
  - **port = 로드 포트 입구**(도메인 정정): `portItems`(PORT 1·2·3…)는 상태 LED 점이 아니라 웨이퍼가 들어가는 FOUP 도킹 입구로 그린다. 캐리어 도어 밴드 색 = 포트 상태(RUN/IDLE/DOWN). 설비 status 는 시그널 타워.
- **실설비 자동 표시(R1)**: 저장 placement 가 0 이어도 선택 라인 실설비(`equipmentItems`)를 장비 그리드로 자동 표시(`autoGridPx`, objectKey 0 sentinel). admin 이 편집(드래그/회전)하면 working 으로 승격, 저장 시 object_key NOT NULL FK 충족 위해 백킹 EQUIPMENT 객체 1회 자동 생성(`ensureEquipmentObjectKey`) 후 PUT. 백엔드/스키마 변경 0.
- **반응형 높이**: 씬 컨테이너 `h-[calc(100dvh-16rem)] min-h-[440px]` — 창 높이에 맞춰 늘고 줄며(최소 440 바닥), r3f Canvas 가 ResizeObserver 로 따라 리사이즈.
- **선택 상세 = 뷰어와 동일**: 3D 상세를 뷰어의 `LiveMapTooltipCard`(process/line/wafer mode + 실시간 상태 + 포트 RUN수/목록 + 통신로그)로 교체. 선택 설비를 `buildLiveMapEquipmentNodes`로 노드 변환(eqpId 매칭)해 주입. CSS 토큰이라 테마 자동 대응.
- **dark/light 테마**: 3D 캔버스(WebGL)는 CSS 토큰 불가 → `useThemeStore` 값으로 배경/그리드/조명/ContactShadows/뱃지 배경을 `SCENE_PALETTE[theme]`로 분기. 오버레이/상세는 토큰으로 자동.
- **성능**: `dpr={[1,1.5]}`(레티나 과샘플 캡) + 그림자맵 2048→1024 + ContactShadows resolution 512 + 장비 작은 파트 castShadow 제거(메인프레임/EFEM만 캐스트) → 3D 진입/조작 렌더 부하↓.
- 신규 e2e: `live-map-3d-auto.spec.ts`(저장 0 → 자동 표시 + 편집/저장 시 POST objects + PUT). 검증: tsc 0 / eslint 0 errors / live-map e2e 9 passed.

### 후속 UX/버그 (2026-06-06, 미커밋)
- **선택 상세 = 뷰어 동일**: `LiveMap3DScene` 상세 패널을 뷰어 `LiveMapTooltipCard`(process/line/wafer mode + 실시간 상태 + 포트 RUN수/목록 + 통신로그)로 교체. `buildLiveMapEquipmentNodes`로 eqpId 매칭. (status e2e 도 EQP-77/A Line/Auto + 카드 X 닫기로 갱신)
- **dark/light 테마**: 캔버스 배경/그리드/조명/ContactShadows/뱃지를 `SCENE_PALETTE[theme]`(`useThemeStore`)로 분기. 상세/오버레이는 CSS 토큰 자동.
- **성능**: `dpr={[1,1.5]}` + 그림자맵 1024 + ContactShadows resolution 512 + 장비 작은 파트 castShadow 제거.
- **편집 UX**: 토글 라벨 `편집 종료`(명확화) + 모든 편집 컨트롤 hover 상태 + 아이콘 버튼 `title`.
- **편집 드래그↔카메라 충돌 수정**: 편집 모드에서 `enableRotate={!editing}` — 설비 좌드래그 이동과 OrbitControls orbit 충돌 제거(pan/zoom 유지). (원인: r3f stopPropagation 은 OrbitControls 네이티브 리스너 미차단.)
- **구조물 편집 = STRUCTURE 전용**: 설비는 빌트인 fab tool 자동 표시라 빌더는 구조물만 — Kind 고정(셀렉터 제거) + 리스트 STRUCTURE 필터(FK용 '기본 설비' EQUIPMENT 숨김). (object-editor e2e STRUCTURE 로 갱신)

### 버그 감사 (2026-06-06, 미커밋)
- **[수정·Critical] 자동 그리드 재배치 겹침**: 편집 모드에서 설비 1개 회전/이동(=working 승격) 시 나머지 자동 설비가 빈 자리로 당겨져 겹치던 버그. 원인: 자동 위치를 "미배치 부분집합"의 index/total 로 계산. 수정: `buildAutoEquipmentPlacements(eqpKeys, placed)` 순수 함수로 추출 — 전체 라인 설비의 고정 index 기반. 회귀 단위 테스트 `live-map-3d-model.test.ts`(일부 placed 여도 나머지 위치 불변) 추가.
- **[수정] 저장 더블클릭 409**: pending 중 저장 버튼 비활성화(`saveLayout.isPending || createObject.isPending`) — `기본 설비` 중복 POST(name UNIQUE 위반) 방지.
- **[관찰·무해] 순수-auto 설비 삭제 no-op**: 미승격 자동 설비에 삭제 클릭 시 working 에 없어 no-op(이동/구조물엔 정상 동작 — 이동 설비는 자동 위치로 복귀). 유지.
- **[관찰·완화됨] 윈도우 포커스 refetch**: useLayout staleTime 0 이나 TanStack structuralSharing 으로 동일 데이터는 참조 보존 → 편집 중 reseed 클로버 없음.
- **[수정·Critical] 저장 403 (CSRF 헤더 누락)**: `layout.api.ts` 의 쓰기(putLayout/createObject/updateObject/deleteObject)가 코드베이스 표준 CSRF 패턴(GET /auth/csrf → 쿠키 토큰을 `X-XSRF-TOKEN` 헤더로 수동 부착)을 안 따라, Spring Security(Double Submit Cookie)가 쓰기를 403 거부. 다른 feature API(user/deploy/eqp/model…)는 모두 부착하는데 layout 만 누락(axios 자동 XSRF 에만 의존). 4개 뮤테이션에 `issueCsrfToken()` + 헤더 부착 추가. e2e(auto)가 POST/PUT 의 X-XSRF-TOKEN 존재를 단언하도록 강화(기존 mock 은 헤더 미검사라 못 잡음).
- 검증: tsc 0 / eslint 0 errors / unit 119 pass / live-map e2e 9 passed.

## Why
live-map 을 `C:\workspace_nori\livemap_mokup.jpg`(2.5D 등각 데이터센터 스타일, HT 계열)처럼 만든다.
뷰어는 구조물+설비를 입체로 보여주는 live map 이고, 구조물 편집은 뷰어가 쓸 객체를 관리하는 라이브러리다.
현재는 평면 Konva 캔버스라 레퍼런스의 음영/깊이/상태감을 못 낸다.

## Requirements (사용자)
- **R1** 뷰어 = 구조물·설비를 모두 보여주는 live map. admin 이 **배치를 수정**하고 **설비 객체를 변경**할 수 있다.
- **R2** 구조물 편집 = 뷰어에서 쓸 객체들을 **추가/수정/삭제(CRUD)** 하는 공간.
- **R3** `livemap_mokup.jpg`(2.5D 등각) 기준.
- **R4** 3D 기술은 ui-front 에 가장 효율적인 것으로.
- **R5** 뷰어의 **선택 설비 상세** 내용 포함.

## Decisions (인터뷰 2026-06-05)
1. **3D 엔진**: `@react-three/fiber` v9 + `three` + `@react-three/drei` 신규 도입. 등각 **ortho 카메라** + 조명/그림자로 mockup1 품질. (ui-front=React 19 → r3f v9. 워크스페이스 nori-client-forked 에 r3f 전례.)
2. **뷰어 배치 편집(R1)**: admin 편집모드 토글 → 객체를 **바닥평면 드래그**(raycast로 x/z 이동) + 간단 회전 핸들. 풀 3축 기즈모 미사용.
3. **객체 에디터(R2)**: **폼/파라미터 도형 컴포저**(box/cylinder/plane + size/position/color) + 우측 **3D 미리보기** 실시간. 3D 기즈모 없음.
4. **영속(R4 효율)**: **프론트 우선, 백엔드/스키마 변경 0**. `shape_json`(JSONB)에 3D 스펙 저장, `placement(objectKey/eqpKey/transformJson)` 그대로 사용. 객체 CRUD API(create/update/delete) + layout PUT **모두 존재**(layout.api.ts: createObject/updateObject:122/deleteObject + putLayout). 프론트에 `useUpdateObject` 훅만 추가.
5. **에셋**: 기본 도형 조합(GLTF 미사용, 추후 고도화 여지).
6. **상세 패널(R5)**: HTML 오버레이로, 기존 `LiveMapTooltipCard`(상태/포트/통신로그) 내용 재사용·적응.

## 데이터 모델 (프론트, 스키마 변경 없음)
- **객체 shape_json v2** (JSONB):
  ```
  { v: 2, prims: [ { id, type: 'box'|'cylinder'|'plane',
                     size: {x,y,z}, position: {x,y,z}, rotationY, color } ] }
  ```
  objectKind 컬럼(STRUCTURE|EQUIPMENT)은 기존 그대로.
- **placement**(기존): objectKey + eqpKey + transformJson. 바닥 위치=transform.x/y, 방향=rotation. 높이/형상은 객체가 보유. 스키마 변경 없음.
- **설비↔템플릿 지정(R1)** = placement.objectKey(뷰어 편집모드에서 admin 이 변경) + eqpKey 바인딩. PUT /live-map/layout 로 영속.
- **공존**: v1(Konva 직렬화) 객체는 deprecated. v2(3D) 가 신규 경로. Konva 빌더는 신규 객체 에디터로 대체.

## 아키텍처
- **신규 `LiveMap3DScene`** (뷰어): r3f `<Canvas>` + 등각 ortho 카메라 + 조명/그림자 + 바닥 그리드 + 제한적 OrbitControls. layout(objects+placements)로 구조물·설비 렌더. 상태(RUN/IDLE/ERROR/DOWN)→색/뱃지. 편집모드: 바닥 드래그로 placement 이동, 우클릭/선택→템플릿 지정. HTML 오버레이: KPI(LiveMapHeader 재사용), 편집 토글, 선택 상세(R5).
- **신규 `LiveMapObjectEditor`** (구조물 편집): 객체 리스트(CRUD) + 폼/파라미터 도형 컴포저 + 3D 미리보기. 기존 `LiveMapLayoutCanvas`(Konva 빌더) 대체.
- **재사용**: useLayout/useSaveLayout/useCreateObject/useDeleteObject + 신규 useUpdateObject, 라인 스코프, 권한 게이팅, LiveMapHeader, 상세 패널 내용.
- **대체/제거 대상**(컷오버 시): LiveMapLayoutCanvas, LiveMapKonvaPrimitive, LiveMapStructureLayer, LiveMapBoard(클러스터 카드) — 단계적으로.

## Acceptance Criteria (기계 검증)
- **P1** r3f 뷰어 씬: mock layout(객체≥1 EQUIPMENT, 구조물≥1 STRUCTURE)으로 등각 씬 렌더 — `<canvas>` 존재 + 상태색 적용 + `page.on(console/pageerror)` error 0. `npx tsc -b` EXIT 0 / `npx playwright test live-map-3d-viewer` PASS.
- **P2** 객체 CRUD: 컴포저로 도형 추가→저장 시 POST /objects 호출 + 리스트 반영; 수정 시 PUT /objects/{key}; 삭제 시 DELETE. `playwright test live-map-object-editor` PASS.
- **P3** 뷰어 편집: 편집모드에서 바닥 드래그→placement.x/y 변경, 템플릿 지정→placement.objectKey 변경, 저장 시 PUT /layout 페이로드 반영, 새로고침 후 유지. PASS.
- **P4** 선택 상세(R5): 설비 선택→오버레이 상세(상태/포트) 표시 + 닫기. console/pageerror 0. PASS.
- 공통: `npm run test:unit` 0 fail, `npx eslint` 0 error. (r3f `<canvas>` 픽셀은 e2e 단언 불가 → DOM 오버레이/카운터/console 로 검증.)

## Phases
1. [x] r3f 셋업(@react-three/fiber v9/three/drei) + 읽기전용 등각 뷰어 씬.
2. [x] 구조물 편집(객체 CRUD + 폼 컴포저 + 3D 미리보기) + useUpdateObject.
3. [x] 뷰어 admin 편집(바닥 드래그 배치 + 템플릿 지정 + PUT 영속).
4. [x] 선택 상세 패널 + 상태 뱃지 + 폴리시(hemisphere/contact shadows). mockup1 추가 폴리시(벽/바닥 디테일)는 시안 반복 여지.

## Out of Scope
- GLTF 실사 모델, mockup2 같은 풀 원근 3D.
- 풀 3축 기즈모 편집.
- 백엔드/DB 스키마 변경, 다운스트림 레포 영향.
- 기존 v1(Konva) 객체 데이터 마이그레이션(신규 v2 별도).

## Risks
- r3f v9 + React 19 + Vite 통합/번들 크기.
- 3D 캔버스 e2e 커버리지 제한(오버레이/카운터로 보강).
- 뷰어/빌더 대체 = 큰 변경 → 단계 컷오버, 기존 동작 회귀 차단.

## 다음 단계 진입 프롬프트
**Plan**: `@.claude/specs/live-map-3d.md 보고 구현 계획 수립. 영향 파일/단계/위험/롤백. 실행 금지. 산출물 .claude/specs/live-map-3d-plan.md.`
