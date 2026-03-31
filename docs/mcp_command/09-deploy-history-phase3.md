# Deploy Monitor / History Phase 3 Draft

이번 문서는 `/deploy` 의 남은 기능 중
`Deploy` 탭과 `Deploy_History` 탭을 서버 데이터 기준으로 마무리하기 위한
**3차 구현 문서 초안**입니다.

본 단계의 목적은 `Register` 에서 생성된 deploy 가
시간 경과에 따라 `Deploy` 와 `Deploy_History` 사이에서 자연스럽게 이동하도록 만들고,
두 탭의 목록/검색 기준을 backend 계약으로 고정하는 것입니다.

본 문서는 아래 선행 문서를 기준으로 합니다.

- [05-deploy-register-api-spec.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/05-deploy-register-api-spec.md)
- [06-deploy-register-backend-phase1.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/06-deploy-register-backend-phase1.md)
- [07-deploy-register-front-phase1.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/07-deploy-register-front-phase1.md)
- [08-deploy-create-phase2.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/08-deploy-create-phase2.md)

─────────────────────────────
📌 이번 단계 목표
─────────────────────────────

3차 구현의 목표는 아래 5가지입니다.

1. `GET /api/deploys` 목록 API 추가
2. `Deploy` 탭은 **non-terminal deploy 목록**만 보이도록 전환
3. `Deploy_History` 탭은 **terminal deploy 목록**만 보이도록 전환
4. 기간/모델/사용자 검색을 server filter 기준으로 전환
5. create 성공 직후 생성된 deploy 가 `Deploy` 목록에 자연스럽게 이어지도록 bridge 규칙 정리

이 단계가 끝나면 `/deploy` 는 아래 상태가 됩니다.

1. `Register`
   - backend 조회 기반
   - backend 생성 기반

2. `Deploy`
   - 아직 종료되지 않은 deploy 목록
   - summary / targets polling 연동 유지

3. `Deploy_History`
   - 실행이 종료된 deploy 목록
   - 기간/모델/사용자 검색 가능

즉, 이번 단계의 핵심은
**Deploy 탭과 Deploy_History 탭의 의미를 서버 상태 기준으로 명확히 분리하는 것**입니다.

─────────────────────────────
✅ 3차 완료의 의미
─────────────────────────────

이번 문서 기준의 `3차 완료`는 아래 범위를 의미합니다.

1. `Register` 에서 생성한 deploy 가
   - `Deploy` 탭에 나타나고
   - 종료되면 `Deploy_History` 로 넘어가는 흐름 완성
2. `Deploy` / `Deploy_History` 의 목록/검색/선택/상세가 server 기준으로 동작
3. create 직후의 임시 bridge 상태가 목록과 충돌하지 않도록 정리

즉,
이번 단계가 끝나면 `/deploy` 의 **monitoring / history 축**은 완성으로 볼 수 있습니다.

다만 아래는 여전히 별도 후속 기능입니다.

1. server redeploy
2. server delete
3. server cancel / retry

따라서 “deploy 관련 모든 기능이 완벽히 끝난다”기보다,
**deploy 목록/모니터링/이력 흐름이 완성된다**고 보는 것이 정확합니다.

─────────────────────────────
🚫 이번 단계 비목표
─────────────────────────────

이번 단계에서 하지 않을 것:

1. 실제 server redeploy API 추가
2. 실제 server delete API 추가
3. deploy cancel / retry API 추가
4. `POST /api/deploys` request payload 재설계
5. `GET /api/deploys/{deployKey}` / `/targets` 계약 재설계
6. EQP / Model feature 구조 변경
7. deploy monitor 상세 영역을 완전히 다른 레이아웃으로 개편

중요:

- 이번 단계는 `Deploy` / `Deploy_History` 의 **목록 기준 정리**가 목적입니다.
- 후속 액션 API(redeploy/delete/cancel)는 별도 단계로 분리하는 것이 안전합니다.

─────────────────────────────
🧭 탭 의미 확정
─────────────────────────────

이번 단계에서 아래 의미를 명시적으로 고정합니다.

## 1. Deploy 탭

`Deploy` 탭에는 아래 상태만 노출합니다.

1. `PLANNING`
2. `READY`
3. `RUNNING`

즉,
`Register` 에서 생성되었고 아직 종료되지 않은 deploy 만 `Deploy` 탭에 있어야 합니다.

## 2. Deploy_History 탭

`Deploy_History` 탭에는 아래 상태만 노출합니다.

1. `COMPLETED`
2. `PARTIAL_FAILED`
3. `FAILED`
4. `CANCELED`

즉,
실행이 종료된 deploy 는 `Deploy_History` 탭으로 이동해야 합니다.

## 3. 사용자 관점 흐름

권장 흐름은 아래와 같습니다.

1. `Register` 에서 deploy 생성
2. 생성 직후 `Deploy` 탭에 표시
3. summary / targets polling 으로 상태 갱신
4. terminal 상태가 되면 `Deploy` 탭에서는 더 이상 보이지 않음
5. 같은 항목이 `Deploy_History` 탭에 보임

이 흐름이 맞아야 사용자는
`진행 중/대기 중 목록` 과 `종료된 이력` 을 자연스럽게 구분할 수 있습니다.

─────────────────────────────
🧱 권장 구현 경계
─────────────────────────────

## 핵심 아이디어

2차에서 `Deploy` 탭은 “활성 deploy 1건 polling” 까지만 구현되었습니다.
이번 단계는 여기서 한 단계 더 나아가,
**목록 자체를 server source-of-truth 로 전환**하는 작업입니다.

권장 경계는 아래와 같습니다.

1. backend
   - `GET /api/deploys` 신규 추가
   - 탭 구분 기준은 `terminalOnly` query 로 제어

2. front
   - `Deploy` / `Deploy_History` 목록은 server list 우선 사용
   - create 직후에는 store bridge 항목을 허용
   - server list 에 동일 `deployKey` 가 내려오면 server row 가 우선

즉,
이번 단계의 무게 중심은
**history/list API 추가 + front 목록 소스 전환** 입니다.

─────────────────────────────
📁 예상 변경 파일
─────────────────────────────

## backend 필수 추가/수정 파일

1. `nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/controller/DeployController.java`
2. `nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/dto/response/DeployHistoryPageResponse.java`
3. `nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/service/DeployService.java`
4. `nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/port/db/DeployStorePort.java`
5. `nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/deploy/DeployHistoryView.java`
6. `nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/DeployJdbcStorePort.java`
7. `nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/DeployJdbcStoreSupport.java`

## backend 테스트 파일

1. `nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/test/java/com/nori/tc/ui/adapters/web/controller/DeployControllerTest.java`
2. `nori-tc-ui-backend/ui/tc-ui-core/src/test/java/com/nori/tc/ui/core/service/DeployServiceTest.java`

## front 필수 추가/수정 파일

1. `src/features/deploy/api/deploy.api.ts`
2. `src/features/deploy/hooks/useDeployHistoryList.ts`
3. `src/features/deploy/lib/deploy-query-keys.ts`
4. `src/features/deploy/types/deploy.types.ts`
5. `src/features/deploy/components/DeployMonitorPanel.tsx`
6. 필요 시 `src/features/deploy/components/DeployHistoryPanel.tsx`
7. 필요 시 `src/features/deploy/stores/deploy-ui.store.ts`

─────────────────────────────
🆕 backend 3차 구현 설계
─────────────────────────────

## 1. 신규 API

### Endpoint

- `GET /api/deploys`

### Query Parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|------|------|
| `modelName` | `string` | N | `null` | deploy name 또는 selected model name 부분 검색 |
| `requestedBy` | `string` | N | `null` | 요청 사용자 부분 검색 |
| `fromDate` | `yyyy-MM-dd` | N | `null` | 생성일 시작 inclusive |
| `toDate` | `yyyy-MM-dd` | N | `null` | 생성일 종료 inclusive |
| `terminalOnly` | `boolean` | N | `false` | terminal 상태만 조회할지 여부 |
| `offset` | `int` | N | `0` | 페이지 시작 위치 |
| `limit` | `int` | N | `100` | 페이지 크기 |

권장 정책:

1. `toDate` 는 controller 에서 inclusive 입력을 받아
   DB query 에는 `toDate + 1 day, exclusive` 로 변환
2. `fromDate > toDate` 이면 `400 Bad Request`
3. 정렬은 `created_at DESC, deploy_key DESC`
4. backend 는 `offset/limit` 계약을 반드시 지키고,
   front 는 이 계약을 기준으로 page 이동을 제어

## 1-1. Pagination 정책 확정

이번 단계에서는 pagination 동작도 명시적으로 고정합니다.

1. `Deploy` 탭과 `Deploy_History` 탭은 모두 server pagination 사용
2. front 는 탭별로 독립된 page 상태를 가짐
   - 예: `deployListPage`, `historyListPage`
3. 검색 조건이 바뀌면 현재 page 는 항상 `0` 으로 초기화
4. 권장 page size
   - 기본 `50`
   - 최대 `100` 또는 backend 상한 이하

주의:

- 단순히 `limit=500` 으로 많이 가져오는 방식은 임시 우회일 뿐,
  목록이 계속 늘어나는 운영 환경에서는 완결 형태로 보기 어렵습니다.
- 따라서 3차를 “완성”으로 보려면 pagination UI 또는 명시적인 page 이동 규칙이 필요합니다.

## 2. 탭별 조회 규칙

front 에서는 아래처럼 호출하는 것을 권장합니다.

1. `Deploy` 탭
   - `terminalOnly=false`

2. `Deploy_History` 탭
   - `terminalOnly=true`

즉,
backend 는 탭 이름을 알 필요가 없고,
terminal 여부만 기준으로 목록을 내려주면 됩니다.

## 3. 권장 response DTO

```java
public record DeployHistoryPageResponse(
        List<DeployHistoryResponse> items,
        int offset,
        int limit,
        long count
) {
    public record DeployHistoryResponse(
            long deployKey,
            String deployName,
            String eventType,
            String deployStatus,
            String executionPolicy,
            String requestedBy,
            String createdAt,
            String startedAt,
            String finishedAt,
            boolean terminal,
            String interfaceType,
            String selectedModelName,
            String selectedModelVersion,
            String selectedBusinessJarName,
            DeploySummaryResponse.TargetSummaryResponse targetSummary
    ) {
    }
}
```

주의:

1. `selectedModelName`, `selectedModelVersion`, `selectedBusinessJarName`, `interfaceType` 는 `null` 허용
2. 응답 래퍼는 기존과 동일하게 `ApiResponse.success(...)` 사용
3. target 집계는 별도 상세 조회가 아니라 목록 summary 용 최소 집계만 포함

## 4. DB 조회 책임

권장 SQL 책임은 아래와 같습니다.

1. `tc_deploy` 기준 header 목록 조회
2. 각 deploy 에 대해 target status 집계 조인
3. `desired_common_state_json` 에서 아래 필드 추출
   - `interfaceType`
   - `uiMessage.modelInfo.modelName`
   - `uiMessage.modelInfo.modelVersion`
   - `uiMessage.businessJar.jarFileName`

즉,
`Deploy` / `Deploy_History` 목록은
별도 target 상세 페이지를 열지 않아도
사용자가 어떤 작업인지 판단 가능한 수준의 정보가 있어야 합니다.

─────────────────────────────
🧠 front 3차 구현 설계
─────────────────────────────

## 1. 신규 query

권장 신규 hook:

1. `useDeployHistoryList(filters, terminalOnly, offset, limit)`

권장 query key:

1. `deployQueryKeys.history(filters, terminalOnly, offset, limit)`

이 query 는 `Deploy` / `Deploy_History` 가 공통으로 사용하고,
탭에 따라 `terminalOnly` 값만 다르게 넘기는 구조가 적합합니다.

## 2. 목록 데이터 소스 전환

현재 local store 는 아래 책임을 가지고 있습니다.

1. seed/local history
2. create 직후 bridge row
3. local targets cache

3차 이후 권장 책임은 아래와 같습니다.

1. server list
   - 기본 source-of-truth

2. local bridge
   - create 직후 server list 에 아직 안 보이는 deploy 를 잠깐 보완

3. local targets cache
   - summary / targets polling 중간 상태 보완

즉,
목록은 server 우선,
bridge 는 보조 역할로 내려가는 방향이 맞습니다.

## 3. bridge 규칙

create 성공 직후에는 아래 규칙을 권장합니다.

1. store 에 임시 bridge item 생성
2. `Deploy` 탭에서는 bridge item 을 먼저 노출 가능
3. server list 에 같은 `deployKey` 가 들어오면 server row 가 우선
4. server row 로 대체되면 bridge 성격은 사실상 종료
5. bridge row 는 session 범위로만 유지하고, 새로고침 후 복원 대상에서 제외
6. server list 조회가 여러 번 성공했는데도 같은 `deployKey` 가 계속 내려오지 않으면
   오래된 bridge row 는 정리 대상임을 명시

권장 정리 규칙:

1. bridge 생성 시 `bridgeCreatedAt` 같은 local metadata 기록
2. server list 성공 응답에 동일 `deployKey` 가 있으면 즉시 대체
3. 동일 `deployKey` 가 없고 bridge 가 일정 시간 이상 오래된 경우
   - `Deploy` 탭에서 제거
   - 필요 시 안내 메시지 표시

즉,
bridge 는 사용자 공백을 메우기 위한 임시 장치이지,
server source-of-truth 를 오래 대체하는 영속 상태가 아니어야 합니다.

이 규칙이 있어야
create 직후 사용자에게 “방금 만든 deploy 가 어디 갔지?” 같은 공백이 생기지 않습니다.

## 4. 탭별 필터 규칙

`Deploy` 와 `Deploy_History` 는 같은 검색 UI를 써도 되지만,
실제 query 는 아래처럼 나뉘어야 합니다.

1. `Deploy`
   - `terminalOnly=false`
   - 결과가 terminal 상태가 되면 탭에서 사라질 수 있음

2. `Deploy_History`
   - `terminalOnly=true`
   - terminal 상태만 조회

즉,
front 에서 local filter 로 억지로 나누는 것이 아니라
backend 결과 자체가 탭 의미를 반영하도록 하는 것이 맞습니다.

## 5. active row / polling 규칙

권장 규칙:

1. `Deploy` 탭에서 선택된 active row 가 server-backed 이면
   - summary polling 활성화
   - targets polling 활성화

2. `Deploy_History` 탭에서는
   - 목록은 server list 사용
   - 별도 polling 은 기본적으로 불필요

즉,
진행 중 탭과 이력 탭은 동일한 목록 API를 공유하더라도
polling 정책은 달라야 합니다.

## 6. active row 전환 규칙

이 규칙은 문서에서 반드시 고정하는 것이 좋습니다.

1. 사용자가 `Deploy` 탭에서 active row 를 보고 있는 동안
   해당 deploy 가 terminal 상태가 되면:
   - summary / targets polling 중지
   - `Deploy` 목록에서 제외
2. 그 시점에 `Deploy` 탭에 다른 non-terminal row 가 있으면
   - 첫 번째 row 를 새 active row 로 선택
3. 남은 row 가 없으면
   - active row 를 `null` 로 초기화
   - 상세 패널은 빈 상태 안내를 표시
4. 필요 시 사용자에게
   - “선택한 Deploy 가 종료되어 History 에서 확인할 수 있습니다.” 같은 안내를 표시

권장 이유:

- terminal 상태가 된 항목을 `Deploy` 탭에서 계속 active 로 유지하면
  목록과 상세 패널의 기준이 어긋납니다.
- 따라서 active row 전환 규칙을 구현 전에 문서로 고정하는 것이 안전합니다.

─────────────────────────────
🧪 검증 포인트
─────────────────────────────

## backend

1. `GET /api/deploys?terminalOnly=false` 가 non-terminal deploy 만 반환하는지
2. `GET /api/deploys?terminalOnly=true` 가 terminal deploy 만 반환하는지
3. `fromDate`, `toDate`, `requestedBy`, `modelName` 필터가 조합되어도 정상 동작하는지
4. 날짜 형식이 잘못되면 `400` 이 내려오는지

## front

1. `Register` 에서 deploy 생성 후 `Deploy` 탭에 즉시 보이는지
2. 진행 중 deploy 가 `Deploy` 탭에만 보이는지
3. 완료 후 `Deploy_History` 탭에 나타나는지
4. 검색 조건이 server query 로 반영되는지
5. 동일 `deployKey` 의 bridge row 와 server row 가 중복 노출되지 않는지
6. 검색 조건 변경 시 page 가 0으로 초기화되는지
7. active row 가 terminal 전환 시 자연스럽게 다음 row 또는 빈 상태로 이동하는지

─────────────────────────────
✅ 완료 조건
─────────────────────────────

이번 단계는 아래 조건을 만족하면 완료로 봅니다.

1. `GET /api/deploys` 가 추가되어 있다
2. `Deploy` 탭은 non-terminal deploy 목록만 server 기준으로 보여준다
3. `Deploy_History` 탭은 terminal deploy 목록만 server 기준으로 보여준다
4. 기간/모델/사용자 검색이 server filter 로 동작한다
5. create 성공 직후 생성한 deploy 가 `Deploy` 탭에 자연스럽게 이어진다
6. bridge row 가 server row 와 중복되지 않고, session 범위에서만 관리된다
7. pagination 규칙이 명시되어 있고 실제 UI에서 동작한다
8. active row 가 terminal 전환 시 어색하지 않게 정리된다
9. backend `./gradlew test` 가 통과한다
10. front `pnpm lint`, `pnpm test:unit`, `pnpm build` 가 통과한다

─────────────────────────────
➡️ 다음 단계
─────────────────────────────

3차가 끝난 뒤의 후속 단계는 아래와 같습니다.

1. server redeploy API 설계/구현
2. server delete / cancel API 설계/구현
3. Deploy 상세 target 조작 UX 보강
4. 브라우저 수동 QA 및 시각 디테일 보정

즉,
3차 완료는 `/deploy` 의 목록/이력 구조를 server 기준으로 완성하는 단계이고,
그 이후는 후속 액션 기능을 확장하는 단계로 보는 것이 적절합니다.
