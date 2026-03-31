# Deploy Register Front Phase 1 Draft

이번 문서는 `/deploy` 의 `Register` 화면을 backend 조회 API와 연결하기 위한
**front 1차 구현 문서 초안**입니다.

본 단계의 목적은 현재 mock 기반으로 동작하는 `Register` 화면을
backend read API 기반으로 전환하는 것입니다.

즉, 이번 단계는 다음 두 가지를 동시에 만족해야 합니다.

1. 화면 UI/상호작용은 현재와 동일하게 유지
2. 데이터 소스만 mock → backend query 로 치환

본 문서는 아래 선행 문서를 기준으로 합니다.

- [05-deploy-register-api-spec.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/05-deploy-register-api-spec.md)
- [06-deploy-register-backend-phase1.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/06-deploy-register-backend-phase1.md)

─────────────────────────────
📌 이번 단계 목표
─────────────────────────────

front 1차 구현의 목표는 아래 4가지입니다.

1. `Target Equipment Search` 결과를 신규 backend API로 전환
2. `Configuration & Deploy` 옵션을 기존 backend API로 전환
3. `Selected Equipments` 의 `Eqp Param Version` 옵션을 기존 backend API로 전환
4. `Deploy` 버튼은 기존 local create 동작을 그대로 유지

이 단계가 끝나면 `/deploy` 의 `Register` 화면은
**실제 backend 데이터로 검색/선택/설정은 가능하지만, deploy 실행은 아직 로컬 상태 기반**인 상태가 됩니다.

─────────────────────────────
🚫 이번 단계 비목표
─────────────────────────────

이번 단계에서 하지 않을 것:

1. `POST /api/deploys` 연결
2. deploy 생성 후 polling 연결
3. CSRF 처리 추가
4. `Deploy` / `Deploy_History` 탭 backend 연동
5. deploy history/search API 연동
6. 기존 EQP/Model feature 구조 변경
7. deploy mock 전체 삭제

중요:

- 이번 단계에서 `deploy.mock.ts` 는 완전히 제거하지 않습니다.
- `Deploy` / `History` 탭이 아직 local data 를 사용하므로
  register 관련 mock 만 점진적으로 비활성화하거나 참조를 끊는 방향으로 갑니다.

─────────────────────────────
🧱 권장 구현 방향
─────────────────────────────

## 핵심 아이디어

현재 `Register` 화면은 아래 mock 들을 직접 사용합니다.

1. `DEPLOY_REGISTER_EQP_ITEMS`
2. `DEPLOY_MODEL_OPTIONS`
3. `DEPLOY_MODEL_VERSION_OPTIONS`
4. `DEPLOY_JAR_OPTIONS`

이것을 한 번에 모두 걷어내기보다,
`조회 결과` 와 `선택 상태` 를 분리하는 방향으로 바꾸는 것이 안전합니다.

즉:

1. 조회 결과
   - React Query
   - backend API 기반

2. 선택 상태
   - Zustand
   - 현재 구조 유지

이렇게 하면 현재 UI 동작을 거의 바꾸지 않고 데이터 소스만 교체할 수 있습니다.

─────────────────────────────
📁 예상 변경 파일
─────────────────────────────

## 필수 추가 파일

1. `src/features/deploy/api/deploy.api.ts`
2. `src/features/deploy/hooks/useDeployRegisterTargets.ts`
3. `src/features/deploy/hooks/useDeployRegisterOptions.ts`
4. `src/features/deploy/hooks/useDeployEqpParamVersions.ts`
5. `src/features/deploy/lib/deploy-query-keys.ts`

## 필수 수정 파일

1. `src/features/deploy/types/deploy.types.ts`
2. `src/features/deploy/components/DeployRegisterPanel.tsx`
3. `src/features/deploy/stores/deploy-ui.store.ts`
4. 필요 시 `src/features/deploy/mocks/deploy.mock.ts`

## 가능하면 재사용할 기존 파일

1. `src/shared/lib/api-client.ts`
2. `src/features/eqp/api/eqp.api.ts`
3. `src/features/eqp/lib/eqp-query-keys.ts`
4. `src/features/eqp/hooks/useEqpManageOptions.ts`
5. `src/features/eqp/hooks/useEqpParamVersions.ts`

─────────────────────────────
🗂 데이터 소스 전환 설계
─────────────────────────────

## 1. Target Equipment Search

### 현재 상태

- `DEPLOY_REGISTER_EQP_ITEMS` 를 직접 filter 해서 사용

### 목표 상태

- `GET /api/deploys/register/targets`
- hook: `useDeployRegisterTargets`

### 권장 구현 방식

`registerFilters` 는 계속 Zustand 에 두고,
`DeployRegisterPanel` 에서 이 필터를 기반으로 query 를 실행합니다.

권장 흐름:

1. 사용자가 draft filter 입력
2. `Search` 버튼 클릭
3. `setRegisterFilters(...)`
4. `useDeployRegisterTargets(registerFilters)` 재조회

즉, 지금의 UX는 그대로 유지하고
검색 결과의 실제 소스만 backend 로 바꿉니다.

## 2. Configuration & Deploy 옵션

### 현재 상태

- `DEPLOY_MODEL_OPTIONS`
- `DEPLOY_MODEL_VERSION_OPTIONS`
- `DEPLOY_JAR_OPTIONS`

### 목표 상태

- 기존 `GET /api/eqp/options` 재사용
- hook: `useDeployRegisterOptions`

### 권장 구현 방식

`useDeployRegisterOptions` 는 deploy feature 안에 만들되,
내부 구현은 `eqpApi.getEqpManageOptions()` 를 재사용하는 방향을 권장합니다.

이유:

1. deploy 화면이 eqp feature 구현 디테일을 직접 알 필요가 없음
2. deploy feature 내부 API/hook 경계가 유지됨
3. 내부 query key 는 기존 `eqpQueryKeys.manageOptions()` 를 재사용할 수 있어 캐시 중복이 없음

### UI 매핑 규칙

1. `New Model`
   - `developModelOptions + operateModelOptions` 합집합에서 `modelName` unique

2. `New Model Version`
   - 위 옵션 전체를 그대로 사용
   - 선택된 `selectedInterfaceType`, `selectedModelName` 기준 필터

3. `Business Jar File`
   - `businessJarOptions` 그대로 사용

## 3. Selected Equipments 의 Eqp Param Version

### 현재 상태

- `DeployRegisterEqpItem.eqpParamVersionOptions` mock 사용

### 목표 상태

- 기존 `GET /api/eqp/{eqpId}/param-versions` 재사용
- hook: `useDeployEqpParamVersions`

### 권장 구현 방식

이 hook 역시 deploy feature 안에 만들되,
내부 구현은 `eqpApi.getEqpParamVersions()` 와 `eqpQueryKeys.paramVersions(eqpId)` 를 재사용하는 것을 권장합니다.

이유:

1. deploy feature 는 자기 훅을 통해 읽는다
2. 실제 호출/캐시 규약은 기존 eqp 도메인과 공유한다
3. 향후 eqp 화면과 deploy 화면이 같은 데이터를 봐도 캐시가 분리되지 않는다

### 기본값 규칙

row별 기본 선택값은 아래 우선순위를 따릅니다.

1. `selectedEqpParamVersions[eqpId]`
2. search 응답의 `appliedParamVersion`
3. param version query 결과의 첫 번째 값

─────────────────────────────
🧠 타입 설계
─────────────────────────────

## `deploy.types.ts` 에 추가할 타입

권장 추가 타입:

```ts
import type { ApiResponse } from '@/features/auth/types/auth.types'

export interface DeployRegisterTargetItem {
  eqpKey: number | null
  eqpId: string
  commInterface: ProtocolType
  enabled: boolean
  modelVersionKey: number | null
  modelName: string | null
  modelVersion: string | null
  modelStatus: ModelStatus | null
  businessJarRef: number | null
  businessJarFileName: string | null
  appliedParamVersion: string | null
}

export interface DeployRegisterTargetPage {
  items: DeployRegisterTargetItem[]
  offset: number
  limit: number
  count: number
}

export type DeployRegisterTargetPageResponse = ApiResponse<DeployRegisterTargetPage>
```

중요:

기존 `DeployRegisterEqpItem` 은 당장 삭제하지 말고,
`Deploy` / `History` 탭 mock 에 영향 없는지 확인한 뒤 점진적으로 정리하는 것이 안전합니다.

## store 에 남길 상태

계속 Zustand 에 두는 값:

1. `registerFilters`
2. `selectedEqpIds`
3. `selectedEqpParamVersions`
4. `selectedModelName`
5. `selectedModelVersionKey`
6. `selectedBusinessJarRef`
7. `selectedInterfaceType`

즉, store 는 계속 “선택 상태”만 담당하고,
조회 결과 배열은 store 에 넣지 않는 방향을 권장합니다.

─────────────────────────────
🔑 Query Key 설계
─────────────────────────────

신규 파일:

- `src/features/deploy/lib/deploy-query-keys.ts`

권장 구조:

```ts
export const deployQueryKeys = {
  all: ['deploy'] as const,
  registerRoot: () => ['deploy', 'register'] as const,
  registerTargets: (filters: DeployRegisterFilters) =>
    ['deploy', 'register', 'targets', filters] as const,
} as const
```

주의:

1. `registerTargets` 는 filter object 를 그대로 key 로 써도 되지만,
   가능하면 정규화된 값만 넣는 것이 좋습니다.
2. `eqp options`, `paramVersions` 는 기존 `eqpQueryKeys` 를 그대로 재사용하는 편이 낫습니다.

─────────────────────────────
🧩 API / Hook 설계
─────────────────────────────

## 신규 API 파일

- `src/features/deploy/api/deploy.api.ts`

이번 단계에서 들어갈 메서드는 최소 1개를 권장합니다.

```ts
getRegisterTargets(filters: DeployRegisterFilters, offset?: number, limit?: number)
```

역할:

1. `/deploys/register/targets` 호출
2. 기존 `eqpApi`, `modelApi` 처럼 `ApiResponse` 계약 검증
3. 실패 시 deploy 전용 기본 오류 메시지 제공

### 권장 원칙

1. `POST /api/deploys` 는 아직 넣지 않습니다.
2. deploy read API 만 먼저 넣습니다.
3. response normalize 로직은 `eqpApi` / `modelApi` 패턴을 그대로 따릅니다.

## 신규 hook

### `useDeployRegisterTargets`

역할:

1. registerFilters 기반 search result 조회
2. `enabled` 제어
3. `staleTime` 설정

권장안:

- `Search` 버튼 기반 UX를 유지하기 위해, query 는 `registerFilters` 변경 시만 움직이게 둡니다.

### `useDeployRegisterOptions`

역할:

1. deploy 화면에서 필요한 option 묶음을 읽기 쉬운 형태로 제공
2. 내부적으로는 `eqpApi.getEqpManageOptions()` 재사용

권장 반환값:

1. `modelOptions`
2. `modelVersionOptions`
3. `businessJarOptions`
4. `rawOptions`

### `useDeployEqpParamVersions`

역할:

1. 설비별 param version 목록 조회
2. 내부적으로 `eqpApi.getEqpParamVersions(eqpId)` 재사용

─────────────────────────────
🖥 컴포넌트 변경 설계
─────────────────────────────

## `DeployRegisterPanel.tsx`

이번 단계의 핵심 수정 파일입니다.

### 변경 포인트

1. `DEPLOY_REGISTER_EQP_ITEMS` 직접 참조 제거
2. `DEPLOY_MODEL_OPTIONS`, `DEPLOY_MODEL_VERSION_OPTIONS`, `DEPLOY_JAR_OPTIONS` 직접 참조 제거
3. search result 는 `useDeployRegisterTargets` 로 교체
4. configuration options 는 `useDeployRegisterOptions` 로 교체
5. selected row param version options 는 `useDeployEqpParamVersions` 로 교체

### 유지할 것

1. draft state (`draftModelName`, `draftModelVersionKey`, `draftEqpId`)
2. `Search`, `Clear`, `Add to Selected`, `Remove`
3. `Deploy` 버튼 local create
4. `feedbackMessage`

### 주의할 점

현재 `selectedEqpItems` 는 `resolveEqpItemsByIds(selectedEqpIds)` 로 mock 에서 가져옵니다.
이 부분은 backend 전환 시 아래 방식으로 바뀌어야 합니다.

권장 방식:

1. 현재 search 결과 + 이미 선택된 row 정보 조합
2. 필요 시 `selectedEqpIds` 기반 map 유지

가장 단순한 권장안:

- `addSelectedEqps` 할 때 store 에 row 상세 전체를 저장하지 말고
- panel 내부에서 `searchResultMap` + `selectedEqpIds` 로 `selectedEqpItems` 를 계산

다만 이렇게 하면 검색 결과에서 사라진 설비 정보가 사라질 수 있으므로,
이번 단계에서는 아래 보강을 권장합니다.

### 보강 권장안

store 에 아래를 추가하는 방안을 권장합니다.

```ts
selectedEqpSnapshotById: Record<string, DeployRegisterTargetItem>
```

의미:

- `Add to Selected` 시점의 row snapshot 보관
- 검색 조건이 바뀌어도 `Selected Equipments` 테이블이 안정적으로 유지됨

이는 현재 상태 구조에서 가장 적은 변경으로 안정성을 확보하는 방법입니다.

─────────────────────────────
🧪 검증 계획
─────────────────────────────

## 코드 검증

1. `pnpm lint`
2. `pnpm build`

## 화면 확인 포인트

1. `/deploy` 진입 시 register 화면 정상 표시
2. 검색 필터 입력 후 `Search` 동작
3. search result table 에 실제 backend 데이터 표시
4. `Add to Selected` 후 selected table 표시 유지
5. `Selected Equipments` 의 `Eqp Param Version` dropdown 정상 로드
6. `Configuration & Deploy` 의 `New Model`, `New Model Version`, `Business Jar File` dropdown 정상 표시
7. `Deploy` 버튼은 여전히 local create 동작

주의:

이번 단계 검증에서 `Deploy` 이후 backend polling 은 확인 대상이 아닙니다.

─────────────────────────────
✅ 완료 조건
─────────────────────────────

front 1차 구현 완료 기준:

1. `Register` 의 search result 가 backend API 기반으로 표시됨
2. `Configuration` 옵션이 backend API 기반으로 표시됨
3. selected row 의 param version 목록이 backend API 기반으로 표시됨
4. 선택/추가/삭제/초기화 UX 는 기존과 동일하게 동작함
5. `Deploy` 버튼은 기존 local create 를 유지함
6. `pnpm lint`, `pnpm build` 기준 오류 없음

─────────────────────────────
⚠️ 리스크 및 주의사항
─────────────────────────────

1. `Selected Equipments` 는 검색 결과와 분리된 독립 상태여야 하므로,
   search result 배열만 믿고 렌더링하면 검색 조건 변경 시 row 정보가 사라질 수 있습니다.

2. `useEqpManageOptions` / `useEqpParamVersions` 를 deploy component 에서 직접 import 해도 되지만,
   deploy feature 내부에 래퍼 hook 을 두는 편이 구조상 더 깔끔합니다.

3. 이번 단계에서는 `POST /api/deploys` 를 붙이지 않으므로,
   `selectedModelVersionKey`, `selectedBusinessJarRef`, `selectedEqpParamVersions` 는
   아직 local create payload 에만 반영됩니다.

4. `deploy.mock.ts` 는 아직 `Deploy`, `History` 탭에서 쓰일 수 있으므로,
   register 관련 상수만 치환하고 성급히 전체 삭제하지 않는 것이 안전합니다.

─────────────────────────────
➡️ 다음 단계
─────────────────────────────

front 1차가 끝나면 다음 단계는 `backend/front 2차 구현` 입니다.

다음 단계에서 할 일:

1. `POST /api/deploys` 호출 추가
2. CSRF 처리 추가
3. `commonRequest.uiMessage` payload 매핑
4. `Deploy` 버튼 local create 제거
5. 성공 시 `Deploy` 모드 전환 + `deployKey` 반영
