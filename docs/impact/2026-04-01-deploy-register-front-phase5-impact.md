# Deploy Register Front Phase 5 Impact Report

## 날짜

- 2026-04-01

## 요청 요약

- `Register` 화면을 create-only 의미로 정리
- active deploy 설비를 검색/선택 단계에서 차단
- 생성 성공 UX를 `READY` 대기 의미로 교체
- `READY` deploy의 polling 부담과 문구를 줄이고 `RUNNING` row만 실시간 동기화 메시지를 노출

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-exec/docs/design/12-deploy-controlled-execution-and-duplicate-guard-program.md`
- `/home/donggeon/workspace_nori/nori-tc-exec/docs/tasks/12-deploy-controlled-execution-and-duplicate-guard-program-tasks.md`

## impacted repository

- `nori-tc-ui-front`

## local governance files

- `/home/donggeon/workspace_nori/nori-tc-ui-front/AGENTS.md`
- `/home/donggeon/workspace_nori/nori-tc-exec/harness/docs/repo-agent-governance.md`

## impacted modules

- `src/features/deploy/api`
- `src/features/deploy/hooks`
- `src/features/deploy/types`
- `src/features/deploy/stores`
- `src/features/deploy/components`

## expected changed files

- `src/features/deploy/api/deploy.api.ts`
- `src/features/deploy/hooks/useDeploySummary.ts`
- `src/features/deploy/hooks/useDeployTargets.ts`
- `src/features/deploy/types/deploy.types.ts`
- `src/features/deploy/stores/deploy-ui.store.ts`
- `src/features/deploy/components/DeployRegisterPanel.tsx`
- `src/features/deploy/components/DeployMonitorPanel.tsx`

## non-goals

- `Deploy` 탭 context menu를 `Deploy / Hold` 로 교체하는 작업
- history redeploy UX 전체 재정의
- polling 주기/쿼리 인프라 전면 개편
- register scenario preview API 계약 재설계

## risk points

1. 검색 결과의 active deploy 메타와 이미 선택된 설비의 상태가 어긋나면 사용자가 차단 사유를 이해하지 못할 수 있습니다.
2. create 성공 직후 bridge placeholder를 `READY`로 바꾸는 과정에서 기존 `RUNNING` 가정이 남아 있으면 Deploy 탭 의미가 다시 흔들릴 수 있습니다.
3. `READY` polling을 줄이더라도 최초 선택 시 summary/targets 1회 조회는 유지되어야 하므로, enabled 조건과 interval 조건을 분리해 다뤄야 합니다.

## verification plan

- `pnpm lint`
- `pnpm test:unit`
- `pnpm build`
