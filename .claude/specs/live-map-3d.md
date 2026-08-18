# live-map 3D 등각 뷰어 + 객체 라이브러리 편집

## Status
Phase 1~4 구현 완료 — 2026-06-05. 검증: tsc 0 / eslint 0 errors / unit 116 pass / live-map e2e 8 passed.
(커밋: c1a810a SPEC, e707a34 P1, 3006fce P2+P3, + P4. 구 Konva 빌더 LiveMapLayoutCanvas 삭제 완료.)

### 후속 (2026-06-05~06, 미커밋)
- **설비 3D 모델 = 반도체 클러스터 공정 장비**(`LiveMap3DEquipmentField`): 메인프레임(후방 본체) + 상단 챔버 클러스터(트랜스퍼 허브 + 프로세스 모듈 3) + EFEM(전면 모듈, 글래스 패널) + **로드 포트(전면 도크 + FOUP 캐리어)** + 시그널 타워(적/황/녹 안돈). EQUIPMENT placement 는 도형 대신 이 장비로 렌더.
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

### 빌트인 구조물 + 조작 안내 (2026-06-06, 미커밋)
- **빌트인 벽/파티션**: `LIVE_MAP_BUILTIN_STRUCTURES`(모델, 음수 sentinel 키 -1/-2)로 벽/파티션을 DB row 없이 편집기 목록(`object-builtin-item-{slug}`) + 뷰어 추가 드롭다운에 항상 노출. 뷰어 배치 후 저장 시 같은 이름의 STRUCTURE 객체를 1회 지연 생성(`ensureBuiltinStructureObjectKey`, `ensureEquipmentObjectKey` 와 동형) 후 placement 키 치환(`keyRemap`). 같은 이름 실 DB STRUCTURE 가 생기면 빌트인은 숨김(중복 방지). `objectsByKey`/`libraryObjects` 에 빌트인 병합, `handleAdd` 의 키 검증을 `<=0`→`===0`(음수 허용)로 완화. (설계 인터뷰: "기성 객체" 선택 — 설비 auto-display 빌트인과 일관. 직전 "프리셋 버튼" 시도는 목록 진입과 중복이라 제거.)
- **조작 안내 힌트**: OrbitControls 기본 매핑(좌:회전 / 우:이동(pan) / 휠:줌, 두손가락:DOLLY_PAN — three `OrbitControls.js:271/358/371` 확인)이라 좌드래그만으론 화면 이동이 안 보임 → 좌하단 `live-map-3d-controls-hint` 오버레이(편집/뷰어 문구 분기) 추가. 기능 변경 없음(pan 은 원래 우드래그로 동작).
- **표시/저장 카운트 설명**: `표시`=resolved.length(저장 배치 + 라인 실설비 자동표시), `저장`=working.length(DB 영속). 레이블에 `title` 툴팁 추가(혼동 완화).
- e2e: `live-map-3d-structure.spec.ts`(빈 라이브러리→빌트인 벽 추가→저장 시 STRUCTURE 1회 POST + PUT 키 치환 + CSRF) 신설, `live-map-object-editor.spec.ts` 에 빌트인 목록 노출/로드/저장+중복숨김 테스트 추가. 검증: tsc 0 / eslint 0 errors / unit 3 pass / live-map e2e 5 passed.

### 편집 고급 + 선택 가독성 + 렌더링 (2026-06-06, 미커밋)
- **① 선택 가독성**: 얇은 단일 링 → 굵은 이중 링(내부 진한 + 외곽 글로우) + 선택 뱃지를 상태색으로 채우고 125% 확대. 여러 대 중 선택 설비가 멀리서·자세히 안 봐도 즉시 식별.
- **② 키보드 미세 이동**: 편집모드 + 선택 있을 때 화살표로 선택 전체 nudge(`NUDGE_PX=8`, Shift=40). 입력/셀렉트 포커스 시 무시. `nudgeSelected`(useCallback) + window keydown effect.
- **③ 다중 선택·그룹 조작**: 선택 모델 단일(`selectedId`)→다중(`selectedIds: string[]`, primary=마지막 선택). Shift/Ctrl+클릭 토글. 그룹 드래그(드래그 시작 시 위치 스냅샷 → delta 절대 적용, drift 없음) / 그룹 회전(`rotateSelected`) / 그룹 삭제 / 키보드 이동. 템플릿 교체·실설비 바인딩은 primary 단일 대상. 선택 패널에 `외 N개` 카운트.
- **④ 층 1/2/3**: `transformJson.floor`(opaque JSONB, 백엔드 무변경 — `LiveMapLayoutService` 는 transform 의 top-level `v` 만 검증) + `buildTransformJson` 기본 floor 1. 좌측 전역 층 선택(`live-map-3d-floor-{n}`)=새 추가 기본 층(activeFloor), 선택 패널 층 버튼(`live-map-3d-set-floor-{n}`)=선택을 그 층으로 이동. 렌더는 각 placement Y=`(floor-1)*FLOOR_HEIGHT(4.5)`, 2층 이상 반투명 슬래브 적층. 자동 설비는 1층.
- **⑤ 렌더링 속도**: vite `optimizeDeps.include: [three, @react-three/fiber, @react-three/drei]` — dev 첫 3D 진입의 콜드 변환(수백 모듈 on-demand) 제거(서버 기동 시 1회 사전 번들). 효과는 dev 서버 재시작 후 적용. 프로덕션 빌드는 원래 번들링돼 더 빠름.
- e2e: `live-map-3d-edit-advanced.spec.ts`(다중선택+그룹회전+층이동 / 키보드 nudge+새추가 기본층) 2 테스트 신설. 검증: tsc 0 / eslint 0 errors / unit 119 pass / live-map e2e 8 passed.

### 층 고도화 — 공정 매핑 + 뷰 필터 (2026-06-06, 미커밋)
- **층고 상향**: `FLOOR_HEIGHT` 4.5→6 (설비/뱃지/시그널타워가 상층 슬래브에 안 겹치게).
- **공정→층 자동 배치**: `floorForCluster(clusterId)`(모델) — 1F: photo/etch/cvd, 2F: cmp/diff/imp, 3F: wet/metal, 그 외(metro/etc 등) 1F. 자동 표시 설비의 floor 를 공정으로 결정. clusterId 출처: `live-map.mock.ts` 클러스터 + 실 API `LiveMapEquipmentResponse.clusterId`.
- **층 뷰 필터**: 좌측 `1F/2F/3F/전체`(`live-map-3d-floor-{n}` + `live-map-3d-floor-all`). `floorView: number|'all'`(기본 'all'). 전체=층별 Y 적층, 단일층=그 층 placement 만 + 바닥(Y=0) 평탄화로 포커스. `CameraRig` 가 floorView 에 맞춰 카메라 줌/타깃 보정(전체 줌아웃+스택 중앙 / 단일 줌인+바닥) — Canvas 재마운트 없이 imperative(react-compiler immutability 오탐 1줄 disable). 새 추가는 보고 있는 층(전체면 1F)에 들어감.
- e2e: `live-map-3d-floors.spec.ts`(공정별 1/2/3층 자동 배치 + 층 버튼 단일/전체 토글) 신설. 검증: tsc 0 / eslint 0 errors / unit 119 pass / live-map e2e 9 passed(floors+advanced 포함).

### 런타임 렌더 성능 — memo + visible 토글 + 폴리 감소 (2026-06-06, 미커밋)
- 원인: 설비 1대 = 메시 ~16개(RoundedBox smoothness 4 고폴리) + drei Html 뱃지 1개 → 실설비 ~54대면 ~860 메시. `LiveMap3DEquipmentField` 미-memo 라 모든 부모 리렌더(층전환/선택/카메라)마다 트리 재조정. 층 전환을 list 필터로 해 메시 언마운트/재마운트.
- **memo**: `LiveMap3DEquipmentField`/`LiveMap3DObject` 를 `React.memo` — equipment/shape ref 가 안정(TanStack structuralSharing + 메모 Map)이라 층전환/선택 시 메시 트리 재조정 스킵.
- **visible 토글**: 층 필터를 list 제거 → `<group visible={showFloor}>` 토글로(메시 1회 마운트 유지, 전환은 visible+위치만). 뱃지(drei Html)는 부모 invisible 로 안 숨겨져 `showFloor` 조건부 렌더로 게이팅. 단일층 보기는 안 보이는 층 draw call 도 스킵돼 더 가벼움.
- **폴리 감소**: RoundedBox `smoothness` 4→2(메인프레임/EFEM), 3→2(FOUP) + 실린더 세그먼트 챔버 24→14·시그널타워 20→12/16→10 — 외형 차이 미미.
- **번들 분리(진입 비용)**: prod `LiveMapPage` 청크가 1,308kB(three+drei 포함)였음 → vite manualChunks 에 `three-vendor` 추가로 분리(three-vendor 1,108kB gzip 308 / LiveMapPage 387kB gzip 119). 캐시 분리 + 병렬 다운로드.
- **dev vs prod**: dev 최초 3D 진입은 StrictMode 2× 렌더 + Vite 소스 on-demand 변환 + React dev 오버헤드로 부풀려짐(실측 ~3s). prod 빌드는 단일 렌더 + 번들이라 실사용 진입은 훨씬 빠름 — 진입 체감은 `npm run preview` 로 측정해야 정확.
- **공유 지오메트리/머티리얼(마운트 비용)**: 설비 N대가 동일 정적 부품(플린스/메인프레임/EFEM/챔버/글래스/타워폴)을 매번 새로 생성(~700 지오메트리/대량 GPU 업로드)하던 것을 모듈 1회 생성→공유(`SHARED_GEO`/`SHARED_MAT`, three-stdlib `RoundedBoxGeometry`)로. 공유 자원 메시는 `dispose={null}` 로 언마운트 시 폐기 방지(재진입 안전). status/port 의존 부분(액센트/타워세그/로드포트)만 per-instance. + 그림자맵 1024→512.
- **남은 레버(미적용)**: 설비 메시 object 수(~864)·draw call·drei Html 뱃지 N개는 그대로 — 더 필요하면 InstancedMesh(정적 부품 1 draw call) + Html 단일 오버레이. 실측 후 결정.
- 검증: tsc 0 / eslint 0 errors / prod build OK / live-map e2e 9 passed(직렬). 병렬 실행 시 3D WebGL 경합으로 간헐 타임아웃 가능(로직 무관).

### 버그 감사 (2026-06-06, 미커밋)
- **[수정·Critical] 자동 그리드 재배치 겹침**: 편집 모드에서 설비 1개 회전/이동(=working 승격) 시 나머지 자동 설비가 빈 자리로 당겨져 겹치던 버그. 원인: 자동 위치를 "미배치 부분집합"의 index/total 로 계산. 수정: `buildAutoEquipmentPlacements(eqpKeys, placed)` 순수 함수로 추출 — 전체 라인 설비의 고정 index 기반. 회귀 단위 테스트 `live-map-3d-model.test.ts`(일부 placed 여도 나머지 위치 불변) 추가.
- **[수정] 저장 더블클릭 409**: pending 중 저장 버튼 비활성화(`saveLayout.isPending || createObject.isPending`) — `기본 설비` 중복 POST(name UNIQUE 위반) 방지.
- **[관찰·무해] 순수-auto 설비 삭제 no-op**: 미승격 자동 설비에 삭제 클릭 시 working 에 없어 no-op(이동/구조물엔 정상 동작 — 이동 설비는 자동 위치로 복귀). 유지.
- **[관찰·완화됨] 윈도우 포커스 refetch**: useLayout staleTime 0 이나 TanStack structuralSharing 으로 동일 데이터는 참조 보존 → 편집 중 reseed 클로버 없음.
- **[수정·Critical] 저장 403 (CSRF 헤더 누락)**: `layout.api.ts` 의 쓰기(putLayout/createObject/updateObject/deleteObject)가 코드베이스 표준 CSRF 패턴(GET /auth/csrf → 쿠키 토큰을 `X-XSRF-TOKEN` 헤더로 수동 부착)을 안 따라, Spring Security(Double Submit Cookie)가 쓰기를 403 거부. 다른 feature API(user/deploy/eqp/model…)는 모두 부착하는데 layout 만 누락(axios 자동 XSRF 에만 의존). 4개 뮤테이션에 `issueCsrfToken()` + 헤더 부착 추가. e2e(auto)가 POST/PUT 의 X-XSRF-TOKEN 존재를 단언하도록 강화(기존 mock 은 헤더 미검사라 못 잡음).
- 검증: tsc 0 / eslint 0 errors / unit 119 pass / live-map e2e 9 passed.

### 공정 bay 레이아웃 — 평면 그리드 → bay-and-chase (2026-06-08, 미커밋)
- **문제**: 자동 표시 설비를 `autoGridPx`(6열 평면 격자)로 층별로 "쭉 나열" — 2D 보드(`LIVE_MAP_CLUSTER_ITEMS`)는 공정을 bay 로 묶는데 3D 는 그 구조를 버려 실제 라인 느낌이 없음. (웹 리서치: 실제 fab = bay-and-chase "핑거" 플랜 — 중앙 통로 양옆 bay, 설비는 통로 향해 정렬, 로드포트가 통로 쪽.)
- **결정(사용자 인터뷰 2026-06-08)**: ① 기존 3층 유지(PROCESS_FLOOR + 1F/2F/3F 필터 보존) + 각 층을 공정 bay 로. ② bay 외형 = 낮은 파티션(1.6, 빌트인 '파티션'과 동일) + 바닥 존 + 공정명 라벨(통로 쪽 열림).
- **모델(`live-map-3d.model.ts`)**: `autoGridPx`/`buildAutoEquipmentPlacements` 제거 → `buildBayEquipmentPlacements`(설비를 cluster 로 그룹화 → 층별 2행 bay(위 ceil(n/2)/아래 나머지, 각 행 중앙정렬) → bay 안 3열 격자, 앞줄=통로 쪽, 통로 향한 회전 0/180) + `buildLineBays`(구조물 렌더용 bay 목록). 좌표는 board px 그대로라 드래그/저장 파이프라인 무변경. 위치 안정성 불변식(일부 placed 여도 나머지 불변)은 cluster 그룹 내 고정 index 로 유지.
- **씬(`LiveMap3DScene.tsx`)**: `BayStructures`(bay 마다 바닥 존 plane + 통로 반대쪽 3면 낮은 파티션 박스, 통로 쪽 열림) + `BayLabelProjector`(공정명 DOM 라벨을 뒷벽 위로 좌표 투영 — 뱃지와 동형, **imperative transform 이라 Tailwind scale·translate 유틸 금지**). 팔레트에 `bayZone`/`bayWall`(dark/light) 추가. 자동 placement 가 rotationDeg/floor 를 bay 행/공정에서 직접 받음.
- **룸(컷어웨이) — 1차 결과가 "빈 그리드 위 floating 펜"이라 재설계**: 스크린샷(Playwright)으로 직접 확인 후, mockup1(`livemap_mokup.jpg` = 2.5D 등각 룸: 솔리드 바닥 + 외벽 + 설비 행) 미감에 맞춤. `FloorRoom`(층마다 솔리드 바닥 슬래브 + 중앙 통로 스트립 + 원거리 외벽 2면(-X/-Z, 등각 카메라 뒤쪽이라 near 벽 생략한 컷어웨이)). 전체 보기에선 최하층만 솔리드/상층 반투명(하층 투시) → 3층 fab 건물로 읽힘. bay 는 행 폭을 꽉 채우게 타일링(`layoutFloorBays` 중앙정렬→등분) + 설비를 bay 폭 기준 촘촘히 묶음(`equipmentSlot` 가변 열). 외벽이 화면에 들어오게 `CameraRig` zoom 32/48→24/38 하향. 팔레트에 `roomFloor/roomAisle/roomWall` 추가.
- **테스트**: 단위 `live-map-3d-model.test.ts` 를 bay 빌더 불변식 + 공정→층 그룹화로 갱신. e2e 신설 `live-map-3d-bays.spec.ts`(공정 3종→bay 라벨 3개, photo 2대=bay 1개, 층 필터 따라 라벨 표시/숨김).
- 검증: tsc 0 / eslint 0 errors(기존 경고 1) / unit 120 pass / live-map e2e(bays/floors/auto/edit-advanced) 5 passed + Playwright 스크린샷 육안 확인.

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
