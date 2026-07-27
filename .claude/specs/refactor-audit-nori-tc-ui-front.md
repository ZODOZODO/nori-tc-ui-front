# 리팩토링 캠페인 Phase 1 감사 — nori-tc-ui-front (S09)

> 캠페인 SPEC: `c:\workspace_nori\nori-tc-common\.claude\specs\nori-tc-refactor-campaign.md`
> 방법론 v5: `...\refactor-campaign-prompts.md` / Plan: `...\nori-tc-refactor-campaign-plan.md`
> hotspot 입력: `...\refactor-hotspots.md` §1·§2·§3 nori-tc-ui-front (deep 배분 **1순위**)
> 선행 감사 입력: `c:\workspace_nori\nori-tc-ui-backend\.claude\specs\refactor-audit-nori-tc-ui-backend.md` (S08 — 축 F 대조 상대편)
> **읽기 전용 세션** — 코드 수정 0. 산출물은 본 md 1개. 롤백 = 본 파일 삭제.

---

## §0 분석 기준

### 0.1 대상 · HEAD

| 항목 | 값 |
|---|---|
| 레포 | `c:\workspace_nori\nori-tc-ui-front` |
| HEAD SHA | `761d41f7d791e31c4da44a6fb04e5a037cc6d31a` |
| HEAD 커밋 | `761d41f Merge branch 'feature/eqp-reconnect-and-stuck-visual' into 'main'` (2026-07-16 15:16 +0000) |
| git status | clean (`git status --porcelain` 출력 0줄) |
| hotspot 기준 SHA | `761d41f7...` (`refactor-hotspots.md` §0) — **현재 HEAD 와 일치**. 재현 기준 편차 없음 |
| 감사일 | 2026-07-27 |
| 런타임 | node 22.22.0 / npm 11.9.0 |

### 0.2 산출물 경로 사전 확인 — **exec 식 예외 불필요**

Plan 은 exec(`.gitignore:139` = `.claude/`) 만 common 경로 예외를 둔다. ui-front 는 해당하지 않는다.

```
$ grep -n "claude" .gitignore
38:.claude/settings.local.json
39:.claude/scheduled_tasks.lock
40:.claude/progress/
41:.claude/harness/
42:.claude/perf/
43:.claude/mr-review/

$ git check-ignore -v .claude/specs/probe.md
(출력 없음 — 무시 대상 아님)
```

`.claude/` **전체가 아니라 6개 하위 경로만** 무시된다. `.claude/specs/` 는 git 추적 대상이므로
Plan 이 지정한 경로(`c:\workspace_nori\nori-tc-ui-front\.claude\specs\refactor-audit-nori-tc-ui-front.md`)를 그대로 사용한다.

### 0.3 규모 (source 만 집계 — `node_modules`/`dist`/빌드 산출물 제외)

| 디렉터리 | 파일 | LOC |
|---|---|---|
| `src/features` | 199 | 41,449 |
| `src/shared` | 35 | 2,443 |
| `src/components` | 11 | 1,099 |
| `src/dev` | 2 | 298 |
| `src/i18n` | 6 | 217 |
| `src/app` | 3 | 157 |
| `src/lib` | 1 | 10 |
| **합계 (src)** | **258** (tsx 113 / ts 145) | **45,695** |
| `tests/unit` (git 추적) | 26 | — |
| `tests/e2e` (gitignore, 로컬 전용) | 59 | — |

측정 명령:
```bash
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | wc -l          # 258
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec cat {} + | wc -l   # 45695
find tests/unit -type f -name "*.ts*" | wc -l   # 26
find tests/e2e  -type f -name "*.ts*" | wc -l   # 59
```

- `src/features` 가 전체 LOC 의 **91%** — 도메인 10개(auth/deploy/dlq/eqp/group/live-map/model/profile/user/user-management).
- **비 Gradle 레포** — JaCoCo·ArchUnit·`*ModuleConfiguration` 개념이 존재하지 않는다. 게이트는 `npm run build` + `npm run test:unit`
  (`package.json:8-9` 실측). 의존성 dep 30 / devDep 17.

### 0.4 hotspot 깊이 배분 — ui-front 는 deep **1순위**

`refactor-hotspots.md` §1/§3: 상위 6개가 1,386~1,712 LOC 이고 **unit 안전망이 0**이다. LOC 는 본 감사가 재측정해 전부 일치했다.

| 파일 | churn | LOC(hotspot) | LOC(본 감사) | import | 훅 호출 | useState | useEffect | unit test | 본 감사 처리 |
|---|---|---|---|---|---|---|---|---|---|
| `src/features/eqp/components/EqpPage.tsx` | 22 | 1712 | **1712** | 48 | **100** | 15 | 3 | **없음** | **함수/훅 단위 deep** |
| `src/features/deploy/components/DeployRegisterPanel.tsx` | 16 | 1566 | **1566** | 31 | 66 | 9 | 4 | **없음** | 함수/훅 단위 deep |
| `src/features/deploy/components/DeployMonitorPanel.tsx` | 14 | 1499 | **1499** | 29 | 57 | 9 | 5 | **없음** | 함수/훅 단위 deep |
| `src/features/model/components/ModelPage.tsx` | 21 | 1487 | **1487** | 27 | 80 | 21 | 3 | **없음** | 함수/훅 단위 deep |
| `src/features/eqp/components/EqpManageFormModal.tsx` | 14 | 1414 | **1414** | 12 | 12 | 4 | 0 | **없음** | 함수/훅 단위 deep |
| `src/features/live-map/components/LiveMap3DScene.tsx` | 10 | 1386 | **1386** | 22 | 63 | 10 | 9 | **없음** | 함수/훅 단위 deep |
| `src/features/model/components/ModelDetailPanel.tsx` | 31 | 1188 | **1188** | 23 | 31 | 6 | 2 | **없음** | 파일 단위 |
| 그 외 251 파일 | — | — | — | — | — | — | — | — | 파일 단위 wide |

**hotspot 권고 검증 (hotspots §1 "분할 전 lib 추출 + unit 보강 선결")** — **권고가 타당함을 확인했다**.
`tests/unit` 26개는 전부 순수 함수/모델 계층(`model-detail-editor` / `live-map-3d-model` / `mdf-message-parser` /
`eqp-runtime-state` / `flow-card-render` 등)만 검증하며, **위 7개 컴포넌트를 직접 렌더하는 unit 테스트는 0개**다.
안전망은 `tests/e2e` 59개뿐인데 이는 gitignore 로컬 전용이라 CI 게이트가 아니다(§8.3).

**P0-3 characterization 후보 (무테스트 고LOC · 축 D 발견 소재지 우선)**
1. `EqpPage.tsx`(1712) — **D-1 소재지**. lifecycle/폴링 오케스트레이션 로직을 `src/features/eqp/lib/` 로 추출 후 unit 박제.
2. `LiveMap3DScene.tsx`(1386) — **D-4 소재지**. `SelectionBox`/`shapeBoundingBox`/저장 시퀀스(`:1004`)를 lib 로 분리.
3. `DeployRegisterPanel.tsx`(1566) / `DeployMonitorPanel.tsx`(1499) — co-change 쌍(10). 두 파일 공통 필터·집계 로직 우선.
4. `ModelPage.tsx`(1487) / `ModelDetailPanel.tsx`(1188) — co-change 15(레포 최대). `model-detail-editor.ts` 에 이미 unit 이 있으므로 **컴포넌트 잔여 로직만** 추출 대상.

### 0.5 방법 · 도구 버전 (재현성)

| 축 | 수행 주체 | 도구 / 명령 |
|---|---|---|
| A 죽은 코드 | **메인 세션 직접** | `npx --yes knip@latest --no-progress` (**knip 6.29.0**) + 글로벌 규칙의 **4곳 검증** |
| B 중복 | **메인 세션 직접** | `npx --yes jscpd@latest src --min-lines 20 --min-tokens 100 --format "typescript,tsx"` (**jscpd 5.0.12**) + 수동 확인 |
| C smell | **메인 세션 직접** | LOC·import·훅 호출 수 실측(§0.4) + jscpd 파일 내부 클론 |
| D 결함 | 읽기 전용 서브에이전트 1 → **채택 전건 메인 세션 재검증** | 6 카테고리 전수 |
| E 보안 | 읽기 전용 서브에이전트 1 → **채택 전건 메인 세션 재검증** | XSS/토큰/로깅/시크릿/게이팅 + `npm audit`(메인 세션 실행) |
| F 계약 | 읽기 전용 서브에이전트 1 → **메인 세션이 스크립트로 독립 재추출·대조** | REST/실시간/스토리지/라우트 |

- **S08 편차 시정**: S08 은 서브에이전트에 Write 도구가 없어 중간 파일을 남기지 못했다. 본 세션도 Explore 계열
  읽기 전용 에이전트를 썼으므로 같은 제약이 있었으나, **메인 세션이 반환값 수령 즉시 본 문서에 통합**했고
  축 A·B·C·F 는 애초에 메인 세션이 직접 수행해 서브에이전트 의존도를 낮췄다. 여전히 "세션 중단 시 재개" 의도는 부분 미충족(§8.4).
- **반증 우선**: 각 P2 후보에 대해 "이 시나리오가 성립하지 않는 이유"를 먼저 탐색하고, 반증에 실패한 것만 P2 로 채택했다.
  반증에 성공해 강등·기각한 항목은 §0.6 에 전부 남겼다.
- **채택 P1/P2 전건을 메인 세션이 직접 file:line 재검증**했다(§8.2).
- **dev 서버·Playwright 미실행** — 탐지 전용 세션(프롬프트 규율). 시각·성능 검증은 Phase 3 트랙.
- `/ui-front-quality` 스킬은 실재하나 **방법론상 감사와 독립인 병행 세션**이므로 본 세션에서 호출하지 않았다 → §8.5 병행 실행 후보.

### 0.6 심각도 조정 노트 (서브에이전트 라벨 → 본 감사 확정 라벨)

캠페인 척도: **P1 = 장애·보안 즉시(무선행조건) / P2 = 잠재(선행조건·저빈도 경합) / P3 = 품질**.
서브에이전트 라벨을 그대로 쓰지 않고 아래와 같이 재조정했다.

| 항목 | 서브에이전트 | 본 감사 | 조정 근거 (직접 확인) |
|---|---|---|---|
| E-1 프로덕션 console 미제거 + `userPk` 로깅 | P2 | **P3** | **반증 대부분 성립.** `src` 전체 `console.*` 는 **8건뿐**이고(전수 인용 §5.4) 토큰·비밀번호·응답 본문은 0건이다. 남는 노출값은 `userPk`(내부 숫자 PK, 본인 세션에서 이미 가시)와 `errorCode` 뿐이라 "보안 사고" 로 보기 어렵다. 실질 결함은 **프로덕션 console 제거 파이프라인 자체의 부재**(hardening) → P3 |
| 축 D D-1/D-2 (lifecycle·polling 중복 명령) | P2 | **P2 유지** | 메인 세션이 `EqpPage.tsx:919-943, 946-981, 983-995` + `EqpLifecycleActionDialog.tsx:80,87` 를 직접 열어 `mutateAsync` settle ↔ 60초 폴링 구간의 `isPending` 공백을 확인. 반증 실패 |
| 축 D D-4 (`EdgesGeometry` 미dispose) | P2 | **P2 유지** | `LiveMap3DScene.tsx:165-168` `useMemo([size])` + 호출부 `:378` 이 매 렌더 새 배열 리터럴을 넘기는 것을 직접 확인. 설비 경로는 모듈 상수(`:149`)라 안전 → **구조물 선택 경로 한정**이라 P1 아님 |
| 축 D D-3 (에러 경계 0건) | P2 | **P2 유지** | `ErrorBoundary`/`componentDidCatch`/`getDerivedStateFromError`/`react-error-boundary` 전 레포 0건 + `Router.tsx:61-83` 이 `<BrowserRouter>+<Routes>` 조합이라 `errorElement` 적용 자체가 불가함을 직접 확인 |
| 축 D D-5~D-10 | P3 | **P3 유지** | 부분 반증(자가 치유 경로 존재·발생 조건 협소)이 성립해 서브에이전트도 P3 로 내렸고 본 감사도 동의 |
| 축 E E-3 (라우트 인증 가드 부재) | P2 | **P2 유지 — 단 범위 축소 명시** | `AppTopBar.tsx:125-142` logout 이 `clearDeployUiSessionState()` 를 **호출하지 않음**을 직접 확인(호출처는 EqpPage/ModelPage/LiveMapPage/DeployPage 4곳뿐) → 같은 탭 잔여 렌더 시나리오 성립. 다만 **서버 데이터 유출은 아니다**(401 차단) → P1 아님 |
| 축 E E-4 (eqp/model/deploy 게이팅 0) | P2 | **P2 유지** | `app-navigation.ts:17-24` 에 세 항목만 `requiredPermission` 미선언 + `permission.ts:1-51` 에 EQP_*/MODEL_*/DEPLOY_* 상수 자체가 부재함을 직접 확인. 백엔드 closed-by-default 강제(S08 §5.1)가 데이터 유출을 막으므로 P1 아님 |
| 축 F "`PUT /api/model/{}/details/{}` 가 백엔드에 없음" | (메인 세션 1차 추출) | **기각 — FALSE** | 본 감사의 백엔드 추출 정규식이 **다중행 애노테이션**(`@PutMapping(\n path = ...)`)을 놓친 계측 오류. `ModelDetailController.java:55-58, 130-133` 에 실재한다. **감사 자체의 오탐 기록으로 보존**(§6.1) |
| 축 F "DLQ GET 4종을 프론트가 호출하지 않음" | (메인 세션 1차 추출) | **기각 — FALSE** | `dlq.api.ts:43-46` 이 경로를 **변수로 주입**(`fetchDlqList(path)`)해 호출부 `:53,59,65,71` 이 리터럴 밖에 있었던 계측 오류. 4종 모두 호출된다. **오탐 기록으로 보존** |
| 축 A knip "`tests/i18n-test-instance.ts` 미사용" | (knip 출력) | **기각 — FALSE** | `tests/alias-hooks.mjs:18` 이 `pathToFileURL(join(TESTS_DIR,'i18n-test-instance.ts'))` 로 **동적 경로 해석**해 로드한다. knip 이 못 보는 경로 → **도구 출력을 결론으로 쓰지 않는다**는 규율의 실증 사례 |
| 축 A knip "unused exports 54" | (knip 출력) | **부분 기각** | 54 중 **30개가 shadcn/ui 프리미티브의 배럴 재export**(`confirm-dialog`/`context-menu`/`dialog`/`select`/`table`)로, 라이브러리 표면을 의도적으로 완전 노출한 것이라 dead 로 채택하지 않는다. 나머지 24개만 A-4 로 항목화 |

**P1 판정**: **0건.** 근거는 §7 — 채택 전건이 선행조건(배포 직후 stale chunk / 60초 폴링 창 / 구조물 편집 세션 / 특정 permCode 부여 / 같은 탭 재사용)을 요구한다.
프론트 권한 게이팅 부재(E-4)는 **백엔드 closed-by-default 강제**(S08 §5.1 — 108 엔드포인트 미게이팅 0건, 코드로 재확인)가 데이터 경계를 지키므로 P1 이 아니다.

---

## §1 축 A — 죽은 코드 / 불필요 로직

### 1.1 knip 원시 출력 (1차 입력, 결론 아님)

`npx --yes knip@latest --no-progress` (knip **6.29.0**), exit 1:

| 카테고리 | 원시 건수 | 4곳 검증 후 채택 |
|---|---|---|
| Unused files | 7 | **6** (1건 오탐 — `tests/i18n-test-instance.ts`) |
| Unused dependencies | 1 (`recharts`) | 1 |
| Unlisted dependencies | 1 (`three-stdlib`) | 1 (**P2 로 승격** — A-3) |
| Unused exports | 54 | **24** (30건은 shadcn 배럴, §0.6) |
| Duplicate exports | 1 | 1 |

### 1.2 A-1 / R1 / R / **P3** — 미사용 파일 6개 (446 LOC)

**위치·인용**

| 파일 | LOC | 정의 라인 |
|---|---|---|
| `src/features/live-map/components/LiveMap3DEquipment.tsx` | 211 | `:174 export const LiveMap3DEquipment = memo(function LiveMap3DEquipment({ equipment }: ...` |
| `src/features/deploy/components/DeployStatusChart.tsx` | 110 | `:34 export function DeployStatusChart({ aggregate }: { aggregate: DeployStatusAggregate })` |
| `src/features/live-map/components/LiveMapToolbar.tsx` | 75 | `:24 export function LiveMapToolbar({` |
| `src/shared/layout/PageFooter.tsx` | 25 | `:14 export function PageFooter({ year, className }: PageFooterProps)` |
| `src/features/live-map/components/LiveMapLegend.tsx` | 24 | `:10 export function LiveMapLegend()` |
| `src/features/group/types/index.ts` | 1 | `export * from './group.types'` (배럴, importer 0) |

**4곳 검증 (글로벌 규칙 — UI dead 단정 전 필수)**

| 검증처 | 방법 | 결과 |
|---|---|---|
| ① UI 진입점 (사이드바/메뉴/버튼 filter) | `src/shared/lib/app-navigation.ts:17-24` 의 nav 6항목 + `AppTopBar.tsx:152-181` 렌더러 전수 대조 | 6개 파일 어느 것도 참조 없음 |
| ② URL 라우팅 / deep link | `src/app/Router.tsx:61-83` 전문 정독 — 라우트 11개(리다이렉트 2 + 페이지 7 + DEV fixture 2) | 대응 라우트 0 |
| ③ store mutation 호출처 | zustand `persist`/`setState` 보유 store 전수(`deploy-ui`/`eqp-ui`/`model-ui`/`shared-layout`/`theme`) grep | 참조 0 |
| ④ 외부 호출 (테스트 / 타 레포 / API) | `tests/` 전체 grep 0건 + 각 파일 `data-testid` **0개**(e2e 선택자 부재) + `c:\workspace_nori\*` 전 레포 Grep | 코드 참조 0. `nori-wm-ui-front\src\shared\layout\PageFooter.tsx` 는 **별개 복제본**, 나머지 히트는 `.claude/specs/*.md` 문서 서술 |
| ⑤ 동적 참조 | `lazy(`/`import(` 전수(`Router.tsx:5-50`, `EqpPage.tsx:21-22`) | 참조 0 |

**확신도 HIGH** (5개 검증처 전부 통과). **제거는 이 세션에서 하지 않는다.**

**주의 (오판 방지 기록)** — `LiveMap3DEquipment` 는 `.claude/specs/live-map-3d.md:8,46,47` 과
`nori-tc-common\.claude\specs\port-carrier-id-lifecycle{,-plan,-dev-report}.md` 가 **현역 소비처로 서술**한다.
실제로는 InstancedMesh 방식 `LiveMap3DEquipmentField.tsx` 로 대체된 뒤 남은 잔재다. 제거 시 **해당 SPEC 문서들도 동시 정정** 필요.
`LiveMapToolbar` 는 `live-map-layout-builder-phase1-plan.md:264` 가 "lineOptions prop 보유하나 현재 미연결 — 통합 필요" 로
**미연결 상태를 이미 인지**하고 있다 → 제거 vs 통합은 사용자 결정 사항.

**[검증 보정] (S10 세션 완결성 게이트, 2026-07-27)** — 위 §1.2 ④ 의 "나머지 히트는 `.claude/specs/*.md` 문서 서술" 은
**ui-front 레포 밖 문서 1건을 누락**했다. 게이트가 `c:\workspace_nori` 전 레포 Grep 을 재실행해 확인한 추가 히트:
`c:\workspace_nori\nori-tc-exec\docs\Architecture\ui\front\10-live-map-dashboard-and-demo-control.md:15` 이
`LiveMapToolbar` 를 구성요소로 서술한다. **코드 참조가 아니므로 dead 판정(확신도 HIGH)은 그대로 유효**하며,
제거 시 동시 정정이 필요한 문서 목록에 이 exec 아키텍처 문서를 추가한다.

**심각도** P3 · **난이도** S · **다운스트림** 없음(ui-front 내부. 단 제거 시 위 SPEC 문서 정정 동반)

### 1.3 A-2 / R1 / R / **P3** — 미사용 의존성 `recharts`

**위치** `package.json:41` `"recharts": "^3.8.1"`
**근거** 유일한 import 가 A-1 의 죽은 파일 `DeployStatusChart.tsx:2` (`import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'`).
`grep -rn "recharts" src` → 이 1줄뿐.
**문제** 차트 라이브러리 1개가 번들 후보 + 취약점 감시 대상으로 남아 있으나 실제 렌더 경로가 없다.
**A-1 과 동시 처리 대상** — 파일을 지우면 의존성도 함께 제거된다.
**심각도** P3 · **난이도** S · **다운스트림** 없음

### 1.4 A-3 / R1·R8 / **F** / **P2** — `three-stdlib` 가 **실사용 중인데 package.json 에 미선언**

**위치** `package.json` (`dependencies` 에 `three-stdlib` 부재) ↔ 실사용 2곳
```ts
// src/features/live-map/components/LiveMap3DEquipmentField.tsx:2   ← 살아있는 파일
import { RoundedBoxGeometry } from 'three-stdlib'
// src/features/live-map/components/LiveMap3DEquipment.tsx:3        ← A-1 의 죽은 파일
import { RoundedBoxGeometry } from 'three-stdlib'
```
**문제** knip 이 `Unlisted dependencies (1) three-stdlib` 로 보고했다. 현재 해석되는 이유는
`@react-three/drei` 의 전이 의존(`package-lock.json:2677` `"three-stdlib": "^2.35.6"`)뿐이다.
`vite.config.ts:45` 는 `three-stdlib` 를 `three-vendor` 청크로 명시 라우팅하고 있어 **빌드 구성이 이 패키지를 전제**한다.
**실패 시나리오** drei 를 마이너 업그레이드해 `three-stdlib` 전이 의존이 빠지거나 hoisting 이 달라지면,
`LiveMap3DEquipmentField.tsx:2` 가 해석 실패해 **`npm run build` 가 깨지고 3D 뷰 전체가 로드 불가**가 된다.
lockfile 재생성·CI clean install 환경에서 재현 가능하다.
**반증 시도** ① 죽은 파일만의 문제인가 → **아니다**. `LiveMap3DEquipmentField.tsx` 는 3D 씬의 현역 설비 렌더러다(A-1 검증에서 live 확인).
② npm 이 자동 보정하는가 → 전이 의존은 계약이 아니다. drei 가 dependencies 에서 빼면 즉시 깨진다.
③ 현재 빌드가 성공하니 문제 없는가 → 현재 lockfile 에 한정된 우연이며, 계약 부재라는 결함은 그대로. **반증 실패.**
**심각도** **P2** (선행조건: drei 업그레이드 또는 lockfile 재생성) · **난이도** S (`package.json` 에 명시 선언 1줄) · **다운스트림** 없음

### 1.5 A-4 / R1 / R / **P3** — 미사용 export 24개 (shadcn 배럴 30건 제외)

knip 원시 54건에서 `src/components/ui/**`(shadcn 프리미티브 재export 30건)를 뺀 나머지. 대표:

| export | 위치 | 종류 |
|---|---|---|
| `useSimulatorRun` | `src/features/live-map/hooks/useSimulatorRun.ts:10` | **훅 전체** (같은 모듈의 `isTerminalRunState` 만 소비됨 — `LiveMapDemoModal.tsx:20`) |
| `PrimitiveImage` | `src/features/live-map/components/LiveMapKonvaPrimitive.tsx:28` | 컴포넌트 (E-6 의 소재지) |
| `mapGatewayToFeed` / `mapBusinessToFeed` / `mapQuarantineToFeed` / `mapRepairTaskToFeed` / `FEED_LIMIT` | `src/features/dlq/lib/dlq-feed.ts:11,31,40,49,58` | 같은 모듈의 `buildDashboardFeed` 만 소비(`DashboardPanel.tsx:14-18`) |
| `UserInfo` / `UserPage` / `UserPageResponse` / `UserUpdateRequest` / `UserPasswordResetRequest` / `UserInfoResponse` / `UserUpdateResponse` / `UserPasswordResetResponse` | `src/features/profile/types/profile.types.ts:54-61` | 타입 8종 재export |
| `layoutQueryKeys` | `src/features/live-map/hooks/useLayout.ts:8` | 쿼리 키 (모듈 내부 사용만) |
| `DCOP_COLLECTION_RULE_OPTIONS` / `PLC_AREA_OPTIONS` / `PLC_DATA_TYPE_OPTIONS` / `PLC_BCD_SIGNED_OPTIONS` | `src/features/model/components/modelDetailColumnDefs.tsx:43,46,49,55` | 옵션 상수 |
| `GridCoord` / `GridRange` / `SelectableTableFeatures` / `SelectableTablePasteHandler` / `SelectableTableRenderCellHelpers` | `src/shared/components/SelectableTable/index.ts:4-9`, `types.ts:25` | 타입 배럴 |

**확신도** — `useSimulatorRun`·`PrimitiveImage` 는 **MEDIUM**(§1.7 참조), 타입/상수 재export 는 **HIGH**(런타임 참조 불가능).
**심각도** P3 · **난이도** S · **다운스트림** 없음

### 1.6 A-5 / R1 / R / **P3** — 중복 export 1건

`src/features/live-map/lib/live-map-3d.model.ts` 가 `LIVE_MAP_WORLD_SCALE` 과 `LIVE_MAP_SNAP_PX` 를 중복 export(knip `Duplicate exports (1)`).
**심각도** P3 · **난이도** S · **다운스트림** 없음

### 1.7 "죽은 코드 아님" 으로 판정한 항목 (오판 방지 기록)

| 후보 | 판정 근거 |
|---|---|
| `tests/i18n-test-instance.ts` (knip unused file) | **오탐.** `tests/alias-hooks.mjs:18` 이 `pathToFileURL(join(TESTS_DIR,'i18n-test-instance.ts'))` 로 동적 로드 → `npm run test:unit` 174개 전부가 이 경로에 의존 |
| `src/components/ui/**` 의 재export 30개 | shadcn/ui 프리미티브의 **의도적 완전 표면 노출**. 개별 소비 여부로 dead 판정하지 않는다 |
| `src/dev/SelectableTableFixture.tsx` / `LayoutShellFixture.tsx` | `Router.tsx:41-50, 73-78` 이 `import.meta.env.DEV` 조건부로 등록. e2e fixture 라 **의도된 코드** |
| `src/features/profile/**` | 라우트는 없으나 `UserProfileModal`·`useMe` 를 5개 페이지가 import(`EqpPage.tsx:54-55`, `DeployPage.tsx:2`, `DlqPage.tsx:3-4`, `LiveMapPage.tsx:5`, `LiveMap3DScene.tsx:6` 등) — **모달 기반 기능이지 dead 아님** |
| `useSimulatorRun`(A-4) | 확신도 **MEDIUM**. `useSimulatorRunList`(폴링 목록)가 실질 대체재로 보이나 데모 실행 단건 폴링 재도입 가능성이 있어 제거 단정 보류 |
| `PrimitiveImage`(A-4) | 확신도 **MEDIUM**. Konva `shape_json` 의 `type:'image'` 분기용으로, 서버 데이터에 해당 type 이 들어오면 필요해진다 → **API 응답 의존**이라 정적 grep 만으로 dead 단정 금지 |

**"미사용" 단정에 사용한 검색 범위**: `c:\workspace_nori` **전 레포**
(`Grep pattern="DeployStatusChart|LiveMap3DEquipment\b|LiveMapLegend|LiveMapToolbar|PageFooter|i18n-test-instance" path=c:\workspace_nori`)
+ 레포 내 `src`/`tests`/`package.json`/`*.mjs` 전수. 동적 import·라우팅·store·`data-testid` 경유 사용도 §1.2 표대로 개별 확인했다.

### 1.8 축 A 0건 항목 — 실행 명령·검색 범위

| 항목 | 결과 | 실행 명령 · 범위 |
|---|---|---|
| 미참조 top-level 컴포넌트(§1.2 6건 외) | **0건** | `npx knip@latest` 의 Unused files 카테고리 전수(7건) 를 4곳 검증 → 6건 채택, 1건 오탐. 그 외 없음 |
| 항상 참/거짓 조건 · 도달 불가 분기 | **0건 (hotspot 7파일 한정)** | 7개 hotspot 전문 정독 + `grep -nE "if \(true\)\|if \(false\)\|\?\? \[\]\s*\)\s*:" src/features/{eqp/components/EqpPage,model/components/ModelPage,deploy/components/DeployRegisterPanel,deploy/components/DeployMonitorPanel,eqp/components/EqpManageFormModal,live-map/components/LiveMap3DScene,model/components/ModelDetailPanel}.tsx` → 0 |
| 죽은 fallback(발생 불가 케이스 방어) | **0건** | 위 동일 범위. TS strict + `?? []` 패턴은 API 경계 방어라 정당 |

---

## §2 축 B — 중복 코드

### 2.1 jscpd 원시 결과 (1차 입력)

```
Duplications detection: Found 32 exact clones with 964(2.15%) duplicated lines in 195 (2 formats) files.
```
`jscpd 5.0.12`, 옵션 `--min-lines 20 --min-tokens 100 --format "typescript,tsx"`, 대상 `src`.

> 승격 판단 규칙: **3회 이상 + 도메인 무관**일 때만 공통화 후보. **ui-front 의 승격 대상은 `nori-tc-common`(Java 레포)이 아니라
> `src/shared/`** 다 — common 은 Java 아티팩트만 발행하므로 TS 코드 승격 경로가 존재하지 않는다.

| ID | 요구 축 | 트랙 | 대표 위치 | 출현 | 심각도 | 난이도 | `src/shared` 승격 | 다운스트림 |
|---|---|---|---|---|---|---|---|---|
| B-1 | R3,R7,R8 | R | `src/features/auth/api/auth.api.ts` (CSRF 헬퍼) | **9곳** | **P2** | M | ✅ 후보 | ui-backend (CSRF 계약) |
| B-2 | R3,R7 | R | `src/features/eqp/api/eqp.api.ts:46-78` | 5곳 | P3 | M | ✅ 후보 | 없음 |
| B-3 | R3,R7 | R | `src/features/eqp/types/eqp.types.ts:453-477` | 5곳 | P3 | S | ✅ 후보 | ui-backend (`ApiResponse` 계약) |
| B-4 | R3 | R | `src/features/dlq/components/BusinessDlqPanel.tsx:55-103` | 4곳 | P3 | M | ❌ | 없음 |
| B-5 | R3,R7 | R | `src/features/eqp/stores/eqp-ui.store.ts:76-119` | 3곳 | P3 | M | ✅ 후보 | 없음 |
| B-6 | R3 | R | `src/features/model/components/modelDetailColumnDefs.tsx:349-389` | 5쌍(파일 내부) | P3 | M | ❌ | 없음 |
| B-7 | R3 | R | `src/features/eqp/components/EqpManageFormModal.tsx:674-730` | 2쌍(파일 내부) | P3 | S | ❌ | 없음 |
| B-8 | R3 | R | `src/features/deploy/components/DeployRegisterPanel.tsx:448-483` | 2쌍(파일 내부) | P3 | S | ❌ | 없음 |
| B-9 | R3 | R | `src/features/deploy/components/DeploySidebar.tsx:84-114` | 2곳 | P3 | S | ❌ | 없음 |
| B-10 | R3 | R | `src/features/model/api/model-flow.api.ts:54-96` | 2곳 | P3 | S | ❌ | 없음 |

### B-1 / R3·R7·R8 / R — **CSRF 토큰 헬퍼 9중 복제 (P2 — 보안 로직 중복)**

**위치 (전부)** `getCookieValue` + `issueCsrfToken` 쌍이 9개 api 파일에 각각 로컬 복제되어 있다:
`auth.api.ts:106` / `deploy.api.ts:155` / `eqp.api.ts:72` / `group.api.ts:55` / `layout.api.ts:68` /
`live-map-demo-run.api.ts:69` / `model.api.ts:67` / `model-flow.api.ts:54` / `user.api.ts:48`
(9곳 전부 `GET /api/auth/csrf` 를 자체 호출한 뒤 `XSRF-TOKEN` 쿠키를 읽어 `X-XSRF-TOKEN` 헤더로 재전송)

```ts
// src/features/eqp/api/eqp.api.ts:46-78 (대표) — 이 골격이 9회
const getCookieValue = (name: string): string | null => { ... }
const issueCsrfToken = async (): Promise<string> => {
  await apiClient.get('/auth/csrf', { withCredentials: true })
  const token = getCookieValue('XSRF-TOKEN')
  ...
}
```
**문제** CSRF 는 **보안 통제**다. 토큰 이름·헤더 이름·재발급 타이밍·실패 처리가 9벌로 유지되므로,
한 곳만 고치면 나머지 8곳이 조용히 드리프트한다. jscpd 도 이 골격을 5쌍의 클론으로 잡았다
(`eqp.api.ts:46-78` ↔ `model-flow.api.ts:27-57` / `model.api.ts:40-73` / `user.api.ts:28-52` / `group.api.ts:35-55`).
**실패 시나리오** ui-backend 가 CSRF 핸들러를 `CsrfTokenRequestAttributeHandler`(raw) 에서 Spring 기본 XOR 방식으로
되돌리면(S08 **E-4** 가 그 변경을 P3 개선안으로 제시), 프론트는 **9개 파일을 전부** 고쳐야 한다.
1곳이라도 빠지면 해당 도메인의 모든 상태변경 요청이 403 이 되며, 그 도메인 e2e 를 돌리기 전까지 발견되지 않는다.
**반증 시도** ① 실제로는 공통 모듈을 쓰는데 재export 한 것 아닌가 → **아니다**. 9개 파일 각각이 `const getCookieValue = ...` 를
로컬 정의한다(직접 확인). ② `src/shared/lib/session.ts` 가 공통 진입점인가 → `clearCsrfCookie` 삭제 함수 하나뿐,
발급·읽기 경로는 공유하지 않는다. **반증 실패.**
**심각도** **P2** (선행조건: 백엔드 CSRF 규약 변경 — S08 E-4 가 실제 후보로 제시됨) · **난이도** M
**다운스트림** **nori-tc-ui-backend** (`UiSecurityConfig.java:95-103` 의 CSRF 핸들러 선택과 직접 결합)
**cross-repo**: S08 **E-4**(CSRF BREACH 보호 비활성 — 수정 시 ui-front 동시 변경 필요)와 **동일 계약면** → **S14 병합 예고**(원본 ID 보존)

### B-2 / R3·R7 / R — API 목록/페이징 래퍼 5중 복제

**위치** `eqp.api.ts:46-78` ↔ `model-flow.api.ts:27-57` ↔ `model.api.ts:40-73` ↔ `user.api.ts:28-52` ↔ `group.api.ts:35-55`
(jscpd 4쌍, 28~33줄). B-1 의 CSRF 골격과 물리적으로 같은 블록에 섞여 있어 **B-1 과 함께 추출하는 것이 합리적**.
**심각도** P3 · **난이도** M · **다운스트림** 없음

### B-3 / R3·R7 / R — 페이지 응답 타입 5중 복제

`eqp.types.ts:453-477` ↔ `group.types.ts:135-159` ↔ `model.types.ts:337-361` ↔ `user.types.ts:131-155` ↔ `auth.types.ts:69-91`
(jscpd 4쌍, 23~25줄). 동일한 `ApiResponse<T>` + 페이지 필드 구조가 도메인마다 재선언된다.
**문제** ui-backend 의 공통 래퍼는 **하나**다 — `ApiResponse.java:16-21 record ApiResponse<T>(boolean success, T data, String errorCode, String errorMsg)` (S08 §6.2).
프론트가 이를 5벌로 재선언하므로 래퍼 필드가 바뀌면 5곳을 고쳐야 한다.
**심각도** P3 · **난이도** S (`src/shared/types/api.ts` 로 제네릭 1개 추출) · **다운스트림** ui-backend `ApiResponse` 계약

### B-4 / R3 / R — DLQ 패널 4종 near-duplicate

`BusinessDlqPanel.tsx:55-103` ↔ `GatewayDlqPanel.tsx:50-98` ↔ `QuarantinePanel.tsx:47-96` ↔ `RepairTaskPanel.tsx:45-94`
(jscpd 6쌍, 23~25줄 × 2블록). 컬럼 정의 + 테이블 셸 골격이 4벌.
**심각도** P3 · **난이도** M · **다운스트림** 없음

### B-5 / R3·R7 / R — zustand 사이드바 슬라이스 3중 복제

`eqp-ui.store.ts:76-119` ↔ `model-ui.store.ts:111-154` ↔ `shared-layout.store.ts:31-74` (jscpd 2쌍, 각 44줄).
**3회 이상 + 도메인 무관** → `src/shared/stores` 승격 후보. 이미 `shared-layout.store.ts` 라는 공통 자리가 있는데도 도메인 store 가 재구현했다.
**심각도** P3 · **난이도** M · **다운스트림** 없음

### B-6~B-10 (요약)

- **B-6** `modelDetailColumnDefs.tsx` 파일 내부 5쌍(`:140-179`↔`:660-699`, `:329-357`↔`:434-460`, `:349-389`↔`:471-510`·`:605-644`, `:412-436`↔`:539-563`) — 컬럼 정의 29~41줄 반복. 699 LOC 중 상당수가 반복 구조.
- **B-7** `EqpManageFormModal.tsx:674-730`↔`:758-814`(**57줄**, 레포 최대 클론) + `:233-255`↔`:277-299`. 프로토콜별 폼 섹션 반복.
- **B-8** `DeployRegisterPanel.tsx:448-483`↔`:555-589`, `:874-898`↔`:921-945`.
- **B-9** `DeploySidebar.tsx:84-114`↔`DlqSidebar.tsx:86-116`(31줄) / `DeployPage.tsx:28-50`↔`UserManagementPage.tsx:37-58`(23줄) / `QuarantinePanel.tsx:47-71`↔`RepairTaskPanel.tsx:45-69`.
- **B-10** `model-flow.api.ts:54-96`↔`model.api.ts:69-113`(43줄) / `EqpManageFormModal.tsx:172-207`↔`EqpModelBindingModal.tsx:57-92`(36줄) / `ActionDataIndexEditorModal.tsx:214-244`↔`FlowFilterEditorModal.tsx:161-191`(31줄) / `BranchModelCreateModal.tsx:209-234`↔`ModelCreateOrUpdateModal.tsx:124-146`(26줄) / `eqp.api.ts:691-722`↔`:733-764`(32줄).

전부 **P3 / R / 다운스트림 없음**.

---

## §3 축 C — Code smell (Fowler) — hotspot 겹침만 항목화

### 3.1 hotspot 실측표 (§0.4 재게)

| 컴포넌트 | LOC | import | 훅 호출 | useState | useEffect | useMemo/Callback | 파일 내 하위 컴포넌트 |
|---|---|---|---|---|---|---|---|
| `EqpPage.tsx` | 1712 | **48** | **100** | 15 | 3 | 49 | 1 |
| `DeployRegisterPanel.tsx` | 1566 | 31 | 66 | 9 | 4 | 21 | 1 |
| `DeployMonitorPanel.tsx` | 1499 | 29 | 57 | 9 | 5 | 16 | 1 |
| `ModelPage.tsx` | 1487 | 27 | 80 | **21** | 3 | 27 | 1 |
| `EqpManageFormModal.tsx` | 1414 | 12 | 12 | 4 | 0 | 7 | 5 |
| `LiveMap3DScene.tsx` | 1386 | 22 | 63 | 10 | **9** | 29 | 5 |
| `ModelDetailPanel.tsx` | 1188 | 23 | 31 | 6 | 2 | 12 | 0 |

### 3.2 hotspot 중첩 smell (10건 — 전부 P3 / R / 요구 축 R6)

| ID | smell | 위치 | 근거(실측) | 난이도 | 다운스트림 |
|---|---|---|---|---|---|
| C-1 | **God Component** — 단일 컴포넌트가 훅 100회 호출·import 48 | `EqpPage.tsx:1-1712` | 하위 컴포넌트 1개뿐 = 로직이 전부 최상위 스코프. 상태 하나 바뀌면 1712줄 트리 전체가 재조정 | L | 없음(내부 분할) |
| C-2 | God Component — 훅 80회 / `useState` 21개 | `ModelPage.tsx:1-1487` | `useState` 21개가 한 스코프에 공존 = 상태 머신이 암묵적 | L | 없음 |
| C-3 | God Component — 훅 66/57회 | `DeployRegisterPanel.tsx`, `DeployMonitorPanel.tsx` | co-change 10(hotspots §2) — 두 파일이 함께 바뀜 = 공통 축 미추출 | L | 없음 |
| C-4 | **Divergent Change** — 3D 씬 1파일이 렌더·편집·저장·카메라·뱃지투영 5축 | `LiveMap3DScene.tsx:1-1386` | `useEffect` 9개(레포 최대) = 서로 무관한 부수효과가 한 파일에 누적. D-4 소재지 | L | 없음 |
| C-5 | **Duplicated Structure as Smell** — 폼 섹션 57줄 클론 | `EqpManageFormModal.tsx:674-730`↔`:758-814` | jscpd 레포 최대 클론. 프로토콜(HSMS/SOCKET/PLC) 분기가 복붙으로 표현됨 | M | 없음 |
| C-6 | **Shotgun Surgery** — CSRF 규약 1개 변경에 9파일 수정 | 9개 `*.api.ts` (B-1 목록) | B-1 과 동일 근원. 보안 규약이 shotgun 대상인 것이 문제 | M | ui-backend |
| C-7 | **Divergent Change** — `ModelDetailPanel` ↔ `ModelPage` co-change **15**(레포 최대) | `ModelDetailPanel.tsx`, `ModelPage.tsx` | hotspots §2. 두 파일 경계가 실제 변경 단위와 불일치 | L | 없음 |
| C-8 | **Primitive Obsession** — 컬럼 정의를 상수 배열 반복으로 표현 | `modelDetailColumnDefs.tsx:140-699` | 699 LOC 중 5쌍의 25~41줄 클론(B-6). 컬럼 스키마를 데이터로 다루지 않고 코드로 반복 | M | 없음 |
| C-9 | **Data Clumps** — 사이드바 3필드(`sidebarOpen`/`sidebarWidth`/`expandedSidebarWidth`)가 3개 store 에 반복 | `eqp-ui.store.ts:76-119` 외 2 | B-5 와 동일 근원. 값 묶음이 타입으로 승격되지 않음 | M | 없음 |
| C-10 | **Middle Man / Barrel 과다** — 타입 배럴이 소비처 없이 재export | `SelectableTable/index.ts:4-9`, `profile.types.ts:54-61`, `group/types/index.ts` | A-4·A-1 과 동일 근원 | S | 없음 |

### 3.3 hotspot 밖 smell (한 줄 목록)

- `deploy-ui.store.ts` 814 LOC — store 단일 파일 최대. persist `partialize` 가 **제외 방식**이라 신규 필드가 자동으로 영속됨(E-3 과 연결).
- `deploy.api.ts` 936 LOC / `eqp.api.ts` 885 / `model.api.ts` 743 / `group.api.ts` 540 — api 계층 대형화.
- `deploy.api.ts` **13개 호출 전부 axios 제네릭 미지정**(응답 정적 타입 `any`) — 계약이 런타임 normalize 함수로만 강제(§6.1).
- `LiveMapDemoModal.tsx` 993 / `LiveMapBoard.tsx` 965 / `ActionDataIndexEditorModal.tsx` 636 / `FlowFilterEditorModal.tsx` 625 — Large Component 예비군.
- 페이징 규약 2종 공존: 전 도메인 `offset/limit` vs `getDeployTargets` 만 `page/size`(`deploy.api.ts:913-919`) — S08 §3.3 이 **백엔드에서 동일 분기**를 지적(`DeployController.getDeployTargets:343-344`) → 양쪽이 같은 불일치를 공유.
- `comm-log.api.ts:32` 만 `encodeURIComponent` 미적용(다른 api 는 전부 적용) — 인코딩 규약 드리프트.
- `LiveMapKonvaPrimitive.tsx` 의 `as unknown as ShapeJson` 4건 — JSONB opaque 컬럼에 대한 의도적 캐스팅(주석으로 근거 명시).

---

## §4 축 D — 결함 / 버그 / 로직 보완 (10건 — P2 4 / P3 6)

### 4.0 전 항목 공통 전제

- **에러 경계가 레포 전체에 0개**다(D-3). 따라서 "상위 경계가 잡아준다" 는 반증은 이 레포에서 **성립하지 않는다**.
- **`onMutate`(낙관적 업데이트) 가 레포 전체에 0건**이다 → "낙관적 업데이트 롤백 부재" 카테고리는 대상 자체가 없다(§4.3).
- 전역 쿼리 설정: `staleTime` 5분, `retry: 1`, **`refetchOnWindowFocus: false`**(`AppProvider.tsx:10-14`).
  포커스 복귀 자가 치유가 없다는 점이 D-5/D-9 의 전제다.

### 4.1 P2 (4건)

**D-1 / R4·R5·R8 / F / `src/features/eqp/components/EqpPage.tsx:919-943, 946-981, 983-984`**
```ts
// :919-920  mutateAsync 는 traceId(202) 를 받는 즉시 settle → 그 뒤 폴링이 최대 60초
const traceId = await startEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
await waitForEqpAsyncCompletion(traceId, t('eqp.page.startTimeout'))
// :983-984  in-flight 판정은 POST 구간만 본다
const isLifecyclePending =
  startEqpMutation.isPending || endEqpMutation.isPending || reconnectEqpMutation.isPending
```
```ts
// :955-958  다이얼로그는 폴링이 끝난 뒤에야 닫힌다
await executeLifecycleAction(targetEqp, action)
closeLifecycleDialog()
```
**문제** `EQP_ASYNC_POLL_INTERVAL_MS = 1000` × `EQP_ASYNC_MAX_ATTEMPTS = 60`(`:119-120`) = 최장 **60초** 동안
`isLifecyclePending === false` 인데 확인 다이얼로그는 열린 채다. `EqpLifecycleActionDialog.tsx:80,87` 의
`disabled={isPending}` 이 풀리고 `:92` 의 스피너도 사라진다.
**실패 시나리오** 운영자가 "Restart" 확인 → 202 직후 스피너가 사라지고 버튼이 되살아남 → 무반응으로 보여 재클릭 →
**같은 설비에 EQP_END/EQP_START 가 중복 발행**되어 재기동 중인 설비가 다시 END 된다.
**반증 시도** ① 다이얼로그 자체 재진입 가드 → `EqpLifecycleActionDialog.tsx:52-95` 는 `isPending` prop 만 신뢰, 자체 플래그 없음.
② 상위 ref 가드 → 같은 파일 `handleCheckOut` 은 `isCheckoutSubmittingRef` 가드를 갖는데(`:1035`) lifecycle 경로에는 없다 = 의도적 누락이 아니라 미적용.
③ `useCallback` 이 재진입을 막는가 → 막지 않는다. **반증 실패.**
**심각도** **P2** (선행조건: 폴링 창 내 재클릭) · **난이도** S (폴링 구간을 포함하는 `isLifecycleRunning` ref/state)
**다운스트림** **nori-tc-ui-backend**(EQP_START/END 중복 수신), **nori-tc-gateway**(실설비 재기동 중 END)

**D-2 / R4·R5·R8 / F / `src/features/eqp/components/EqpPage.tsx:986-995` + `EqpPollingGroupControl.tsx:81,89,100`**
```ts
// EqpPage.tsx:986-992 — D-1 과 동일 구조
const isPollingGroupPending =
  startPollingGroupMutation.isPending || endPollingGroupMutation.isPending
...
const traceId = await startPollingGroupMutation.mutateAsync({ eqpId, groupMessageName })
await waitForEqpAsyncCompletion(traceId, t('eqp.page.pollingGroupStartTimeout'))
```
**문제** D-1 과 같은 근원. `EqpPollingGroupControl.tsx` 의 세 버튼(`:81,89,100`)이 `disabled={isPending}` 만으로 보호되는데
그 `isPending` 이 POST 구간만 커버한다.
**실패 시나리오** PLC 설비에서 Polling Group "Start" 재클릭 → 동일 group 에 `EQP_PLC_GROUP_START` 2회 발행.
S08 **D-7**(gateway PASS 후 DB 반영 실패 시 보상 없음)과 만나면 gateway 폴링 상태와 DB `enabled_poll_groups` 가 어긋난다.
**반증 시도** ① 부모가 `key` 로 remount 해 격리하는가 → `EqpPage.tsx:1434` 의 `key={selectedEqpId}-polling-group` 은
**설비 전환만** 커버하고 동일 설비 연타는 못 막는다. ② `runCommand` 내부 in-flight 가드 → 없음(`EqpPollingGroupControl.tsx:36-65`). **반증 실패.**
**심각도** **P2** · **난이도** S · **다운스트림** ui-backend, **nori-tc-gateway** (PLC 폴링 상태 불일치)
**cross-repo**: S08 **D-7** 과 같은 경로의 양단 결함 → **S14 병합 검토 예고**(원본 ID 보존)

**D-3 / R4·R8 / F / `src/app/Router.tsx:61-83` (레포 전역)**
```tsx
export function Router() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/eqp" element={<EqpPage />} />
        ...
```
**문제** `ErrorBoundary` / `componentDidCatch` / `getDerivedStateFromError` / `react-error-boundary` 가 **전 레포 0건**이다.
`Suspense` 는 로딩만 처리하고 reject 는 처리하지 않으므로, lazy chunk 로드 실패나 렌더 중 throw 가 루트까지 전파돼
React 19 가 트리 전체를 언마운트한다 → **완전 백지 + 복구 UI 없음**.
9개 페이지가 전부 `lazy()`(`Router.tsx:5-50`)라 청크 로드 실패 표면이 넓다.
**실패 시나리오** 신규 배포로 `assets/EqpPage-<hash>.js` 가 교체된 뒤 구 `index.html` 을 캐싱한 탭에서 `/eqp` 이동 →
`import()` 404 → 앱 전체 백지. 새로고침 안내조차 없다.
**반증 시도** ① react-router `errorElement` → 이 앱은 데이터 라우터(`createBrowserRouter`)가 아니라 `<BrowserRouter>+<Routes>` 조합
(`main.tsx:16`, `Router.tsx:64`)이라 `errorElement` **적용 자체가 불가**하다. ② 상위 경계 → `main.tsx`/`AppProvider.tsx` 어디에도 없음.
③ 3D 경로 전용 경계 → `LiveMapPage.tsx:307-325` 도 `Suspense` 만이라 `<Canvas>` WebGL 생성 실패가 동일하게 전파. **반증 실패.**
**심각도** **P2** (선행조건: 배포 직후 stale index.html 또는 렌더 throw) · **난이도** M (루트 + 라우트별 + 캔버스 3계층)
**다운스트림** 없음

**D-4 / R4·R8 / F / `src/features/live-map/components/LiveMap3DScene.tsx:165-168` + 호출부 `:378`**
```tsx
// :165-168
const edges = useMemo(
  () => new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0] + 0.2, size[1] + 0.2, size[2] + 0.2)),
  [size],
)
```
```tsx
// :378 — size 가 매 렌더 새 배열 리터럴 → useMemo 가 매 렌더 무효화
return <SelectionBox center={[bbox.center.x, bbox.center.y, bbox.center.z]} size={[bbox.size.x, bbox.size.y, bbox.size.z]} />
```
**문제** 렌더마다 `EdgesGeometry` 와 내부 `BoxGeometry` **2개**가 새로 생성되고 `dispose()` 되지 않는다.
r3f 는 `args` 로 자기가 만든 geometry 만 자동 dispose 하며 **prop 으로 주입된 geometry 는 건드리지 않는다**.
**실패 시나리오** 편집 모드에서 구조물(벽/파티션)을 선택한 채 드래그하면 프레임마다 새 GPU 버퍼가 쌓여,
장시간 편집 세션에서 **WebGL context lost / 탭 크래시**.
**반증 시도** ① 설비 선택 경로도 같은가 → **아니다**. 설비는 모듈 상수 `EQUIPMENT_SELECT_BOX`(`:149`)를 넘겨 memo 가 안정 →
**구조물 경로 한정**이라 P1 아님. ② r3f 자동 dispose 에 기대는 설계인가 → 같은 파일군 `LiveMap3DEquipmentField.tsx:38-48` 이
모듈 레벨 공유 `GEO`/`MAT` 를 쓰는 것으로 보아 이 코드베이스는 자동 dispose 에 의존하지 않는다. ③ `frameloop="demand"` 로 억제되는가 →
드래그 중 `invalidate` 가 계속 걸려 억제되지 않는다. **반증 실패.**
**심각도** **P2** (선행조건: 구조물 편집 장시간 세션) · **난이도** S (모듈 상수 재사용 또는 cleanup 에서 `edges.dispose()`)
**다운스트림** 없음

### 4.2 P3 (6건)

| ID | 요구 축 | 트랙 | 위치 | 문제 · 실패 시나리오 | 난이도 | 다운스트림 |
|---|---|---|---|---|---|---|
| D-5 | R4 | F | `src/features/eqp/hooks/useEqpMutations.ts:76` | polling group start/end mutation 쌍만 `onSuccess` 캐시 무효화가 전무 → 그룹 기동 후 `EqpInfoTable` 런타임 상태가 재선택 전까지 기동 전 값. 반증: 해당 도메인에 `refetchInterval` 0건 + 전역 `refetchOnWindowFocus:false` 라 자가 치유 없음. 단 서버가 그룹 상태를 detail 에 노출하는지 **미확인** → P3 | S | 없음 |
| D-6 | R4 | F | `src/features/model/components/ModelDetailPanel.tsx:649` | `deleteFlowMutation.mutate(..., { onSuccess })` 에 `onError` 없음 + 다이얼로그 open 조건이 `flowIdToDelete !== null`(`:1109`) → 서버 409 시 확인 다이얼로그가 피드백 없이 열린 채 잔류. 반증: 상위 error 렌더(`:598-601`)는 create/update 만 커버 | S | ui-front |
| D-7 | R4 | F | `src/features/live-map/hooks/useLayout.ts:64, 74` | object update/delete 가 `layoutQueryKeys.objects()` 만 무효화하고 `layout(lineKey)`(같은 `objects` 배열 보유, `LiveMap3DScene.tsx:520`)는 미무효화. **부분 반증**: `staleTime:0`(`:22`) + 모드 전환 remount 로 대부분 자가 치유 → 빌더·3D 동시 활성 경로만 성립 | S | 없음 |
| D-8 | R4 | F | `src/features/live-map/components/LiveMap3DScene.tsx:985-1012` | `ensureBuiltinStructureObjectKey` 가 렌더 시점 `objectsQuery.data` 클로저를 await 루프 안에서 조회 → `objectsQuery` 미로딩 + 서버에 동명 객체 기존재 시 중복 STRUCTURE 생성. **부분 반증**: `new Set` 중복 제거(`:1011-1013`) + 2회차엔 실 objectKey 로 리셋(`:456-462`) | M | ui-backend(중복 행) |
| D-9 | R4 | F | `src/features/eqp/components/EqpPage.tsx:713` | EDIT 체크아웃 중 `editParamsQuery.data` 참조가 바뀌면 `localEditRows` 를 통째로 재시드 → 미저장 편집 소실. **부분 반증**: TanStack v5 `structuralSharing` 으로 내용 동일 refetch 는 참조 유지 + `refetchOnWindowFocus:false`. `refetchOnReconnect`(기본 true) 경로만 성립 | M | 없음 |
| D-10 | R4 | F | `src/main.tsx:14` | `void i18nReady.then(() => createRoot(...))` — `.catch` 없음. reject 시 `createRoot` 미호출로 DOM 영구 공백. 레포 유일한 non-null assertion(`getElementById('root')!`)도 여기. **부분 반증**: i18next 는 백엔드 로드 실패를 콜백으로 넘기고 deferred 는 resolve 하는 것이 일반 동작 → reject 도달 확률 낮음 | S | 없음 |

### 4.3 반증으로 기각한 축 D 후보 (투명성 기록 — 10건)

| 후보 | 기각 사유 (직접 확인) |
|---|---|
| 낙관적 업데이트 롤백 부재 | **대상 0건.** `onMutate` 가 레포 전체 0건. `deploy-ui.store.ts:429 createServerDeployBridge` 는 `mutateAsync` **성공 후**에만 호출(`DeployRegisterPanel.tsx:604-619`)이라 낙관적 선반영이 아님 |
| `useCreateDeploy` 등 invalidate 없는 mutation | 호출부가 수동 처리. `DeployRegisterPanel.tsx:634-652` 가 `setQueryData(summary/targets)` + `invalidateQueries({queryKey: deployQueryKeys.all, refetchType:'active'})` 수행 |
| `setQueryData(deployQueryKeys.targets(k,0,50))` 와 조회 키 불일치 | `deploy-query-keys.ts:47-53` 의 `targets()` 기본값이 `status=null, eqpId=null` 이라 `[...,0,50,null,null]` 로 동일. 페이로드 shape 도 `deploy.types.ts:301-308` 과 일치 |
| `deployKey === null` 시 queryKey 가 `['deploy']` 로 충돌 | 같은 조건에서 `enabled: enabled && deployKey !== null`(`useDeployTargets.ts:23`, `useDeploySummary.ts:17`) → `queryFn` 도달 불가 |
| 이벤트 핸들러 내 리스너 등록 후 unmount cleanup 없음 (`resizable-divider.tsx:50` / `sidebar-resize-handle.tsx:46` / `useGridResize.ts:43`) | `mouseup`/`pointerup` 이 `{once:true}` 또는 자기 자신을 제거하는 핸들러로 등록 → 다음 마우스 업에서 자가 해제. `removeEventListener` 참조 매칭도 동일 클로저라 성립 |
| `LiveMap3DEquipmentField.tsx:38-70` 모듈 레벨 `GEO`/`MAT` 미dispose | 프로세스 수명 싱글톤(부품 종류당 1개)이라 누적 없음. `InstancedPart` remount 시 r3f 는 `InstancedMesh.dispose()`(instanceMatrix/Color 만) 호출이라 공유 자원도 안전 |
| 구독/타이머 cleanup 누락 전반 | `LiveMapBoard.tsx:254`(ResizeObserver), `:284,319,349`(pointer), `LiveMap3DScene.tsx:280,511,780`(window), `SelectableTable.tsx:373`(rAF), `LiveMapCommLogPanel.tsx:105`(rAF), `LiveMapPage.tsx:203`(setInterval), `LoginPage.tsx:134`(keydown), `LiveMapKonvaPrimitive.tsx:46`(image load) — **전부 대응 cleanup 확인** |
| 비동기 응답 후 setState 하는 useEffect (AbortController 부재) | async effect 는 2곳뿐이고 둘 다 cancel 플래그 보유: `UserPasswordResetModal.tsx:76-107`, `LiveMapDemoModal.tsx:216-231`. 나머지는 TanStack Query 관리 |
| non-null assertion 남용 / API 배열 가정 | `!` 는 3건뿐(`main.tsx:14`=D-10, `useCommLog.ts:7`=`enabled:!!eqpId` 가드 존재, `as unknown as ShapeJson` 4건=JSONB opaque 의도적). `?? []` 패턴이 일관 적용 |
| 로그아웃 시 쿼리 캐시 잔존 | `AppTopBar.tsx:138` 이 `queryClient.clear()` + `clearCsrfCookie()` 수행. 단 **localStorage persister·sessionStorage 는 별개** → E-2/E-3 로 이관 |

---

## §5 축 E — 보안 (레포 중점: XSS / 토큰 저장)

### 5.1 발견 항목 (P2 3건 / P3 5건)

**E-1 / R8 / F / P2 — TanStack Query persist 가 deny-list 라 업무 데이터가 localStorage 에 30분 평문 잔존**

위치 `src/app/providers/AppProvider.tsx:19-22, 30-49, 57-63`
```ts
const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'nori-tc-ui-cache' })
const PERSIST_DENY_QUERY_HEADS = new Set(['auth','user','group','live-map','live-map-layout','live-map-objects','deploy'])
const shouldDehydrateQuery = (query: Query): boolean => { ...; return !PERSIST_DENY_QUERY_HEADS.has(head) }
// :57-63
persistOptions={{ persister, maxAge: 30 * 60 * 1000, dehydrateOptions: { shouldDehydrateQuery } }}
```
**문제** **allow-list 가 아니라 deny-list** 다. 목록에 없는 query head 는 전부 localStorage 에 30분 평문 영속된다.
실제 누락 head: `eqp`(설비 목록·상세·파라미터·checkout 상태 — `eqp-query-keys.ts:8-21`), `model`(모델/플로우 전문 — `model-query-keys.ts:9-21`),
`dlq`(DLQ 메시지 payload), `line`. 신규 도메인을 추가하면 **기본값이 "영속"** 이라 조용히 확대된다.
**실패 시나리오** 공유 현장 PC 에서 A 사용자가 로그아웃한 뒤 B 사용자가 같은 브라우저를 쓰면,
`localStorage['nori-tc-ui-cache']` 에 남은 설비 파라미터·모델 정의·DLQ 메시지 본문이 최대 30분간 복원 가능하다.
**반증 시도** ① 로그아웃이 지우는가 → **아니다**. `AppTopBar.tsx:125-142` 는 `queryClient.clear()` + `clearCsrfCookie()` 만 호출하고
`persister.removeClient()` 는 **레포 전체 0건**(grep 확인). `clear()` 의 persist flush 로 비워질 가능성은 있으나
**런타임 실증은 미수행**(§8.4) → 명시적 제거 부재라는 결함은 남는다.
② 인증 토큰이 여기 있는가 → **아니다**. `['auth','me']` 는 deny 에 포함되고 세션은 HttpOnly 쿠키다 → **P1 아님**.
**반증 부분 실패 → P2 유지.**
**심각도** **P2** · **난이도** M (deny-list → allow-list 반전 + 로그아웃 시 `persister.removeClient()`) · **다운스트림** 없음

**E-2 / R8 / F / P2 — eqp·model·deploy 화면에 권한 게이팅이 전무 (권한 코드 상수 자체가 부재)**

위치 ① `src/shared/lib/app-navigation.ts:17-24`
```ts
export const APP_TOP_NAVIGATION_ITEMS: readonly AppTopNavigationItem[] = [
  { key: 'dash',   label: 'Dash',   route: '/eqp/live-map', requiredPermission: DASH_READ_PERMISSION },
  { key: 'eqp',    label: 'Eqp',    route: '/eqp' },      // ← requiredPermission 없음
  { key: 'model',  label: 'Model',  route: '/model' },    // ← 없음
  { key: 'deploy', label: 'Deploy', route: '/deploy' },   // ← 없음
  { key: 'dlq',    label: 'Dlq',    route: '/dlq',  requiredPermission: DLQ_READ_PERMISSION },
  { key: 'user',   label: 'User',   route: '/user', requiredPermission: USER_READ_PERMISSION },
] as const
```
위치 ② `src/shared/lib/permission.ts:5-37` — 정의된 상수는 **6종뿐**
(`LIVE_MAP_READ`, `USER_READ`, `DLQ_READ`, `LIVE_MAP_LAYOUT_WRITE`, `LIVE_MAP_LAYOUT_READ`, `LIVE_MAP_DEMO_RUN_SCENARIO_DELETE`).
**`EQP_*` / `MODEL_*` / `DEPLOY_*` 상수는 존재하지 않는다.**
위치 ③ 게이팅이 **있는** 화면과의 대조 — `DlqPage.tsx:72-74`, `UserManagementPage.tsx:63-65`
```tsx
if (!hasPermission(meQuery.data?.permissionCodes, DLQ_READ_PERMISSION)) {
  return <Navigate to={FORBIDDEN_FALLBACK_ROUTE} replace />
}
```
`EqpPage.tsx` / `ModelPage.tsx` / `DeployPage.tsx` 는 `hasPermission` import 가 **0건**이다.
**문제** 메뉴 노출·페이지 진입·write 버튼(설비 CRUD / 모델 커밋 / 배포 실행) 어디에도 권한 조건이 없다.
백엔드에는 해당 권한이 실재한다 — S08 §5.2 의 `EQP_READ`/`EQP_WRITE`/`MODEL_READ`/`MODEL_WRITE`/`DEPLOY_*` 8종
(+ 프론트 `permission-category.ts` 와 i18n 카탈로그에 eqp/model/deploy 카테고리 존재) → **의도적 미구현이 아니라 누락**이다.
**실패 시나리오** 조회 전용 그룹 사용자가 `/deploy` 진입 → 배포 대상 선택 → "배포 실행" → 서버 403.
기능 유출은 없으나 **권한 없는 사용자에게 배포 UI 전체와 설비 인벤토리 화면이 노출**되고, GET 이 열려 있다면 실데이터까지 보인다.
**반증 시도** ① 백엔드가 막는가 → **막는다**. S08 §5.1 이 108 엔드포인트 × 4 인가 경로 전수 대조로 미게이팅 0건을 확인했고,
`UiApiPermissionCache.java:142-147` 이 closed-by-default 다. **따라서 데이터 경계는 지켜지며 P1 이 아니다.**
② 그렇다면 문제가 아닌가 → 아니다. `EQP_READ` 미보유 사용자는 화면만 보고 데이터는 못 받으므로 **빈 화면 + 반복 403** 이라는
잘못된 UX 를 겪고, 권한 모델이 프론트에 반영되지 않아 향후 백엔드 게이팅에 구멍이 생기면 2차 방어선이 0 이다. **반증 부분 성립 → P2 유지.**
**심각도** **P2** (선행조건: 백엔드 강제에 전적으로 의존) · **난이도** M (권한 상수 + nav `requiredPermission` + 페이지 가드. write 버튼까지면 L)
**다운스트림** **nori-tc-ui-backend**(permCode 문자열 계약), **nori-tc-exec**(권한 시드)
**전제 확인 결과** — "프론트는 eqp/model/deploy 게이팅이 없고 백엔드가 closed-by-default 로 강제한다" 는 프롬프트 전제는 **코드로 참임을 확인**했다.
백엔드 강제가 없는 화면은 발견되지 않았다(S08 §5.1 대조).

**E-3 / R8 / F / P2 — 라우트 인증 가드 부재 + 로그아웃이 sessionStorage 를 정리하지 않음**

위치 ① `src/app/Router.tsx:64-80` — `ProtectedRoute` / auth loader / `<Navigate>` 인증 가드가 **하나도 없다**.
인증 판정은 오직 `src/shared/lib/api-client.ts:20-28` 의 401 인터셉터(`window.location.href = '/login'`)뿐 = **사후 차단**.
위치 ② `src/shared/components/AppTopBar.tsx:125-142`
```ts
} finally {
  await onAfterLogout?.()
  queryClient.clear()
  clearCsrfCookie()
  navigate(LOGIN_ROUTE, { replace: true })
}
```
위치 ③ `src/features/deploy/stores/deploy-ui.store.ts:729-742` — sessionStorage `deploy-ui-state` 의 `partialize` 가
**제외 방식**(`hasSubmittedRegisterSearch`/`registerSearchRevision` 2개만 빼고 나머지 전부 저장 — `selectedEqpTargetsById`, `localHistory` 포함).
**문제** 로그아웃 경로가 `clearDeployUiSessionState()`(`:808`)를 **호출하지 않는다**. 호출처는
`DeployPage.tsx:48,57` / `EqpPage.tsx:1343` / `ModelPage.tsx:1282` / `LiveMapPage.tsx:219` 4개 페이지 진입 시점뿐이다(전수 grep).
**실패 시나리오** 같은 탭에서 A 사용자가 `/deploy` 에서 로그아웃 → B 사용자가 `/deploy` 딥링크 진입 →
401 왕복 전 프레임에 **A 의 선택 설비 목록·localHistory 가 sessionStorage 에서 복원되어 렌더**된다.
**반증 시도** ① 서버 데이터 없는 빈 껍데기 아닌가 → sessionStorage 복원분이 있어 서버 호출 0회에도 업무 데이터가 그려진다.
② 백엔드가 막지 않나 → 막는다(401) → **데이터 유출은 아니므로 P1 아님**. ③ 다른 페이지 방문으로 정리되는가 →
`/login` 은 4개 호출처에 없어 로그아웃 직후에는 남는다. **반증 부분 성립 → P2 유지(범위: 같은 탭 한정).**
**심각도** **P2** · **난이도** M (`<RequireAuth>` 래퍼 + 로그아웃 시 세션 정리) · **다운스트림** 없음

**E-4 / R8 / F / P3 — 프로덕션 번들에 `console` 제거 파이프라인 부재**

위치 `vite.config.ts:29-56` (build 블록에 `esbuild.drop` / `terser.drop_console` **없음** — 전문 확인)
+ `src/features/auth/api/auth.api.ts:184`
```ts
console.info('[authApi] login success', { userPk: parsedResponse.data.userPk })
```
**문제** src 의 `console.*` 8건(§5.4 전수)이 그대로 번들에 남는다. `dist/assets`(2026-07-17 빌드 산출물) 실측에서도
`console.info` 4 / `console.error` 32 / `console.warn` 21 / `console.log` 1 잔존.
**반증 시도** ① 토큰·비밀번호가 찍히는가 → **아니다**(§5.4 전수 확인). 노출값은 `userPk`(내부 숫자 PK)와 `errorCode` 뿐.
② `AppTopBar.tsx:135` 가 axios error 객체 전체를 찍어 `X-XSRF-TOKEN` 헤더가 딸려 나오는가 → CSRF 토큰은 double-submit 쿠키라
이미 JS 가시 → 추가 유출 없음. **반증 대부분 성립 → P2 에서 P3 로 강등(§0.6).**
**심각도** P3 · **난이도** S (`esbuild: { drop: ['console','debugger'] }` 1줄) · **다운스트림** 없음
> 주의: `dist/` 는 **2026-07-17 빌드 산출물**로 HEAD 시점 재빌드가 아니다. 결함 근거는 `vite.config.ts` 직접 확인이며 dist 는 보강 증거다.

**E-5 / R8 / F / P3 — 보안 응답 헤더 전무**

위치 `deploy/docker/nginx.conf:20-41` (전문 확인)
```nginx
server {
    listen 8080;
    root /app/build;
    location /api/ { proxy_pass http://tc-ui-backend.mes.svc.cluster.local:8080; ... }
    location / { try_files $uri $uri/ /index.html; }
}
```
**문제** `Content-Security-Policy` / `X-Frame-Options`(`frame-ancestors`) / `X-Content-Type-Options` /
`Referrer-Policy` / `Permissions-Policy` 가 **전부 없다**. `index.html` 에 CSP `<meta>` 도 없다.
**실패 시나리오** 공격자 사이트가 `tc.noricloud.org` 를 iframe 으로 감싸 clickjacking(세션 쿠키가 `SameSite=None` — S08 §5.6).
CSP 부재로 향후 XSS 발생 시 2차 방어선이 0.
**반증 시도** ① 현재 XSS 가 있는가 → **없다**(§5.3 0건 표) → 즉시 사고 아님 = P3.
② 상위 Gateway 가 헤더를 주입하는가 → `deploy/helm/.../httproute.yaml` 에 `ResponseHeaderModifier` filter 없음.
Gateway 리소스 자체는 이 레포 밖이라 **미확인**.
**심각도** P3 · **난이도** S (nginx `add_header` 5줄) · **다운스트림** **nori-tc-ui-backend**(CSP `connect-src` 대상), **nori-tc-exec**(helm)
> 이 `nginx.conf` 는 S08 **E-1** 이 인용한 바로 그 프록시다(`nginx.conf:27-31` — `X-Forwarded-For` 설정이 ui-backend 의
> actuator IP 화이트리스트를 무력화). 같은 파일의 양면 결함 → **S14 병합 예고**.

**E-6 / R8 / F / P3 — Konva `Image` 의 `src` 무검증(임의 외부 리소스 로드)**

위치 `src/features/live-map/components/LiveMapKonvaPrimitive.tsx:35-48`
```tsx
const src = typeof attrs.src === 'string' ? attrs.src : ''
...
const element = new window.Image()
element.src = src
```
**문제** `attrs` 는 서버 저장 `shape_json`(JSONB) 에서 온 **사용자 저작 데이터**(`LIVE_MAP_LAYOUT_WRITE` 보유자가 작성).
URL 스킴·호스트 검증 없이 `Image.src` 에 대입한다.
**실패 시나리오** WRITE 권한 내부자가 `src: "https://attacker.example/beacon.png?u=..."` 인 도형을 배치 →
그 라인의 Live Map 을 여는 모든 사용자의 브라우저가 외부로 요청을 보내 IP·UA·접속 시각이 유출된다.
**반증 시도** ① `javascript:` 로 코드 실행되나 → **불가**(`HTMLImageElement.src` 는 실행하지 않음).
② data URL SVG 로 스크립트 실행되나 → **불가**(`<img>` 로 로드된 SVG 는 스크립트 비활성).
③ Konva `Text`(`:66`)에 사용자 입력 주입이 XSS 인가 → **기각**. Konva 는 canvas 2D 렌더러라 HTML 파서를 거치지 않는다.
**XSS 는 반증 성립**, 임의 outbound 요청 하나만 남는다.
**심각도** P3 · **난이도** S (스킴/호스트 allow-list) · **다운스트림** **nori-tc-ui-backend**(`shape_json` 서버측 검증이 진짜 방어선)

**E-7 / R8 / F / P3 — 로그인 아이디 localStorage 평문 저장**

위치 `src/features/auth/components/LoginPage.tsx:96, 148-151` — 키 `nori-tc:savedUserId`, "아이디 저장" 체크박스 opt-in.
**반증 시도** ① 비밀번호도 저장되나 → **아니다**(전수 확인). ② 사용자 명시 동의인가 → **그렇다**(`:144-151` 조건부, 해제 시 `:151` 즉시 제거).
**의도된 기능** — 남는 것은 공유 PC 계정 열거 리스크라는 정책 판단뿐.
**심각도** P3 · **난이도** S · **다운스트림** 없음

**E-8 / R8 / R / P3 — 프로덕션 번들에 DEV fixture 청크 emit**

위치 `src/app/Router.tsx:41-50, 73-78`. 라우트 경로 문자열은 tree-shake 되나(`grep -ro "__fixtures" dist/assets` → **0건**)
청크 파일은 emit 된다(`dist/assets/LayoutShellFixture-Bb9r5NTB.js`, `SelectableTableFixture-DpnyBPpK.js` 실재).
**반증 시도** 라우트가 살아 있어 접근되는가 → **기각**(경로 문자열 부재 → catch-all `*` → `/login`). 정보 노출만 남음.
**심각도** P3 · **난이도** S · **다운스트림** 없음

### 5.2 권한 게이팅 현황표 (E-2 근거)

| 화면 · 기능 | 프론트 게이팅 | 근거 file:line |
|---|---|---|
| 라우트 전역 인증 가드 | ❌ **없음** (401 인터셉터 사후 처리) | `src/app/Router.tsx:64-80` / `src/shared/lib/api-client.ts:20-28` |
| 상단 네비 메뉴 filter | ✅ 있음 (6항목 중 3항목만 대상) | `AppTopBar.tsx:108-110` → `app-navigation.ts:29-34` |
| Dash `/eqp/live-map` 메뉴 | ✅ `LIVE_MAP_READ` | `app-navigation.ts:18` |
| Dlq `/dlq` 메뉴 + **본문 차단** | ✅ + ✅ `<Navigate>` | `app-navigation.ts:22` / `DlqPage.tsx:72-74` |
| User `/user` 메뉴 + **본문 차단** | ✅ + ✅ `<Navigate>` | `app-navigation.ts:23` / `UserManagementPage.tsx:63-65` |
| **Eqp `/eqp`** | ❌ 메뉴 ❌ 본문 | `app-navigation.ts:19`, `EqpPage.tsx`(`hasPermission` import 0) |
| **Model `/model`** | ❌ ❌ | `app-navigation.ts:20`, `ModelPage.tsx` |
| **Deploy `/deploy`** | ❌ ❌ | `app-navigation.ts:21`, `DeployPage.tsx` |
| LiveMap 3D 뷰 진입 | ✅ `LIVE_MAP_LAYOUT_READ‖WRITE` | `LiveMapPage.tsx:81-85` |
| LiveMap 구조물 편집 | ✅ `LIVE_MAP_LAYOUT_WRITE` | `LiveMapPage.tsx:81`, `LiveMap3DScene.tsx:419` |
| LiveMap 데모 시나리오 삭제 | ✅ `LIVE_MAP_DEMO_RUN_SCENARIO_DELETE` | `LiveMapDemoModal.tsx:129-131` |
| 데모 시나리오 md 업로드 | ❌ (삭제만 게이팅) | `LiveMapDemoModal.tsx:806-807` vs `:129` |
| 모델 XML 업로드 | ❌ | `ModelDetailPanel.tsx:930-931` |

> **오탐 방지 기록**: 축 F 서브에이전트는 "`/dlq` `/user` 도 딥링크 진입 가능" 이라 보고했으나,
> 메인 세션이 `DlqPage.tsx:72-74`, `UserManagementPage.tsx:63-65` 를 직접 열어 `<Navigate to={FORBIDDEN_FALLBACK_ROUTE} replace />`
> **본문 차단이 실재함을 확인**했다. 해당 주장은 채택하지 않는다.

### 5.3 축 E 0건 항목 — 실행 명령 · 검색 범위

| 항목 | 결과 | 실행 명령 · 범위 (cwd = `c:\workspace_nori\nori-tc-ui-front`) |
|---|---|---|
| `dangerouslySetInnerHTML` / `innerHTML` / `outerHTML` / `document.write` / `insertAdjacentHTML` / `srcdoc` / `<iframe` | **0건** | `grep -rn "dangerouslySetInnerHTML\|innerHTML\|outerHTML\|document.write\|insertAdjacentHTML\|srcdoc\|<iframe" src` → 0. `src`+`tests` 전체 Grep 도 0 |
| `eval(` / `new Function(` | **0건** | `grep -rn "\beval(\|new Function(" src` → 0 |
| 문자열 인자 `setTimeout`/`setInterval` | **0건** | `grep -rn "setTimeout(['\"]\|setInterval(['\"]" src tests` → 0 |
| `postMessage` 송수신 / `addEventListener('message')` | **0건** | `grep -rn "postMessage\|addEventListener('message'" src` → 0 (origin 검증 이슈 자체가 성립 안 함) |
| `target="_blank"` / `<a href>` 외부 링크 | **0건** | `grep -rn "_blank" src` → 0. 네비게이션은 전량 react-router `navigate()` |
| `window.open` / `location.assign` / `location.replace` | **0건** | `grep -rn "window\.open\|location\.assign\|location\.replace" src` → 0 |
| `location.href = 사용자입력` | **0건** | `grep -rn "location\.href" src` → 1건뿐이며 `api-client.ts:24` 의 하드코딩 리터럴 `'/login'` |
| 하드코딩 시크릿 / API 키 / `.env*` | **0건** | `ls -la .env*` → 파일 없음. `grep -rn "VITE_" src` → 0. `import.meta.env` 사용처는 `Router.tsx:73,76` 의 `DEV` 플래그뿐 → **번들에 박히는 `VITE_` 변수 0개** |
| 인증 토큰의 JS 접근 저장소 보관 | **0건** | `grep -rn "localStorage\|sessionStorage\|document.cookie" src` 전수(§5.5 표) — JWT/access/refresh 토큰 저장 코드 없음. 세션은 HttpOnly 쿠키(`api-client.ts:8-15` `withCredentials:true`, `auth.types.ts:26` "토큰은 HttpOnly 쿠키로만 전달") |
| `Authorization: Bearer` 수동 부착 | **0건** | `grep -rn "Authorization\|Bearer" src` → 0 (`nginx.conf:32-33` 의 passthrough 설정만) |
| apiClient 우회 raw `fetch()` / `axios.*` 직접 호출 | **0건** | `grep -rn "fetch(\|axios\." src \| grep -v api-client` → TanStack `refetch()` 만 매칭 |
| `createObjectURL` / `Blob(` / `atob`/`btoa` / `DOMParser` | **0건** | `grep -rn "createObjectURL\|Blob(\|atob(\|btoa(\|DOMParser\|parseFromString" src` → 0 |
| 상태변경 요청의 CSRF 헤더 미부착 | **0건** | 상태변경 api 전수가 `issueCsrfToken()` 경유 확인(§B-1 의 9파일). 미부착 mutation 없음 |

### 5.4 `console.*` 전수 (E-4 근거 — 8건)

```
src/features/auth/api/auth.api.ts:184   console.info('[authApi] login success', { userPk: ... })
src/features/auth/api/auth.api.ts:201   console.warn('[authApi] login failed', ...)
src/features/auth/api/auth.api.ts:227   console.info('[authApi] logout skipped due to already invalid session')
src/features/auth/api/auth.api.ts:243   console.info('[authApi] logout success')
src/features/auth/api/auth.api.ts:250   console.warn('[authApi] logout failed', ...)
src/features/auth/hooks/useLogin.ts:56  console.info('[useLogin] login flow completed', ...)
src/features/auth/hooks/useLogin.ts:62  console.error('[useLogin] login flow failed', { status, errorCode })
src/shared/components/AppTopBar.tsx:135 console.warn('[AppTopBar] logout request failed, ...', error)
```
비밀번호·토큰·응답 본문 전체 로깅 **0건**.

### 5.5 저장소 계약 (localStorage / sessionStorage / cookie 전수 — 7키)

| 키 | 저장소 | 내용 | 쓰는 곳 file:line | version/migrate | 민감도 |
|---|---|---|---|---|---|
| `nori-tc-ui-cache` | localStorage | TanStack Query dehydrate 캐시. deny head 7종 제외 → **eqp / model / dlq / line 등 업무 데이터 잔존** | `AppProvider.tsx:19-22, 57-63` | **없음**(`buster` 미설정), `maxAge` 30분 | **중 (E-1)** |
| `shared-sidebar-layout` | localStorage | zustand persist — `sidebarOpen`/`sidebarWidth`/`expandedSidebarWidth` | `shared-layout.store.ts:76-79` | 없음(`partialize` 도 없음) | 없음 |
| `nori-tc-theme` | localStorage | `'light' \| 'dark'` raw string | `theme.store.ts:41, 48` | 없음(수동 구현) | 없음 |
| `nori-tc-lang` | localStorage | `'ko' \| 'en' \| 'vi'` raw string | `src/i18n/index.ts:28` | 없음 | 없음 |
| `nori-tc:savedUserId` | localStorage | 로그인 아이디 평문(체크박스 opt-in) | `LoginPage.tsx:96, 148-151` | 없음 | **낮음~중 (E-7)** |
| `eqp-ui-selection` | sessionStorage | `selection` 만(`partialize`) | `eqp-ui.store.ts:127-134` | 없음 | 낮음 |
| `deploy-ui-state` | sessionStorage | **제외 방식 partialize** — 2필드만 빼고 `selectedEqpTargetsById`/`localHistory` 등 전부 | `deploy-ui.store.ts:729-742`, 삭제 `:808` | version 없음, 커스텀 `merge` `:743-745` | **중 (E-3)** |
| `XSRF-TOKEN` | cookie (non-HttpOnly, 서버 발급) | CSRF double-submit 토큰 | read 9곳(B-1) / delete `src/shared/lib/session.ts:11` | — | 설계상 JS 가시(정상) |
| 인증 세션 | **HttpOnly 쿠키 (JS 미접근)** | — | `api-client.ts:8-15` | — | ✅ 올바름 |

**zustand persist 3개 store 전부 `version`/`migrate` 미설정** — 스키마 변경 시 구 형태가 그대로 rehydrate 된다(P3 관찰).

### 5.6 의존성 CVE — `npm audit` **완료 (실측)**

실행: `npm audit` (cwd = `c:\workspace_nori\nori-tc-ui-front`, npm 11.9.0)

```
vite  7.0.0 - 7.3.3
Severity: high
launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows - https://github.com/advisories/GHSA-v6wh-96g9-6wx3
vite: `server.fs.deny` bypass on Windows alternate paths - https://github.com/advisories/GHSA-fx2h-pf6j-xcff
fix available via `npm audit fix`
node_modules/vite

9 vulnerabilities (1 low, 1 moderate, 7 high)

To address all issues, run:
  npm audit fix
```

| severity | 건수 |
|---|---|
| critical | **0** |
| high | **7** |
| moderate | **1** |
| low | **1** |
| **total** | **9** |

| 패키지 | severity | 취약 범위 | 요지 |
|---|---|---|---|
| `axios` | high | 1.0.0 – 1.17.0 | `formDataToJSON` 과도 재귀 DoS + prototype pollution |
| `brace-expansion` | high | ≤5.0.7 | 지수 시간 확장 DoS |
| `form-data` | high | 4.0.0 – 4.0.5 | multipart 필드명 CRLF injection |
| `js-yaml` | high | 4.0.0 – 4.2.0 | merge key 2차 복잡도 DoS |
| `postcss` | high | ≤8.5.17 | sourceMappingURL path traversal → 임의 `.map` 노출 |
| `react-router` | high | 6.0.0 – 8.2.0 | `<Link>`/`useNavigate` 백슬래시 open redirect 외 |
| `vite` | high | 7.0.0 – 7.3.3 | `server.fs.deny` 우회(Windows) + launch-editor NTLMv2 유출 |
| `react-router-dom` | moderate | 6.0.0-alpha.0 – 7.17.0 | `react-router` 전이 |
| `esbuild` | low | 0.27.3 – 0.28.0 | dev 서버 임의 파일 읽기(Windows) |

**본 감사는 목록화까지만 수행한다**(방법론 규율 — 업그레이드는 F 트랙). 9건 전부 Phase 2 백로그 F 트랙으로 승격한다.
> 주의: **Java 레포의 `dependencyCheckAggregate` 수치와 집계 단위가 다르다**(고유 CVE 수가 아니라 npm advisory 단위).
> S06(2265 취약점 인스턴스) / S08(고유 CVE 138) 과 직접 비교하지 말 것. S14 에서 별도 축으로 병합한다.
> `axios`/`react-router`/`vite` 는 **런타임 의존**이라 우선순위가 높고, `esbuild`/`postcss`/`brace-expansion`/`js-yaml` 은 빌드타임이다.

---

## §6 축 F — 계약 표면 인벤토리 (목록화)

### 6.1 ui-backend REST 호출 — **98 distinct** + S08 인벤토리 전수 대조

**추출 방법(재현 가능)** — 메인 세션이 스크립트로 독립 재추출했다:
`apiClient.<verb>(...)` 의 경로 리터럴을 다중행 포함으로 파싱 → `${...}` 를 `{}` 로 정규화 → `baseURL='/api'`(`api-client.ts:9`) 부착.

| 항목 | 값 |
|---|---|
| HTTP 클라이언트 | `apiClient` **단일**(axios, `api-client.ts:8`), baseURL `/api`, `withCredentials: true`, timeout 10s |
| 401 인터셉터 | `window.location.href = '/login'` (`api-client.ts:20-28`) |
| raw `fetch()` / `axios.*` 직접 호출 | **0건** |
| 정규식 추출 distinct | **94** |
| 변수 경로 주입 (dlq 4종 — `dlq.api.ts:43-46` 이 path 를 인자로 받음, 호출부 `:53,59,65,71`) | **+4** |
| **프론트 호출 distinct 합계** | **98** |

**cross-repo 대조 — S08 §5.1 의 백엔드 108 엔드포인트와 집합 연산**

| 구분 | 개수 | 결과 |
|---|---|---|
| 프론트 호출 ∩ 백엔드 | **98** | 전부 대응 존재 |
| **프론트가 호출하는데 백엔드에 없음** | **0건** | ✅ dangling 호출 없음 |
| **백엔드에 있는데 프론트가 호출하지 않음** | **10건** | 아래 표 |
| 합계 검산 | 98 + 10 = **108** | S08 §5.1 의 108 과 **일치** |

**F-1. 프론트 미소비 백엔드 엔드포인트 10개** (백엔드 컨트롤러 실재 — S08 §5.1 대조)

| 메서드 · 경로 | 백엔드 컨트롤러 | 해석 |
|---|---|---|
| `GET /api/admin/deploy-scenarios/catalog` | `DeployScenarioAdminController` | **시나리오 관리 UI 미구현**(3개 세트) |
| `POST /api/admin/deploy-scenarios/reload` | 〃 | 〃 |
| `POST /api/admin/deploy-scenarios/validate` | 〃 | 〃 |
| `GET /api/permission/{permId}` | `PermissionController` | **권한 CRUD UI 미구현**(4개 세트). 프론트는 `GET /api/permission` 목록만 소비 |
| `POST /api/permission` | 〃 | 〃 |
| `PUT /api/permission/{permId}` | 〃 | 〃 |
| `DELETE /api/permission/{permId}` | 〃 | 〃 |
| `DELETE /api/dlq/gateway/{dlqId}` | `DlqController` | **DLQ 삭제 UI 미구현**. 조회 4종은 소비 중 |
| `DELETE /api/dlq/business/{dlqId}` | 〃 | 〃 |
| `GET /api/user/{userPk}/group` | `UserController` | 프론트는 `GET /api/group/{groupId}/user`(역방향)만 사용 |

> 10건은 **결함이 아니라 미소비 표면**이다(백엔드 단독 부채 후보 — S08 축 A 의 죽은 코드 판정에는 포함되지 않았다).
> S14 에서 "백엔드 REST 표면 중 소비자 0" 항목으로 재평가 대상. `DELETE /api/dlq/*` 는 시드에 `DLQ_DELETE` 권한이
> 실재하므로(S08 §5.2) **기획된 기능의 프론트 미구현**일 가능성이 높다.

**F-2. 추출 계측 오류 2건 (오탐 기록 — 반증 성립)**

| 1차 판정 | 정정 |
|---|---|
| "`PUT /api/model/{}/details/{}` · `/details/mdf` 가 백엔드에 없음" | **FALSE.** 백엔드 추출 정규식이 다중행 애노테이션을 놓쳤다. `ModelDetailController.java:55-58`(`@PutMapping(\n path = "/{modelVersionKey}/details/{detailNode}", consumes = APPLICATION_JSON_VALUE)`), `:130-133`(`/details/mdf`, MULTIPART) 에 실재 |
| "DLQ GET 4종을 프론트가 호출하지 않음" | **FALSE.** `dlq.api.ts:43-46` 이 경로를 변수로 받아 호출한다(`:53,59,65,71`). 리터럴 기반 추출의 한계 |

**F-3. 계약 품질 관찰**

- **`deploy.api.ts` 13개 호출 전부 axios 제네릭 미지정** → 응답 정적 타입이 `any`. 계약이 런타임 normalize 함수로만 강제된다.
  같은 파일이 유일하게 `page/size` 페이징 규약을 쓴다(`:913-919`) — 나머지 전 도메인은 `offset/limit`.
- **`ApiResponse<T>` 래퍼**(ui-backend `ApiResponse.java:16-21` 소유)를 프론트가 도메인별 5벌로 재선언(B-3).
- multipart 엔드포인트 2개: `PUT /api/model/{mvk}/details/mdf`, `POST /api/live-map/demo-runs/scenarios`.
- **DLQ 3종 응답은 nori-tc-common DB 도메인 타입이 그대로 REST 로 노출**된다(S08 §6.2 — `RedisDlqEntry`/`RedisBusinessDlqEntry`/`RedisQuarantineEntry`).
  즉 **common 변경이 ui-front 를 직접 깬다**. S08 **D-18**(DLQ 직렬화 mode 불일치)이 실현되면 프론트는 빈 목록만 받는다 → **S14 병합 대상**.

**F-4. cross-repo 권한 코드 계약 불일치 — `USER_READ` 가 git-tracked 시드에 부재 (P2)**

프론트가 게이팅에 쓰는 permCode 6종을 exec 의 권한 시드/패치와 대조했다.

| 프론트 상수 (`permission.ts`) | exec git-tracked SQL 실재 |
|---|---|
| `LIVE_MAP_READ` (`:5`) | ✅ `postgres_insert_sample_data.sql:774` |
| `DLQ_READ` (`:16`) | ✅ `:768` |
| `LIVE_MAP_LAYOUT_READ` / `_WRITE` (`:30`, `:23`) | ✅ `patch/postgres_2026_06_02_*` |
| `LIVE_MAP_DEMO_RUN_SCENARIO_DELETE` (`:37`) | ✅ `patch/postgres_2026_06_22_*:30` |
| **`USER_READ` (`:10`)** | ❌ **0건** |

검색 범위: `Grep pattern="USER_READ" path=c:\workspace_nori` 전 레포. tc 계열 히트는 프론트 상수·테스트·문서뿐이고
`tc_ui_permission` INSERT 행은 없다(있는 것은 `USER_INFO_WRITE` = PREFIX `/api/user`, method NULL — S08 §5.2).
`nori-wm-business\flyway\sql\V202607122300__seed_wm_ui_auth_bootstrap.sql:21` 에는 실재하나 **다른 제품(wm)** 이다.

**실패 시나리오** git-tracked 시드만으로 신규 환경을 구축하면 어떤 사용자도 `USER_READ` 를 갖지 못한다 →
`app-navigation.ts:23` 의 User 메뉴가 **모든 사용자(ADMIN 포함)에게 비노출**되고, `/user` 딥링크는
`UserManagementPage.tsx:63-65` 가 `FORBIDDEN_FALLBACK_ROUTE` 로 되돌린다. **사용자·그룹 관리 화면 전체가 도달 불가.**
**반증 시도** ① 라이브 DB 에 있는가 → **있다.** `nori-tc-common\.claude\specs\week19-execution-dev-report.md:585` 가
"repo seed 엔 `USER_INFO_WRITE`만 존재하고 `USER_READ` 행은 **라이브 DB drift**" 라고 이미 기록했다 →
**현재 운영은 정상이므로 P1 아님.** ② 시드가 ADMIN 에 전 권한을 자동 부여하니 괜찮은가 → 자동 부여는
`tc_ui_permission` **행이 존재할 때** 조인하는 방식(S08 §5.1)이라 행 자체가 없으면 부여할 대상이 없다. **반증 부분 성립 → P2.**
**심각도** **P2** (선행조건: 신규 환경 프로비저닝 또는 시드 재실행) · **난이도** S (exec 에 `USER_READ` patch SQL 1개)
**다운스트림** **nori-tc-exec**(권한 시드), **nori-tc-ui-backend**(권한 카탈로그)
**cross-repo**: S08 §5.1 이 "라이브 DB 권한 drift 미확인" 으로 남긴 항목의 **구체적 1건** → **S14 병합 예고**

### 6.2 실시간 채널 — **0건** + 폴링 7종

**WebSocket / SSE / STOMP / socket.io: 0건**
```bash
grep -rn "new WebSocket\|EventSource\|SockJS\|socket\.io\|@stomp\|stompjs" src --include=*.ts --include=*.tsx   # 0
```
`package.json` 의존성에도 `sockjs-client`/`@stomp/stompjs`/`socket.io-client` 없음. **실시간성은 전부 TanStack Query 폴링**이다.

| # | 쿼리 키 | 주기 | 중단 조건 | 위치 |
|---|---|---|---|---|
| 1 | `deployQueryKeys.history(...)` | 3s | `terminalOnly === true` | `useDeployHistoryList.ts:16,18` |
| 2 | `deployQueryKeys.summary(deployKey)` | 3s | `status !== 'RUNNING' \|\| terminal` | `useDeploySummary.ts:15,18-26` |
| 3 | `deployQueryKeys.targets(...)` | 3s | `activeDeployStatus !== 'RUNNING'` | `useDeployTargets.ts:19-22, 25-30` |
| 4 | `['comm-log', eqpId, type]` | 10s | **없음**(`enabled: !!eqpId` 만) | `useCommLog.ts:6, 10` |
| 5 | `['live-map']` | 5s | **없음**(상시) | `useLiveMap.ts:6, 9` |
| 6 | `['live-map-demo-run', runId]` | 3s | terminal state | `useSimulatorRun.ts:12, 16-19` |
| 7 | `['live-map-demo-run-list']` | 3s | **없음**(`enabled` 만) | `useSimulatorRunList.ts:9, 13` |

`refetchIntervalInBackground` 0건 → 백그라운드 탭에서는 정지(TanStack 기본).
비-네트워크 타이머 1개: `LiveMapPage.tsx:203-205` `setInterval(1000)` 경과시간 tick.

### 6.3 스토리지 키 계약 — 7키

§5.5 표와 동일(축 E 와 공유). 요약: localStorage 5 / sessionStorage 2. zustand `persist` store 3개
(`shared-layout` / `deploy-ui` / `eqp-ui`) 전부 **`version`/`migrate` 미설정**.

### 6.4 라우트 목록 — 11개

| path | 컴포넌트 | lazy | 메뉴 진입점 | 권한 게이팅 |
|---|---|---|---|---|
| `/` | `<Navigate to="/login">` | — | — | — |
| `/login` | `LoginPage` | ✔ `Router.tsx:5-8` | **없음 — 딥링크/리다이렉트 전용**(401 인터셉터 `api-client.ts:24`, 로그아웃 `AppTopBar.tsx:140`, catch-all `Router.tsx:79`) | — |
| `/eqp` | `EqpPage` | ✔ `:10-13` | topbar `Eqp` (`app-navigation.ts:19`) | **없음** |
| `/eqp/live-map` | `LiveMapPage` | ✔ `:25-28` | topbar `Dash` (`:18`) + **로그인 후 기본 착지**(`useLogin.ts:37,59`) | `LIVE_MAP_READ` (메뉴) + `LIVE_MAP_LAYOUT_READ‖WRITE` (본문) |
| `/model` | `ModelPage` | ✔ `:15-18` | topbar `Model` (`:20`) | **없음** |
| `/deploy` | `DeployPage` | ✔ `:20-23` | topbar `Deploy` (`:21`) | **없음** |
| `/dlq` | `DlqPage` | ✔ `:35-38` | topbar `Dlq` (`:22`) | `DLQ_READ` (메뉴 + 본문) |
| `/user` | `UserManagementPage` | ✔ `:30-33` | topbar `User` (`:23`) | `USER_READ` (메뉴 + 본문) — **F-4 참조** |
| `/__fixtures/selectable-table` | `SelectableTableFixture` | ✔ `:41-44` | **없음 — 딥링크 전용**, `import.meta.env.DEV` 조건부 | DEV 한정 |
| `/__fixtures/layout-shell` | `LayoutShellFixture` | ✔ `:47-50` | **없음 — 딥링크 전용**, DEV 조건부 | DEV 한정 |
| `*` | `<Navigate to="/login">` | — | catch-all | — |

- 페이지 컴포넌트 9개 **전부 `lazy()`** — non-lazy 0. topbar 메뉴 6항목 전부 실존 라우트에 매핑(**dangling 메뉴 0건**).
- `AppTopBar.tsx:160-165` 이 hover/focus 시 메뉴별 prefetch 수행(`deploy` 는 정적 query 부재로 제외 — `:38-39, 93`).

---

## §7 P1 / P2 Top 요약

**P1 = 0건.** 채택 전건이 선행조건을 요구한다(§0.6). 프론트 권한 게이팅 부재(E-2)는 백엔드 closed-by-default 강제
(S08 §5.1 — 108 엔드포인트 미게이팅 0건)가 데이터 경계를 지키므로 P1 이 아니다.

**P2 = 10건** (축 D 4 + 축 E 3 + 축 A·B·F 각 1)

| 순 | ID | 축 | 요구 축 | 트랙 | 위치 | 1줄 요약 | 난이도 | 다운스트림 |
|---|---|---|---|---|---|---|---|---|
| 1 | D-3 | D | R4,R8 | F | `src/app/Router.tsx:61-83` (레포 전역) | 에러 경계 **0건** + 데이터 라우터 아님 → lazy chunk 로드 실패 시 앱 전체 백지, 복구 UI 없음 | M | — |
| 2 | D-1 | D | R4,R5,R8 | F | `src/features/eqp/components/EqpPage.tsx:919-943, 983-984` | `mutateAsync` settle 후 60초 폴링 구간에 `isPending` 공백 → 확인 버튼 재활성 → **EQP_END/START 중복 발행** | S | ui-backend, gateway |
| 3 | D-2 | D | R4,R5,R8 | F | `EqpPage.tsx:986-995` + `EqpPollingGroupControl.tsx:81,89,100` | 동일 구조 — PLC 폴링 그룹 START/END 중복 발행 | S | ui-backend, gateway |
| 4 | E-2 | E | R8 | F | `src/shared/lib/app-navigation.ts:19-21` + `permission.ts:5-37` | eqp/model/deploy 메뉴·본문·write 버튼 게이팅 0. **EQP_*/MODEL_*/DEPLOY_* 권한 상수 자체가 부재** | M | ui-backend, exec |
| 5 | E-1 | E | R8 | F | `src/app/providers/AppProvider.tsx:30-49` | Query persist 가 **deny-list** → eqp/model/dlq/line 업무 데이터가 localStorage 30분 잔존, 로그아웃 시 `removeClient()` 없음 | M | — |
| 6 | E-3 | E | R8 | F | `Router.tsx:64-80` + `AppTopBar.tsx:125-142` | 라우트 인증 가드 0 + 로그아웃이 `clearDeployUiSessionState()` 미호출 → 같은 탭 딥링크에 이전 사용자 deploy 선택 잔여 렌더 | M | — |
| 7 | D-4 | D | R4,R8 | F | `src/features/live-map/components/LiveMap3DScene.tsx:165-168, 378` | `size` 새 배열 리터럴로 `useMemo` 무효화 → `EdgesGeometry`+`BoxGeometry` 매 렌더 누수, dispose 없음 → WebGL context lost | S | — |
| 8 | B-1 | B | R3,R7,R8 | R | 9개 `*.api.ts` (`auth/deploy/eqp/group/layout/demo-run/model/model-flow/user`) | **CSRF 발급·읽기 로직 9중 복제** — 백엔드 CSRF 규약 변경 시 9곳 동시 수정, 누락 도메인은 전량 403 | M | **ui-backend** |
| 9 | A-3 | A | R1,R8 | F | `package.json` ↔ `LiveMap3DEquipmentField.tsx:2` | `three-stdlib` 를 현역 파일이 import 하는데 **미선언 의존**(drei 전이에만 의존) → drei 업그레이드 시 빌드 붕괴 | S | — |
| 10 | F-4 | F | R8 | F | `permission.ts:10` ↔ exec 권한 시드 | 프론트 게이팅 코드 **`USER_READ` 가 git-tracked 시드에 0건**(라이브 DB drift) → 신규 환경에서 User 관리 화면 전원 도달 불가 | S | **exec**, ui-backend |

**묶음 권고 (Phase 2 입력)**

- **묶음 1 (S, 최우선)**: **D-1 + D-2** — 동일 근본 원인(폴링 구간을 포함하지 않는 in-flight 판정). 공통 `useAsyncCommandGuard` 1개로 함께 해소.
- **묶음 2 (M)**: **E-1 + E-3** — 둘 다 "로그아웃이 클라이언트 상태를 정리하지 않는다". `AppTopBar.handleLogout` 한 곳에서
  `persister.removeClient()` + `clearDeployUiSessionState()` 를 함께 처리.
- **묶음 3 (M)**: **B-1 + E-2** — 둘 다 `src/shared/lib/` 로의 횡단 관심사 승격(CSRF 헬퍼 / 권한 상수·가드).
- **선행 (S)**: **A-3** 은 다른 어떤 작업보다 먼저 — 빌드 재현성의 전제다.
- **P0-3 선행 필수**: D-1/D-2 의 소재지 `EqpPage.tsx`(1712, 무테스트), D-4 의 소재지 `LiveMap3DScene.tsx`(1386, 무테스트)는
  characterization test 없이 손대면 안 된다(§0.4).

**축별 발견 수**

| 축 | P1 | P2 | P3 | 계 |
|---|---|---|---|---|
| A (죽은 코드) | 0 | 1 (A-3) | 4 (A-1·A-2·A-4·A-5) | 5 |
| B (중복) | 0 | 1 (B-1) | 9 (B-2~B-10) | 10 |
| C (smell) | 0 | 0 | 10 | 10 |
| D (결함) | 0 | 4 | 6 | 10 |
| E (보안) | 0 | 3 | 5 | 8 |
| F (계약) | 0 | 1 (F-4) | — | 인벤토리 (REST 98 / 폴링 7 / 스토리지 7 / 라우트 11) + 미소비 백엔드 10 |
| **합계** | **0** | **10** | **34** | **44** (+ npm audit 9건 별도) |

---

## §8 세션 메타

### 8.1 읽기 전용 준수

```
$ git status --porcelain
(출력 0줄)
```
세션 전 구간에서 코드 수정 0. 생성물은 본 md 1개.
`dist/` 는 2026-07-17 기존 산출물이며 본 세션이 빌드하지 않았다(§5.1 E-4 주). 롤백 = 본 파일 삭제.

### 8.2 메인 세션 직접 재검증 목록 (채택 P2 전건 + 강등/기각 판정 근거)

| 대상 | 재검증 내용 | 결과 |
|---|---|---|
| D-1 | `EqpPage.tsx:915-1000` 열람 — `mutateAsync`→`waitForEqpAsyncCompletion` 시퀀스 6곳, `:119-120` 폴링 상수(1000ms×60), `:983-984` `isLifecyclePending` 정의, `:946-981` `closeLifecycleDialog()` 가 await 뒤임, `EqpLifecycleActionDialog.tsx:80,87,92` `disabled={isPending}` | 확정 |
| D-2 | `EqpPage.tsx:986-995` + `EqpPollingGroupControl.tsx:81,89,100` `disabled={isPending}` 직접 확인 | 확정 |
| D-3 | `Router.tsx` **전문 열람** — `<Suspense>+<Routes>` 구조, `errorElement` 부재, lazy 9개. `ErrorBoundary\|componentDidCatch\|getDerivedStateFromError` 레포 grep 0건 | 확정 |
| D-4 | `LiveMap3DScene.tsx:145-175`(`EQUIPMENT_SELECT_BOX` 상수 + `useMemo([size])`) + 호출부 `:372-382`(`size={[bbox.size.x, ...]}` 새 배열) 직접 대조 | 확정 |
| E-1 | `AppProvider.tsx` **전문 열람** — deny-list `:30-38`, `shouldDehydrateQuery :40-49`, `maxAge :61`. `removeClient` 레포 grep 0건 | 확정 |
| E-2 | `app-navigation.ts` **전문 열람**(6항목 중 3항목만 `requiredPermission`) + `permission.ts` **전문 열람**(상수 6종, EQP/MODEL/DEPLOY 부재) + `DlqPage.tsx:65-85`·`UserManagementPage.tsx:58-78` 대조 게이팅 확인 | 확정 |
| E-3 | `AppTopBar.tsx:125-142` logout 전문 + `clearDeployUiSessionState` 호출처 전수 grep(4곳, logout 미포함) | 확정 |
| E-4 | `vite.config.ts` **전문 열람**(build 블록에 drop 없음) + `src` `console.*` 전수 8건 + `dist/assets` 잔존 실측 | 확정(강등) |
| E-5 | `deploy/docker/nginx.conf:18-45` 전문 — `add_header` 0건 | 확정 |
| E-6 | `LiveMapKonvaPrimitive.tsx:28-50` 전문 | 확정 |
| B-1 | 9개 api 파일의 `getCookieValue`/`issueCsrfToken` 로컬 정의 grep + jscpd 클론 5쌍 대조 | 확정 |
| A-1 | knip 7건 → 4곳(+동적 참조) 검증, `c:\workspace_nori` 전 레포 Grep, `data-testid` 0개 확인 | 확정(6건 채택 / 1건 오탐) |
| A-3 | `three-stdlib` import 2곳 + `package.json` 부재 + `package-lock.json:2677` 전이 + `vite.config.ts:45` 청크 규칙 | 확정 |
| F-1 | 스크립트로 프론트 98 / 백엔드 108 독립 재추출 → 집합 연산. **98 + 미소비 10 = 108** 검산 일치 | 확정 |
| F-4 | `permission.ts` 6상수 ↔ exec 시드/패치 대조, `USER_READ` 워크스페이스 전 레포 Grep | 확정(라이브 drift 는 기존 기록으로 반증) |
| **기각** `PUT /api/model/{}/details/*` 부재 | `ModelDetailController.java:55-58, 130-133` 다중행 애노테이션 직접 확인 | FALSE(계측 오류) |
| **기각** DLQ GET 미호출 | `dlq.api.ts:40-72` 전문 — 변수 경로 주입 확인 | FALSE(계측 오류) |
| **기각** `/dlq`·`/user` 딥링크 무방비 | `DlqPage.tsx:72-74`, `UserManagementPage.tsx:63-65` `<Navigate>` 차단 확인 | FALSE(서브에이전트 오보고) |
| **기각** `tests/i18n-test-instance.ts` 미사용 | `tests/alias-hooks.mjs:14-22` 동적 경로 해석 확인 | FALSE(knip 한계) |

### 8.3 테스트 안전망 현황 (baseline 참조)

```
$ npm run test:unit
1..174
# tests 174
# suites 0
# pass 174
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1985.2219
```

- `tests/unit` **26 파일 / 174 테스트 전부 PASS** — S02 baseline(`refactor-coverage-baseline.md`)과 동일 수치.
- 26개 전부 **순수 함수·모델 계층**(`model-detail-editor` / `live-map-3d-model` / `mdf-message-parser` / `eqp-runtime-state` /
  `flow-card-render` / `model-diff` / `password-generator` 등). **§0.4 의 hotspot 7개 컴포넌트를 렌더하는 unit 테스트는 0개.**
- `tests/e2e` 59 파일은 **gitignore 로컬 전용**이라 CI 게이트가 아니다. 본 세션은 **e2e 를 실행하지 않았고**,
  알려진 로컬 사전 실패를 **발견으로 등록하지 않았다**(프롬프트 규율 + baseline 기준).

### 8.4 방법론 준수 편차 (정직 기록)

- **중간 파일 미생성**: 축 D/E/F 서브에이전트는 읽기 전용 Explore 계열이라 Write 도구가 없었다(S08 과 동일 제약).
  메인 세션이 반환값을 즉시 본 문서에 통합했고 축 A·B·C·F 대조는 메인 세션이 직접 수행했으나,
  **"세션 중단 시 재개 가능성 확보" 라는 원래 의도는 여전히 부분 미충족**이다. S10~S13 에서는 도구 출력(`knip.txt`/`jscpd` JSON)처럼
  스크래치패드에 영속되는 산출물을 늘리거나 메인 세션이 반환값을 즉시 파일로 저장할 것.
- **미확인으로 남긴 항목**:
  ① E-1 의 `queryClient.clear()` 가 persister 를 실제로 flush 하는지 **런타임 실증 미수행**.
  ② E-5 의 상위 Gateway(HTTPRoute 밖 리소스)가 보안 헤더를 주입하는지.
  ③ D-5 의 서버 응답(`/api/eqp/{id}` detail)이 폴링 그룹 상태를 포함하는지.
  ④ A-4 의 `PrimitiveImage` 가 실제 `shape_json` 데이터에서 `type:'image'` 로 소비되는지(**API 응답 의존** — 정적 grep 한계).
  ⑤ 라이브 DB 의 `tc_ui_permission` 실제 행(F-4 의 drift 규모) — S08 §8.4 ①과 동일 미확인 항목.
  ⑥ `dist/` 는 2026-07-17 산출물이라 HEAD 재빌드 기준이 아니다(E-4·E-8 보강 증거의 한계).
- **`npm run build` 미실행** — 코드 변경이 0이라 R/F 트랙 게이트 대상이 아니다. 탐지 세션 규율에 따라 생략했다.

### 8.5 병행 실행 후보

- **`/ui-front-quality`** — 스킬이 로컬에 실재한다. 방법론상 **감사와 독립인 병행 세션**이므로 본 세션에서 호출하지 않았다.
  타입 안전성(tsc + any/unknown/as) / lint(eslint) / 테스트 / a11y 4축은 본 감사의 축 A~F 와 중복되지 않으므로 별도 세션 권장.
- **`/ui-front-perf`** — Phase 3 P 트랙. 아래 P 후보를 스코프로 지정.

### 8.6 P 트랙 후보 (성능 — Phase 3 `/ui-front-perf`, 본 세션에서 측정·개선 금지)

| # | 후보 | 위치 |
|---|---|---|
| 1 | `useMemo([size])` 의존성이 매 렌더 새 배열 → memo 무효화 (D-4 와 동일 근원) | `LiveMap3DScene.tsx:165, 378` |
| 2 | 1초 `setInterval` 의 `setNow` 가 페이지 트리 전체를 초당 1회 재렌더 | `LiveMapPage.tsx:203-205` |
| 3 | 단일 컴포넌트 1400~1712 LOC — state 1개 변경 시 재렌더 표면이 파일 전체 | `EqpPage.tsx` / `DeployRegisterPanel.tsx` / `DeployMonitorPanel.tsx` / `ModelPage.tsx` |
| 4 | 설비 수만큼 DOM 버튼 렌더 + `BadgeProjector` 가 `useFrame` 마다 전체 순회하며 `style.transform` write | `LiveMap3DScene.tsx:199, 1067-1114` |
| 5 | `parts` useMemo 가 exhaustive-deps disable 상태로 11종 배열 매번 재구성 | `LiveMap3DEquipmentField.tsx:186-224` |
| 6 | `commentTargetPageSize = Math.max(total, 50)` 가 queryKey 에 포함 → total 변동마다 캐시 엔트리 신설(파편화) | `DeployMonitorPanel.tsx:428` |
| 7 | 선택 드래그 중 rAF 루프가 velocity 0 에서도 계속 재귀 스케줄 | `SelectableTable.tsx:368-374` |
| 8 | 동시 활성 시 3초 주기 병렬 폴링 6종(§6.2) | `useLiveMap`/`useCommLog`/`useSimulatorRunList`/deploy 3종 |
| 9 | `manualChunks` 전이 공유 의존 취약(`scheduler`/`react-reconciler` 배치) — 회귀 시 three(1.1MB)가 전 페이지 preload | `vite.config.ts:37-53` |

### 8.7 cross-repo 병합 예고 (S14)

| 본 감사 ID | 동일 원인 / 상대편 | S14 처리 |
|---|---|---|
| **B-1** | S08 **E-4** (CSRF BREACH 보호 비활성 — `UiSecurityConfig.java:95-103`). 백엔드가 XOR 핸들러로 되돌리면 ui-front 9파일 동시 수정 필요 | 병합 행. **양단 동시 변경 항목**으로 expand→migrate→contract 순서 명시 |
| **E-5** | S08 **E-1** (actuator IP 화이트리스트 무력화). **같은 `nori-tc-exec\deploy\docker\nginx.conf` 파일의 양면 결함** — S08 은 `:27-31` 의 `X-Forwarded-For`, 본 감사는 `add_header` 부재 | 병합 행. nginx.conf 1회 수정으로 양쪽 해소 가능 |
| **F-4** | S08 §5.1 "라이브 DB 권한 drift **미확인**" 의 구체적 1건(`USER_READ`). `week19-execution-dev-report.md:585` 가 이미 drift 로 기록 | 병합 행. exec 시드 patch 1개로 해소. **라이브 DB 전수 대조**를 S14 확인 항목으로 승계 |
| **D-2** | S08 **D-7** (gateway PASS 후 DB 반영 실패 시 보상 없음). 프론트 중복 발행 + 백엔드 보상 부재가 같은 PLC 폴링 경로의 양단 | 병합 검토. 원본 ID 2개 보존 |
| **§6.1 F-3 (DLQ 응답 타입)** | S08 **D-18** (DLQ Redis 직렬화 mode 불일치) + S08 §6.2 (common DB 도메인 타입이 REST 로 노출) | 병합 행. common 소유 타입이 ui-front 를 직접 깨는 계약 |
| **§6.1 F-1 (미소비 10)** | S08 축 A 는 이 10개를 죽은 코드로 잡지 않았다(REST 핸들러는 프레임워크 호출로 분류) | S14 에서 "소비자 0 REST 표면" 항목 신설 후 재평가 |
| **§3.3 페이징 규약 2종** | S08 §3.3 (`DeployController.getDeployTargets:343-344` 만 `page/size`) — **양쪽이 같은 불일치를 공유** | 병합 행. 계약 통일은 양단 동시 변경 |
| **npm audit 9건** | Java 레포 CVE 와 **집계 단위 상이** — 직접 합산 금지 | S14 에서 "npm advisory" 별도 축으로 관리 |

### 8.8 다음 세션

**S10 — 감사: nori-tc-exec** (`c:\workspace_nori\nori-tc-exec`).
**산출물 경로 예외 엄수** — exec `.gitignore:139` 가 `.claude/` 전체를 무시하므로 감사 문서는
`c:\workspace_nori\nori-tc-common\.claude\specs\refactor-audit-nori-tc-exec.md` 에 Write 한다(Plan §5).
중점: config/secret 하드코딩·평문 자격증명(축 E).
본 감사에서 넘기는 입력: **F-4**(`USER_READ` 권한 시드 부재 — exec `docs/db_table/patch/` 소유), **E-5**(`deploy/docker/nginx.conf` 보안 헤더 부재 — exec 소유,
S08 E-1 과 같은 파일), §6.1 의 프론트 미소비 백엔드 엔드포인트 10건(권한 시드 대조 시 참고).
