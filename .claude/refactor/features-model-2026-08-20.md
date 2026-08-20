# features/model — measurement-first 리팩터링 (2026-08-20)

#9 트랙 3회차(마지막). 근거: `wm-parity-foundation.md:178-180` (거대 파일 4개 분해 확정).
1회차 `features/deploy` / 2회차 `features/eqp` 는 각각의 보고서에 있다.

확정 대상: `src/features/model/components/ModelPage.tsx` (P1).
`ModelDetailPanel.tsx` 는 확정 4파일 밖 — 아래 §6 에 P2 로 측정만 기록한다.

---

## 1. Baseline (clean HEAD 실측)

| 항목 | 값 | 출처 |
|---|---|---|
| ModelPage.tsx | **1,504줄** | `wc -l` |
| useState / useEffect / useMemo / useCallback | 20 / 3 / 16 / 9 | `grep -c` |
| top-level `export function` | 1 (파일 거의 전체가 단일 컴포넌트) | `grep -c` |
| `key={index}` 계열 | **0건** | `grep -rn 'key={\(index\|i\|idx\)}'` |
| 빌드 | PASS 27.19s / ModelPage 청크 65.05 kB | `npm run build` |
| 런타임 | ModelPage cold 33ms / select 28ms / warm 46ms / rows=[1] | `refactor-baseline-2026-08-20T0425-model.json` |
| unit | 246 pass | `npm run test:unit` |
| e2e (model 44 test) | **37 fail / 2 did not run / 5 pass** | `npx playwright test` |

### scope prop 실측 — 3모드 분기는 코드에 거의 없다

`ModelPage` 는 `scope: ProtocolType`("SECS"/"SOCKET"/"PLC") 3모드 공유 컴포넌트지만
`grep -n scope` 결과 실제 분기는 6곳뿐이다: props 선언(:150), 시그니처(:159),
목록 필터(:292-307), effect deps(:781), 자식 prop 전달(:1312). 인터페이스별 실질 분기는
`resolveDetailNodesByInterface` 하나에 모여 있다. → 분할 시 모드별 위험이 낮다는 뜻이고,
그 함수를 unit 으로 고정하는 것이 3모드 회귀 방어의 핵심이 된다(§3 A).

---

## 2. e2e 게이트 진단 — 37/44 사전 실패의 원인 2겹

둘 다 **리팩터링과 무관한 사전 부채**다. 리팩터링 전 clean HEAD 에서 측정했다.

### (a) `/api/line` catch-all 이 객체를 반환 → 공유 topbar 크래시

`model-flow.spec.ts` 의 `setupMocks` fallback 이 paginated 객체(`{items:[],offset,limit,count}`)로
모든 `/api/*` 를 응답하는데, 공유 topbar 의 `LineScopeSelector.tsx:40` 은 배열을 요구한다
→ `TypeError: (lineListQuery.data ?? []).map is not a function` → ErrorBoundary 가 화면 전체를 삼킴.
한 번 실행에서 이 크래시가 **92건** 찍혔다.

fix 를 실증했고 크래시는 **92 → 0** 이 됐다. 그러나 20 test 는 여전히 실패한다 — 원인이 (b) 로 넘어간다.
`tests/e2e/` 는 `.gitignore:22` 로 git 추적 대상이 아니라(정책: unit 만 CI 게이트) commit 이 불가하므로
복구용 diff 를 여기 남긴다. 형제 스펙 `plc/plc-model-tree.spec.ts:60` 이 이미 같은 처리를 한다.

```js
// tests/e2e/model/model-flow.spec.ts — setupMocks 의 paginated fallback 직전에 삽입
// 공유 topbar 의 LineScopeSelector 가 배열을 요구한다 — 아래 paginated 객체 fallback 으로
// 응답하면 `.map is not a function` 으로 ErrorBoundary 가 화면 전체를 삼킨다.
if (pathname === '/api/line' && method === 'GET') {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(createApiResponse([])),
  })
  return
}
```

### (b) 스펙의 진입 경로가 wm-parity 개편으로 stale

스펙 다수가 `getByRole('button', { name: 'SECS', exact: true })` 로 사이드바 섹션 헤더를 클릭해
트리를 펼친다. 그 헤더는 **의도적으로 제거됐다** — `ModelSidebar.tsx:94`:

> "1단계였던 SECS / Socket / PLC 섹션 헤더는 전역 LNB 의 menu-label 로 승격돼 여기서 사라졌다"

스코프는 이제 URL(`/model/secs` 등)이 정한다. `plc-model-tree.spec.ts:175` 의
`lnb-item-modelPlc` 도 같은 계열 — LNB 아코디언이 기본 접힘이라 펼치지 않으면 안 보인다.
즉 **진입 경로를 URL 라우트 방식으로 재작성해야** 살아난다. 리팩터링 트랙과 별개의 작업이라
이번 회차에서는 손대지 않았다(사용자 결정).

### 살아있는 게이트 (이번 회차 판정 근거)

| spec | test | 커버 |
|---|---|---|
| `model/model-check-in-diff-overflow.spec.ts` | 1 | `/model/secs` → ModelCheckInDiffModal 오버플로우 |
| `verify-ui/overlays-model-detail.spec.ts` | 4 | `/model/socket` 진입 → 상세 → 오버레이 2종 → EDIT Undo |

ModelPage 진입·탭·상세·모달 경로는 덮이고, **사이드바 트리 조작 경로는 덮이지 않는다.**
그래서 이번 회차는 상호작용 의존 분할을 하지 않고 순수 변환 추출로 한정했다(사용자 결정).

---

## 3. 적용한 분할 — main 직접 commit 4건, 1건당 1 commit

| commit | 내용 | ModelPage LOC | unit |
|---|---|---|---|
| `e678c4b` | 순수 헬퍼 9개 → `lib/model-page-helpers.ts`(103) | 1504 → **1427** (-5.1%) | 246 → 254 |
| `746095d` | `resolveErrorMessage` 중복 2사본 → `shared/lib/resolve-error-message.ts`(15) | 1427 → **1416** | 254 |
| `c512ef6` | check-in diff 섹션 조립 → `model-diff.util.ts` 의 `buildCheckInDiffSections` | 1416 → **1400** | 254 → 257 |
| `0e780a0` | 목록+선택 상세 병합 → `mergeSelectedModelIntoList` | 1400 → **1390** | 257 → 260 |

누적 **1,504 → 1,390 (-114줄, -7.6%)**, unit **246 → 260 (+14 test)**.

### A. `e678c4b` — 순수 헬퍼 9개

정렬 2(`sortDetailRowsByFirstColumn` / `sortByUpdatedAtDesc`), 상세 노드 해석 2
(`resolveDetailNodesByInterface` / `DIFF_EXCLUDED_NODES`), 상태 판정 1(`isDeprecatedStatus`),
삭제 파급 수집 2(`collectModelVersionKeysByModelKeys` / `collectCascadeDeletedVersionKeys`),
조회 1(`resolveLatestModelByName`), row id 1(`createEditableDetailRowId`).

9개 전부 `ModelPage.tsx` 안에만 있었고 다른 사본이 없다(`grep -rln` 전수 확인). 단일 파일로 묶은
근거 — 이들은 모두 "페이지가 모델 목록·노드를 다루는 헬퍼" 라는 한 주제이고, 기존 `model/lib` 8파일이
전부 주제 1개=파일 1개 구조다. 2파일로 쪼개면 각 2~7개 함수로 글로벌 룰 #3 에 걸린다.

신설 unit 8 test 중 3모드 방어가 2건:
- SECS/SOCKET/PLC 가 서로 다른 노드 집합을 받는지 (같으면 탭이 남의 노드를 그린다)
- 소문자 인터페이스 정규화 (빠지면 전부 SECS fallback 으로 떨어져 SOCKET/PLC 탭이 잘못 그려진다)

나머지는 root 삭제의 branch 파급 수집(빠지면 사라진 branch 가 화면에 유령으로 남음),
in-place sort 금지(React query 캐시 배열을 뒤집으면 리렌더 누락) 등.

### B. `746095d` — resolveErrorMessage 중복 정리

인계 노트가 "3회차에 물어라" 고 지시한 항목. `ModelPage.tsx:56` 과
`features/eqp/lib/eqp-error-message.ts:9` 의 본문이 동일했다. `shared/lib/api-error.ts` 의
`ApiError` 를 푸는 일이라 자리가 shared 다 — feature 별 사본을 두면 model 이 `features/eqp/lib` 을
import 하는 경계 위반이나 3번째 사본으로 이어진다.

`features/eqp/lib/eqp-error-message.ts` 삭제 + `EqpPage.tsx:50` /
`useEqpLifecycleCommands.ts:5` import 교체 + ModelPage 의 불필요해진 `ApiError` import 제거.

eqp 를 건드렸으므로 2회차의 eqp 격리 세트로 회귀를 확인했다(§4).

### C. `c512ef6` — check-in diff 섹션 조립

`handleRequestCheckIn` 안의 순수 변환(노드별 `computeNodeDiff` → 컬럼 fallback → 빈 섹션 제거)을
`buildCheckInDiffSections` 로 분리. `computeNodeDiff` 를 감싸는 조합이라 같은 주제 파일에 뒀다.

고정한 규칙 2개 — (1) 현재 버전 `columns` 가 비면 이전 버전 것으로 대체한다. EDIT 에서 row 를
전부 지우면 서버가 빈 배열을 주고, 그대로 쓰면 삭제분만 있는 섹션의 표 머리가 사라진다.
(2) 변경 없는 노드는 제외한다(모달 노이즈).

### D. `0e780a0` — 목록 + 선택 상세 병합

`modelItems` useMemo 본문 → `mergeSelectedModelIntoList`. 고정한 분기 3개 — 선택 없음 / 목록에
있으면 교체(빠지면 체크인 직후 값이 목록 표에 안 보임) / 목록에 없으면 prepend(빠지면 다른
스코프에서 고른 선택의 버전 화면이 빈 목록으로 뜸). 스코프 경계 로직인데 담당 e2e 가 사전 실패였다.

---

## 4. 게이트 결과 (commit 4건 전부)

- **lint**: 위반 0 (`eslint .` 출력 없음)
- **unit**: 246 → 260 pass / 0 fail
- **build**: 4건 모두 PASS
- **e2e (model 게이트 5)**: 4건 모두 **5 passed**, exit=0
- **e2e (eqp 격리 세트, `746095d` 전용)**: 21 test → 8 pass / 3 did not run(serial) / 10 fail.
  10 fail 이 2회차 노트의 사전 실패 목록과 **정확히 일치** → 무회귀:
  `eqp-line-select:126,144` `plc-eqp-form:127,149` `overlays-eqp:45` `overlays-eqp-result:82`
  (create 폼 진입 6) + `selectable-table-check-in:307,340`
  `selectable-table-gateway-group:195,247` (clipboard·ContextMenu 4)

### 3모드 라우트 검증 (mock 없이 실제 백엔드)

`tests/e2e/_verify_3modes.mjs`(gitignore, 복구용으로 §7 에 요지 기록)로 순회:

```
[PASS] /model/secs    tables=1 bodyChars=370 consoleErr=0 pageErr=0 api5xx=0
[PASS] /model/socket  tables=1 bodyChars=924 consoleErr=0 pageErr=0 api5xx=0
[PASS] /model/plc     tables=1 bodyChars=438 consoleErr=0 pageErr=0 api5xx=0
[RESULT] PASS — 3 모드 전건
```

`/model/plc` 는 담당 e2e(`plc-model-tree.spec.ts`)가 사전 실패라 이 경로로만 확인된다.

---

## 5. 런타임 — regression 없음, 단 ±5% 게이트는 판정 불가

| 측정 | ModelPage cold / select / warm | rows |
|---|---|---|
| baseline | 33 / 28 / 46 ms | [1] |
| after A (`e678c4b`) | 34 / 58 / 27 ms | [1] |
| after B (`746095d`) | 51 / 31 / 34 ms | [1] |
| after C (`c512ef6`) | 43 / 26 / 30 ms | [1] |
| after D (`0e780a0`) | 69 / 23 / 44 ms | [1] |

절대값이 23~69ms 대역에서 흔들린다. 2회차 교훈 #4 그대로 **±5% 게이트로는 판정 불가**이며,
판정 근거는 (i) 순수 이동이라 코드 경로가 동일, (ii) 청크가 사실상 불변, (iii) rows 동일이다.

### spike 는 매번 손대지 않은 페이지에 찍힌다 (2회차 운용 지식 #2 재확인)

| 측정 | >1000ms 발생 지점 |
|---|---|
| baseline | EqpPage/cold `/api/auth/me` 4845ms(200) · DeployPage/warm `/api/eqp/options` 4552ms(200) · `/api/eqp` 4551ms |
| after A | EqpPage/warm `/api/model` 4499ms(200) · LiveMapPage/warm `/api/live-map` 4569ms(200) |
| after B | 없음 |
| after C | EqpPage/cold 4699ms(200) |
| after D | LiveMapPage/cold 4576ms(200) |

매 실행 **다른 페이지의 다른 엔드포인트**에 status 200 으로 ~4.5s 가 균일하게 찍힌다.
프론트 코드 경로와 무관한 백엔드/환경 stall이다 — "내 변경 탓 아님" 을 데이터로 말할 수 있다.

### 청크

| 청크 | baseline | 최종 |
|---|---|---|
| ModelPage | 65.05 kB (gzip 17.58) | **65.00 kB** (gzip 17.52) |
| ModelDetailPanel | 64.98 kB | 64.98 kB (불변) |
| EqpPage | 71.31 kB | **71.28 kB** (중복 제거분) |

2회차 교훈 #7 재확인 — **순수 이동은 번들을 줄이지 않는다.** LOC -7.6% 대비 청크는 -0.05 kB 다.
LOC 감소를 번들 개선으로 보고하면 안 된다.

---

## 6. 최종 상태 — 임계 미달성 (정직한 결론)

| 항목 | 최종 | 임계 | 판정 |
|---|---|---|---|
| ModelPage.tsx LOC | **1,390** | 500 | 미달성 (2.8배) |
| ModelPage useState | **20** | 8 | 미달성 (P1 기준 ≥15 여전) |
| ModelPage useEffect / useMemo / useCallback | 3 / 16 / 9 | 4 / — / — | useEffect 만 통과 |
| `key={index}` | 0 | 0 | 통과 |

**useState 20 은 이번 회차에 1개도 줄지 않았다.** 순수 함수만 뺐으니 당연한 결과다 —
훅 상태를 줄이려면 모달 상태 훅(12개 이동 가능) / check-in·out 라이프사이클 훅 추출이 필요하고,
그건 사이드바·모달 상호작용 e2e 가 살아 있어야 안전하게 판정할 수 있다(§2 (b)).

### 이번 회차 대상 밖 — 측정만 (사용자 결정 사항)

| 파일 | LOC | 복잡도 | 우선순위 |
|---|---|---|---|
| `ModelDetailPanel.tsx` | 1,194 | useState 5 / useEffect 1 / useMemo 11 | **P2** (확정 4파일 밖. 분할 확장은 사용자 결정) |
| `modelDetailColumnDefs.tsx` | 727 | hook 0, 순수 컬럼 정의 9 fn | P3 (hook 없음 — 분할 이득 낮음) |
| `lib/model-detail-editor.ts` | 682 | — | P3 (lib, unit 이미 있음) |
| `FlowFilterEditorModal.tsx` | 644 | useState 1 | P3 |
| `ActionDataIndexEditorModal.tsx` | 640 | useState 2 | P3 |
| `api/model.api.ts` | 633 | — | **P2** (api 임계 400 초과 → 도메인 split 후보) |
| `FlowCard.tsx` | 508 | useState 1 | P3 |
| `stores/model-ui.store.ts` | 327 | — | 임계(400) 이하 — 손댈 이유 없음 |

inline-object prop 스캔은 매치 0 (SKILL 정책상 판정 제외 항목이나 이번엔 발생 자체가 없음).

---

## 7. 이 회차에서 발견한 별건 (수정 안 함 — 글로벌 룰 #4)

1. **`resolveDetailNodesByInterface` 가 모듈 전역 배열의 참조를 그대로 반환한다.**
   `SECS_DETAIL_NODES` 등은 `ModelDetailNode[]`(readonly 아님)이라 호출자가 mutate 하면
   전역이 오염된다. 현재 호출자는 모두 읽기만 해서 증상은 없다. 고치려면 타입을
   `readonly ModelDetailNode[]` 로 좁히는 편이 사본 생성보다 싸다.
2. **`ModelPage.tsx` 의 lazy import 주석이 stale.** "2007 LOC 패널이라" 라고 적혀 있는데
   실제 `ModelDetailPanel.tsx` 는 1,194줄이다.
3. **model 계열 e2e 37 test 진입 경로 stale** (§2 (b)). 살리려면 섹션 헤더 클릭 →
   URL 라우트 이동으로 재작성해야 한다.
4. **`_verify_3modes.mjs`** — 3모드 라우트를 실제 백엔드로 순회하며 console.error / pageerror /
   `/api` 5xx / 표 렌더를 AND 판정하는 스크립트. `tests/e2e/` 가 gitignore 라 git 에 안 남는다.
   `_perf_measure.mjs` 의 UI 폼 로그인(`#userId` / `#password` / `button[type=submit]` →
   `**/live-map` 대기)을 그대로 쓰고 `perf-login.local.json` 자격을 읽는다. 필요하면 재작성 가능.
5. `lib/` 와 `utils/` 이중 디렉터리 — 1·2회차에서도 관측된 사전 존재 사항.

---

## 8. 다음 측정 시점 권장

ModelPage 를 임계(500)에 접근시키려면 **모달 상태 훅 / 라이프사이클 훅 추출**이 필요하고,
그 전에 §2 (b) 의 e2e 진입 경로 복구가 선행되는 편이 안전하다. 순서 권장:

1. model 계열 e2e 진입 경로를 URL 라우트 방식으로 재작성 (37 test 회수)
2. 그 게이트 위에서 모달 상태 훅(useState 12개) / check-in·out 라이프사이클 훅 추출
3. `api/model.api.ts` 633줄 도메인 split (P2)
