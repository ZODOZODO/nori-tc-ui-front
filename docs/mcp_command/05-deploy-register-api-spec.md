# Deploy Register API Spec Draft

이번 문서는 `/deploy` 의 `Register` 화면을 backend 와 연결하기 위한 **1차 API 설계 초안**입니다.

목표는 현재 frontend-only 상태의 `Register` 화면을, 기존 backend 계약을 최대한 재사용하면서도
불필요한 N+1 조회 없이 실제 데이터로 전환할 수 있도록 **조회 계약을 먼저 확정**하는 것입니다.

이 문서는 다음 순서를 위한 기준 문서입니다.

1. 설계 확정
2. backend 1차 구현
3. front 1차 구현
4. backend/front 2차 구현

─────────────────────────────
📌 이번 문서의 결론
─────────────────────────────

`Register` 화면 연결은 아래 방식으로 진행하는 것을 권장합니다.

1. `Target Equipment Search` 는 신규 조회 API `GET /api/deploys/register/targets` 를 사용합니다.
2. `Configuration & Deploy` 의 `New Model`, `New Model Version`, `Business Jar File` 옵션은
   기존 `GET /api/eqp/options` 를 재사용합니다.
3. `Selected Equipments` 의 `Eqp Param Version` 옵션은
   기존 `GET /api/eqp/{eqpId}/param-versions` 를 선택된 설비 기준으로 lazy load 합니다.
4. `Deploy` 버튼의 `POST /api/deploys` 연결은 이번 문서 범위가 아니며 2차 단계에서 별도 진행합니다.

즉, 이번 설계의 핵심은 아래와 같습니다.

- `Register` 조회는 먼저 붙인다.
- 실제 배포 실행은 나중에 붙인다.
- 기존 `/api/eqp` / `/api/model` 을 프론트에서 억지 조합하지 않는다.
- `Register` 화면 전용 read model 은 backend 가 조합해서 내려준다.

─────────────────────────────
🧭 왜 신규 조회 API가 필요한가
─────────────────────────────

현재 backend 의 기존 API는 아래처럼 데이터가 분산되어 있습니다.

1. `GET /api/eqp`
   - `eqpId`, `commInterface`, `modelVersionKey` 등 기본 정보만 제공
   - `modelName`, `modelVersion`, `modelStatus`, `businessJarFileName`, `appliedParamVersion` 은 없음

2. `GET /api/eqp/options`
   - `businessJarOptions`
   - `developModelOptions`
   - `operateModelOptions`
   를 제공

3. `GET /api/eqp/{eqpId}/param-versions`
   - 설비별 파라미터 버전 목록 제공

4. `POST /api/deploys`
   - 이미 존재하지만, `Register` 조회 화면 데이터와는 별개의 생성 API

이 상태에서 프론트가 `Target Equipment Search` 테이블을 만들기 위해
`/api/eqp` + `/api/model` + `/api/eqp/{eqpId}/manage` 를 조합하면,
설비 수만큼 추가 요청이 생기는 비효율적인 구조가 됩니다.

따라서 `Register` 테이블이 직접 필요로 하는 컬럼은 backend 가 한 번에 조합해서 내려주는 것이 좋습니다.

─────────────────────────────
🎯 적용 범위
─────────────────────────────

이번 문서가 다루는 범위:

1. `Target Equipment Search` 조회 API
2. `Configuration & Deploy` 옵션 조회 재사용 규칙
3. `Selected Equipments` 의 설비별 param version 조회 규칙
4. frontend 상태와 backend 조회 결과의 경계

이번 문서가 다루지 않는 범위:

1. `POST /api/deploys`
2. deploy polling (`GET /api/deploys/{deployKey}`, `GET /api/deploys/{deployKey}/targets`)
3. CSRF 처리
4. Business Jar upload API
5. deploy history API

─────────────────────────────
🆕 신규 API 제안
─────────────────────────────

## 1. Target Equipment Search 조회

### Endpoint

- `GET /api/deploys/register/targets`

### 목적

`Register > Target Equipment Search` 테이블에 필요한 데이터를
한 번에 조회하기 위한 deploy 전용 read API 입니다.

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `modelName` | `string` | N | model name exact match 또는 prefix match 용도 |
| `modelVersionKey` | `number` | N | 현재 연결된 model version key 기준 필터 |
| `eqpId` | `string` | N | 설비 ID 부분 검색 |
| `offset` | `number` | N | 기본 `0` |
| `limit` | `number` | N | 기본 `50`, front 1차에서는 `500` 사용 가능 |

### Response Contract

공통 응답 래퍼는 기존과 동일하게 `ApiResponse<T>` 를 따릅니다.

```ts
interface DeployRegisterTargetItem {
  eqpKey: number | null
  eqpId: string
  commInterface: string
  enabled: boolean
  modelVersionKey: number | null
  modelName: string | null
  modelVersion: string | null
  modelStatus: string | null
  businessJarRef: number | null
  businessJarFileName: string | null
  appliedParamVersion: string | null
}

interface DeployRegisterTargetPage {
  items: DeployRegisterTargetItem[]
  offset: number
  limit: number
  count: number
}
```

### 응답 예시

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "eqpKey": 101,
        "eqpId": "PHOTO-01",
        "commInterface": "SOCKET",
        "enabled": true,
        "modelVersionKey": 2401,
        "modelName": "PhotoCell-A",
        "modelVersion": "v2.4",
        "modelStatus": "OPERATE",
        "businessJarRef": 9001,
        "businessJarFileName": "photo-business-v2.jar",
        "appliedParamVersion": "p2.4.1"
      }
    ],
    "offset": 0,
    "limit": 50,
    "count": 1
  },
  "errorCode": null,
  "errorMsg": null
}
```

### 프론트 매핑 규칙

`Target Equipment Search` 테이블 컬럼은 아래처럼 매핑합니다.

| UI 컬럼 | 응답 필드 |
|------|------|
| `Eqp ID` | `eqpId` |
| `Model` | `modelName` |
| `Model Version / Status` | `modelVersion`, `modelStatus` |
| `Business Jar File` | `businessJarFileName` |
| `Interface` | `commInterface` |

### 설계 메모

1. `businessJarFileName` 은 **현재 설비에 바인딩된 business jar** 를 의미합니다.
2. `appliedParamVersion` 은 선택 후 `Selected Equipments` 의 기본값 계산에 사용합니다.
3. `modelName`, `modelVersion`, `modelStatus`, `businessJarFileName` 이 없을 수 있으므로 `null` 허용으로 둡니다.

─────────────────────────────
♻️ 기존 API 재사용
─────────────────────────────

## 2. Configuration & Deploy 옵션 조회

### Endpoint

- `GET /api/eqp/options`

### 재사용 이유

이 API는 이미 아래 데이터를 제공합니다.

1. `businessJarOptions`
2. `developModelOptions`
3. `operateModelOptions`

따라서 `Register` 의 아래 입력값은 별도 deploy 전용 API를 만들지 않고
기존 계약을 그대로 재사용하는 것이 좋습니다.

- `New Model`
- `New Model Version`
- `Business Jar File`

### 프론트 매핑 규칙

1. `developModelOptions` 와 `operateModelOptions` 를 합쳐서 `New Model Version` 옵션 소스로 사용합니다.
2. `New Model` 드롭다운은 위 옵션 목록에서 `modelName` 기준으로 unique 처리합니다.
3. `Business Jar File` 은 `businessJarOptions` 를 그대로 사용합니다.
4. `commInterface` 필터는 선택된 설비의 `selectedInterfaceType` 과 일치하는 옵션만 노출합니다.

## 3. Selected Equipments 의 Eqp Param Version 조회

### Endpoint

- `GET /api/eqp/{eqpId}/param-versions`

### 재사용 이유

현재 backend 는 설비별 파라미터 버전 목록 조회 계약을 이미 제공합니다.
`Selected Equipments` 의 마지막 컬럼은 설비별 값이므로,
선택된 row 에 대해서만 lazy load 하는 것이 가장 자연스럽습니다.

### 프론트 매핑 규칙

1. `Selected Equipments` 에 row 가 추가될 때 즉시 조회하지 않아도 됩니다.
2. 해당 row 가 처음 렌더링되거나 드롭다운이 열릴 때 조회해도 됩니다.
3. 기본 선택값은 아래 우선순위를 따릅니다.
   - `selectedEqpParamVersions[eqpId]`
   - `DeployRegisterTargetItem.appliedParamVersion`
   - `GET /api/eqp/{eqpId}/param-versions` 의 첫 번째 값

─────────────────────────────
🧩 프론트 상태 경계
─────────────────────────────

## React Query 로 관리할 것

1. `register search result`
2. `configuration options`
3. `selected eqp param version options`

## Zustand 로 계속 관리할 것

1. `registerFilters`
2. `selectedEqpIds`
3. `selectedEqpParamVersions`
4. `selectedModelName`
5. `selectedModelVersionKey`
6. `selectedBusinessJarRef`
7. `selectedInterfaceType`

즉, backend 연결 후에도 `선택 상태` 자체는 client state 로 유지하고,
`조회 결과` 만 server state 로 전환합니다.

─────────────────────────────
🚧 1차 / 2차 단계 경계
─────────────────────────────

## backend 1차 구현

아래만 구현합니다.

1. `GET /api/deploys/register/targets`
2. 필요한 테스트 추가
3. 기존 `GET /api/eqp/options`, `GET /api/eqp/{eqpId}/param-versions` 재사용 확인

## front 1차 구현

아래만 구현합니다.

1. `deploy register` 검색 mock 제거
2. `Target Equipment Search` 를 신규 API로 전환
3. `Configuration & Deploy` 옵션을 `GET /api/eqp/options` 로 전환
4. `Selected Equipments` 의 param version 옵션을 lazy load 전환
5. `Deploy` 버튼은 기존 local create 유지

## backend/front 2차 구현

아래를 구현합니다.

1. `POST /api/deploys` 연결
2. CSRF 처리 추가
3. `commonRequest.uiMessage` 매핑 확정
4. `Deploy` 버튼 성공 후 `deployKey` 저장 및 모드 전환
5. 이후 `summary/targets polling` 연결

─────────────────────────────
🧾 2차 단계용 payload 방향
─────────────────────────────

`POST /api/deploys` 는 이미 존재하며, backend 테스트 기준으로
`commonRequest.uiMessage` 내부에 아래와 같은 구조를 기대하는 방향이 보입니다.

```json
{
  "modelInfo": {
    "modelVersionKey": 2402,
    "modelVersion": "v2.5"
  },
  "businessJar": {
    "jarRef": 9002,
    "jarFileName": "photo-business-next.jar"
  },
  "eqpParams": {
    "version": "p2.5.0"
  }
}
```

다만 이 payload 는 이번 문서에서 구현하지 않습니다.
이번 문서에서는 **2차에서 이 구조로 갈 수 있도록 조회 API를 먼저 정리한다** 까지만 확정합니다.

─────────────────────────────
✅ 설계 확정 체크 결과
─────────────────────────────

이번 초안에서 확정한 권장안:

1. `Register` 조회는 신규 read API를 만든다.
2. `Configuration` 옵션은 기존 `/api/eqp/options` 를 재사용한다.
3. `Eqp Param Version` 옵션은 기존 `/api/eqp/{eqpId}/param-versions` 를 재사용한다.
4. `POST /api/deploys` 연결은 2차로 미룬다.

이번 초안에서 후속 문서로 넘기는 항목:

1. backend 1차 구현 상세 작업 목록
2. front 1차 구현 상세 작업 목록
3. `POST /api/deploys` request body 최종 DTO
4. deploy 성공 후 polling UX
