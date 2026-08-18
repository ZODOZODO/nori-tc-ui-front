# DEV REPORT: wm-parity-foundation — 구현 기록

> 입력: `.claude/specs/wm-parity-foundation.md` (SPEC) + `.claude/specs/wm-parity-foundation-plan.md` (Plan)
> 스키마: Plan §8 의 고정 8섹션. 각 C 단위 완료 시 누적 갱신한다(Plan §5.0 스텝 4).

---

## 1. 측정 조건

| 항목 | 값 |
|---|---|
| baseline SHA | `3704176` (`docs(specs): Implement 진행을 단계별 보고-커밋-컨펌 게이트로 전환`) |
| 브랜치 | `main` |
| 작업 트리 | clean (`git status --porcelain` 출력 0줄) |
| 백엔드 (localhost:8080) | **미기동** — S-06 봉인 조건. `netstat -ano | grep ':8080'` 매칭 0건으로 확인 |
| 프론트 dev server | Playwright `webServer` 가 3000 포트에 자동 기동. 측정 직전 포트 3000 점유 0건 확인 |
| e2e 명령 | `npx playwright test --reporter=list,json` (config 의 html reporter 대신 목록/JSON 로 기계 대조 가능하게) |
| 워커 | 4 (`playwright.config.ts` 로컬 기본값) |
| 측정 일시 | 2026-08-18 |

**C18 은 동일 조건(백엔드 미기동 · 워커 4)에서 재측정한다.** 조건을 바꾸면 AC16 의 목록 대조가 무효가 된다(W8).

원본 산출물:
- 목록 출력 `…/scratchpad/e2e-baseline.txt`
- JSON 리포트 `…/scratchpad/e2e-baseline.json`

---

## 2. e2e baseline (AC16 판정 기준)

### 2.1 총계

| 구분 | 수치 |
|---|---|
| spec 파일 | 70 |
| 총 테스트 | 182 |
| **passed (baseline PASS 집합)** | **90** (44 파일) |
| **failed (판정 제외 집합)** | **78** (29 파일) |
| skipped (`did not run`) | 14 (6 파일 — 전부 `verify-ui/overlays-*` 의 조건부 skip) |

**AC16 판정 규칙**: 아래 §2.2 의 baseline PASS 90건이 C18 최종 실행에서 **전건 PASS** 여야 한다.
§2.3 의 78건은 사전 실패이므로 판정에서 제외한다.

### 2.2 baseline PASS 전체 목록 (90건 / 44 파일) — **AC16 의 판정 대상**

- `demo-matrix.harness.spec.ts` (1)
  - demo matrix cell
- `deploy/deploy-monitor-view-modal.spec.ts` (1)
  - Deploy View 모달 — 대상별 진행 현황 테이블이 모달 폭 안에 들어온다 (가로 overflow 없음)
- `deploy/deploy-register-bulk-guard.spec.ts` (1)
  - 100+ 설비 전체선택 → 추가 시 가상화 + 개수 가드로 서버 400 을 사전 차단한다
- `deploy/deploy-register-scenario-modal.spec.ts` (1)
  - 시나리오 선택 모달 — 테이블이 모달 폭 안에 줄바꿈되어 들어온다 (가로 overflow 없음)
- `dlq-page.spec.ts` (7)
  - DLQ_READ 보유 사용자는 /dlq 진입 시 4 사이드바 항목이 표시
  - 사이드바 클릭 시 해당 mode 의 API 가 호출되고 응답 행이 렌더
  - DLQ_READ 미보유 사용자는 topbar Dlq 메뉴 미표시 + /dlq 직접 진입 시 /login 으로 redirect
  - 기본 진입 시 대시보드 패널이 렌더된다
  - KPI 카드 4개 카운트가 mock 데이터와 일치한다
  - 최근 장애 피드가 시간 역순으로 정렬된다
  - 새로고침 버튼 클릭 시 4 endpoint 재호출된다
- `eqp-line-select.spec.ts` (1)
  - eqp 폼에서 라인 미선택 시 저장이 차단된다 (POST 미발생)
- `group-page.spec.ts` (8)
  - Group-AC-3: 그룹 목록 표시
  - Group-AC-4: 그룹 등록 성공
  - Group-AC-5: 그룹 수정 성공
  - Group-AC-6: 그룹 삭제 성공
  - Group-AC-7: 그룹 멤버 추가/제거
  - Group-AC-8b: 권한 없는 사용자가 /user 직접 접근 시 차단
  - Group-AC-9: 권한 편집 스테이징 후 저장 시 일괄 적용
  - Group-AC-10: 권한 편집 취소 시 변경 폐기 (API 호출 없음)
- `i18n/i18n-flat-key-render.spec.ts` (1)
  - flat key 가 raw key 가 아니라 번역 값으로 렌더됩니다.
- `layout-overflow-guard.spec.ts` (6)
  - 페이지 가로 오버플로우 가드 — eqp (/eqp)
  - 페이지 가로 오버플로우 가드 — model (/model)
  - 페이지 가로 오버플로우 가드 — deploy (/deploy)
  - 페이지 가로 오버플로우 가드 — dlq (/dlq)
  - 페이지 가로 오버플로우 가드 — user-group (/user)
  - 페이지 가로 오버플로우 가드 — live-map (/eqp/live-map)
- `live-map/live-map-3d-auto.spec.ts` (1)
  - admin: 미배치 설비는 자동 표시되지 않고, 편집 드롭다운으로 선택→추가해야 배치된다 (console/pageerror 0)
- `live-map/live-map-3d-bays.spec.ts` (1)
  - bay 라벨이 없고, 미배치 설비는 자동 표시되지 않는다 (console/pageerror 0)
- `live-map/live-map-3d-edit-advanced.spec.ts` (2)
  - admin: 미배치 설비 2대 추가 → Shift+클릭 다중 선택 → 그룹 회전 + 층 이동이 PUT 전체에 반영된다 (console/pageerror 0)
  - admin: 2층 활성 + 빌트인 벽 추가 → 화살표로 미세 이동 후 저장이 floor=2, x=699 로 반영된다 (console/pageerror 0)
- `live-map/live-map-3d-editing.spec.ts` (1)
  - admin: 3D 편집모드에서 객체 추가 → 회전 → 템플릿 교체 → 저장이 PUT /layout 에 반영된다 (console/pageerror 0)
- `live-map/live-map-3d-eqp-autoplace.spec.ts` (1)
  - admin: gateway_app 자동 배치 — gateway_app1→1층, gateway_app2→2층 (console/pageerror 0)
- `live-map/live-map-3d-eqp-drag.spec.ts` (1)
  - admin: 시드 바닥 위 설비를 뱃지로 끌면 설비가 이동한다(바닥 아님) (console/pageerror 0)
- `live-map/live-map-3d-eqp-meshpick.spec.ts` (1)
  - admin: 캔버스 메시를 멀리 끈 뒤 새 위치에서 다시 선택된다 (console/pageerror 0)
- `live-map/live-map-3d-eqp-redrag.spec.ts` (1)
  - admin: 뱃지를 두 번 연속 끌면 두 번 다 이동한다(캡처가 유지된다)
- `live-map/live-map-3d-floors.spec.ts` (1)
  - admin: 층 버튼이 그 층 배치만 / 전체가 모두 보여준다 (console/pageerror 0)
- `live-map/live-map-3d-seed.spec.ts` (1)
  - admin: 기본 구조 채우기 → 시드 배치 후 저장하면 4종 STRUCTURE(벽/파티션/바닥/기둥)가 1회씩 생성된다 (console/pageerror 0)
- `live-map/live-map-3d-status.spec.ts` (1)
  - admin: 바인딩된 설비의 상태 뱃지 → 클릭 시 선택 설비 상세(상태/포트)를 연다 (console/pageerror 0)
- `live-map/live-map-3d-structure.spec.ts` (1)
  - admin: 빈 라이브러리에서도 빌트인 벽을 뷰어에 추가→저장하면 STRUCTURE 객체가 1회 생성되고 PUT 에 그 키로 반영된다 (console/pageerror 0)
- `live-map/live-map-3d-undo-counts.spec.ts` (2)
  - admin: 구조물 추가 → 종류별 표시/변경 카운트 증가, 되돌리기 버튼 + Ctrl+Z 단계 복원 (console/pageerror 0)
  - admin: "표시" 카운트는 현재 보고 있는 층만 센다 (console/pageerror 0)
- `live-map/live-map-3d-viewer.spec.ts` (1)
  - admin: 3D 모드가 layout 의 v2 객체를 react-three-fiber <canvas> 로 렌더한다 (console/pageerror 0)
- `live-map/live-map-demo-run-reattach.spec.ts` (1)
  - LiveMapDemoModal — 세션 밖 실행중 run 재부착(닫고 재오픈해도 유지)
- `live-map/live-map-flow-groups.spec.ts` (4)
  - admin: 그룹 추가/이름·색 변경 후 저장하면 canvas_json.flow 로 PUT 된다 (console/pageerror 0)
  - admin: 설비 드래그&드롭 배정/해제가 canvas_json.flow.assignments 로 PUT 된다 (console/pageerror 0)
  - admin: Ctrl 다중 선택 완료 후 (Ctrl 없이) 드래그하면 선택 전체가 일괄 이동한다 (console/pageerror 0)
  - admin: 화살표 생성(스타일 지정)/삭제가 canvas_json.flow.arrows 로 PUT 된다 (console/pageerror 0)
- `live-map/live-map-line-scope.spec.ts` (1)
  - 상단바 라인 스코프가 뷰어(공정 플로우 board)를 게이팅한다 (console/pageerror 0)
- `live-map/live-map-object-editor.spec.ts` (3)
  - admin: 구조물 편집에서 도형 조합 객체를 생성·수정·삭제한다 (console/pageerror 0)
  - admin: 구조물 편집에서 높이(H)를 키우면 바닥이 고정되고 위로만 자란다 — Y=H/2 유지 (console/pageerror 0)
  - admin: 구조물 편집 목록에 빌트인 벽/파티션이 항상 뜨고, 클릭→Save 로 내 STRUCTURE 객체가 된다 (console/pageerror 0)
- `live-map/live-map-readonly.spec.ts` (2)
  - 읽기 전용: 뷰어 + 3D 토글은 보이되 구조물 편집(빌더) 토글은 없다 (console/pageerror 0)
  - 읽기 전용: 3D 씬을 읽기 전용으로 렌더하고 편집 토글/저장은 없다 (console/pageerror 0)
- `live-map/live-map-scenario-upload.spec.ts` (3)
  - 업로드 UI 표시 + 유효 업로드 후 드롭다운 갱신
  - 삭제 권한 보유 — 비시드 삭제 활성 / 시드 비활성
  - 삭제 권한 미보유 — 삭제 액션 비표시(업로드는 표시)
- `live-map/live-map-structure-overlay.spec.ts` (1)
  - operator: 저장된 STRUCTURE placement 가 뷰어 board 배경 레이어로 렌더된다 (console/pageerror 0)
- `live-map/live-map-viewer.spec.ts` (1)
  - 뷰어가 실설비를 공정 카드에 배치하고 설비 선택 시 상세 패널을 연다 (console/pageerror 0)
- `login-page.smoke.spec.ts` (1)
  - 로그인 페이지 핵심 요소가 렌더링됩니다.
- `modal/modal-visual-sweep-eqp.spec.ts` (2)
  - EqpManageFormModal(SECS create) — HSMS Settings 포함 대형 폼 시각
  - EqpManageFormModal(Socket create) — Socket Settings 포함 폼 시각
- `modal/modal-visual-sweep-group.spec.ts` (3)
  - GroupPermissionsModal — 전 카테고리 + 긴 권한명/설명 worst-case 시각
  - GroupUpsertModal — 긴 그룹명/설명 편집 폼 시각
  - GroupAddMembersModal — 멤버 다수 + 긴 사용자명/부서 시각
- `modal/modal-visual-sweep-livemap.spec.ts` (1)
  - LiveMapDemoModal — 와이드 3D 데모 모달 시각
- `model/model-check-in-diff-overflow.spec.ts` (1)
  - ModelCheckInDiffModal — 다컬럼/긴값 diff 가 모달 폭 밖으로 튀어나오지 않는다
- `plc/plc-eqp-polling-group.spec.ts` (2)
  - PLC 설비 폴링 그룹 Start → EQP_PLC_GROUP_START 발행 + async PASS (console/pageerror 0)
  - PLC 설비 폴링 그룹 End → EQP_PLC_GROUP_END 발행 (console/pageerror 0)
- `selectable-table/selectable-table-dlq-business.spec.ts` (2)
  - Selectable-Table-R2-AC-1: BusinessDlqPanel 2x2 영역 Ctrl+C → 클립보드 TSV
  - Selectable-Table-R2-AC-1 회귀: BusinessDlqPanel row testId / pagination / refresh 보존
- `selectable-table/selectable-table-resize.spec.ts` (1)
  - Selectable-Table-R6-AC-resize: header 우측 경계 drag → 컬럼 width px 증가
- `selectable-table/selectable-table-sort.spec.ts` (1)
  - Selectable-Table-R6-AC-sort: header 클릭 asc → desc → off 3 단계 행 순서
- `selectable-table/selectable-table-virtual.spec.ts` (2)
  - Selectable-Table-R6-virtual-1: windowing + 스크롤 후 rowIdx↔row 정합 (2x2 range copy)
  - Selectable-Table-R6-virtual-2: drag 하단 경계 → auto-scroll 로 off-screen 행까지 선택
- `user-page.spec.ts` (10)
  - topbar User 클릭 시 /user 로 라우팅
  - 사용자 목록 표시
  - 사용자 등록 성공
  - 사용자 수정 성공
  - 사용자 삭제 성공
  - 비밀번호 초기화 모달
  - 페이지네이션 prev/next
  - 권한 없는 사용자는 User 메뉴 미표시
  - /user 직접 접근 차단
  - 사용자 그룹 매핑 표시
- `verify-ui/overlays-auth.spec.ts` (3)
  - RecoveryModal(forgotId) — 열림 / 닫힘 / 오버플로우
  - RecoveryModal(forgotPassword) — 열림 / 닫힘 / 오버플로우
  - RecoveryModal 두 변형이 서로 다른 필드를 그립니다
- `verify-ui/routes.spec.ts` (2)
  - /login 은 인증 없이 렌더됩니다
  - / 와 미지정 경로는 /login 으로 리다이렉트합니다

### 2.3 baseline FAIL 전체 목록 (78건 / 29 파일) — **판정 제외 집합**

| spec 파일 | FAIL 수 | 실패 사유 (첫 에러 1줄) |
|---|---|---|
| `eqp-line-select.spec.ts` | 1 | Error: console errors: Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| `group-page.spec.ts` | 2 | Error: expect(locator).toBeVisible() failed |
| `i18n/i18n-language-toggle.spec.ts` | 2 | Error: console errors: Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| `live-map/live-map-3d-eqp-cmp.spec.ts` | 1 | Test timeout of 180000ms exceeded. |
| `modal/modal-overflow-guard-extra.spec.ts` | 2 | Test timeout of 60000ms exceeded. |
| `model/model-flow.spec.ts` | 20 | Test timeout of 30000ms exceeded. |
| `plc/plc-eqp-form.spec.ts` | 2 | Error: console errors: Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| `plc/plc-model-tree.spec.ts` | 3 | Error: expect(locator).toBeVisible() failed |
| `selectable-table/selectable-table-check-in.spec.ts` | 2 | Test timeout of 30000ms exceeded. |
| `selectable-table/selectable-table-deploy-monitor.spec.ts` | 2 | Test timeout of 30000ms exceeded. |
| `selectable-table/selectable-table-gateway-group.spec.ts` | 2 | Test timeout of 30000ms exceeded. |
| `selectable-table/selectable-table-group-list.spec.ts` | 3 | Error: [console:error] Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| `selectable-table/selectable-table-model-check-in-diff.spec.ts` | 2 | Test timeout of 30000ms exceeded. |
| `selectable-table/selectable-table-model-info.spec.ts` | 3 | Test timeout of 30000ms exceeded. |
| `selectable-table/selectable-table-model-parameter.spec.ts` | 3 | Test timeout of 30000ms exceeded. |
| `selectable-table/selectable-table-model-workflow.spec.ts` | 3 | Test timeout of 30000ms exceeded. |
| `selectable-table/selectable-table-parent-model-commit.spec.ts` | 2 | Test timeout of 30000ms exceeded. |
| `selectable-table/selectable-table-user-list.spec.ts` | 3 | Error: [console:error] Failed to load resource: the server responded with a status of 500 (Internal Server Error) |
| `socket-message-layout.spec.ts` | 1 | Test timeout of 30000ms exceeded. |
| `verify-ui/manage-batch-equivalence.spec.ts` | 1 | Error: expect(page).toHaveURL(expected) failed |
| `verify-ui/manage-batch-perf.spec.ts` | 1 | Error: expect(page).toHaveURL(expected) failed |
| `verify-ui/overlays-deploy.spec.ts` | 1 | Error: expect(page).toHaveURL(expected) failed |
| `verify-ui/overlays-eqp-result.spec.ts` | 1 | Error: expect(page).toHaveURL(expected) failed |
| `verify-ui/overlays-eqp.spec.ts` | 1 | Error: expect(page).toHaveURL(expected) failed |
| `verify-ui/overlays-live-map.spec.ts` | 1 | Error: expect(page).toHaveURL(expected) failed |
| `verify-ui/overlays-model-detail.spec.ts` | 1 | Error: expect(page).toHaveURL(expected) failed |
| `verify-ui/overlays-model-tree.spec.ts` | 1 | Error: expect(page).toHaveURL(expected) failed |
| `verify-ui/overlays-user-group.spec.ts` | 4 | Error: expect(page).toHaveURL(expected) failed |
| `verify-ui/routes.spec.ts` | 7 | Error: RequireAuth console.error |

<details><summary>FAIL 78건 테스트명 전체</summary>

- `eqp-line-select.spec.ts`
  - eqp 폼 라인 드롭다운이 GET /api/line 으로 채워지고 선택된다 (console/pageerror 0)
- `group-page.spec.ts`
  - Group-AC-1 / Group-AC-2: /user 사이드바 Group 클릭 시 그룹 패널 활성화
  - Group-AC-8a: 권한 없는 사용자는 User 메뉴 미표시 (Group 사이드바 자체에 도달 불가)
- `i18n/i18n-language-toggle.spec.ts`
  - AC7 — LanguageToggle 3개 언어 노출 + Tiếng Việt 선택 시 vi 렌더 (console/pageerror 0)
  - AC8 — vi 선택 후 reload 시 활성 언어가 vi 로 유지된다
- `live-map/live-map-3d-eqp-cmp.spec.ts`
  - admin: 저장된 설비를 어느 방향으로 옮겨도 뱃지가 안 가려진다(재선택 가능) (console/pageerror 0)
- `modal/modal-overflow-guard-extra.spec.ts`
  - eqp CheckInModal — 긴 Param Value/Description diff 가 모달 폭 밖으로 안 나간다
  - ParentModelCommitModal — 컬럼 多/긴 값 diff 가 모달 폭 밖으로 안 나간다
- `model/model-flow.spec.ts`
  - Model-Flow-AC-1: /model 진입 후 좌측 사이드바에 Flow 트리가 렌더된다
  - Model-Flow-AC-2: Flow 카드 클릭 시 5 섹션이 모두 펼친 상태로 표시된다
  - Model-Flow-AC-3: [+ Add Flow] 클릭 시 빈 FlowCard 가 추가된다
  - Model-Flow-AC-3b: draft Flow Name 이 editable 이고 저장 시 POST body workflowName 에 반영된다
  - Model-Flow-AC-3c: draft 카드의 DCOP 추가 버튼이 disabled + tooltip 으로 안내된다
  - Model-Flow-AC-3d: draft actionName 입력 후 저장 시 POST→PUT 으로 actionName 이 영속된다
  - Model-Flow-AC-D1: 저장된 Flow 카드 삭제 버튼 → 확인 시 DELETE 호출 + 제거
  - Model-Flow-AC-D2: Message Flows 우클릭 Delete → 확인 시 DELETE 호출
  - Model-Flow-AC-4: Identity Message Name dropdown 변경 → save → reload 후 유지
  - Model-Flow-AC-5: Filter [편집...] 클릭 시 Flow Filter 모달이 열린다
  - Model-Flow-AC-6: Action [편집...] 클릭 시 Action Data Index 모달이 열린다
  - Model-Flow-AC-5.1: SOCKET model 의 자유 messageName Flow 도 Filter 섹션을 표시한다
  - Model-Flow-AC-F1: Add Flow 버튼 bounding-box 가 80x28 이하다
  - Model-Flow-AC-F2: DcopItemPickerModal N:M binding 라운드트립
  - Model-Flow-AC-F3: DcopItemPickerModal 모두 선택 토글이 unbound 항목만 tri-state 로 처리한다
  - Model-Flow-AC-F4: 모두 제거 클릭 후 picker 저장 시 dcopItemKeys 가 빈 배열로 송신된다
  - Model-Flow-AC-F5: dcop-itemes 노드 테이블에 Workflow Name 컬럼이 없다
  - Model-Flow-AC-F8: 3 message 노드 평면 테이블에 Data Index 컬럼이 없다
  - Model-Flow-AC-Save-1: 우상단 Save 의 aria-label 이 컨텍스트(Flow / Reference) 별로 다르다
  - Model-Flow-AC-Save-2: FlowCard 본문에 별도 저장 버튼이 없다
- `plc/plc-eqp-form.spec.ts`
  - PLC Eqp Create 진입점 → PLC 폼 오픈 + PLC Settings 섹션 렌더 (console/pageerror 0)
  - PLC 폼 제출 body 에 plcSettings 포함 AND socketSettings/hsmsSettings null (오전송 회귀 차단)
- `plc/plc-model-tree.spec.ts`
  - PLC 모델은 PLC 섹션 아래에만 분류되고 SECS 섹션에는 나타나지 않는다 (오분류 음성)
  - PLC 모델 상세 진입 시 plc-group / plc-register 디테일 노드 라벨이 렌더된다
  - PLC 모델 plc-group 노드 선택 시 카탈로그 컬럼/행이 실제 테이블로 렌더된다 (placeholder 제거)
- `selectable-table/selectable-table-check-in.spec.ts`
  - AC-R5-CI-1: CheckInModal 2x2 range copy → TSV (added / changed 행)
  - AC-R5-CI-2: CheckInModal diff 색상 + strikethrough 보존
- `selectable-table/selectable-table-deploy-monitor.spec.ts`
  - Selectable-Table-R2-AC-2: DeployMonitorPanel 2x2 영역 Ctrl+C → 클립보드 TSV
  - Selectable-Table-R2-AC-2 회귀: DeployMonitorPanel 우클릭 ContextMenu (View) 가 wrapRow 적용 후에도 노출
- `selectable-table/selectable-table-gateway-group.spec.ts`
  - Selectable-Table-R2-AC-3: GatewayGroupTable 2x2 영역 Ctrl+C → 클립보드 TSV
  - Selectable-Table-R2-AC-3 회귀: GatewayGroupTable 우클릭 ContextMenu Label 가 wrapRow 적용 후에도 노출
- `selectable-table/selectable-table-group-list.spec.ts`
  - Selectable-Table-R4-AC-3a: GroupListTable 2x2 영역 Ctrl+C → 클립보드 TSV
  - Selectable-Table-R4-AC-3b: GroupListTable 기존 Pencil 액션 버튼 클릭 시 GroupUpsertModal 노출 (회귀)
  - Selectable-Table-R4-AC-3c: GroupListTable 행 더블클릭 시 GroupUpsertModal 노출 (신규 W-GL1=A)
- `selectable-table/selectable-table-model-check-in-diff.spec.ts`
  - AC-R3.2-1: ModelCheckInDiffModal 2x2 range copy → TSV (added / changed 행)
  - AC-R3.2-1: ModelCheckInDiffModal diff 색상 + strikethrough 보존
- `selectable-table/selectable-table-model-info.spec.ts`
  - Selectable-Table-R4-AC-1a: ModelInfoTable 2x2 영역 Ctrl+C → 클립보드 TSV
  - Selectable-Table-R4-AC-1b: ModelInfoTable 단일 클릭 — 선택(onSelectRow)은 동작하되 row 하이라이트는 미표시
  - Selectable-Table-R4-AC-1c: ModelInfoTable 더블클릭 시 onOpenDetail 호출 (Version 프레임 진입)
- `selectable-table/selectable-table-model-parameter.spec.ts`
  - Selectable-Table-R1-AC-1: 단일 셀 Ctrl+C → 클립보드에 셀 값 1개가 들어간다
  - Selectable-Table-R1-AC-2: 드래그 영역 Ctrl+C → 클립보드에 TSV(행=\n, 셀=\t) 가 들어간다
  - Selectable-Table-R1-AC-3: Excel TSV Ctrl+V paste → 셀 값들이 onChangeDetailValue 로 반영된다
- `selectable-table/selectable-table-model-workflow.spec.ts`
  - Selectable-Table-R3-AC-1: dcop-itemes 사각형 영역 Ctrl+C → TSV 클립보드
  - Selectable-Table-R3-AC-3: dcop-itemes EventId 컬럼은 eventides 옵션을 dropdown 으로 노출
  - Selectable-Table-R3-AC-6: 사이드바 진입 가능 7 detail 노드의 SelectableTable testId 노출
- `selectable-table/selectable-table-parent-model-commit.spec.ts`
  - AC-R3.2-2: ParentModelCommitModal changed DiffTable 2x2 range copy → TSV
  - AC-R3.2-2: ParentModelCommitModal 3 mode 색상 + strikethrough 보존
- `selectable-table/selectable-table-user-list.spec.ts`
  - Selectable-Table-R4-AC-2a: UserListTable 2x2 영역 Ctrl+C → 클립보드 TSV
  - Selectable-Table-R4-AC-2b: UserListTable 기존 Pencil 액션 버튼 클릭 시 UserUpsertModal 노출 (회귀)
  - Selectable-Table-R4-AC-2c: UserListTable 행 더블클릭 시 UserUpsertModal 노출 (신규 W-UL1=A)
- `socket-message-layout.spec.ts`
  - Socket Message 상세 테이블 레이아웃을 재현합니다.
- `verify-ui/manage-batch-equivalence.spec.ts`
  - manage-batch 응답은 단건 manage 응답과 필드까지 같다
- `verify-ui/manage-batch-perf.spec.ts`
  - manage-batch 응답 시간을 설비 수별로 측정한다
- `verify-ui/overlays-deploy.spec.ts`
  - DeployRegisterPanel(결과 다이얼로그) — 변경 없음 분기
- `verify-ui/overlays-eqp-result.spec.ts`
  - CheckInModal — 파라미터 Check Out 후
- `verify-ui/overlays-eqp.spec.ts`
  - Gateway 노드 우클릭 → EqpManageFormModal(create) 3 인터페이스
- `verify-ui/overlays-live-map.spec.ts`
  - LiveMapDemoModal(본체) — 열림 / 닫힘 / 오버플로우
- `verify-ui/overlays-model-detail.spec.ts`
  - FlowCard 편집 2 오버레이 — Flow Filter / Action Data Index
- `verify-ui/overlays-model-tree.spec.ts`
  - 섹션 우클릭 → ModelCreateOrUpdateModal(create)
- `verify-ui/overlays-user-group.spec.ts`
  - UserUpsertModal / PasswordReset / DeleteConfirm 3 오버레이
  - GroupUpsert / Permissions / AddMembers / DeleteConfirm 4 오버레이
  - UserProfileModal — 열림 / 취소 닫힘 / 오버플로우
  - UserProfileModal — ESC 로 닫힙니다
- `verify-ui/routes.spec.ts`
  - 인증 없이 보호 라우트에 가면 /login 으로 막힙니다
  - /eqp (EqpPage) 가 렌더됩니다
  - /eqp/live-map (LiveMapPage) 가 렌더됩니다
  - /model (ModelPage) 가 렌더됩니다
  - /deploy (DeployPage) 가 렌더됩니다
  - /dlq (DlqPage) 가 렌더됩니다
  - /user (UserManagementPage) 가 렌더됩니다

</details>

### 2.4 skipped (did not run) 14건 / 6 파일

- `verify-ui/overlays-deploy.spec.ts` (2)
- `verify-ui/overlays-eqp-result.spec.ts` (2)
- `verify-ui/overlays-eqp.spec.ts` (2)
- `verify-ui/overlays-live-map.spec.ts` (3)
- `verify-ui/overlays-model-detail.spec.ts` (3)
- `verify-ui/overlays-model-tree.spec.ts` (2)

---

## 3. 커밋 로그

| C 단위 | 커밋 SHA | 레포 | 변경 파일 | 해당 AC | 상태 |
|---|---|---|---|---|---|
| C0 | (커밋 없음 — 게이트) `0c95833` 는 dev-report 신설 커밋 | ui-front | `.claude/specs/wm-parity-foundation-dev-report.md` | AC16 전제 | ✅ 완료 |
| C1-a | `21fda50` | ui-front | 9개 — 신설 `src/shared/types/api.types.ts` · `src/shared/lib/api-error.ts`, 수정 `src/shared/lib/csrf.ts` · `src/shared/api/line.api.ts` · `live-map/api/{comm-log,layout,live-map,live-map-demo-run}.api.ts` · `dlq/api/dlq.api.ts` | AC1 AC2 AC3 | ✅ 완료 |
| C1-b | `1b429c4` | ui-front | 31개 — types 5(auth/eqp/group/model/user) · api 7(auth/deploy/eqp/group/model/model-flow/user/profile) · 소비처 13 · shared 2 · 단위테스트 1 | **AC7 AC8 AC9** + AC1 AC2 AC3 | ✅ 완료 |
| C2 | `3411e34` | ui-front | 13개 — Plan §5.C2 의 12파일(`deploy.api` · `deploy.types` · `eqp.types` · `group.types` · `comm-log.api` · `layout.api` · `live-map-demo-run.api` · `live-map.api` · `model.types` · `profile.types` · `user.types` · `shared/api/line.api`) + `auth/types/auth.types.ts` | **AC17** + AC1 AC2 AC3 | ✅ 완료 |
| C3 | `ae4e85b` | ui-front | 8개 — 삭제 6(`live-map/components/LiveMap3DEquipment.tsx` · `deploy/components/DeployStatusChart.tsx` · `live-map/components/LiveMapToolbar.tsx` · `shared/layout/PageFooter.tsx` · `live-map/components/LiveMapLegend.tsx` · `group/types/index.ts`) + `package.json`(recharts 제거) + `package-lock.json` | **AC10 AC11** + AC1 AC2 AC3 | ✅ 완료 |
| C4 | `c9f1f72` | ui-front | 2개 — `.claude/specs/live-map-3d.md`(3곳) · `.claude/specs/live-map-layout-builder-phase1-plan.md`(1곳) | (AC 없음 — R10 문서) | ✅ 완료 |
| C5-a | `fe78343` | **nori-tc-common** | 3개 — `.claude/specs/port-carrier-id-lifecycle{,-plan,-dev-report}.md` 각 1곳 | (AC 없음 — R10 문서) | ✅ 완료 |
| C5-b | `99f4347` | **nori-tc-common** | 1개 — `.claude/specs/refactor-backlog.md` 4행(284·285 완료 전환 / 287·293 각주) | (AC 없음 — D-5 ledger) | ✅ 완료 |
| C6 | `b45f54f` | **nori-tc-exec** | 1개 — `docs/Architecture/ui/front/10-live-map-dashboard-and-demo-control.md:15-16` | (AC 없음 — R10 문서) | ✅ 완료 |
| C7 | `225db3e` | ui-front | 4개 — 신설 `shared/stores/toast.store.ts` · `shared/components/Toaster.tsx` · `shared/lib/notify.ts`(wm 무수정 이식) + 수정 `app/providers/AppProvider.tsx` | **AC14** + AC1 AC2 AC3 | ✅ 완료 |
| C8 | `a21d0f9` | ui-front | 7개 — group 4(`GroupAddMembersModal` · `GroupUpsertModal` · `GroupPermissionsModal` · `GroupDeleteConfirmDialog`) · user 3(`UserUpsertModal` · `UserDeleteConfirmDialog` · `UserPasswordResetModal`) | **AC13** + AC1 AC2 AC3 | ✅ 완료 |
| C9 | `776bdca` | ui-front | 3개 — 신설 `components/ui/control-styles.ts`(wm 무수정) + 수정 `components/ui/input.tsx` · `components/ui/select.tsx` | (AC 없음 — R4 프리미티브) + AC1 AC2 AC3 | ✅ 완료 |
| C10 | `08899d3` | ui-front | 3개 — 신설 `components/ui/checkbox.tsx`(Plan §3.6-C 전문) · `components/ui/switch.tsx`(wm 무수정) + 수정 `components/ui/select.tsx`(`SELECT_EMPTY_VALUE`) | (AC 없음 — R5 프리미티브) + AC1 AC2 AC3 | ✅ 완료 |
| C11 | `dea29f9` | ui-front | 4개 — `shared/components/SelectableTable/SelectableTable.tsx` · 신설 `.../sort.ts` · `features/user/components/UserListTable.tsx` · 신설 `tests/unit/selectable-table-sort.test.ts` | **AC12** + AC1 AC2 AC3 | ✅ 완료 |

---

## 4. 잔여 수치 누적표

| 시점 | raw `<button>` (src/features) | raw `<select>` | raw `type="checkbox"` |
|---|---|---|---|
| C0 (착수 전) | 80 | 15 | 10 |
| C1-a | 80 | 15 | 10 | (raw 요소 미변환 단계) |
| C1-b | 80 | 15 | 10 | (raw 요소 미변환 단계) |
| C2 | 80 | 15 | 10 | (raw 요소 미변환 단계) |
| C3 | 80 | 15 | 10 | (죽은 파일 6개 삭제 후 재측정 — 삭제 파일에 raw 요소가 없어 수치 변동 0) |
| C4 | 80 | 15 | 10 | (문서만 변경) |
| C5-a | 80 | 15 | 10 | (타 레포 문서만 변경) |
| C5-b | 80 | 15 | 10 | (타 레포 문서만 변경) |
| C6 | 80 | 15 | 10 | (타 레포 문서만 변경) |
| C7 | 80 | 15 | 10 | (토스트 인프라만 추가 — raw 요소 무관) |
| C8 | 80 | 15 | 10 | (에러 처리만 변경) |
| C9 | 80 | 15 | 10 | (프리미티브 시각만 변경) |
| C10 | 80 | 15 | 10 | (프리미티브 신설만 — 소비는 C13~C16) |
| C11 | 80 | 15 | 10 | (테이블 로딩/정렬만 변경) |

---

## 5. 게이트 출력

### C0 — `npx playwright test` (baseline)

```
    [chromium] › tests\e2e\verify-ui\routes.spec.ts:49:3 › Step 1 — 라우트 전수 › 인증 없이 보호 라우트에 가면 /login 으로 막힙니다
    [chromium] › tests\e2e\verify-ui\routes.spec.ts:60:5 › Step 1 — 라우트 전수 › /eqp (EqpPage) 가 렌더됩니다
    [chromium] › tests\e2e\verify-ui\routes.spec.ts:60:5 › Step 1 — 라우트 전수 › /eqp/live-map (LiveMapPage) 가 렌더됩니다
    [chromium] › tests\e2e\verify-ui\routes.spec.ts:60:5 › Step 1 — 라우트 전수 › /model (ModelPage) 가 렌더됩니다
    [chromium] › tests\e2e\verify-ui\routes.spec.ts:60:5 › Step 1 — 라우트 전수 › /deploy (DeployPage) 가 렌더됩니다
    [chromium] › tests\e2e\verify-ui\routes.spec.ts:60:5 › Step 1 — 라우트 전수 › /dlq (DlqPage) 가 렌더됩니다
    [chromium] › tests\e2e\verify-ui\routes.spec.ts:60:5 › Step 1 — 라우트 전수 › /user (UserManagementPage) 가 렌더됩니다
  14 did not run
  90 passed (16.1m)
```

### C1-a — build / lint / test:unit / 회귀 e2e

`npm run build` PASS
```
dist/assets/react-vendor-VH1en6bk.js            228.56 kB │ gzip:  73.23 kB
dist/assets/konva-vendor-Dp7wt_BH.js            312.33 kB │ gzip:  95.73 kB
dist/assets/three-vendor-D0YZ_Sa2.js            906.27 kB │ gzip: 244.45 kB
(!) Some chunks are larger than 500 kB after minification. Consider:
✓ built in 33.38s
```

`npm run lint` PASS (출력 0줄 — eslint 무경고)
```
> nori-tc-ui@0.0.0 lint
> eslint .
```

`npm run test:unit` PASS
```
1..209
# tests 209
# suites 0
# pass 209
# fail 0
# duration_ms 3819.4936
```

회귀 e2e (변경 API 를 소비하는 baseline PASS spec 6개) — 14 passed / 1 failed(사전 실패)
```
  1 failed
    [chromium] › tests\e2e\eqp-line-select.spec.ts:125:1 › eqp 폼 라인 드롭다운이 GET /api/line 으로 채워지고 선택된다 (console/pageerror 0)
  14 passed (46.4s)
```
→ 이 1건은 §2.3 의 baseline FAIL 과 동일 테스트(같은 파일의 baseline PASS 테스트는 `:​...` 라인이 다른
"라인 미선택 시 저장이 차단된다" 로, 이번 실행에서 PASS). **회귀 0**.

### C1-b — build / lint / test:unit / AC grep / 회귀 e2e

AC grep (전부 1건 / 1파일)
```
AC7: src/shared/lib/api-error.ts:98:export const resolveSuccessPayload = <TData>(
AC8: src/shared/lib/csrf.ts
AC9: src/shared/lib/api-error.ts:49:export class ApiError extends Error {
```

`npm run build` PASS
```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
✓ built in 16.21s
```

`npm run lint` PASS (경고 0)
```
> nori-tc-ui@0.0.0 lint
> eslint .
```

`npm run test:unit` PASS
```
# tests 209
# pass 209
# fail 0
# duration_ms 2657.7652
```

회귀 e2e (auth/user/group/deploy/eqp/model 소비 spec 14개) — 31 passed / 2 failed(사전 실패)
```
  2 failed
    [chromium] › tests\e2e\group-page.spec.ts:357:1 › Group-AC-1 / Group-AC-2: /user 사이드바 Group 클릭 시 그룹 패널 활성화
    [chromium] › tests\e2e\group-page.spec.ts:475:1 › Group-AC-8a: 권한 없는 사용자는 User 메뉴 미표시 (Group 사이드바 자체에 도달 불가)
  31 passed (1.1m)
```
→ 2건 모두 §2.3 의 `group-page.spec.ts` baseline FAIL 2건과 **정확히 동일**. **회귀 0**.

### C2 — AC grep / build / lint / test:unit / 회귀 e2e

AC17 grep — 0건
```
$ grep -rn "features/auth/types/auth.types" src
(출력 없음)
$ grep -rn "features/auth/types/auth.types" src | wc -l
0
```

`npm run build` PASS
```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
✓ built in 18.08s
```

`npm run lint` PASS (경고 0)
```
> nori-tc-ui@0.0.0 lint
> eslint .
```

`npm run test:unit` PASS
```
1..209
# tests 209
# pass 209
# fail 0
# duration_ms 2799.6378
```

회귀 e2e (auth/user/group/eqp/dlq/deploy/model/live-map 소비 spec 15개) — 38 passed / 3 failed(사전 실패)
```
  3 failed
    [chromium] › tests\e2e\eqp-line-select.spec.ts:125:1 › eqp 폼 라인 드롭다운이 GET /api/line 으로 채워지고 선택된다 (console/pageerror 0)
    [chromium] › tests\e2e\group-page.spec.ts:357:1 › Group-AC-1 / Group-AC-2: /user 사이드바 Group 클릭 시 그룹 패널 활성화
    [chromium] › tests\e2e\group-page.spec.ts:475:1 › Group-AC-8a: 권한 없는 사용자는 User 메뉴 미표시 (Group 사이드바 자체에 도달 불가)
  38 passed (1.5m)
```
→ 3건 모두 §2.3 의 baseline FAIL(`eqp-line-select.spec.ts` 1 + `group-page.spec.ts` 2)과 **정확히 동일**.
**회귀 0**.

### C3 — dead 재확인 / AC grep / build / lint / test:unit / 회귀 e2e

dead 재확인 (삭제 직전 실측) — 5개 컴포넌트 전부 **자기 파일 선언 외 참조 0건**, group 배럴 재export 0건
```
$ grep -rn "LiveMap3DEquipment" src tests | grep -v LiveMap3DEquipmentField
src/features/live-map/components/LiveMap3DEquipment.tsx:174:export const LiveMap3DEquipment = memo(...)
$ grep -rn "from './types'|from '../types'|from '@/features/group/types'" src tests
src/shared/components/SelectableTable/index.ts:10:} from './types'        ← SelectableTable 자체 types (group 무관)
src/shared/components/SelectableTable/SelectableTable.tsx:27:} from './types'
```

AC10 / AC11 grep
```
AC10: grep -rn "recharts" src package.json | wc -l   → 0
AC11: git ls-files <6경로> | wc -l                    → 0
```

`npm run build` PASS
```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
✓ built in 17.02s
```

`npm run lint` PASS (경고 0)
```
> nori-tc-ui@0.0.0 lint
> eslint .
```

`npm run test:unit` PASS
```
1..209
# tests 209
# pass 209
# fail 0
# duration_ms 2937.4364
```

회귀 e2e (deploy 3 · layout-overflow-guard · live-map viewer/readonly/3d-viewer · group-page · login smoke) — 22 passed / 2 failed(사전 실패)
```
  2 failed
    [chromium] › tests\e2e\group-page.spec.ts:357:1 › Group-AC-1 / Group-AC-2: /user 사이드바 Group 클릭 시 그룹 패널 활성화
    [chromium] › tests\e2e\group-page.spec.ts:475:1 › Group-AC-8a: 권한 없는 사용자는 User 메뉴 미표시 (Group 사이드바 자체에 도달 불가)
  22 passed (1.2m)
```
→ 2건 모두 §2.3 의 `group-page.spec.ts` baseline FAIL 과 **정확히 동일**. **회귀 0**.

### C4 — 문서 정정 확인 / build / lint / test:unit

정정 후 잔존 확인
```
$ grep -rn "LiveMap3DEquipment\b" .claude/specs/live-map-3d.md
(출력 없음 — 3곳 전부 LiveMap3DEquipmentField 로 교체)
$ grep -n "LiveMapToolbar" .claude/specs/live-map-layout-builder-phase1-plan.md
264:- ~~⚠ `LiveMapToolbar.tsx` 는 lineOptions prop 보유하나 현재 미연결 — 통합 필요.~~
```

`npm run build` / `npm run lint` / `npm run test:unit` — 전부 PASS (코드 변경 0이라 회귀 e2e 없음)
```
✓ built in 15.65s
> nori-tc-ui@0.0.0 lint
> eslint .
# pass 209
# fail 0
# duration_ms 2797.1695
```

### C5-a — nori-tc-common 문서 정정 확인

정정 후 잔존 확인 (레포 `c:\workspace_nori\nori-tc-common`, 커밋 `fe78343`)
```
$ grep -rn "LiveMap3DEquipment\b" .claude/specs/port-carrier-id-lifecycle.md \
    .claude/specs/port-carrier-id-lifecycle-plan.md .claude/specs/port-carrier-id-lifecycle-dev-report.md
(출력 없음 — 3곳 전부 LiveMap3DEquipmentField 로 교체)

$ git diff --stat
 .claude/specs/port-carrier-id-lifecycle-dev-report.md | 2 +-
 .claude/specs/port-carrier-id-lifecycle-plan.md       | 2 +-
 .claude/specs/port-carrier-id-lifecycle.md            | 2 +-
 3 files changed, 3 insertions(+), 3 deletions(-)
```
빌드 게이트 미수행 — 변경이 `.claude/specs/*.md` 3개뿐이라 nori-tc-common 의 Gradle 산출물과
무관하다(코드 변경 0). ui-front 코드도 건드리지 않았으므로 회귀 e2e 도 없다.

### C5-b — refactor-backlog ledger 갱신 확인

레포 `c:\workspace_nori\nori-tc-common`, 커밋 `99f4347`. 스키마 자기 검사(셀 18개 / 상태 칸이
`부채 이관` 인지 / 증거 칸 원문 일치)를 통과하지 못하면 스크립트가 중단하도록 하고 실행했다.
```
행 284: 부채 이관 -> 완료
행 285: 부채 이관 -> 완료
행 287: 각주 추가 (상태 유지)
행 293: 각주 추가 (상태 유지)

$ grep "^| 284 |" … → 상태= 완료  / 세션= P3 처분-4 → wm-parity-foundation C3
$ grep "^| 285 |" … → 상태= 완료  / 세션= P3 처분-4 → wm-parity-foundation C3
$ grep "^| 286 |" … → 상태= 부채 이관 (무변경)
$ git diff --stat →  .claude/specs/refactor-backlog.md | 8 ++++----
```
`상태` 값 `완료` 는 §0.5(`:84`)의 허용값 3종에 포함된다. 기계 검증기는 이 레포에
스크립트로 존재하지 않아(`c:\workspace_nori` 전역 grep 0건) 실행하지 못했다.

### C6 — nori-tc-exec 아키텍처 문서 정정 확인

레포 `c:\workspace_nori\nori-tc-exec`, 커밋 `b45f54f`. `LiveMapToolbar` 항목을 지우고 그 기능의 현
소재를 `LiveMapBoard` 항목에 합쳤다.
```
$ grep -rn "LiveMapToolbar" docs
(출력 없음)

- `LiveMapBoard`
  - cluster와 설비 node를 지도 형태로 배치하고 zoom/layout edit를 처리하며, 보드 헤더에서 검색어와 status filter를 제공합니다.
  - line filter는 이 화면 전용이 아니라 상단 navigation의 공용 `LineScopeSelector`가 담당하고, `LiveMapPage`가 `line-scope.store`의 선택 라인을 읽어 설비를 걸러 냅니다.

$ git diff --stat
 docs/Architecture/ui/front/10-live-map-dashboard-and-demo-control.md | 5 ++---
 1 file changed, 2 insertions(+), 3 deletions(-)
```
빌드 게이트 미수행 — `docs/` 문서 1개만 바뀌어 exec 의 Gradle 산출물과 무관하다.

### C7 — AC grep / build / lint / test:unit / 회귀 e2e

AC14 grep — 1건
```
$ grep -c "<Toaster" src/app/providers/AppProvider.tsx
1
```

이식 전제 실측 (전부 tc 에 존재 확인)
```
package.json:32 "lucide-react": "^0.576.0" / :34 "radix-ui": "^1.4.3" / :46 "zustand": "^5.0.11"
node_modules/radix-ui/dist/index.d.ts:60  export { reactToast as Toast }
src/lib/utils.ts (cn) 존재 / src/index.css:137 --danger 존재
wm 원본과 diff 0 — 3파일 전부 무수정 이식
```

`npm run build` PASS
```
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 16.07s
```

`npm run lint` PASS (경고 0)
```
> nori-tc-ui@0.0.0 lint
> eslint .
```

`npm run test:unit` PASS (신규 의존성 0 — `dependency-declaration.test.ts` 포함 통과)
```
# tests 209
# pass 209
# fail 0
# duration_ms 2804.8394
```

회귀 e2e (앱 루트 마운트라 전 화면 영향 — login/layout/user/group/dlq/eqp/live-map/i18n 8 spec) — 35 passed / 3 failed(사전 실패)
```
  3 failed
    [chromium] › tests\e2e\eqp-line-select.spec.ts:125:1 › eqp 폼 라인 드롭다운이 GET /api/line 으로 채워지고 선택된다 (console/pageerror 0)
    [chromium] › tests\e2e\group-page.spec.ts:357:1 › Group-AC-1 / Group-AC-2: /user 사이드바 Group 클릭 시 그룹 패널 활성화
    [chromium] › tests\e2e\group-page.spec.ts:475:1 › Group-AC-8a: 권한 없는 사용자는 User 메뉴 미표시 (Group 사이드바 자체에 도달 불가)
  35 passed (1.3m)
```
→ 3건 모두 §2.3 의 baseline FAIL 과 **정확히 동일**. `console/pageerror 0` 을 단언하는 spec 들이 통과했으므로
Toaster 마운트가 콘솔 오류를 유발하지 않음도 함께 확인된다. **회귀 0**.

### C8 — AC grep / build / lint / test:unit / 회귀 e2e

AC13 grep — 7파일
```
$ grep -rln "notifyFailure" src/features/user src/features/group
src/features/user/components/UserDeleteConfirmDialog.tsx
src/features/user/components/UserPasswordResetModal.tsx
src/features/user/components/UserUpsertModal.tsx
src/features/group/components/GroupAddMembersModal.tsx
src/features/group/components/GroupDeleteConfirmDialog.tsx
src/features/group/components/GroupPermissionsModal.tsx
src/features/group/components/GroupUpsertModal.tsx
```

`npm run build` / `npm run lint` / `npm run test:unit` — 전부 PASS
```
✓ built in 16.64s
> nori-tc-ui@0.0.0 lint
> eslint .
# pass 209
# fail 0
# duration_ms 2867.2033
```

회귀 e2e (user-page · group-page · modal-visual-sweep-group · selectable-table-group-list) — 21 passed / 5 failed(사전 실패)
```
  5 failed
    [chromium] › tests\e2e\group-page.spec.ts:357:1 › Group-AC-1 / Group-AC-2: /user 사이드바 Group 클릭 시 그룹 패널 활성화
    [chromium] › tests\e2e\group-page.spec.ts:478:1 › Group-AC-8a: 권한 없는 사용자는 User 메뉴 미표시 (Group 사이드바 자체에 도달 불가)
    [chromium] › tests\e2e\selectable-table\selectable-table-group-list.spec.ts:181:1 › Selectable-Table-R4-AC-3a: GroupListTable 2x2 영역 Ctrl+C → 클립보드 TSV
    [chromium] › tests\e2e\selectable-table\selectable-table-group-list.spec.ts:219:1 › Selectable-Table-R4-AC-3b: GroupListTable 기존 Pencil 액션 버튼 클릭 시 GroupUpsertModal 노출 (회귀)
    [chromium] › tests\e2e\selectable-table\selectable-table-group-list.spec.ts:235:1 › Selectable-Table-R4-AC-3c: GroupListTable 행 더블클릭 시 GroupUpsertModal 노출 (신규 W-GL1=A)
  21 passed (56.0s)
```
→ 5건 모두 §2.3 의 baseline FAIL 과 **테스트 제목이 동일**(`group-page.spec.ts` 2 + `selectable-table-group-list.spec.ts` 3).
`:475`→`:478` 줄 이동은 아래 조사 기록의 spec 동기화 3줄 추가 때문이고 제목·판정은 그대로다. **회귀 0**.

### C9 — build / lint / test:unit / 레이아웃 회귀 5 spec

wm 원본 대조 — `select.tsx` 는 이식 후 wm 파일과 **완전 동일**(diff 0), `control-styles.ts` / `input.tsx` 도 무수정 복사
```
$ diff ../nori-wm-ui-front/src/components/ui/select.tsx src/components/ui/select.tsx
SELECT IDENTICAL
$ grep -n "color-input|color-card|shadow-soft-md|brand-accent|color-popover" src/index.css
34: --color-card / 36: --color-popover / 48: --color-input / 66: --color-brand-accent / 87: --shadow-soft-md
```

`npm run build` / `npm run lint` / `npm run test:unit` — 전부 PASS
```
✓ built in 17.18s
> nori-tc-ui@0.0.0 lint
> eslint .
# fail 0
# duration_ms 2995.4007
```

Plan §5.C9 의 판정 조건 2 — 레이아웃 회귀 5 spec
```
  2 failed
    [chromium] › tests\e2e\modal\modal-overflow-guard-extra.spec.ts:107:1 › eqp CheckInModal — 긴 Param Value/Description diff 가 모달 폭 밖으로 안 나간다
    [chromium] › tests\e2e\modal\modal-overflow-guard-extra.spec.ts:183:1 › ParentModelCommitModal — 컬럼 多/긴 값 diff 가 모달 폭 밖으로 안 나간다
  12 passed (1.4m)
```
→ 실패 2건은 §2.3 baseline FAIL 의 `modal-overflow-guard-extra.spec.ts` **2건과 제목까지 동일**(Plan 이 미리
판정 제외로 지정한 spec). 나머지 4 spec 12건은 전부 PASS. **판정 조건 2 충족**.

### C10 — 이식 원본 대조 / build / lint / test:unit / 회귀 e2e

원본 대조 + radix 전제 실측
```
$ diff ../nori-wm-ui-front/src/components/ui/switch.tsx src/components/ui/switch.tsx
SWITCH IDENTICAL
node_modules/radix-ui/dist/index.d.ts:12  export { reactCheckbox as Checkbox }
node_modules/radix-ui/dist/index.d.ts:56  export { reactSwitch as Switch }
node_modules/@radix-ui/react-checkbox/dist/index.d.ts:11  type CheckedState = boolean | 'indeterminate'   (1.3.3)
src/index.css:65 --color-brand-primary / :129 --brand-primary  (신규 토큰 0)
```
`checkbox.tsx` 는 wm 에 원본이 없어 Plan §3.6-C 의 고정 전문을 그대로 옮겼다(디자인 재량 0).

`npm run build` / `npm run lint` / `npm run test:unit` — 전부 PASS (신규 의존성 0)
```
✓ built in 35.24s
> nori-tc-ui@0.0.0 lint
> eslint .
# fail 0
# duration_ms 4427.4694
```

회귀 e2e (login smoke · layout-overflow-guard · modal-visual-sweep-eqp)
```
  ok 8 [chromium] › tests\e2e\modal\modal-visual-sweep-eqp.spec.ts:88:1 › EqpManageFormModal(SECS create) …
  ok 9 [chromium] › tests\e2e\modal\modal-visual-sweep-eqp.spec.ts:113:1 › EqpManageFormModal(Socket create) …
  9 passed (28.9s)
```
→ 실패 0. **회귀 0**.

### C11 — AC grep / build / lint / test:unit(신규 2건) / 회귀 e2e

AC12 grep — 둘 다 충족
```
$ grep -n "isLoading" src/shared/components/SelectableTable/SelectableTable.tsx
47:  isLoading?: boolean
140:  isLoading,
571:          {isLoading ? (
$ grep -rn -B8 "isLoading={" src/features --include="*.tsx" | grep -c "<SelectableTable"
1
```

`npm run build` / `npm run lint` PASS + `npm run test:unit` **209 → 211**(numeric 정렬 단위 테스트 2건 추가)
```
✓ built in 36.13s
> nori-tc-ui@0.0.0 lint
> eslint .
# tests 211
# pass 211
# fail 0
```
신규 테스트는 `['9','10','2']` 를 `2,9,10` 으로 단언하고, **같은 입력에 대해 옵션 없는 `localeCompare`
결과와 다름**(`notDeepEqual`)까지 단언한다 — 종전 비교기였다면 깨지는 형태다(RED 조건 내장).

회귀 e2e — Plan 이 지정한 `selectable-table-*` 전체 + `user-page.spec.ts`
```
  25 failed
  16 passed (3.4m)
```
→ 25 = §2.3 의 baseline FAIL 합계와 정확히 일치(check-in 2 · deploy-monitor 2 · gateway-group 2 ·
group-list 3 · model-check-in-diff 2 · model-info 3 · model-parameter 3 · model-workflow 3 ·
parent-model-commit 2 · user-list 3). 16 = 같은 파일군의 baseline PASS 합계.
baseline PASS 부분집합만 따로 돌린 결과도 **16 passed / 0 failed**. **회귀 0**.

---

## 6. R8/R9 보류 사유

(C17 에서 기록)

---

## 7. 스크린샷

**C9 — control-styles 이식 전/후** (증거이지 게이트가 아니다. Plan §5.C9)

| 화면 | before | after | 판정 |
|---|---|---|---|
| EQP 관리 폼 모달(SECS create) | [c9-before-eqp-form.png](assets/c9-before-eqp-form.png) | [c9-after-eqp-form.png](assets/c9-after-eqp-form.png) | **의도한 변경** — 컨트롤 높이 44→40px, 모서리 덜 둥글게, 글자 15px, 테두리/배경 톤 변화. 2열 필드 그리드 정렬·모달 폭·요소 잘림 **변화 없음** |
| `/login` | — | — | **차이 0** — `LoginPage.tsx` 는 `Input` 프리미티브를 쓰지 않고 raw `<input>` 4곳(`:63,185,211,238`)을 직접 쓴다. 이 화면은 C9 의 영향 밖이다(캡처로 확인) |
| 모델 변경사항 미리보기 모달 | — | — | **차이 0** — 화면 안에 Input/Select 가 없다(표·배지만). `model-check-in-diff-overflow` spec 캡처로 확인 |

두 스크린샷을 직접 열어(Read) 비교했고, 잘림·겹침 같은 의도치 않은 깨짐은 없었다 → 그대로 커밋했다.
`/login` 대신 **모델 상세 패널**을 찍으려 했으나 그 패널을 렌더하는 spec 4개(`model-flow`,
`selectable-table-model-info`/`-workflow`/`-parent-model-commit`)가 전부 baseline FAIL 이라
같은 model 도메인에서 baseline PASS 인 `model-check-in-diff-overflow` 로 대체했다.

---

## 8. 계획 결함

> Plan 에 없던 상황과 그때 택한 보존적 선택(S-19). 없으면 "없음" 이라고 적는다.

### C0-결함-1 — baseline FAIL 집합이 Plan §5.C0 예측(12 spec)보다 넓다

- **Plan 예측**: "백엔드 미기동 조건 — `verify-ui/*` 11 spec + `demo-matrix.harness.spec.ts` = 12 spec baseline 제외"
- **실측**: FAIL 은 **29 파일 / 78 테스트**. `verify-ui/*` 는 11 파일 중 10 파일이 FAIL(`overlays-auth.spec.ts` 는 3건 전부 PASS,
  `routes.spec.ts` 는 2 PASS / 7 FAIL 로 혼재)이고, `demo-matrix.harness.spec.ts` 는 **1건 PASS** 다.
  나머지 19 파일은 백엔드 무관하게 실패하는 사전 실패(메모리 `project_ui_front_e2e_preexisting_local_failures`,
  `project_ui_front_e2e_line_mock_array` 와 정합).
- **택한 선택(보존적)**: Plan 의 예측 수치를 쓰지 않고 **실측 목록을 정본**으로 삼는다. AC16 은 원래
  "목록 대조"로 정의돼 있어(SPEC AC16, Plan §5.C18) 판정 방식 자체는 변경 없음. 코드 변경 0.
- **후속 단계 영향(주의)**: Plan 이 회귀 게이트로 지정한 spec 중 아래는 **baseline FAIL** 이라 게이트로 쓸 수 없다.
  해당 단계에서는 "baseline FAIL 이므로 판정 제외"를 명시하고, baseline PASS 인 형제 spec 으로 대체 판정한다.
  - C11 게이트: `selectable-table-user-list.spec.ts`(3건 FAIL), `selectable-table-check-in`/`-deploy-monitor`/
    `-gateway-group`/`-group-list`/`-model-*`/`-parent-model-commit` (전부 FAIL)
    → 대체 가능한 baseline PASS: `selectable-table-sort`(1), `-resize`(1), `-virtual`(2), `-dlq-business`(2), `user-page.spec.ts`(10)
  - C12 게이트: `selectable-table-deploy-monitor.spec.ts`(FAIL) → `deploy/deploy-monitor-view-modal.spec.ts`(PASS 1) 로 판정
  - C14 게이트: `model/model-flow.spec.ts`(20건 전부 FAIL), `selectable-table-model-*`(전부 FAIL)
    → `model/model-check-in-diff-overflow.spec.ts`(PASS 1) 로 판정
  - C9 게이트 5 spec 중 `modal/modal-overflow-guard-extra.spec.ts` 는 2건 FAIL → 판정 제외.
    나머지 4 spec(`layout-overflow-guard` 6, `modal-visual-sweep-eqp` 2, `-group` 3, `-livemap` 1)은 전부 PASS 라 게이트 유효
  - C13 게이트 관련: `plc/plc-eqp-form.spec.ts` 2건 FAIL(W12 검증용) → `modal/modal-visual-sweep-eqp.spec.ts`(PASS 2) 로 판정

### C1-a-결함-1 — CSRF 실패 문구가 도메인 키에서 공용 키로 바뀐다

- **사실**: 제거된 로컬 `issueCsrfToken` 중 `live-map-demo-run.api.ts` 는 `i18n.t('error.livemap.csrf')`,
  `layout.api.ts` 는 영문 리터럴 `'CSRF token missing'` 을 던졌다. 공용 정의는 Plan R1 지시대로
  `error.auth.csrf` 를 쓴다 → 이 두 경로의 사용자 문구가 바뀐다.
- **택한 선택**: Plan/SPEC 이 공용 정의의 문구를 `error.auth.csrf` 로 명시했으므로 그대로 따랐다
  (신규 i18n 키 0 = S-16 도 충족). 코드 변경 없음.
- **부수 관찰(수정하지 않음)**: `error.livemap.csrf` 키가 이 전환으로 참조 0이 된다. 미사용 i18n 키 정리는
  본 SPEC 범위 밖이라 삭제하지 않았다(글로벌 룰 4 — 무관한 죽은 코드는 언급만).

### C1-a-결함-2 — dlq `isApiResponse` 가 느슨한 가드에서 엄격한 가드로 바뀐다

- **사실**: dlq 로컬 가드는 `success` 가 boolean 인지만 봤고, 공용 가드는 `errorCode`/`errorMsg` 의
  `null | string` 까지 검사한다. 봉투가 불완전한 응답이 오면 이전엔 통과하던 것이 이제 fallback 문구로 던져진다.
- **택한 선택**: D-4 가 "전환한다"로 봉인돼 있어 공용 가드를 썼다. 다만 회귀 위험을 실측으로 확인 —
  `tests/e2e/dlq-page.spec.ts` 의 mock 은 4 endpoint 모두 `success/data/errorCode/errorMsg` 전 필드를
  채우고 있고(`:73-82`), 해당 spec 7건은 이번 실행에서 전부 PASS 했다.
- `unwrapArrayPayload` 의 "data 가 배열이 아니면 `[]` 반환" 동작은 **그대로 보존**했다
  (공용 `resolveSuccessPayload` 로 갈아타면 throw 로 바뀌므로 전환하지 않음 — 기존 동작 보존, S-19).

### C1-b-결함-1 — `allowNullData=true` 호출 7곳은 3-인자 `resolveSuccessPayload` 로 옮길 수 없다

- **사실**: Plan 은 공용 `resolveSuccessPayload(payload, status, fallbackMessage)` 3-인자만 정의했으나,
  eqp/group/model/user 의 로컬 정의에는 4번째 인자 `allowNullData` 가 있었고 **7곳이 `true` 로 호출**한다
  (eqp 5 / group 3 / model 2 중 실제 4-인자 호출 7건 — `saveEditParams`, `checkin`, `undoCheckout`,
  `group delete/addMember/removeMember`, `model` 2건). `data: null` 이 정상인 DELETE/checkin 응답들이다.
  3-인자 공용 함수로 그대로 옮기면 **정상 응답을 실패로 오탐**한다.
- **택한 선택(기존 동작 보존, S-19)**: 공용 `assertSuccessResponse(payload, status, fallbackMessage)` 를
  `shared/lib/api-error.ts` 에 1개 신설하고 그 7곳만 이 함수로 바꿨다. 정의 1 · 소비 7 이라 룰 11 위반 아님.
  AC7 은 `const resolveSuccessPayload` 만 세므로 영향 없다(실측 1건 유지).
- **부수**: 이 4번째 인자는 `false` 로 넘기는 호출부가 0이었으므로 기본값 인자 자체는 소멸했다(글로벌 룰 6 부합).

### C1-b-결함-2 — auth.api 의 CSRF 래핑을 "호출부 3곳 try/catch" 대신 헬퍼 1개로 했다

- **Plan 문언**: "공용 `issueCsrfToken()` 을 호출하고 **호출부 3곳**을 `try { … } catch { throw normalizeAuthError(…) }` 로 감싼다".
- **택한 형태**: 동일 try/catch 를 `requestAuthCsrfToken(purpose)` 헬퍼 1개로 두고 호출부 3곳
  (`prepareCsrfToken` / `login` / `logout`)이 그것을 부른다. **동작은 문언과 동일** —
  공용 정의가 던지는 `CSRF_TOKEN_MISSING` ApiError 는 `normalizeAuthError` 의 `instanceof ApiError` 분기로
  그대로 통과하고, 쿠키 요청 403 만 `login-csrf`/`logout-csrf` 문맥으로 보정된다.
- **사유**: 같은 try/catch 를 3번 복제하는 대신 1개로 묶었다(글로벌 룰 3). AC8 은 `issueCsrfToken\s*=` 를
  세므로 이름이 다른 이 헬퍼는 판정에 영향이 없다(실측 1파일 유지).

### C1-b-결함-3 — 도메인별 CSRF_TOKEN_MISSING 문구가 공용 문구로 통일된다

- 제거된 로컬 `issueCsrfToken` 7개는 각각 `error.eqp.csrf` / `error.group.csrf` / `error.model.csrf` /
  `error.user.csrf` / `error.deploy.csrf` / `error.auth.csrf` 를 던졌다. 공용 정의는 `error.auth.csrf` 하나다.
- Plan R1 이 공용 정의의 문구를 `error.auth.csrf` 로 못박았으므로 그대로 따랐다(신규 키 0 = S-16).
- **미사용이 된 i18n 키(삭제하지 않음)**: `error.eqp.csrf`, `error.group.csrf`, `error.model.csrf`,
  `error.user.csrf`, `error.deploy.csrf`, `error.livemap.csrf`. 미사용 키 정리는 본 SPEC 범위 밖(룰 4).

### C1-b-결함-4 — `data === null` 실패의 errorCode 가 `INVALID_RESPONSE` → `UNKNOWN_ERROR` 로 바뀐다

- 도메인 로컬 `resolveSuccessPayload` 는 success=true·data=null 일 때 `INVALID_RESPONSE` 를 넣었고
  공용 정의는 `UNKNOWN_ERROR` 를 넣는다. **errorMsg 는 양쪽 다 fallbackMessage 로 동일**하다.
- `INVALID_RESPONSE` 를 분기 조건으로 읽는 소비처가 `src` 전체에 0건임을 grep 으로 확인하고 그대로 진행했다.

### C1-b-작업 사고 기록 — 1차 스크립트의 정규식 과탐 (커밋 전 원복)

- 블록 삭제용 정규식의 JSDoc 부분을 `(?:\/\*\*[\s\S]*?\*\/\n)?` 로 짜서 **파일 첫 주석부터 대상 직전까지
  통째로 삼켰다**(auth/eqp/group/model/user types 등 5파일에서 2,424줄 삭제). 커밋 전이라
  `git show HEAD:<path> > <path>` 로 31파일을 전량 원복(`git diff` 0줄 · 클래스 6종 복원 확인) 후,
  JSDoc 을 `(?:\/\*\*(?:[^*]|\*(?!\/))*\*\/\n)?` 로 한정하고 **블록 45줄 초과 시 중단하는 가드**를 넣어 재실행했다.
- 재실행 결과 삭제량 899줄로 정상화. 이 사고로 인한 잔존 영향은 없다(최종 diff 는 검증 게이트 전건 통과).

### C2-결함-1 — Plan §5.C2 의 "auth 내부 상대 경로 2건" 은 C1-b 에서 이미 해소됐다

- Plan 은 `auth.api.ts:14` / `useLogin.ts:9` 를 C2 에서 함께 정리하라고 적었으나, 두 줄 모두 C1-b 의
  `AuthApiError` → 공용 `ApiError` 통합 과정에서 이미 `@/shared/lib/api-error` 로 바뀌었다.
- 현재 남은 `'../types/auth.types'` import 2건은 auth 고유 심볼(`LoginRequest` / `LoginSuccessResponse` /
  `createLoginFailResponse` 등)이라 옮길 대상이 아니다 — 그대로 둔다(AC17 grep 대상 아님).

### C2-결함-2 — Plan 12파일 외에 `auth/types/auth.types.ts` 자신을 1개 더 손댔다

- 12파일의 import 만 옮기면 `auth.types.ts` 에 `ApiResponse` / `isRecord` / `isApiResponse` 로컬 정의가
  공용 정의와 **완전히 같은 내용으로 중복 잔존**한다(R2 가 없애려던 중복 그 자체).
- 보존적 선택(S-19)으로 **동작이 바뀌지 않는 범위** — 로컬 정의 3개를 지우고 공용 정의를 import 하는
  것만 했다. auth 고유 타입/함수는 한 줄도 건드리지 않았다.

### C2-결함-3 — 4파일에서 같은 모듈 import 가 2줄로 갈라져 1줄로 합쳤다

- `eqp.types` / `user.types` / `group.types` / `model.types` 는 C1-b 에서 `isApiResponse` 를 공용에서
  가져오게 바뀐 상태였고, C2 의 경로 치환으로 `type ApiResponse` 도 같은 모듈을 가리키게 됐다.
- `import { isApiResponse, type ApiResponse } from '@/shared/types/api.types'` 한 줄로 병합했다
  (`model.types` 는 기존 별칭 `as BaseApiResponse` 유지).

### C3-결함-1 — 삭제 6파일에 raw 요소가 없어 §4 누적표가 움직이지 않는다

- Plan §5.C3 은 죽은 파일 삭제를 R10 으로만 분류했고 raw 요소 감소를 약속하지 않았다. 삭제 후
  재측정 결과 `<button>` 80 / `<select>` 15 / `type="checkbox"` 10 으로 **C2 와 동일**하다.
- 즉 AC4/AC5/AC6 의 잔여 수치는 C13~C16 이 전부 감당한다. C3 은 AC10/AC11 전용 단계다.

### C4-결함-1 — `refactor-audit-nori-tc-ui-front.md` 는 정정 대상 목록에 없다

- 이 파일에도 제거된 5컴포넌트·recharts 서술이 다수(`:162~166`, `:181~199`, `:258`) 있으나 Plan §5.C4 의
  정정표에 없고, §5.C4 하단의 "정정하지 않는 문서" 목록에도 없다 — Plan 이 판단을 남기지 않은 칸이다.
- **보존적 선택(S-19)**: 손대지 않았다. 이 문서는 **이 6파일을 dead 로 판정한 감사 자체의 실행 기록**이라
  당시 사실이 맞고(=`nori-client-forked-migration-*` 과 같은 성격), 오히려 C3 의 판정 근거 문서다.
- Plan 이 명시적으로 열거한 2파일 4곳만 고쳤다.

### C5-a-결함-1 — nori-tc-common 의 `nori-tc-refactor-campaign-dev-report.md` 도 정정 대상 밖이다

- `:636`, `:645`, `:647`, `:705`, `:706` 에 제거된 5컴포넌트 서술이 있으나 Plan §5.C5-a 표에 없다.
- C4-결함-1 과 같은 이유로 손대지 않았다 — 이 문서는 dead 판정을 수행한 **캠페인의 실행 기록**이고,
  `:647` 은 오히려 "제거 시 문서 동시 정정 필요" 라는 **이번 C4/C5-a/C6 의 지시 근거**다.

### C5-b-결함-1 — Plan 이 C5-b 에게 아직 실행되지 않은 C6 을 완료로 적으라고 지시한다

- Plan §5.C5-b 는 재평가 조건 (b)(c) 를 "문서 5건 정정 완료 = C4·C5-a·**C6**" 로 대체하라고 적었는데,
  실행 순서(§5)는 C5-b 가 C6 보다 **앞**이다. 그대로 쓰면 아직 없는 사실을 ledger 에 적게 된다.
- **보존적 선택(S-19)**: 실행된 것만 SHA 로 적고(C4 `c9f1f72` / C5-a `fe78343`), exec 문서는
  "같은 사이클의 C6 단위가 담당" 으로 표기했다. C6 완료 후에도 이 문장은 참이라 재수정이 필요 없다.

### C5-b-결함-2 — `보류 사유` 칸 처리 지침이 Plan 에 없다

- 284/285 의 `보류 사유` 칸에는 이관 당시의 실측 근거가 길게 들어 있고, Plan 은 이 칸을 어떻게 할지
  적지 않았다. 완료 행의 관례(`순서 4` 등)는 `-` 지만, 지우면 실측 기록이 소실된다.
- **보존적 선택(S-19)**: 본문을 그대로 두고 앞에 `(이관 당시 기록)` 만 붙여 시점을 명시했다.

### C6-결함-1 — Plan 이 인용한 `LiveMapPage.tsx:88-89,155-157` 은 라인 드리프트다

- Plan §5.C6 은 line 필터 소비처를 `LiveMapPage.tsx:88-89,155-157` 로 적었으나 현 HEAD 실측은
  `:16`(store import) · `:105`(`selectedLineValue` 구독) · `:139`(설비 필터) · `:157`(필터 인자) 이다.
- 커밋 메시지와 문서에는 **실측한 줄**만 인용했다(`LiveMapBoard.tsx:571,579` 는 Plan 표기와 일치 확인).
  렌더 지점은 `AppTopBar.tsx:191` 로 추가 확인했다.

### C7-결함-1 — `<Toaster />` 를 넣으며 `I18nProvider` 의 children 형태가 바뀐다

- Plan 은 "I18nProvider 자식으로 마운트" 만 지시했고, 기존 코드는 `<I18nProvider>{children}</I18nProvider>`
  한 줄이었다. 자식이 2개가 되므로 여는/닫는 태그를 여러 줄로 펼치는 형태 변경이 불가피했다.
- 동작 변경은 없다(같은 provider 아래 형제 추가). 그 외 `AppProvider.tsx` 는 import 1줄 외 무변경.

### C8-조사기록 — `group-page.spec.ts` `Group-AC-5` 가 4-spec 병렬에서만 실패했다 (spec 경합, 코드 결함 아님)

- **현상**: C8 변경 후 4-spec 병렬 실행에서 baseline PASS 인 `Group-AC-5: 그룹 수정 성공` 이 4회 중 3회
  FAIL. 단독 실행은 PASS, `group-page.spec.ts` 단일 파일 실행도 3/3 PASS.
- **실패 원인 확정**: 실패 스크린샷에 `Fill in all required fields (group code, group name).` 이 떠 있다 —
  `GroupUpsertModal.tsx:96` 의 **클라이언트 사전 검증**이다(C8 이 손대지 않은 줄). spec 이
  `group-row-edit-10` 클릭 직후 상세 GET 응답을 기다리지 않고 Save 를 눌러, `groupCode` 가 빈 값인
  순간에 눌리면 막힌다. 15s 뒤 캡처된 화면에는 `ADMINS` 가 들어와 있어 **응답이 늦게 도착했음**이 보인다.
- **차분 실험**: C8 변경을 `git stash` 로 빼고 같은 4-spec 을 2회 → `Group-AC-5` 2/2 PASS.
  즉 C8 이 dev 모듈 그래프에 `notify`→`toast.store` 를 한 겹 더 얹어 첫 모달 렌더를 몇 ms 늦추고,
  그것이 원래 존재했던 spec 경합을 넘긴 것으로 본다. **런타임 동작 변경은 없다**(검증 로직·API 경로 무변경).
- **조치**: 프로덕션 코드가 아니라 **spec 을 동기화**했다 — 편집 클릭 후
  `await expect(page.locator('#group-upsert-code')).toHaveValue('ADMINS')` 3줄 추가.
  단정을 약화한 것이 아니라 **로드 완료 대기를 명시**한 것이다. 이후 4-spec 2/2 에서 비-baseline 실패 0.
- `tests/e2e/` 는 `.gitignore:20` 으로 추적 대상이 아니라 이 spec 수정은 커밋에 포함되지 않는다
  (Plan §4 의 "같은 커밋" 요구는 추적되는 파일에만 적용 가능).

### C9-결함-1 — Plan 이 지정한 스크린샷 3화면 중 2화면이 이 SPEC 의 영향 밖이다

- Plan §5.C9 는 `/login` · EQP 관리 폼 모달 · 모델 상세 패널을 찍으라고 했다. 실제로 찍어 보니
  `/login` 은 `Input` 프리미티브를 안 쓰고(raw `<input>` 4곳), 모델 쪽 캡처 화면에는 Input/Select 가 없다
  → 전/후 차이 0. **컨트롤 시각 변화를 실제로 보여 주는 화면은 EQP 폼 모달 하나**다.
- **모델 상세 패널**을 찍으려 했으나 그 패널을 렌더하는 spec 4개가 전부 baseline FAIL 이라 캡처 자체가 불가.
  같은 도메인의 baseline PASS spec(`model-check-in-diff-overflow`)으로 대체하고 그 사실을 §7 에 적었다.
- 임시 캡처 spec(`tests/e2e/_c9-login-capture.spec.ts`)은 캡처 후 삭제했다. 증거 PNG 2장은
  `.claude/specs/assets/` 에 넣어 git 으로 추적한다(`test-results/` 는 실행마다 지워진다).

### C10-상태 — 신설 프리미티브 3종의 소비처가 이 시점엔 0이다

- Plan §5.C10 의 주의사항 그대로다: `checkbox.tsx` / `switch.tsx` / `SELECT_EMPTY_VALUE` 는
  **C13~C16 에서 배선**되기 전까지 소비처가 없다(글로벌 룰 11 의 미사용 추상화 구간).
- Plan 이 "C10 과 C13 사이에 세션을 끊지 않는다" 로 봉인했고, 이 세션이 그대로 이어서 진행한다.
  부득이 끊길 경우 다음 세션의 첫 작업은 **C11 이 아니라 C13 까지 완주**하는 것이다.

### C11-결함-1 — `user-row-skeleton` testid 가 사라진다

- `UserListTable` 의 로딩 전용 `<Table>` 을 지우면서 `data-testid="user-row-skeleton"` 도 함께 없어지고,
  공용 `data-testid="selectable-table-skeleton-row"` 로 바뀐다. Plan 은 이 testid 를 언급하지 않았다.
- **참조처 0건 확인 후 진행**: `grep -rn "user-row-skeleton" src tests` → 선언 1곳뿐(소비 0).
  `skeletonRowCount={USER_PAGE_SIZE}` 로 넘겨 **행 수(20)는 종전과 동일**하게 유지했다.
- 함께 미사용이 된 `USER_TABLE_COLUMN_COUNT` 상수와 import 5개(`Skeleton`/`Table`/`TableBody`/
  `TableCell`/`TableHead`/`TableHeader`)를 제거했다(내 변경이 만든 미사용 — 글로벌 룰 4).

### C11-결함-2 — 비교기를 별도 모듈로 뽑은 이유

- Plan 은 "`SORT_COLLATOR` 를 export 하거나 별도 모듈로 뽑는다" 로 두 갈래를 열어 뒀다.
  **별도 모듈(`SelectableTable/sort.ts`)을 택했다** — 단위 테스트 러너가
  `node --experimental-strip-types` 라 `.tsx`(JSX 포함) 파일은 import 할 수 없기 때문이다.
- 소비처는 컴포넌트 + 단위 테스트 2곳이라 룰 11 의 조기 추상화에 해당하지 않는다(Plan 명시).
