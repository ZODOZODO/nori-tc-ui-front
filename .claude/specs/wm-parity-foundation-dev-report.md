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

---

## 4. 잔여 수치 누적표

| 시점 | raw `<button>` (src/features) | raw `<select>` | raw `type="checkbox"` |
|---|---|---|---|
| C0 (착수 전) | 80 | 15 | 10 |
| C1-a | 80 | 15 | 10 | (raw 요소 미변환 단계) |

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

---

## 6. R8/R9 보류 사유

(C17 에서 기록)

---

## 7. 스크린샷

(C9 에서 첨부)

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
</content>
