# Deploy Actions Phase 4 Draft

이번 문서는 `/deploy` 의 남은 기능 중
`Deploy` / `Deploy_History` 탭에서 수행하는 **쓰기 액션**을 마무리하기 위한
**4차 구현 문서 초안**입니다.

본 단계의 목적은 3차에서 완성된
`목록 / 모니터링 / 이력 흐름` 위에
실제 사용자 액션인 `cancel / redeploy / delete` 를 안정적으로 올리는 것입니다.

본 문서는 아래 선행 문서를 기준으로 합니다.

- [05-deploy-register-api-spec.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/05-deploy-register-api-spec.md)
- [08-deploy-create-phase2.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/08-deploy-create-phase2.md)
- [09-deploy-history-phase3.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/09-deploy-history-phase3.md)

─────────────────────────────
📌 이번 단계 목표
─────────────────────────────

4차 구현의 목표는 아래 4가지입니다.

1. `Deploy` 탭에서 active/non-terminal deploy 를 취소할 수 있다
2. `Deploy_History` 탭에서 terminal deploy 를 다시 실행할 수 있다
3. `Deploy_History` 탭에서 terminal deploy 를 목록에서 제거할 수 있다
4. 액션 후 목록/상세/active row 가 server 기준으로 자연스럽게 갱신된다

이 단계가 끝나면 `/deploy` 는 아래 상태가 됩니다.

1. `Register`
   - 조회
   - 생성

2. `Deploy`
   - non-terminal 목록
   - 상세 monitoring
   - cancel 가능

3. `Deploy_History`
   - terminal 목록
   - redeploy 가능
   - delete 가능

즉,
이번 단계의 핵심은
**deploy 페이지의 쓰기 액션을 server 기준으로 완성하는 것**입니다.

─────────────────────────────
✅ 4차 완료의 의미
─────────────────────────────

이번 문서 기준의 `4차 완료`는 아래를 의미합니다.

1. 사용자가 진행 중 deploy 를 취소할 수 있다
2. 사용자가 종료된 deploy 를 다시 실행할 수 있다
3. 사용자가 종료된 deploy 이력을 목록에서 제거할 수 있다
4. 액션 결과가 `Deploy` / `Deploy_History` / 상세 패널에 즉시 반영된다

즉,
4차가 끝나면 `/deploy` 페이지는
`register + monitoring + history + 주요 액션`
까지 모두 갖춘 상태로 볼 수 있습니다.

─────────────────────────────
🚫 이번 단계 비목표
─────────────────────────────

이번 단계에서 하지 않을 것:

1. deploy payload 구조 재설계
2. `GET /api/deploys` 목록 계약 재설계
3. `GET /api/deploys/{deployKey}` / `/targets` polling 계약 재설계
4. EQP / Model feature 구조 변경
5. Business Jar upload API 확장
6. 대규모 UX 리디자인

중요:

- 이번 단계에서는 `retry`를 별도 액션으로 두지 않습니다.
- `retry` 성격은 `redeploy` 로 통합하는 것을 권장합니다.

이유:

1. 사용자가 이해하기 쉽습니다.
2. backend 상태 전이 정책이 단순해집니다.
3. `retry` 와 `redeploy` 를 동시에 두면 의미가 겹칠 가능성이 큽니다.

─────────────────────────────
🧭 액션 매트릭스 확정
─────────────────────────────

이번 단계에서 액션 허용 기준을 아래처럼 고정합니다.

## 1. Deploy 탭

대상:

- `PLANNING`
- `READY`
- `RUNNING`

허용 액션:

1. `Cancel`

허용하지 않는 액션:

1. `Redeploy`
2. `Delete`

## 2. Deploy_History 탭

대상:

- `COMPLETED`
- `PARTIAL_FAILED`
- `FAILED`
- `CANCELED`

허용 액션:

1. `Redeploy`
2. `Delete`

허용하지 않는 액션:

1. `Cancel`

즉,
`Deploy` 는 진행 중 작업 관리,
`Deploy_History` 는 종료된 작업의 재실행/정리 용도입니다.

─────────────────────────────
🗂 액션 의미 확정
─────────────────────────────

## 1. Cancel

의미:

- 이미 생성되어 진행 중인 deploy 를 더 이상 진행하지 않도록 중단 요청

권장 상태 전이:

1. `PLANNING` / `READY` / `RUNNING`
2. cancel 요청 수락
3. 최종 상태 `CANCELED`
4. `Deploy` 탭에서 제거
5. `Deploy_History` 탭에 표시

## 2. Redeploy

의미:

- terminal deploy 의 요청 정보를 기반으로 새 deploy 를 다시 생성

중요:

- 기존 `deployKey` 를 재사용하지 않습니다.
- 항상 **새 deploy** 를 생성합니다.

권장 흐름:

1. 사용자가 terminal row 에서 `Redeploy`
2. backend 가 기존 deploy payload 를 재구성
3. 새 `deployKey` 생성
4. 새 deploy 는 `Deploy` 탭에 표시
5. 기존 이력 row 는 그대로 유지

## 3. Delete

의미:

- terminal deploy 항목을 목록에서 더 이상 보이지 않도록 제거

권장 정책:

1. 초기 구현은 **soft delete** 권장
2. 실제 row 삭제 대신 `deleted` 성격 플래그나 목록 제외 정책 사용 가능
3. 최소한 `GET /api/deploys` 목록에서는 제외되어야 함

이유:

1. 이력 감사 추적이 필요한 환경에서 hard delete 는 위험합니다.
2. 화면 요구는 “안 보이게 하는 것”이지 반드시 물리 삭제가 아닐 수 있습니다.

─────────────────────────────
🆕 backend 4차 구현 설계
─────────────────────────────

## 1. 신규/추가 API

권장 계약은 아래와 같습니다.

### 1) Cancel

- `POST /api/deploys/{deployKey}/cancel`

response:

- `deployKey`
- `deployStatus`
- `resultCode`
- `resultMessage`

### 2) Redeploy

- `POST /api/deploys/{deployKey}/redeploy`

response:

- `deployKey` (새 deployKey)
- `deployStatus`
- `polling.summaryUrl`
- `polling.targetsUrl`
- `resultCode`
- `resultMessage`

### 3) Delete

- `DELETE /api/deploys/{deployKey}`

response:

- `deployKey`
- `deleted`
- `resultCode`
- `resultMessage`

## 2. 상태 검증 정책

backend 는 액션 요청 시 아래를 검증해야 합니다.

### Cancel

허용:

1. `PLANNING`
2. `READY`
3. `RUNNING`

거부:

1. `COMPLETED`
2. `PARTIAL_FAILED`
3. `FAILED`
4. `CANCELED`

### Redeploy

허용:

1. `COMPLETED`
2. `PARTIAL_FAILED`
3. `FAILED`
4. `CANCELED`

거부:

1. `PLANNING`
2. `READY`
3. `RUNNING`

### Delete

허용:

1. `COMPLETED`
2. `PARTIAL_FAILED`
3. `FAILED`
4. `CANCELED`

거부:

1. `PLANNING`
2. `READY`
3. `RUNNING`

즉,
진행 중 항목은 cancel 만 가능하고,
종료된 항목은 redeploy/delete 만 가능하도록 분리하는 것이 맞습니다.

## 3. 권한 / 보안

이번 단계에서는 아래를 반드시 확인해야 합니다.

1. CSRF 처리
2. 인증 사용자 기반 액션 기록
3. 액션 실패 시 민감한 내부 예외 노출 금지

권장 actor 처리:

1. `Authentication` 기준 actor 추출
2. cancel / redeploy / delete 모두 감사 로그 또는 audit 필드에 actor 반영

## 4. backend 구현 파일 예상

1. `nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/controller/DeployController.java`
2. 필요 시 action response DTO 파일
3. `nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/service/DeployService.java`
4. `nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/port/db/DeployStorePort.java`
5. `nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/DeployJdbcStorePort.java`
6. 관련 테스트 파일

─────────────────────────────
🧠 front 4차 구현 설계
─────────────────────────────

## 1. 신규 mutation hook

권장 hook:

1. `useCancelDeploy`
2. `useRedeployDeploy`
3. `useDeleteDeploy`

구현 패턴:

- 기존 `useCreateDeploy` 와 동일한 mutation 패턴
- 성공 시 deploy query invalidate
- 필요 시 active row 조정

## 2. UI 액션 위치

권장 위치:

1. `Deploy` 탭 row 우클릭 메뉴
   - `Cancel`

2. `Deploy_History` 탭 row 우클릭 메뉴
   - `Redeploy`
   - `Delete`

3. 필요 시 상세 영역 상단 보조 버튼
   - 선택된 active row 기준으로 동일 액션 제공 가능

즉,
row context menu 를 기본 액션 entry 로 두고,
상세 패널에는 선택적으로 보조 액션을 둘 수 있습니다.

## 3. 성공 후 상태 반영 규칙

### Cancel 성공 후

1. 현재 row 가 terminal 상태가 될 때까지 summary polling 결과를 반영
2. terminal 확정 후 `Deploy` 목록에서 제거
3. `Deploy_History` 탭에서 보이게 됨
4. active row 는 3차 규칙에 따라 다음 row 또는 `null` 로 전환

### Redeploy 성공 후

1. 새 deployKey 를 반환받음
2. 새 deploy 를 `Deploy` 탭으로 전환해서 보여줌
3. 기존 history row 는 유지
4. summary / targets polling 을 새 deployKey 기준으로 시작

### Delete 성공 후

1. 현재 목록에서 row 제거
2. active row 가 삭제된 row 였다면
   - 다음 row 선택 또는 `null`
3. 성공 메시지 표시

## 4. confirm 정책

권장 confirm:

1. `Cancel`
   - “진행 중 Deploy 를 취소하시겠습니까?”

2. `Redeploy`
   - “이 Deploy 설정으로 새 작업을 다시 실행하시겠습니까?”

3. `Delete`
   - “이 Deploy 이력을 목록에서 제거하시겠습니까?”

이유:

- 액션이 모두 상태 변경을 동반하므로,
  accidental click 을 막는 최소 confirm 은 필요합니다.

## 5. query invalidate 정책

권장 invalidate:

1. `GET /api/deploys`
2. `GET /api/deploys/{deployKey}`
3. `GET /api/deploys/{deployKey}/targets`

특히 redeploy 후에는 아래가 중요합니다.

1. history 목록 invalidate
2. deploy 목록 invalidate
3. 새 deployKey summary/targets query 활성화

─────────────────────────────
🧪 검증 포인트
─────────────────────────────

## backend

1. `POST /api/deploys/{deployKey}/cancel` 이 non-terminal 에서만 성공하는지
2. `POST /api/deploys/{deployKey}/redeploy` 가 terminal 에서만 성공하고 새 deployKey 를 반환하는지
3. `DELETE /api/deploys/{deployKey}` 가 terminal 에서만 성공하는지
4. 잘못된 상태에서 요청 시 적절한 `400` 또는 domain error 가 내려오는지

## front

1. `Deploy` 탭에서 non-terminal row 에만 `Cancel` 이 보이는지
2. `Deploy_History` 탭에서 terminal row 에만 `Redeploy/Delete` 가 보이는지
3. cancel 후 row 가 `Deploy` 에서 사라지고 `History` 로 이동하는지
4. redeploy 후 새 row 가 `Deploy` 탭에 나타나는지
5. delete 후 history 목록에서 제거되는지
6. 액션 성공/실패 메시지가 한국어로 자연스럽게 보이는지

─────────────────────────────
✅ 완료 조건
─────────────────────────────

이번 단계는 아래 조건을 만족하면 완료로 봅니다.

1. `Cancel` API 와 UI 가 동작한다
2. `Redeploy` API 와 UI 가 동작한다
3. `Delete` API 와 UI 가 동작한다
4. 액션별 상태 검증이 backend 에서 강제된다
5. 액션 후 `Deploy` / `Deploy_History` / 상세 패널이 자연스럽게 갱신된다
6. backend `./gradlew test` 가 통과한다
7. front `pnpm lint`, `pnpm test:unit`, `pnpm build` 가 통과한다

─────────────────────────────
➡️ 이후 상태
─────────────────────────────

4차까지 끝나면 `/deploy` 는 아래 범위를 갖습니다.

1. Register 조회
2. Deploy 생성
3. Deploy 모니터링
4. Deploy history 조회
5. Cancel
6. Redeploy
7. Delete

즉,
이 문서 기준으로는 `/deploy` 페이지가
실사용 가능한 수준의 주요 흐름과 액션을 모두 갖춘 상태가 됩니다.
