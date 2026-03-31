# Deploy Actions Front Phase 4 Impact Report

## 날짜

- 2026-03-31

## 요청 요약

- `/deploy` 의 쓰기 액션인 `Cancel`, `Redeploy`, `Delete` 를 프론트에 연결
- 탭별 상태에 맞는 액션만 노출하고 confirm, 성공/실패 메시지, active row 전환을 일관되게 처리
- mutation 성공 후 목록/상세/polling 상태를 server 기준으로 자연스럽게 갱신

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/09-deploy-history-phase3.md`
- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/10-deploy-actions-phase4.md`

## impacted repository

- `nori-tc-ui-front`

## local governance files

- `/home/donggeon/workspace_nori/nori-tc-ui-front/AGENTS.md`
- `/home/donggeon/workspace_nori/nori-tc-exec/harness/docs/repo-agent-governance.md`

## impacted modules

- `src/features/deploy/api`
- `src/features/deploy/hooks`
- `src/features/deploy/components`
- `src/features/deploy/stores`
- `src/features/deploy/types`
- `src/shared/lib`

## expected changed files

- `src/features/deploy/api/deploy.api.ts`
- `src/features/deploy/hooks/useCancelDeploy.ts`
- `src/features/deploy/hooks/useRedeployDeploy.ts`
- `src/features/deploy/hooks/useDeleteDeploy.ts`
- `src/features/deploy/hooks/useDeployHistoryList.ts`
- `src/features/deploy/hooks/useDeploySummary.ts`
- `src/features/deploy/hooks/useDeployTargets.ts`
- `src/features/deploy/lib/deploy-query-keys.ts`
- `src/features/deploy/stores/deploy-ui.store.ts`
- `src/features/deploy/components/DeployMonitorPanel.tsx`
- `src/features/deploy/components/DeployHistoryPanel.tsx`

## non-goals

- deploy payload 구조 재설계
- `GET /api/deploys` 목록 계약 재설계
- Business Jar upload API 확장
- 대규모 UX 리디자인

## risk points

1. terminal / non-terminal 상태 구분이 잘못되면 `Cancel` 이 history 에 보이거나 `Redeploy/Delete` 가 진행 중 row 에 보이는 UX 오류가 생길 수 있습니다.
2. cancel / delete 성공 후 active row 와 polling 정리가 누락되면 이미 사라진 row 를 계속 상세 패널에서 바라보는 어색한 상태가 생길 수 있습니다.
3. redeploy 는 새 `deployKey` 를 반환하는 흐름이라, 기존 history row 유지와 새 active deploy 전환을 동시에 처리하지 않으면 사용자 입장에서 중복처럼 보일 수 있습니다.

## verification plan

- `pnpm lint`
- `pnpm test:unit`
- `pnpm build`
