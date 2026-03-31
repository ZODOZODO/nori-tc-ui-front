# Deploy Front UI Impact Report

## 날짜

- 2026-03-31

## 요청 요약

- `docs/mcp_command/04-deploy-frame.md` 기준으로 `/deploy` 화면을 frontend-only 단계로 구현
- deploy 전용 backend API 없이 local mock data + Zustand 기반으로 동작

## impacted repository

- `nori-tc-ui-front`

## local governance files

- `/home/donggeon/workspace_nori/nori-tc-ui-front/AGENTS.md`
- `/home/donggeon/workspace_nori/nori-tc-exec/harness/docs/repo-agent-governance.md`

## impacted modules

- `src/app`
- `src/features/deploy`
- `src/features/eqp/components`
- `src/features/model/components`
- `docs/mcp_command`

## expected changed files

- `src/app/Router.tsx`
- `src/features/deploy/types/deploy.types.ts`
- `src/features/deploy/mocks/deploy.mock.ts`
- `src/features/deploy/stores/deploy-ui.store.ts`
- `src/features/deploy/components/DeployPage.tsx`
- `src/features/deploy/components/DeploySidebar.tsx`
- `src/features/deploy/components/DeployRegisterPanel.tsx`
- `src/features/deploy/components/DeployMonitorPanel.tsx`
- `src/features/deploy/components/DeployHistoryPanel.tsx`
- `src/features/eqp/components/EqpPage.tsx`
- `src/features/model/components/ModelPage.tsx`

## non-goals

- deploy 전용 backend API 연동
- CSRF 처리 추가
- polling 구현
- 기존 EQP/Model 화면 구조 리팩토링
- 공통 TopBar 대규모 추출

## risk points

1. deploy 화면은 backend 비연동이므로 mock data 구조와 향후 API DTO가 달라질 수 있음
2. 기존 EQP/Model 상단 메뉴는 각 페이지에 하드코딩되어 있어 `/deploy` route 연결 시 중복 수정 필요
3. `UserProfileModal` 과 로그아웃은 기존 auth/profile API 동작을 그대로 사용하므로 로그인 세션이 필요함

## verification plan

- `pnpm lint`
- `pnpm build`
