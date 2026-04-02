# Deploy Ready Delete Front Impact Report

## 날짜

- 2026-04-01

## 요청 요약

- `/deploy` 의 `Deploy` 탭 server row 우클릭 메뉴에 `Delete` 를 추가
- `READY` 와 `PLANNING` deploy 삭제 UX를 기존 history delete 흐름과 일관되게 연결
- 실행 실패 원인 분석 결과에 맞춰 `Deploy` 와 `Delete` 노출 조건을 상태별로 정리

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/11-deploy-ready-delete-and-action-permission-fix.md`

## impacted repository

- `nori-tc-ui-front`

## impacted modules

- `src/features/deploy/components`
- `src/features/deploy/hooks`

## expected changed files

- `src/features/deploy/components/DeployMonitorPanel.tsx`
- `src/features/deploy/hooks/useDeleteDeploy.ts`

## risk points

1. `READY` 와 `RUNNING` 분기가 섞이면 실행 버튼이 사라지거나 잘못된 삭제 메뉴가 노출될 수 있습니다.
2. 삭제 성공 후 active row 정리가 누락되면 상세 패널이 이미 삭제된 deployKey 를 계속 바라볼 수 있습니다.

## verification plan

- `pnpm lint`
- `pnpm build`
