# Deploy Register Backend Phase 1 Draft

이번 문서는 `/deploy` 의 `Register` 화면을 backend 와 연결하기 위한 **backend 1차 구현 문서 초안**입니다.

본 단계의 목적은 `Register` 화면이 필요로 하는 조회 데이터를 backend 에서 안정적으로 제공하는 것입니다.
즉, 이번 단계는 **read API 추가와 기존 옵션 API 재사용 정리**까지가 범위이며,
실제 deploy 생성(`POST /api/deploys`) 연결은 다음 단계로 넘깁니다.

본 문서는 아래 설계 문서를 선행 기준으로 사용합니다.

- [05-deploy-register-api-spec.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/05-deploy-register-api-spec.md)

─────────────────────────────
📌 이번 단계 목표
─────────────────────────────

backend 1차 구현의 목표는 아래 3가지입니다.

1. `GET /api/deploys/register/targets` 신규 read API 추가
2. `GET /api/eqp/options` 재사용 가능 상태 확인
3. `GET /api/eqp/{eqpId}/param-versions` 재사용 가능 상태 확인

이 단계가 끝나면 front 1차 구현은 아래만 하면 됩니다.

- search table mock 제거
- configuration option mock 제거
- selected eqp param version option mock 제거

─────────────────────────────
🚫 이번 단계 비목표
─────────────────────────────

이번 단계에서 하지 않을 것:

1. `POST /api/deploys` request body 변경
2. deploy 생성 로직 변경
3. deploy polling 로직 변경
4. CSRF 처리 추가
5. deploy history/search API 추가
6. Business Jar upload API 추가
7. 기존 `/api/eqp` 또는 `/api/model` 계약 변경

즉, 이번 단계는 **조회 전용 API 추가**에 집중합니다.

─────────────────────────────
🧱 권장 구현 방향
─────────────────────────────

## 핵심 아이디어

`Register > Target Equipment Search` 에 필요한 필드는 기존 backend 에 분산되어 있습니다.

- `GET /api/eqp` 는 기본 EQP 정보만 제공
- `GET /api/eqp/options` 는 model/jar 옵션 제공
- `GET /api/eqp/{eqpId}/manage` 는 상세 스냅샷 제공

이 상태에서 프론트가 직접 조합하면 N+1 호출이 생기므로,
backend 에서 `Register` 전용 read model 을 만들어 한 번에 내려주는 방식이 적합합니다.

## 권장 레이어 구조

아래 구조를 권장합니다.

1. Web Adapter
   - `DeployController` 에 `GET /api/deploys/register/targets` 추가
   - 신규 response DTO 추가

2. Core
   - `DeployRegisterQueryService` 신규 추가
   - `DeployRegisterQueryPort` 신규 추가
   - `DeployRegisterTargetView` 신규 추가

3. DB Adapter
   - `JpaDeployRegisterQueryPort` 신규 추가
   - 기존 `EqpManagementDbSupport` 재사용

이 방향의 장점:

1. `DeployController` 는 얇게 유지됩니다.
2. `Deploy` 기능의 조회 책임이 `EqpController` 로 섞이지 않습니다.
3. DB 조합 로직을 adapter 에 두고, core 는 use case 중심으로 유지할 수 있습니다.
4. 이후 `register/history/search` read model 이 늘어나도 같은 구조로 확장 가능합니다.

─────────────────────────────
📁 예상 변경 파일
─────────────────────────────

## 필수 추가/수정 파일

1. `nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/controller/DeployController.java`
2. `nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/dto/response/DeployRegisterTargetPageResponse.java`
3. `nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/service/DeployRegisterQueryService.java`
4. `nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/port/db/DeployRegisterQueryPort.java`
5. `nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/deploy/DeployRegisterTargetView.java`
6. `nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/JpaDeployRegisterQueryPort.java`

## 테스트 파일

1. `nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/test/java/com/nori/tc/ui/adapters/web/controller/DeployControllerTest.java`
2. `nori-tc-ui-backend/ui/tc-ui-core/src/test/java/com/nori/tc/ui/core/service/DeployRegisterQueryServiceTest.java`
3. 필요 시
   `nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/test/java/.../JpaDeployRegisterQueryPortTest.java`

## 가능하면 재사용할 기존 파일

1. `EqpManagementDbSupport`
2. `EqpQueryPort`
3. `EqpOptionsQueryPort`
4. `DeployController`

─────────────────────────────
🆕 신규 API 구현 상세
─────────────────────────────

## Endpoint

- `GET /api/deploys/register/targets`

## Query Parameters

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|------|------|
| `modelName` | `string` | N | `null` | 현재 연결 model name 필터 |
| `modelVersionKey` | `long` | N | `null` | 현재 연결 modelVersionKey 필터 |
| `eqpId` | `string` | N | `null` | eqpId 부분 검색 |
| `offset` | `int` | N | `0` | 페이지 시작 위치 |
| `limit` | `int` | N | `50` | 페이지 크기 |

## Response DTO

권장 response DTO:

```java
public record DeployRegisterTargetPageResponse(
        List<DeployRegisterTargetResponse> items,
        int offset,
        int limit,
        long count
) {
    public record DeployRegisterTargetResponse(
            Long eqpKey,
            String eqpId,
            String commInterface,
            boolean enabled,
            Long modelVersionKey,
            String modelName,
            String modelVersion,
            String modelStatus,
            Long businessJarRef,
            String businessJarFileName,
            String appliedParamVersion
    ) {
    }
}
```

주의:

1. `modelName`, `modelVersion`, `modelStatus`, `businessJarFileName`, `appliedParamVersion` 은 `null` 허용
2. 응답 래퍼는 기존처럼 `ApiResponse.success(...)` 사용
3. 정렬은 `eqpId ASC` 권장

─────────────────────────────
🧠 Core 설계
─────────────────────────────

## 신규 view 모델

`DeployRegisterTargetView`

역할:

- controller 가 직접 DB 모델을 알지 않도록 중간 read model 역할 수행
- response DTO 로 변환되기 직전의 core 조회 모델

권장 필드:

1. `eqpKey`
2. `eqpId`
3. `commInterface`
4. `enabled`
5. `modelVersionKey`
6. `modelName`
7. `modelVersion`
8. `modelStatus`
9. `businessJarRef`
10. `businessJarFileName`
11. `appliedParamVersion`

## 신규 port

`DeployRegisterQueryPort`

역할:

- deploy register read model 을 DB adapter 에서 조회하는 전용 포트

권장 메서드:

```java
PagedResponse<DeployRegisterTargetView> findRegisterTargets(
        String modelName,
        Long modelVersionKey,
        String eqpId,
        UiPageRequest pageRequest
);
```

## 신규 service

`DeployRegisterQueryService`

역할:

- controller 가 query parameter 를 그대로 넘길 수 있게 정리
- 입력값 validation
- trim/blank 정규화
- adapter 호출

권장 책임:

1. 빈 문자열을 `null` 로 정규화
2. `offset`, `limit` 기본값 처리
3. service 는 조합 로직보다 use case orchestration 에 집중

─────────────────────────────
🗄 DB Adapter 설계
─────────────────────────────

## 권장 구현체

- `JpaDeployRegisterQueryPort`

## 권장 구현 전략

기존 `EqpManagementDbSupport` 의 아래 메서드를 재사용합니다.

1. `loadAllEqps()`
2. `loadAllModels()`
3. `loadAllBusinessJars()`

이 데이터를 한 번씩 메모리로 읽은 뒤 아래 방식으로 조합합니다.

1. `eqp.modelVersionKey` 기준으로 `UiModel` 매핑
2. `eqp.businessJarKey` 기준으로 `UiBusinessJar` 매핑
3. `eqp.appliedParamVersion` 직접 사용
4. 필터 적용
5. 정렬 적용
6. offset/limit 기반 잘라서 `PagedResponse` 반환

## 왜 이 방식이 적합한가

현재 `EqpManagementDbSupport` 는 이미 scan 기반 헬퍼로 동작하고 있습니다.
즉, 이번 단계에서 별도 store query 를 새로 만들기보다,
기존 support 를 재사용해 read model 을 빨리 안정화하는 편이 낫습니다.

## 필터 규칙 권장안

1. `modelName`
   - blank 면 무시
   - 기본은 exact match 권장

2. `modelVersionKey`
   - null 이면 무시
   - eqp 의 현재 연결 `modelVersionKey` 와 비교

3. `eqpId`
   - blank 면 무시
   - 대소문자 무시 부분 검색 권장

4. `enabled`
   - 이번 단계에서는 별도 필터로 받지 않음

─────────────────────────────
🔌 Controller 구현 메모
─────────────────────────────

이번 단계에서는 신규 controller 를 만들기보다
기존 `DeployController` 에 아래 endpoint 를 추가하는 것을 권장합니다.

- `GET /api/deploys/register/targets`

이유:

1. URL prefix 가 이미 `/api/deploys`
2. 현재 deploy 관련 web entry point 가 `DeployController` 하나로 모여 있음
3. 1차 단계에서는 파일 수를 과도하게 늘리지 않는 편이 유리함

다만 DTO 는 별도 파일로 분리하는 것을 권장합니다.

─────────────────────────────
🧪 테스트 계획
─────────────────────────────

## 1. Controller 테스트

대상 파일:

- `DeployControllerTest`

검증 항목:

1. `GET /api/deploys/register/targets` 가 200을 반환하는지
2. query param 이 service 로 전달되는지
3. 응답이 `ApiResponse.success(data)` 구조를 따르는지
4. item 필드가 기대대로 직렬화되는지

## 2. Core 서비스 테스트

대상 파일:

- `DeployRegisterQueryServiceTest`

검증 항목:

1. blank filter 가 `null` 로 정규화되는지
2. 기본 pageRequest 가 올바르게 적용되는지
3. port 호출 인자가 기대대로 전달되는지

## 3. Adapter 테스트

가능하면 추가:

- `JpaDeployRegisterQueryPortTest`

검증 항목:

1. model/jar 조합이 올바른지
2. `modelName`, `modelVersionKey`, `eqpId` 필터가 올바른지
3. `eqpId ASC` 정렬이 보장되는지
4. pagination 이 올바른지
5. model/jar 누락 시 `null` 로 안전하게 내려가는지

─────────────────────────────
✅ 완료 조건
─────────────────────────────

backend 1차 구현 완료 기준:

1. `GET /api/deploys/register/targets` 호출 가능
2. `Target Equipment Search` 에 필요한 컬럼이 한 번에 내려옴
3. 기존 `/api/eqp/options` 와 `/api/eqp/{eqpId}/param-versions` 는 수정 없이 재사용 가능
4. `POST /api/deploys` 기존 테스트/동작에 영향 없음
5. `./gradlew test` 통과

─────────────────────────────
⚠️ 리스크 및 주의사항
─────────────────────────────

1. 현재 DB adapter 는 scan 기반 helper 를 사용하므로 대용량 데이터에서 비용이 커질 수 있습니다.
   다만 register 1차 단계에서는 기존 구조 재사용 이점이 더 큽니다.

2. `Register` 검색 전용 API 는 EQP 페이지 API 와 목적이 다르므로,
   기존 `/api/eqp` 응답에 필드를 덧붙이는 방식은 권장하지 않습니다.

3. 이번 단계는 조회 API만 추가해야 하므로,
   `DeployService`, `DeployPlanner`, `DeployExecutor` 등 실행 경로는 변경하지 않는 것이 안전합니다.

4. 실제 구현 전에는 `nori-tc-ui-backend` 쪽 impact report 를 별도로 만드는 것을 권장합니다.

─────────────────────────────
➡️ 다음 단계
─────────────────────────────

backend 1차가 끝나면 다음 문서 기준으로 front 1차 구현으로 넘어갑니다.

다음 단계에서 할 일:

1. `deploy register` 의 mock search data 제거
2. 신규 `GET /api/deploys/register/targets` 연동
3. 기존 `GET /api/eqp/options` 연동
4. 기존 `GET /api/eqp/{eqpId}/param-versions` 연동
5. `Deploy` 버튼은 여전히 local create 유지
