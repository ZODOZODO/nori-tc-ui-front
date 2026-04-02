# Deploy Page Reset On Reentry Impact

## 날짜

- 2026-04-01

## 변경 목적

- `Deploy` 페이지를 벗어났다가 다시 들어오면 이전 session 의 register 입력값이 남지 않도록 정리합니다.
- 로그아웃 후 재로그인했을 때 `Selected Equipments`, `Configuration & Deploy`, `Target Equipment Search` 가 이전 값으로 복원되는 문제를 제거합니다.

## 적용 범위

- `/deploy` 페이지 unmount 시 `deploy-ui` store 를 초기화합니다.
- 로그아웃 루틴에서 persisted deploy session state 를 함께 제거합니다.

## 사용자 영향

- `Deploy` 페이지 재진입 시 항상 비어 있는 `Register` 초기 화면부터 시작합니다.
- 아래 항목이 모두 초기화됩니다.
  - `Target Equipment Search`
  - `Selected Equipments`
  - `Configuration & Deploy`
  - `Deploy` 페이지 내부 mode / active selection / 임시 bridge 상태

## 비고

- backend API 계약 변경은 없습니다.
- monitor/history 는 다시 진입한 뒤 서버 조회로 다시 확인하는 흐름을 유지합니다.
