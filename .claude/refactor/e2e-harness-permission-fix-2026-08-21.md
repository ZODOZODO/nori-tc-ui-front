# e2e 하네스 fix — 가짜 권한 코드 + stale 진입 경로 (2026-08-21)

`tests/e2e/` 는 gitignore 라 fix 를 commit 할 수 없다. 유실되면 아래 스펙들이 다시 전부
실패 상태로 돌아가므로 복구 가능한 형태로 diff 를 박아 둔다(관례:
`features-model-2026-08-20.md` 와 동일).

## 무엇이 문제였나

### 1. 스펙 mock 이 **존재하지 않는 권한 코드**를 주고 있었다

`MODEL_RW` / `EQP_RW` 는 앱 어디에도 없다. 실측:

```
$ grep -rn "EQP_RW|MODEL_RW|DEPLOY_RW|USER_RW" src        → 0 건
$ grep -rn "MODEL_RW" ../nori-tc-ui-backend               → 0 건
```

`hasPermission` 은 정확 일치다(`src/shared/lib/permission.ts:68` — `permissionCodes.includes(code)`).
라우트는 `MODEL_READ` 를 요구한다(`src/app/Router.tsx:102`). 즉 `MODEL_RW` 로는 통과할 수
없고, 화면은 **"No access permission / Required permission MODEL_READ"** 에서 멈춘다.

`RequirePermission` 이식(wm-parity-sidebar R11) 전에는 라우트가 권한을 보지 않아 아무 값이나
통과했고, 그래서 이 가짜 코드가 오래 살아남았다.

> **이것이 "로컬 사전 실패" 로 기록돼 온 실패들의 진짜 원인 중 하나다.** 과거 진단은
> `/api/line` mock 형태(a)와 사이드바 섹션 헤더 제거(b) 두 겹까지 짚었으나 권한 게이팅은
> 빠져 있었다. `model-flow.spec.ts` 의 `/api/line` mock 은 이미 배열이었다(`createApiResponse([])`).

### 2. 진입 경로가 stale 했다

`openEditModelTab` 은 "LNB 3단 아코디언(기본 접힘)" 을 가정해 섹션 → root → branch 를 차례로
눌렀다. 현재 구조는 **LNB 스코프 + 중간 패널 모델명 1단 + 우측 버전 테이블** 이고 branch
버튼이 없다. 게다가 모델명을 누르면 우측 테이블이 그 root 의 버전으로 좁혀져 `EDIT` 행이
사라진다 — 진입 직후에는 스코프의 전 버전이 이미 들어 있으므로 **누르지 않아야** 한다.

## fix diff

### `tests/e2e/model/model-flow.spec.ts`

ME mock (원래 `permissionCodes: ['MODEL_RW']`):

```ts
        // 'MODEL_RW' 는 어디에도 없는 코드였다(ui-front src / ui-backend 양쪽 grep 0 건).
        // RequirePermission 이식 전에는 라우트가 권한을 안 봤으므로 아무 값이나 통과했지만,
        // 지금은 Router.tsx:102 가 MODEL_READ 를 요구해 전 테스트가 권한 화면에서 멈춘다.
        createApiResponse({
          userPk: 1,
          userId: 'admin',
          permissionCodes: ['MODEL_READ', 'LINE_READ'],
        }),
```

`openEditModelTab` 진입 경로 — 아코디언 3클릭 제거 + 딥링크:

```ts
  // 인터페이스 스코프는 라우트가 정한다(Router.tsx:103-105) — LNB 아코디언 클릭 시퀀스를
  // 딥링크로 대체한다. 이전 구현은 "3단 아코디언(기본 접힘)" 을 가정해 섹션/root/branch 를
  // 차례로 눌렀지만, 지금 구조는 LNB 스코프 + 중간 패널 모델명 1 단 + 우측 버전 테이블이라
  // branch 버튼이 아예 없다. 딥링크는 사이드바 구조가 또 바뀌어도 깨지지 않는다.
  await page.goto(sectionTitle === 'Socket' ? '/model/socket' : '/model/secs')
  // 모델 목록이 도착하기 전 사이드바 모델명 버튼은 보이지 않습니다 — networkidle 대기.
  await page.waitForLoadState('networkidle')
  // 진입 직후 Model Info 테이블에는 스코프의 전 버전이 이미 들어 있다 — 사이드바 모델명을
  // 누르면 오히려 그 root 의 버전으로 목록이 좁혀져 EDIT 행이 사라진다(누르지 않는다).
  const editRow = page.getByRole('row', { name: /FLOW_DEMO_MODEL_admin EDIT/i })
  await editRow.dblclick()
```

(삭제된 3줄: `getByRole('button', {name: sectionTitle}).click()` /
`getByRole('button', {name:'FLOW_DEMO_MODEL', exact:true}).click()` /
`getByRole('button', {name:'FLOW_DEMO_MODEL_admin'}).click()`, 그리고 `page.goto('/model')`)

**결과: 20 failed → `20 passed` (PW_EXIT=0).**

### 신규 테스트 — flow 저장 실패 문구 (`model-flow.spec.ts`)

`ModelDetailPanel` 의 `flowSaveErrorMessage` 가 화면에 닿는지 보는 테스트. `FlowCard.tsx:254`
는 문구가 null 이면 아무것도 렌더하지 않고 `saveStatus='error'` 는 버튼 상태만 바꾼다.

```ts
test('Model-Flow-AC-Save-3: flow 저장 실패 시 서버 errorMsg 가 카드에 표시된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)

  const SERVER_MESSAGE = 'workflowName 이 이미 사용 중입니다. 다른 이름을 지정해 주세요.'
  // setupMocks 뒤에 등록해 POST /flows 만 가로챈다 — 나중 route 가 먼저 매칭되고,
  // GET 등 나머지는 fallback 으로 기존 핸들러에 넘긴다.
  await page.route(/\/api\/model\/\d+\/flows$/, async (route, request) => {
    if (request.method() !== 'POST') {
      return route.fallback()
    }
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        data: null,
        errorCode: 'FLOW_NAME_DUPLICATED',
        errorMsg: SERVER_MESSAGE,
      }),
    })
  })

  await openEditModelTab(page)
  await page.getByRole('button', { name: /Add Flow/i }).click()
  await page.getByPlaceholder('Enter a new Flow name').fill('DUP_FLOW')
  await page.getByRole('button', { name: 'Save Flow' }).click()

  // 서버 문구가 그대로 떠야 한다 — fallback('Message Flow 생성에 실패했습니다.') 이면 실패다.
  await expect(page.getByText(SERVER_MESSAGE)).toBeVisible()
  await expect(page.getByText('Message Flow 생성에 실패했습니다.')).toHaveCount(0)
})
```

실패 재현 확인: `flowSaveErrorMessage` 를 `resolveErrorMessage(...)` 대신 fallback 문구만 쓰게
되돌리면 **1 failed**. 복원하면 통과.

### 나머지 9 스펙 — ME mock 권한 일괄 교체

`'MODEL_RW'` / `'EQP_RW'` 를 아래 실제 코드 목록으로 치환했다(레퍼런스는
`layout-overflow-guard.spec.ts:28` — 이 스펙만 처음부터 실제 코드를 나열하고 있었다).

```ts
permissionCodes: ['MODEL_READ', 'MODEL_WRITE', 'EQP_READ', 'EQP_WRITE', 'DEPLOY_READ',
  'DEPLOY_WRITE', 'DLQ_READ', 'USER_READ', 'GROUP_READ', 'LINE_READ', 'LIVE_MAP_READ',
  'LIVE_MAP_LAYOUT_READ']
```

대상: `modal/modal-overflow-guard-extra.spec.ts`(2 곳) · `plc/plc-model-tree.spec.ts` ·
`socket-message-layout.spec.ts` · `selectable-table/` 6 개(`check-in` /
`model-check-in-diff` / `model-info` / `model-parameter` / `model-workflow` /
`parent-model-commit`). `layout-overflow-guard.spec.ts` 는 잔여물 `'MODEL_RW', ` 만 제거.

재현용 일괄 명령:

```bash
PERMS="'MODEL_READ', 'MODEL_WRITE', 'EQP_READ', 'EQP_WRITE', 'DEPLOY_READ', 'DEPLOY_WRITE', 'DLQ_READ', 'USER_READ', 'GROUP_READ', 'LINE_READ', 'LIVE_MAP_READ', 'LIVE_MAP_LAYOUT_READ'"
for f in <위 9 개 경로>; do
  sed -i "s/'MODEL_RW'/$PERMS/g; s/'EQP_RW'/$PERMS/g" "$f"
done
sed -i "s/'MODEL_RW', //" tests/e2e/layout-overflow-guard.spec.ts
```

## 어디까지 살아났나

| 대상 | 결과 |
|---|---|
| `model/model-flow.spec.ts` | **20 passed** (이전 20 failed) |
| 위 9 스펙 + `layout-overflow-guard` 합산 | **19 passed / 24 failed** (43) |

권한만으로는 부족하다 — 남은 24 건은 `model-flow` 와 같은 종류의 **진입 경로 / DOM 구조
stale** 이며 스펙마다 다르다. `selectable-table-user-list` / `group-list` 는 애초에 `_RW` 를
쓰지 않았으므로 원인이 또 별개다. 스펙별 개별 재작성이 필요하고, `model-flow` 에서 쓴 패턴
(**딥링크 진입 + 실제 권한 코드 + 스냅샷으로 DOM 확인**)이 그 작업의 템플릿이다.

## 다음에 같은 실패를 만나면

1. **실패 스크린샷을 먼저 본다**(`test-results/<test>/test-failed-1.png`). "No access
   permission" 이면 권한 mock, 화면이 정상인데 locator 실패면 진입 경로다. 이 두 가지를
   구분하지 않으면 "로컬 사전 실패" 로 묶어 버리게 된다.
2. `error-context.md` 의 `# Page snapshot` 이 실제 role/이름을 보여준다 — locator 를 추측하지 말 것.
3. 권한 코드는 `src/shared/lib/permission.ts` 가 유일한 출처다. 스펙이 쓰는 코드가 거기 있는지
   grep 으로 확인한다.
