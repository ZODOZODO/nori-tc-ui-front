# Deploy History Front Phase 3 Impact Report

## 날짜

- 2026-03-31

## 요청 요약

- `/deploy` 의 `Deploy` / `Deploy_History` 목록을 server source-of-truth 기준으로 전환
- `Deploy` 는 non-terminal 목록, `Deploy_History` 는 terminal 목록만 보여주도록 탭 의미를 고정
- create 직후 bridge row, server row, active row 전환, pagination 규칙을 프론트에서 일관되게 정리

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/05-deploy-register-api-spec.md`
- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/08-deploy-create-phase2.md`
- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/09-deploy-history-phase3.md`

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
- `src/features/deploy/lib`

## expected changed files

- `src/features/deploy/api/deploy.api.ts`
- `src/features/deploy/hooks/useDeployHistoryList.ts`
- `src/features/deploy/hooks/useDeploySummary.ts`
- `src/features/deploy/hooks/useDeployTargets.ts`
- `src/features/deploy/lib/deploy-query-keys.ts`
- `src/features/deploy/types/deploy.types.ts`
- `src/features/deploy/stores/deploy-ui.store.ts`
- `src/features/deploy/components/DeployMonitorPanel.tsx`
- `src/features/deploy/components/DeployHistoryPanel.tsx`

## non-goals

- 실제 server `redeploy` / `delete` / `cancel` mutation 추가
- `POST /api/deploys` payload 구조 재설계
- EQP / Model feature 구조 변경
- deploy 상세 패널 레이아웃 대개편

## risk points

1. server row 와 bridge row 병합 규칙이 불명확하면 동일 `deployKey` 중복 노출이나 유령 row 가 남을 수 있습니다.
2. 검색 조건 변경 시 page 초기화, active row 정리, polling 중단 규칙이 어긋나면 탭과 상세 패널 기준이 서로 달라질 수 있습니다.
3. `Deploy` 와 `Deploy_History` 가 같은 목록 hook 을 공유하더라도 `terminalOnly` 와 polling 정책을 분리하지 않으면 terminal row 에 대한 불필요한 polling 이 계속될 수 있습니다.

## verification plan

- `pnpm lint`
- `pnpm test:unit`
- `pnpm build`
