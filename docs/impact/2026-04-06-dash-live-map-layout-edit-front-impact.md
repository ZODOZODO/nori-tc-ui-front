# Dash Live Map Layout Edit Front Impact Report

## 날짜

- 2026-04-06

## 요청 요약

- `/eqp/live-map` 화면에서 raw status 표기(`A-EQ17 [ERROR]`)를 제거
- 기존 3개 클러스터/sector 구조를 10개 공정 단위 보드로 재배치
- 버퍼 / 반송 장비 영역 제거
- `live sync` 왼쪽에 배치 편집 스위치를 추가
- 스위치가 켜졌을 때만 설비와 공정 카드 drag / drop 이동 허용
- 선택 설비 카드에 포트 상태와 처리 방식(`Single` / `Batch`) 정보 추가

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/12-dash-map-front-phase1.md`
- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/13-dash-live-map-layout-edit-phase2.md`

## impacted repository

- `nori-tc-ui-front`

## impacted modules

- `src/features/live-map`
- `tests`
- `docs/mcp_command`
- `docs/impact`

## expected changed files

- `src/features/live-map/types/live-map.types.ts`
- `src/features/live-map/mocks/live-map.mock.ts`
- `src/features/live-map/lib/live-map-layout.ts`
- `src/features/live-map/lib/live-map-selectors.ts`
- `src/features/live-map/stores/live-map-ui.store.ts`
- `src/features/live-map/components/LiveMapPage.tsx`
- `src/features/live-map/components/LiveMapBoard.tsx`
- `src/features/live-map/components/LiveMapMachineNode.tsx`
- `src/features/live-map/components/LiveMapTooltipCard.tsx`
- `tests/live-map-layout.test.ts`
- `docs/mcp_command/13-dash-live-map-layout-edit-phase2.md`
- `docs/impact/2026-04-06-dash-live-map-layout-edit-front-impact.md`

## risk points

1. zoom 상태에서 drag delta 계산이 잘못되면 노드가 pointer 이동량보다 크게 움직일 수 있습니다.
2. 공정 카드 group drag 시 포함 설비 좌표가 일부 누락되면 카드와 설비가 서로 어긋날 수 있습니다.
3. store draft 좌표 복원이 잘못되면 선택 설비 locate 기능이 어긋날 수 있습니다.

## verification plan

- `pnpm test:unit`
- `pnpm lint`
- `pnpm build`
