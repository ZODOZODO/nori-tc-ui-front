# Deploy Monitor Front Phase 6 Impact Report

## 날짜

- 2026-04-01

## 요청 요약

- `Deploy` 탭 active row 우클릭 메뉴를 `READY -> Deploy`, `RUNNING -> Hold`로 전환
- `pauseRequested=true` 상태를 row/header에서 식별 가능하게 표시
- history `Redeploy` 성공 시 새 `READY` bridge로 추가하고 `deploy` 모드로 전환
- `Cancel`은 기본 active 탭 컨텍스트 메뉴에서 제거

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-exec/docs/design/12-deploy-controlled-execution-and-duplicate-guard-program.md`
- `/home/donggeon/workspace_nori/nori-tc-exec/docs/tasks/12-deploy-controlled-execution-and-duplicate-guard-program-tasks.md`

## impacted repository

- `nori-tc-ui-front`

## local governance files

- `/home/donggeon/workspace_nori/nori-tc-ui-front/AGENTS.md`
- `/home/donggeon/workspace_nori/nori-tc-exec/harness/docs/repo-agent-governance.md`

## impacted modules

- `src/features/deploy/components`
- `src/features/deploy/hooks`
- `src/features/deploy/stores`

## expected changed files

- `src/features/deploy/components/DeployMonitorPanel.tsx`
- `src/features/deploy/hooks/useStartDeploy.ts`
- `src/features/deploy/hooks/useHoldDeploy.ts`
- `src/features/deploy/stores/deploy-ui.store.ts`

## non-goals

- register 화면 재설계
- backend action API 계약 변경
- history table 컬럼/레이아웃 전면 개편

## risk points

1. start 직후 polling 이 `RUNNING`으로 바로 전환되지 않으면 active row가 여전히 `READY`로 보일 수 있습니다.
2. hold 요청 직후 `pauseRequested=true`를 로컬에도 반영하지 않으면 중복 Hold 클릭과 안내 문구가 어긋날 수 있습니다.
3. history redeploy 성공 시 `deploy` 모드 전환과 bridge 추가 타이밍이 어긋나면 사용자가 새 `READY` row를 찾지 못할 수 있습니다.

## verification plan

- `pnpm lint`
- `pnpm test:unit`
- `pnpm build`
