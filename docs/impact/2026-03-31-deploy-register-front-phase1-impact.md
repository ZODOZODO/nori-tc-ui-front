# Deploy Register Front Phase 1 Impact Report

## 날짜

- 2026-03-31

## 요청 요약

- `/deploy` 의 `Register` 화면을 mock 기반에서 backend 조회 기반으로 전환
- search 결과, model/jar 옵션, eqp param version 옵션만 backend 와 연결
- `Deploy` 버튼의 실제 생성은 아직 local create 를 유지

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/05-deploy-register-api-spec.md`
- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/07-deploy-register-front-phase1.md`

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

## expected changed files

- `src/features/deploy/api/deploy.api.ts`
- `src/features/deploy/hooks/useDeployRegisterTargets.ts`
- `src/features/deploy/hooks/useDeployRegisterOptions.ts`
- `src/features/deploy/hooks/useDeployEqpParamVersions.ts`
- `src/features/deploy/lib/deploy-query-keys.ts`
- `src/features/deploy/types/deploy.types.ts`
- `src/features/deploy/components/DeployRegisterPanel.tsx`
- `src/features/deploy/stores/deploy-ui.store.ts`
- `src/features/deploy/mocks/deploy.mock.ts`

## non-goals

- `POST /api/deploys` 연결
- deploy summary / targets polling 연결
- `Deploy_History` backend 연동
- CSRF 처리 추가
- 기존 EQP/Model feature 구조 변경

## risk points

1. phase 1 backend 응답 타입과 현재 mock 타입이 다르므로 `deploy.types.ts` 에서 점진적 타입 분리가 필요합니다.
2. `Selected Equipments` 의 `eqp param version` 은 row별 lazy load 구조이므로 query key와 초기 기본값 규칙이 어긋나면 선택값이 흔들릴 수 있습니다.
3. 조회 결과는 React Query, 선택 상태는 Zustand 로 분리되므로 `Search` 이후 결과 갱신과 선택 유지 규칙을 명확히 맞춰야 합니다.

## verification plan

- `pnpm lint`
- `pnpm test:unit`
- `pnpm build`
