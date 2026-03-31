# Deploy Create Front Phase 2 Impact Report

## 날짜

- 2026-03-31

## 요청 요약

- `/deploy` 의 `Register` 에서 실제 `POST /api/deploys` 호출
- 성공 시 `Deploy` 탭으로 전환하고 summary / targets 를 backend polling 으로 조회
- CSRF 처리와 create payload 매핑 규칙을 프론트에 반영

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/05-deploy-register-api-spec.md`
- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/08-deploy-create-phase2.md`

## impacted repository

- `nori-tc-ui-front`

## local governance files

- `/home/donggeon/workspace_nori/nori-tc-ui-front/AGENTS.md`
- `/home/donggeon/workspace_nori/nori-tc-exec/harness/docs/repo-agent-governance.md`

## impacted modules

- `src/features/deploy/api`
- `src/features/deploy/hooks`
- `src/features/deploy/lib`
- `src/features/deploy/types`
- `src/features/deploy/stores`
- `src/features/deploy/components`
- `src/shared/lib`

## expected changed files

- `src/features/deploy/api/deploy.api.ts`
- `src/features/deploy/hooks/useCreateDeploy.ts`
- `src/features/deploy/hooks/useDeploySummary.ts`
- `src/features/deploy/hooks/useDeployTargets.ts`
- `src/features/deploy/lib/deploy-query-keys.ts`
- `src/features/deploy/types/deploy.types.ts`
- `src/features/deploy/stores/deploy-ui.store.ts`
- `src/features/deploy/components/DeployRegisterPanel.tsx`
- `src/features/deploy/components/DeployMonitorPanel.tsx`
- `src/features/deploy/components/DeployHistoryPanel.tsx`
- `src/features/deploy/mocks/deploy.mock.ts`

## non-goals

- `Register` 조회 API 재설계
- `Deploy_History` 전체 기간 서버 검색 구현
- Business Jar upload API 추가
- EQP/Model 화면 리팩토링

## risk points

1. 현재 `selectedInterfaceType` 는 mixed selection 시 `null` 이 되므로 `Deploy` 버튼 차단 규칙이 빠지면 backend validation 오류로 바로 이어집니다.
2. `DeployJarOption` 등 mock 중심 타입과 실제 backend 응답 타입이 달라 phase 1/phase 2 데이터를 함께 다루는 과정에서 타입 충돌이 생길 수 있습니다.
3. create 성공 후 summary / targets polling 이 실패하는 경우와 create 자체 실패하는 경우를 UI에서 분리하지 않으면 사용자가 상태를 오해할 수 있습니다.

## verification plan

- `pnpm lint`
- `pnpm test:unit`
- `pnpm build`
