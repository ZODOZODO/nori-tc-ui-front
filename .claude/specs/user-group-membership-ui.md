# SPEC — User/Group Membership UI (미구현 기능 트래킹)

> 작성일: 2026-05-27
> 단계: Specify (Plan / Implement / Validate 후속)
> 대상 레포: `nori-tc-ui-front` (단일 레포)
> 출처: selectable-table-rollout R4 Validate 중 발견 — e2e 가 선행 명세했으나 production 미구현인 기능 2건을 별 SPEC 으로 분리 (사용자 결정 2026-05-27).

## Why

User / Group 관리 페이지에 다음 2 기능이 **e2e 로 선행 명세**되어 있으나 production 코드가 미구현이다. 해당 testId 가 `src/` 전체에 부재함을 grep 으로 확인 (`group-member-panel` / `group-member-add` / `user-group-chip` → No files found, 2026-05-27).

이로 인해 e2e 2 케이스가 항상 fail 상태였다:
- `tests/e2e/group-page.spec.ts:356` (Group-AC-7: 그룹 멤버 추가/제거)
- `tests/e2e/user-page.spec.ts:502` (사용자 그룹 매핑 표시 + 제거)

이 fail 은 selectable-table-rollout (R1~R4) 작업과 무관하며, R4 Validate 시 사전 존재 fail 로 분류 후 별 SPEC 으로 트래킹하기로 결정.

## Requirements

### F1 — 그룹 멤버 관리 패널 (`group-member-panel`)

- [ ] GroupAdminPanel 에서 그룹 행 선택 시 멤버 관리 패널 노출 (`data-testid="group-member-panel"`)
- [ ] 멤버 추가 입력 + 제출 (`group-member-add-input` / `group-member-add-submit`) → `POST /api/user/{userPk}/group/{groupId}`
- [ ] 멤버 제거 → `DELETE /api/user/{userPk}/group/{groupId}`
- [ ] 기대 동작은 `tests/e2e/group-page.spec.ts:356` (Group-AC-7) 가 이미 명세 (mock route `/api/user/(\d+)/group/(\d+)` 존재)

### F2 — 사용자별 소속 그룹 칩 표시/제거 (`user-group-chip`)

- [ ] 사용자 상세(또는 행 확장)에서 소속 그룹을 칩으로 표시 (`data-testid="user-group-chip-{groupId}"`)
- [ ] 칩 제거 → 사용자-그룹 매핑 해제 API 호출
- [ ] 기대 동작은 `tests/e2e/user-page.spec.ts:502` 가 이미 명세 (`user-group-chip-10` / `user-group-chip-11` 기대, ADMINS/OPS 라벨)

## Constraints

- **UserListTable / GroupListTable 의 SelectableTable 마이그레이션(R4) 은 이미 완료** — 본 SPEC 은 행 테이블이 아닌 멤버십 관리 UI (패널 / 칩) 신규 구현.
- TanStack Query 데이터 흐름 유지 — 표시 레이어만 신규 추가.
- 기존 e2e 의 testId / mock route 계약을 그대로 만족시키는 방향으로 구현 (e2e 가 contract 역할).

## Acceptance Criteria

- [x] `tests/e2e/group-page.spec.ts` (Group-AC-7) PASS — **현 설계(모달)로 충족**: `group-row-members-{id}` → GroupAddMembersModal 에서 체크박스 add(POST) + 기존 멤버 `group-member-remove-{userPk}` remove(DELETE). console.error/pageerror 0.
- [x] `tests/e2e/user-page.spec.ts` (사용자 그룹 매핑 표시) PASS — **현 설계로 충족**: `user-row-group-{userPk}-{groupId}` chip 인라인 표시. 제거는 Group 페이지 모달이 담당(UserListTable 은 표시 전용 — 코드 주석 명시).
- [x] `npx tsc -b` / `npm run build` PASS (변경 파일 0 신규 에러)
- [x] `npm run lint` PASS (변경 파일 신규 에러/warning 0)

### 해소 결정 (2026-05-29 — 사용자 승인 "현재 모달 설계에 맞춰 e2e 갱신 + 누락된 remove 구현")

- 이 SPEC 작성(2026-05-27) 이후 production 이 **모달 기반 멤버 관리**(`GroupAddMembersModal`)로 재설계됨. 원 SPEC 의 인라인 `group-member-panel` / `group-member-add-input` / `user-group-chip-remove` 계약 대신 **현 설계를 정본으로 채택**.
- **구현(F1)**: `useRemoveGroupMember` 훅 신규 + GroupAddMembersModal 기존 멤버에 `group-member-remove-{userPk}` 버튼(DELETE) 추가. (멤버 add 는 기존 모달에 이미 존재.)
- **F2**: user 페이지는 그룹 chip **표시 전용**(설계 정합 — "그룹 add/remove 는 Group 페이지에서 관리"). 멤버 제거는 F1 모달이 담당.
- **e2e 갱신**: 두 테스트를 현 설계 testId/흐름으로 재작성. 테스트 약화 아님 — add+remove 동작을 현 UI 경유로 동일하게 검증.

## Out of Scope

- selectable-table-rollout (R1~R7) 의 테이블 마이그레이션 — 별 SPEC.
- 그룹/사용자 CRUD 기본 동작 — 이미 구현 완료 (group-page / user-page e2e 의 나머지 케이스 PASS).

## SDD 진행 상태

- [x] **Specify** — 이 SPEC.md 작성 (2026-05-27). e2e contract 가 이미 존재하므로 Plan 단계에서 e2e 역분석으로 구현 범위 확정 가능.
- [x] **Plan/Implement/Validate** — 2026-05-29 통합 수행. 현 모달 설계 채택 + F1 멤버 제거 구현 + e2e 2건 현 설계로 갱신 → group-page 8 passed / user-page 10 passed (단독·전체 실행 모두 통과).
