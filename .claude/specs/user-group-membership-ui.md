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

- [ ] `tests/e2e/group-page.spec.ts:356` (Group-AC-7) PASS — `group-member-panel` 노출 + 멤버 추가/제거 API 호출 + console.error/pageerror 0
- [ ] `tests/e2e/user-page.spec.ts:502` PASS — `user-group-chip-{groupId}` 표시 + 제거 + console.error/pageerror 0
- [ ] `npx tsc -b` PASS (변경 파일 0 신규 에러)
- [ ] `npm run lint` PASS (변경 파일 신규 에러/warning 0)
- [ ] `npx vite build` PASS

## Out of Scope

- selectable-table-rollout (R1~R7) 의 테이블 마이그레이션 — 별 SPEC.
- 그룹/사용자 CRUD 기본 동작 — 이미 구현 완료 (group-page / user-page e2e 의 나머지 케이스 PASS).

## SDD 진행 상태

- [x] **Specify** — 이 SPEC.md 작성 (2026-05-27). e2e contract 가 이미 존재하므로 Plan 단계에서 e2e 역분석으로 구현 범위 확정 가능.
- [ ] **Plan** — 미수행
- [ ] **Implement** — 미수행
- [ ] **Validate** — 미수행
