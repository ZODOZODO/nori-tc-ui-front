# live-map 3D 등각 뷰어 + 객체 라이브러리 편집

## Status
Specify 완료 — 2026-06-05. 인터뷰 4문항 확정 반영. 다음 단계 Plan.

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
1. r3f 셋업(@react-three/fiber v9/three/drei) + 읽기전용 등각 뷰어 씬.
2. 구조물 편집(객체 CRUD + 폼 컴포저 + 3D 미리보기) + useUpdateObject.
3. 뷰어 admin 편집(바닥 드래그 배치 + 템플릿 지정 + PUT 영속).
4. 선택 상세 패널 + 상태 뱃지 + mockup1 향한 폴리시(조명/그림자/바닥/벽).

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
