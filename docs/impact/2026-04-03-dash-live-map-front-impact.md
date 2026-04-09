# Dash Live Map Front Impact Report

## 날짜

- 2026-04-03

## 요청 요약

- `design.pen` 의 `dash_map frame` 을 실제 앱 페이지로 구현
- 상단 공통 topbar 에 `Dash` 메뉴를 추가하고 기존 주요 페이지에도 동일하게 반영
- `Dash` 메뉴/route 는 `permissionCodes` 기반으로 제어

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/12-dash-map-front-phase1.md`

## impacted repository

- `nori-tc-ui-front`

## impacted modules

- `src/app`
- `src/features/live-map`
- `src/features/eqp/components`
- `src/features/model/components`
- `src/features/deploy/components`
- `src/shared`

## expected changed files

- `src/app/Router.tsx`
- `src/features/live-map/types/live-map.types.ts`
- `src/features/live-map/mocks/live-map.mock.ts`
- `src/features/live-map/stores/live-map-ui.store.ts`
- `src/features/live-map/lib/live-map-selectors.ts`
- `src/features/live-map/components/LiveMapPage.tsx`
- `src/features/live-map/components/LiveMapHeader.tsx`
- `src/features/live-map/components/LiveMapToolbar.tsx`
- `src/features/live-map/components/LiveMapBoard.tsx`
- `src/features/live-map/components/LiveMapLegend.tsx`
- `src/features/live-map/components/LiveMapTooltipCard.tsx`
- `src/features/live-map/components/LiveMapMachineNode.tsx`
- `src/features/eqp/components/EqpPage.tsx`
- `src/features/model/components/ModelPage.tsx`
- `src/features/deploy/components/DeployPage.tsx`
- `src/shared/components/AppTopBar.tsx`
- `src/shared/components/PermissionRoute.tsx`
- `src/shared/lib/app-navigation.ts`
- `src/shared/lib/permission.ts`
- `src/shared/lib/session.ts`

## risk points

1. topbar 공통화 중 로그아웃 후 페이지별 정리 로직이 빠지면 기존 store/reset 동작이 깨질 수 있습니다.
2. `Dash` 메뉴를 권한 기준으로 숨기더라도 route guard가 없으면 URL 직접 진입이 가능해집니다.
3. board zoom/absolute layout 구현이 부정확하면 작은 viewport 에서 node 위치가 쉽게 어긋날 수 있습니다.

## verification plan

- `pnpm lint`
- `pnpm build`
