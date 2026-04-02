# Deploy Register Scenario Selection Front Impact Report

## 날짜

- 2026-04-01

## 요청 요약

- `/deploy` 의 `Register` 탭에서 Deploy 버튼 클릭 시 바로 생성하지 않고 scenario preview 를 호출
- 변경이 없는 설비는 `Selected Equipments` 에서 제거
- 권장 시나리오와 선택 가능한 시나리오를 modal data table 로 보여주고 사용자가 하나를 선택한 뒤 deploy 생성

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-backend/docs/design/2026-04-01-deploy-register-scenario-selection-design.md`

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
- `src/features/deploy/hooks/useCreateDeploy.ts`
- `src/features/deploy/hooks/useDeployScenarios.ts`
- `src/features/deploy/hooks/useDeployRegisterScenarioPreview.ts`
- `src/features/deploy/lib/deploy-query-keys.ts`
- `src/features/deploy/types/deploy.types.ts`
- `src/features/deploy/stores/deploy-ui.store.ts`
- `src/features/deploy/components/DeployRegisterPanel.tsx`

## non-goals

- `Deploy` 탭 polling 화면 전체 개편
- `Register` 검색 API 재설계
- Business Jar 업로드 UI 추가
- deploy history table 컬럼 전체 재구성

## risk points

1. 현재 `Deploy` 버튼은 model version 미선택 시 무조건 차단하므로, optional 변경 조합을 허용하려면 버튼 활성화와 검증 문구를 함께 재설계해야 합니다.
2. no-change 설비를 자동 제거할 때 zustand 상태와 화면 렌더링이 어긋나면 사용자가 의도치 않은 target 으로 deploy 할 수 있습니다.
3. preview 응답의 권장 시나리오와 실제 create 요청의 선택 시나리오가 달라질 수 있어 modal 상태 관리가 꼬이면 잘못된 scenario code 가 전송될 수 있습니다.

## verification plan

- `pnpm lint`
- `pnpm test:unit`
- `pnpm build`
