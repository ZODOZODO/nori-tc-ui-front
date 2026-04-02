# Deploy Ready Delete And Action Permission Fix

## 날짜

- 2026-04-01

## 요청 요약

- `/deploy` 의 `Deploy` 탭 datatable 우클릭 메뉴에 `Delete` 를 추가합니다.
- `READY` deploy 는 `Deploy + Delete`, `PLANNING` deploy 는 `Delete` 를 노출합니다.
- `RUNNING` deploy 는 기존처럼 삭제하지 않고 `Hold` 만 유지합니다.
- `POST /api/deploys/{deployKey}/start` 가 권한 누락으로 차단되지 않도록 action API permission 정책을 보강합니다.

## 정책 확정

### 1. Deploy 탭

- `PLANNING`: `Delete`
- `READY`: `Deploy`, `Delete`
- `RUNNING`: `Hold`

### 2. Delete 허용 범위

- backend 는 `PLANNING`, `READY`, terminal 상태의 deploy 삭제를 허용합니다.
- `RUNNING` deploy 삭제는 계속 금지합니다.

### 3. Action API permission

- `start/hold/cancel/redeploy` 는 동적 `deployKey` 경로이므로 `REGEX` match_type 기반 permission 으로 등록합니다.
- `delete` 도 동일하게 `REGEX` permission 으로 등록합니다.
- `/api/deploys/register/scenario-preview` 는 기존 `DEPLOY_PREVIEW` exact permission 을 유지합니다.
