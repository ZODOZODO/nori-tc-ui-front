# EQP Optional Gateway Jar Impact Report

## 날짜

- 2026-04-02

## 요청 요약

- `SOCKET Eqp Create` 모달에서 `Gateway Jar`를 선택하지 않아도 생성 가능해야 함
- 현재 `미선택` sentinel 값이 정수 파싱으로 들어가 `"Gateway Jar은(는) 정수로 입력해 주세요."` 오류가 발생하는 흐름 보정
- 같은 입력 방식의 `Business Jar`도 동일하게 선택값이 없으면 `null` 로 요청되도록 정리

## reference docs

- `/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/02-eqp-frame.md`
- `/home/donggeon/workspace_nori/nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/dto/request/EqpCreateRequest.java`
- `/home/donggeon/workspace_nori/nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/dto/request/EqpUpdateRequest.java`

## impacted repository

- `nori-tc-ui-front`

## impacted modules

- `src/features/eqp/components`

## expected changed files

- `src/features/eqp/components/EqpManageFormModal.tsx`

## risk points

1. `미선택` sentinel 값을 일반 숫자 입력과 같은 방식으로 검증하면 optional select 전체가 숫자 오류로 막힐 수 있습니다.
2. create만 수정하고 update를 놓치면 `Eqp Info Update`에서도 같은 jar 미선택 오류가 재발할 수 있습니다.
3. 프론트에서 `null` 로 정규화하더라도 백엔드 DTO가 nullable 계약이 아니면 400 응답으로 바뀔 수 있어 계약 확인이 필요합니다.

## verification plan

- `pnpm lint`
- `pnpm test:unit`
- `pnpm build`
