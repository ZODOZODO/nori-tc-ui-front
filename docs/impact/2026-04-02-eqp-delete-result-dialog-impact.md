# EQP Delete Result Dialog Impact Report

## 날짜

- 2026-04-02

## 요청 요약

- `/eqp` 페이지에서 EQP 삭제 확인 후 성공/실패 결과를 별도 팝업으로 노출
- 실패 시 백엔드 `errorMsg`를 그대로 보여줘 원인을 바로 확인 가능하게 정리
- 삭제 확인 팝업이 비동기 결과 전에 닫히는 흐름을 함께 보정

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/02-eqp-frame.md`

## impacted repository

- `nori-tc-ui-front`

## impacted modules

- `src/features/eqp/components`

## expected changed files

- `src/features/eqp/components/EqpDeleteConfirmDialog.tsx`
- `src/features/eqp/components/EqpDeleteResultDialog.tsx`
- `src/features/eqp/components/EqpPage.tsx`

## risk points

1. 삭제 성공 후 선택 상태 정리가 누락되면 이미 삭제된 EQP 상세를 계속 바라볼 수 있습니다.
2. 실패 결과 팝업 전환 시 confirm 팝업이 먼저 닫히면 로딩 상태가 끊겨 사용자가 중복 클릭할 수 있습니다.
3. 백엔드가 `errorMsg` 없이 실패하면 사용자에게 보여줄 원인이 fallback 문구로만 표시됩니다.

## verification plan

- `pnpm lint`
- `pnpm build`
