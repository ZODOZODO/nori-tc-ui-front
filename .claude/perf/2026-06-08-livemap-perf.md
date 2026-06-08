# live-map 성능 측정 — 2026-06-08 (measurement-first)

## 측정 환경
- backend :8080 HTTP 401(가동) / front dev :3000 HTTP 200 / prod preview :4173 HTTP 200
- 측정기: `tests/e2e/_perf_livemap.mjs` (모드별 진입 ms + 층 전환 ms + console/pageerror 수집). MOCK 모드로 prod preview 격리 측정(54대).
- 측정 JSON: `.claude/perf/measurements/livemap-dev-*.json`, `livemap-prod-mock54-*.json`

## 빌드 baseline
```
LiveMapPage  387.87 kB │ gzip: 119.12 kB
three-vendor 1,109.62 kB │ gzip: 309.00 kB
✓ built in 23.47s
```

## 런타임 측정 (설비 54대)

| 단계 | dev (StrictMode 2×) | prod (단일 렌더) |
|---|---|---|
| click3D → scene visible | 155 ms | 118 ms |
| **scene visible → 첫 설비 렌더** | **8,504 ms** | **3,086 ms** |
| floor_all / 1 / 2 / 3 | 5,296–10,759 ms | 751–6,668 ms |
| builder 진입 | 9,791 ms | 3,362 ms |
| console.error / pageerror | 0 / 0 | 0 / 0 |

## 분류
- **P1 (백엔드)**: 없음. `/api/live-map` 등 응답 <35ms. UI 변경 대상 아님.
- **P2/P3 (클라이언트 렌더)**: **설비 54대 마운트 = prod 3.1초**가 단일 최대 병목. 결함(defect)은 0 — 순수 성능.
  - 잔존 비용 원천: ① 메시 객체 ~864개(54×~16) 생성·reconcile·draw call ② drei `<Html>` 뱃지 54개 포털 마운트.
  - 이미 적용: 공유 지오메트리/머티리얼(지오메트리-gen↓), memo, visible 토글, smoothness/세그먼트↓, three-vendor 분리, 그림자맵 512.
  - 남은 레버(미적용, 측정으로 검증 예정):
    - (A) Html 뱃지 54 → hover/선택 시에만(상태는 시그널타워 색 유지) — 포털 마운트 제거.
    - (B) InstancedMesh — 정적 부품 864 객체 → ~10 instanced. 선택/드래그/뱃지 연동 리팩터(위험·시간 큼).

## 결함 탐지 방법(확립)
- `_perf_livemap.mjs` 가 `page.on('console', error)` + `page.on('pageerror')` 로 전 과정 수집 → 현재 0건.
- 회귀 가드는 기존 e2e 스펙(`live-map-3d-*.spec.ts`)이 각 시나리오에서 `consoleErrors/pageErrors == []` 단언.

## 귀속 측정 (메시 vs 뱃지)
| 버전 | 메시 수(54대) | firstBadge (prod mock54) |
|---|---|---|
| 전체 설비 | 864 (54×16) | 3,086–5,849 ms |
| 최소(플린스+메인프레임) | 108 (54×2) | 1,595–2,343 ms |

→ 메시 864→108 = firstBadge **약 절반 감소**. **메시 수가 비용의 ~절반(확증)**. 잔여 ~1.6–2.3초 = 54 Html 뱃지 + 씬(조명/그림자/ContactShadows) 기반.

## Phase1 인스턴싱 결과 — 진입엔 효과 없음(측정 반증)
drei `<Instances>`/`<Instance>` 로 부품 종류당 1 draw call 화(LiveMap3DEquipmentField). e2e 7 통과. prod firstBadge 스케일링:

| 설비 수 | firstBadge (prod mock) |
|---|---|
| 1 | ~1.4s |
| 54 | 3.8s (baseline 3.1s — 개선 없음) |
| 200 | 4.5s |
| 500 | 9.0s |

→ **진입(firstBadge)은 GPU draw call 이 아니라 React 재조정 + DOM 바운드.** drei `<Instance>` 는 draw call 만 O(부품)로 줄이고 **`<Instance>` React 엘리먼트는 O(N×부품) 그대로** + **뱃지 drei Html O(N)** → 진입 불변. 인스턴싱은 프레임률(pan/rotate at scale)엔 도움이나 그 축은 미측정. 진입 구조: **고정 base ~1.4s + 설비당(뱃지 + per-instance React 엘리먼트)**.

## 진입(entry) 진짜 해법 — 측정 기반
1. **on-demand 뱃지**: drei Html O(N)→O(선택). 상태는 모델 색(시그널타워, 이미 instanceColor)으로. e2e 선택 기제(뱃지 클릭) 재작성 필요.
2. **manual InstancedMesh**(imperative instanceMatrix/instanceColor): drei `<Instance>` 의 O(N×부품) React 엘리먼트 → O(부품). 진입의 per-설비 비용 제거.
3. **base ~1.4s 축소**: 그림자/ContactShadows/Grid 초기 렌더 비용. (그림자 off / ContactShadows frames=1 등)

## Phase2 단일 오버레이 뱃지 — 진입 firstBadge 직격(측정 확증)
N개 drei Html 포털 → Canvas 밖 단일 DOM 오버레이(plain 버튼 N) + Canvas 안 BadgeProjector(useFrame 좌표 갱신). e2e 5 통과.
- firstBadge: 54대 3,835ms → **7ms** (뱃지가 진입 비용의 큰 축이었음 확증).
- 그러나 층 전환/builder 는 여전히 N 비례(54: floor 2.1s / 500: floor 14s). 원인: drei `<Instance>` 가 **O(N×부품) React 엘리먼트** → 매 리렌더 재조정. draw call 만 O(부품), React 는 O(N×부품) = 반쪽 인스턴싱.

## Phase3 manual InstancedMesh — 적용·측정
drei `<Instances>`/`<Instance>` → 수동 `<instancedMesh>` ×부품 + useLayoutEffect `setMatrixAt`/`setColorAt`. React 엘리먼트 O(부품), 인스턴스 갱신 JS 루프. 선택=mainframe instanceId. e2e 6 통과.
- firstBadge: 6~7ms 유지(뱃지 오버레이 효과).
- 정상상태 층 전환(floor_3, 마운트 정착 후): 54대 1.0s / 500대 1.8s — 합리적.
- floor_1(첫 전환)은 초기 메시 마운트 tail 오염으로 노이즈(54 1.7s / 500 15s) — 정상상태 아님.
- builder 전환은 여전히 N 비례(500 ~10s) — 미해결.

## 종합 (현재)
- **진입 라벨**: 3,835ms→7ms (확정 win).
- **아키텍처**: 인스턴싱으로 draw call·메시 React 엘리먼트 O(부품). 1000대 GPU 부담 제거(프레임률, 미측정).
- **남은 비용(per-N)**: 초기 메시 마운트 + builder/첫 전환. 후보: 뱃지 오버레이 N버튼 재조정 / ContactShadows·그림자 / base 셰이더. 추가 isolation 필요.
- **시각 검증 미완**: 인스턴싱 재작성은 drei판과 동일 transform 이라 외형 동일 예상이나 브라우저 육안 확인 필요.

## 다음 (측정 기반 후보)
- 측정 기준선 확정: **prod firstBadge ~3,000 ms** (변동 3.0–5.8s, 머신 부하 영향).
- 후보(한 번에 하나 → after 재측정 → 효과 없으면 롤백):
  - **B 설비 모델 간소화** (메시 ~16→~6/대) — 메시 절반 직격(확증된 레버), 외형 단순화. 중간 위험.
  - **C InstancedMesh** — 정적 부품 864→~13 객체, 외형 유지. 선택/드래그/뱃지 연동 리팩터 = 고위험/고시간.
  - **A 뱃지 단일 오버레이** — drei Html 54 포털→1, 항상표시 UX 유지. 잔여 비용 직격. 중간.

## 뷰어(2D) 느림 — 번들 근본 원인 + 수정 (측정 확증)

**측정 공백 지적(사용자)**: 그간 측정기는 3D + builder 만 쟀고 **기본 모드인 2D 뷰어를 독립 측정 안 함**. `_perf_livemap.mjs` 에 `viewer_firstNodeVisible` + `back_to_viewer` 추가, three-vendor 네트워크 검증기 `_verify_lazy_three.mjs` 신설.

**측정**: 뷰어 렌더 자체는 빠름 (firstNode 8–10ms, back_to_viewer 142–429ms). 진짜 원인은 **번들** — 2D 뷰어 진입에 three.js(gzip 245KB)가 *항상* 다운로드됨. 뷰어는 three 를 한 줄도 안 쓰는데도.

**3단 추적**:
1. [LiveMapPage.tsx:12,14](../../src/features/live-map/components/LiveMapPage.tsx) 가 3D/builder 를 **정적 import** → 뷰어 청크가 three 정적 의존.
2. lazy 전환 후에도 **엔트리(index-*.js)가 three-vendor 정적 import** — `scheduler`(react-dom↔@react-three/fiber 공유 의존)가 배열형 manualChunks 에서 three-vendor 로 오버킷됨. 배열형은 전이 공유 의존을 못 옮김(추가해도 청크 해시 불변으로 확증).
3. 함수형 전환 + scheduler→react-vendor 후에도 **LiveMapPage 가 three-vendor 에서 `{m,x}` 정적 import** — [LiveMapStructureLayer.tsx:2](../../src/features/live-map/components/LiveMapStructureLayer.tsx#L2) 의 `react-konva` → `react-reconciler`(@react-three/fiber 와 공유) 가 three-vendor 로 오버킷됨.

**수정**:
- (a) `LiveMap3DScene` / `LiveMapObjectEditor` → `lazy()` ([LiveMapPage.tsx](../../src/features/live-map/components/LiveMapPage.tsx))
- (b) [vite.config.ts](../../vite.config.ts) `manualChunks` 배열형 → **함수형**, `scheduler` → react-vendor 고정
- (c) konva 스택(`konva` + `react-konva` + `react-reconciler`) → 전용 `konva-vendor` 청크 (뷰어가 실제 쓰는 것만, three 와 분리). react-vendor 에 넣으면 live-map 외 페이지까지 react-reconciler 끌려오므로 분리.

**결과 (측정 확증)**:
| 항목 | before | after |
|---|---|---|
| 뷰어 진입 three-vendor 네트워크 요청 | 1건 | **0건** (PASS) |
| 3D 클릭 시 three-vendor 로드 | (이미 로드됨) | **1건** (올바른 on-demand) |
| LiveMapPage 청크 gzip | 120.06 KB | **13.41 KB** |
| 뷰어 critical path three.js | 245 KB gzip 다운로드 | **제외** (konva-vendor 95KB만, 뷰어 실사용) |
| three-vendor 청크 | 1,099 KB | 910 KB (react-reconciler 제거) |

검증: prod preview MOCK 54 전 모드(뷰어→3D→floor→builder→복귀) console/pageerror **0**, eslint **0**, live-map e2e **14 PASS** (1.4m).

**핵심 교훈**: manualChunks 배열형은 **전이 공유 의존(scheduler, react-reconciler)** 을 의도한 청크로 못 옮긴다 → 상시 로드 청크가 lazy 청크(three-vendor)를 정적으로 끌어오는 오염 발생. 함수형 + 공유 의존 명시 라우팅으로만 해결. 커스텀 react 렌더러(react-konva, react-three-fiber)를 같은 페이지에서 쓰면 공유 reconciler 의 청크 배치가 lazy 분리를 무력화할 수 있음.
