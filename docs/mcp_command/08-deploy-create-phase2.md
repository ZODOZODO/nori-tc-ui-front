# Deploy Create Phase 2 Draft

이번 문서는 `/deploy` 의 `Register` 화면을 실제 deploy 생성 API와 연결하기 위한
**backend/front 2차 구현 문서 초안**입니다.

본 단계의 목적은 현재 frontend-only 상태인 `Deploy` 실행 버튼을
실제 backend 계약인 `POST /api/deploys` 와 연결하고,
성공 이후 `Deploy` 탭이 서버 응답 기준으로 동작하도록 전환하는 것입니다.

본 문서는 아래 선행 문서를 기준으로 합니다.

- [05-deploy-register-api-spec.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/05-deploy-register-api-spec.md)
- [06-deploy-register-backend-phase1.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/06-deploy-register-backend-phase1.md)
- [07-deploy-register-front-phase1.md](/home/donggeon/workspace_nori/nori-tc-ui-front/docs/mcp_command/07-deploy-register-front-phase1.md)

─────────────────────────────
📌 이번 단계 목표
─────────────────────────────

backend/front 2차 구현의 목표는 아래 5가지입니다.

1. `Register` 의 `Deploy` 버튼을 `POST /api/deploys` 와 연결
2. 성공 시 backend 가 반환한 `deployKey` 기준으로 `Deploy` 모드 전환
3. `Deploy` 탭의 summary / targets 를 `GET /api/deploys/{deployKey}` 및
   `GET /api/deploys/{deployKey}/targets` 로 조회
4. 상태 변경 요청에 필요한 CSRF 처리 추가
5. 실제 backend 계약에 맞는 request payload 매핑 규칙 확정

이 단계가 끝나면 `/deploy` 는 아래 상태가 됩니다.

1. `Register`
   - backend 조회 기반
   - backend 생성 기반

2. `Deploy`
   - 활성 deploy 1건에 대해서는 실제 서버 summary / targets 조회 가능

3. `Deploy_History`
   - 전체 기간 검색용 서버 API가 아직 없으므로 완전한 서버 연동은 아님
   - 필요 시 임시 bridge 상태 또는 phase 3 로 분리

─────────────────────────────
🚫 이번 단계 비목표
─────────────────────────────

이번 단계에서 하지 않을 것:

1. `Register` 조회 API 재설계
2. `GET /api/deploys/register/targets` 계약 재변경
3. Business Jar upload API 추가
4. `Deploy_History` 전체 기간 검색용 신규 backend API 추가
5. EQP / Model feature 구조 변경
6. deploy 도메인 전체 mock 즉시 완전 삭제

중요:

- 이번 단계의 핵심은 **create + active deploy polling 연결** 입니다.
- 전체 history 목록 / 기간 검색 API는 별도 단계로 분리하는 것이 안전합니다.

─────────────────────────────
🧭 현재 기준점
─────────────────────────────

현재 프론트는 `Deploy` 버튼 클릭 시 실제 backend 호출 대신
Zustand store 의 `createLocalDeploy(...)` 로 로컬 이력만 생성합니다.

관련 현재 구현:

1. [deploy-ui.store.ts](/home/donggeon/workspace_nori/nori-tc-ui-front/src/features/deploy/stores/deploy-ui.store.ts)
   - `createLocalDeploy`
   - `redeployLocalHistoryItem`
   - `localHistory`
   - `localTargetsByDeployKey`

2. [DeployRegisterPanel.tsx](/home/donggeon/workspace_nori/nori-tc-ui-front/src/features/deploy/components/DeployRegisterPanel.tsx)
   - `createLocalDeploy({ requestedBy: DEPLOY_CURRENT_USER.userId })` 호출

반면 backend 는 이미 아래 계약을 제공합니다.

1. `POST /api/deploys`
2. `GET /api/deploys/{deployKey}`
3. `GET /api/deploys/{deployKey}/targets`

즉, 이번 단계의 핵심은 **기존 local create 를 실제 server create 로 치환**하는 것입니다.

─────────────────────────────
🧱 권장 구현 경계
─────────────────────────────

## 핵심 아이디어

이번 단계는 backend 를 크게 뜯는 작업이 아니라,
기존 deploy 생성 계약을 front 가 정확히 사용하도록 만드는 작업입니다.

권장 경계는 아래와 같습니다.

1. backend
   - 가능하면 기존 `POST /api/deploys` / polling 계약을 그대로 사용
   - 추가 변경은 정말 필요한 경우에만 최소화

2. front
   - request payload 생성 책임을 명확히 가짐
   - 성공 시 `activeDeployKey` 를 실 서버 값으로 전환
   - `Deploy` 탭은 실 서버 summary / targets query 로 전환

즉, 2차 단계의 무게 중심은 **front 연동과 상태 전환** 에 있습니다.

─────────────────────────────
📁 예상 변경 파일
─────────────────────────────

## 필수 추가 파일

1. `src/features/deploy/api/deploy.api.ts`
2. `src/features/deploy/hooks/useCreateDeploy.ts`
3. `src/features/deploy/hooks/useDeploySummary.ts`
4. `src/features/deploy/hooks/useDeployTargets.ts`
5. `src/features/deploy/lib/deploy-query-keys.ts`

## 필수 수정 파일

1. `src/features/deploy/types/deploy.types.ts`
2. `src/features/deploy/stores/deploy-ui.store.ts`
3. `src/features/deploy/components/DeployRegisterPanel.tsx`
4. `src/features/deploy/components/DeployMonitorPanel.tsx`
5. 필요 시 `src/features/deploy/components/DeployHistoryPanel.tsx`
6. 필요 시 `src/features/deploy/mocks/deploy.mock.ts`

## backend 쪽 확인 또는 선택 수정 파일

1. `nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/controller/DeployController.java`
2. 필요 시 deploy create / summary / targets 관련 테스트 파일

중요:

- 기본 권장안은 **backend 신규 API 추가 없이** 진행입니다.
- 다만 실제 payload gap 이 발견되면 그때만 backend 쪽 최소 수정이 필요합니다.

─────────────────────────────
🗄 backend 2차 구현 권장안
─────────────────────────────

## 1. 우선 결론

이번 단계에서 backend 는 **반드시 새 API를 추가할 필요는 없습니다.**

이미 존재하는 계약:

1. `POST /api/deploys`
2. `GET /api/deploys/{deployKey}`
3. `GET /api/deploys/{deployKey}/targets`

현재 backend `DeployPlanningService` 기준으로
`EQP_BUSINESS_JARFILE_UPDATE` 에 필요한 최소 필드는 아래입니다.

1. `commonRequest.interfaceType`
2. `commonRequest.uiMessage.modelInfo.modelVersionKey`
3. `commonRequest.uiMessage.businessJar.jarRef`

즉, phase 1 조회 결과와 기존 `GET /api/eqp/options` 만으로도
**최소 create payload 는 충분히 구성 가능**합니다.

## 2. backend 에서 이번 단계에 꼭 확인할 것

1. `POST /api/deploys` 의 request / response 계약이 현재 테스트로 보장되는지 확인
2. `GET /api/deploys/{deployKey}` 와 `/targets` 가 프론트가 기대하는 필드를 안정적으로 내려주는지 확인
3. 인증 사용자 기반 actor 해석이 정상인지 확인

중요:

- `requestedBy` 는 프론트 request body 에 넣지 않습니다.
- backend 가 `Authentication` 에서 actor 를 해석합니다.

## 3. backend 에서 선택적으로 고려할 것

필수는 아니지만 아래 사항은 점검 가치가 있습니다.

1. create 직후 summary 조회가 너무 이르게 오면 `PLANNING` 상태만 보일 수 있는지 확인
2. error code / error message 가 UI 에 바로 노출 가능한 형태인지 확인
3. polling 응답 속도와 page size 기본값이 UI 기대와 맞는지 확인

## 4. backend 변경이 필요한 경우의 기준

아래 중 하나가 실제로 막히는 경우에만 backend 수정 검토:

1. 프론트가 반드시 보내야 하는 필드가 기존 조회 API에 없음
2. create 후 polling 응답만으로 화면 복원이 불가능함
3. 에러 응답이 계약적으로 불안정함

현재 확인 기준으로는 이번 단계에서 backend 의 필수 변경은 없어 보입니다.

─────────────────────────────
🧠 front 2차 구현 설계
─────────────────────────────

## 1. API 레이어 추가

신규 `deploy.api.ts` 를 만들고 아래 함수를 두는 것을 권장합니다.

1. `createDeploy(request)`
2. `getDeploySummary(deployKey)`
3. `getDeployTargets(deployKey, params)`

구현 패턴은 [eqp.api.ts](/home/donggeon/workspace_nori/nori-tc-ui-front/src/features/eqp/api/eqp.api.ts)
와 동일하게 가져가는 것이 좋습니다.

권장 공통 처리:

1. `issueCsrfToken()`
2. `withCsrfHeaders(...)`
3. `resolveSuccessPayload(...)`
4. `normalizeDeployError(...)`

즉, deploy 도 별도 axios 인스턴스를 만들지 말고
[api-client.ts](/home/donggeon/workspace_nori/nori-tc-ui-front/src/shared/lib/api-client.ts) 를 재사용합니다.

## 2. Query / Mutation 구성

권장 hook:

1. `useCreateDeploy`
   - `POST /api/deploys`
   - `useMutation`

2. `useDeploySummary`
   - `GET /api/deploys/{deployKey}`
   - `useQuery`

3. `useDeployTargets`
   - `GET /api/deploys/{deployKey}/targets`
   - `useQuery`

권장 polling 규칙:

1. `Deploy` 탭에서만 활성화
2. `deployStatus.terminal !== true` 인 동안만 polling
3. 권장 interval
   - summary: `3000ms`
   - targets: `3000ms ~ 5000ms`

최소 구현은 create 성공 후 1회 조회만으로도 가능하지만,
실사용성을 생각하면 polling 까지 한 번에 넣는 편이 낫습니다.

## 3. store 경계 정리

이번 단계 이후에도 Zustand 에 남길 상태:

1. `mode`
2. `activeDeployKey`
3. `selectedEqpIds`
4. `selectedEqpParamVersions`
5. `selectedModelName`
6. `selectedModelVersionKey`
7. `selectedBusinessJarRef`
8. `selectedInterfaceType`
9. `registerFilters`
10. `monitorFilters`

이번 단계에서 약화되거나 제거되는 로컬 책임:

1. `createLocalDeploy`
2. `activeDeployKey` 생성 책임

권장 방향:

1. `createLocalDeploy` 는 더 이상 `Deploy` 버튼의 주 경로로 사용하지 않음
2. create 성공 시 backend 가 준 `deployKey` 를 `setActiveDeployKey(...)` 로 저장
3. `setMode('deploy')` 로 전환

## 4. local history bridge 전략

`Deploy_History` 전체를 서버 기반으로 바꾸는 API는 아직 없으므로,
이번 단계에서는 아래 중 하나를 선택해야 합니다.

### 권장안

1. `Deploy` 탭만 서버 기반으로 전환
2. `Deploy_History` 는 현재 local/mock 기반을 유지
3. 단, create 성공한 실제 deploy 는 필요 시 local bridge entry 로만 추가

이때 주의:

- **가짜 deployKey 를 생성하면 안 됩니다.**
- local bridge entry 를 추가하더라도 반드시 backend 가 반환한 `deployKey` 를 그대로 사용해야 합니다.

### 더 단순한 대안

1. `Deploy_History` 는 이번 단계에서 변하지 않음
2. create 성공 후에도 history 목록에는 자동 반영하지 않음
3. 사용자는 `Deploy` 탭에서 현재 실행건만 확인

1차 연결로는 이 방식도 충분히 현실적입니다.

─────────────────────────────
🔑 Request Payload 매핑 규칙
─────────────────────────────

## 1. request body 구조

backend request DTO 기준:

```ts
interface DeployCreateRequest {
  deployName: string
  eventType: string
  executionPolicy?: string
  commonRequest: {
    interfaceType: string
    uiMessage: Record<string, unknown>
  }
  targets: Array<{
    eqpId: string
    uiMessageOverride?: Record<string, unknown> | null
  }>
}
```

## 2. UI 상태 → request 필드 매핑

| UI 상태 | request 매핑 | 권장 규칙 |
|------|------|------|
| `selectedEqpIds` | `targets[].eqpId` | 선택된 설비 순서 그대로 사용 |
| `selectedInterfaceType` | `commonRequest.interfaceType` | `null` 이면 요청 차단 |
| `selectedModelVersionKey` | `commonRequest.uiMessage.modelInfo.modelVersionKey` | 필수 |
| 선택된 model option 의 `modelKey` | `commonRequest.uiMessage.modelInfo.modelKey` | 가능하면 포함 |
| 선택된 model option 의 `modelVersion` | `commonRequest.uiMessage.modelInfo.modelVersion` | 가능하면 포함 |
| 선택된 model option 의 `modelName` | `commonRequest.uiMessage.modelInfo.modelName` | 선택적 포함 |
| `selectedBusinessJarRef` | `commonRequest.uiMessage.businessJar.jarRef` | 필수 |
| 선택된 jar option 의 `jarFileName` | `commonRequest.uiMessage.businessJar.jarFileName` | 가능하면 포함 |
| row 별 `selectedEqpParamVersions[eqpId]` | `targets[].uiMessageOverride.eqpParams.version` | 선택적 포함 |

## 3. eventType / executionPolicy 규칙

이번 단계 권장 고정값:

1. `eventType = "EQP_BUSINESS_JARFILE_UPDATE"`
2. `executionPolicy = "BEST_EFFORT"`

현재 UI 에 별도 선택 UI 가 없으므로,
2차 구현에서도 일단 고정값으로 두는 것이 자연스럽습니다.

## 4. deployName 규칙

현재 UI 에 deployName 입력창이 없으므로 자동 생성 규칙이 필요합니다.

권장안:

```text
{modelName} {modelVersion} Business Jar Update
```

fallback 권장안:

```text
Deploy {yyyy-MM-dd HH:mm:ss}
```

즉, 사람이 history 에서 봐도 알아볼 수 있는 deterministic name 이 좋습니다.

## 5. mixed interface 차단 규칙

현재 store 는 선택 설비들의 interface 가 섞이면 `selectedInterfaceType = null` 이 됩니다.

`POST /api/deploys` 는 `commonRequest.interfaceType` 이 필수이므로,
아래 규칙을 반드시 넣어야 합니다.

1. 서로 다른 interface 타입이 섞여 있으면 `Deploy` 버튼 비활성화 또는 요청 차단
2. UI 메시지 예시:
   - `서로 다른 Interface 의 설비는 한 번에 Deploy 할 수 없습니다.`

이 규칙은 create 직전 프론트에서 명확히 막는 것이 좋습니다.

─────────────────────────────
🧾 Payload 예시
─────────────────────────────

권장 payload 예시:

```json
{
  "deployName": "PhotoCell-A v2.4 Business Jar Update",
  "eventType": "EQP_BUSINESS_JARFILE_UPDATE",
  "executionPolicy": "BEST_EFFORT",
  "commonRequest": {
    "interfaceType": "SOCKET",
    "uiMessage": {
      "modelInfo": {
        "modelVersionKey": 2401,
        "modelKey": 500,
        "modelName": "PhotoCell-A",
        "modelVersion": "v2.4"
      },
      "businessJar": {
        "jarRef": 9001,
        "jarFileName": "photo-business-v2.jar"
      }
    }
  },
  "targets": [
    {
      "eqpId": "PHOTO-01",
      "uiMessageOverride": {
        "eqpParams": {
          "version": "p2.4.1"
        }
      }
    },
    {
      "eqpId": "PHOTO-02",
      "uiMessageOverride": {
        "eqpParams": {
          "version": "p2.4.3"
        }
      }
    }
  ]
}
```

중요:

- planner 기준 최소 필수는 `modelVersionKey`, `jarRef`, `interfaceType` 입니다.
- `modelKey`, `modelName`, `modelVersion`, `jarFileName` 은 권장 포함값입니다.
- `eqpParams.version` 은 row 별 override 가 필요할 때만 넣어도 됩니다.

─────────────────────────────
⚠️ 타입 정리 포인트
─────────────────────────────

현재 프론트의 [deploy.types.ts](/home/donggeon/workspace_nori/nori-tc-ui-front/src/features/deploy/types/deploy.types.ts)
에는 mock 기반 타입이 일부 남아 있습니다.

대표적으로 `DeployJarOption` 은 현재 아래 필드를 요구합니다.

1. `jarRef`
2. `jarFileName`
3. `sourceType`
4. `expectedSha256`

하지만 backend `GET /api/eqp/options` 의 `businessJarOptions` 는 현재 아래만 제공합니다.

1. `jarRef`
2. `jarFileName`

따라서 2차 구현 전에 아래 중 하나가 필요합니다.

### 권장안

`DeployJarOption` 을 backend 계약 기준으로 재정의하고,
mock 전용 필드는 optional 로 낮춥니다.

예:

```ts
export interface DeployJarOption {
  jarRef: number
  jarFileName: string
  sourceType?: 'DB' | (string & {})
  expectedSha256?: string
}
```

이렇게 해야 phase 1 / phase 2 데이터를 같은 타입 계층에서 다룰 수 있습니다.

─────────────────────────────
🖥 화면 전환 규칙
─────────────────────────────

## Register → Deploy 전환

권장 흐름:

1. 사용자가 `Deploy` 클릭
2. 프론트 validation 수행
3. `createDeploy.mutate(requestBody)`
4. 성공 시
   - `setActiveDeployKey(response.deployKey)`
   - `setMode('deploy')`
5. `DeployMonitorPanel` 에서 `activeDeployKey` 기준 summary / targets query 실행

## 실패 시 처리

실패 시 권장 처리:

1. mode 전환하지 않음
2. 현재 선택 상태 유지
3. backend error message 를 사용자 메시지로 노출
4. 버튼 로딩 상태 해제

─────────────────────────────
🧯 에러 처리 권장안
─────────────────────────────

`Deploy` 생성은 상태 변경 요청이므로, 아래 에러 케이스를 명확히 다뤄야 합니다.

1. CSRF 토큰 누락
   - `CSRF 토큰을 확인할 수 없습니다. 페이지를 새로고침한 후 다시 시도해 주세요.`

2. 혼합 interface 선택
   - `서로 다른 Interface 의 설비는 한 번에 Deploy 할 수 없습니다.`

3. 필수 선택값 누락
   - `설비, 새 Model Version, Business Jar File 을 모두 선택해 주세요.`

4. backend validation error
   - backend `errorMsg` 우선 노출

5. create 후 summary polling 실패
   - deploy create 성공 자체는 유지
   - `Deploy 정보 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.` 별도 노출

─────────────────────────────
✅ 완료 조건
─────────────────────────────

이번 단계 완료 조건은 아래와 같습니다.

1. `Register` 에서 선택한 설비/모델/jar 기준으로 `POST /api/deploys` 호출 가능
2. 혼합 interface 선택 시 create 요청이 차단됨
3. create 성공 시 backend 가 준 실제 `deployKey` 로 `Deploy` 탭 전환
4. `Deploy` 탭에서 summary / targets 가 실제 서버 응답으로 보임
5. summary / targets 는 terminal 상태 전까지 polling 가능
6. create 실패 시 기존 선택 상태와 입력값이 유지됨

─────────────────────────────
🧪 검증 포인트
─────────────────────────────

## backend

1. `./gradlew test`
2. `DeployController` create / summary / targets 테스트 확인
3. planner validation 관련 테스트 확인

## front

1. `pnpm lint`
2. `pnpm build`

## 수동 확인

1. 같은 interface 의 설비만 선택하고 deploy 시 실제 `202 Accepted` 수신
2. mixed interface 선택 시 버튼 차단 또는 오류 안내 확인
3. 성공 직후 `Deploy` 탭 전환 확인
4. summary / targets polling 에 따라 상태가 갱신되는지 확인
5. create 실패 시 메시지와 선택 상태 유지 확인

─────────────────────────────
🔜 다음 단계 메모
─────────────────────────────

이번 단계가 끝나도 아래는 별도 후속 과제로 남습니다.

1. `Deploy_History` 전체 기간 검색용 backend list API
2. history 전면 서버 연동
3. deploy 재실행(`Redeploy`) 서버 연동 규칙
4. deploy cancel / retry / popupRequired 처리 정교화

즉, 이번 2차 단계의 끝은 **create + active deploy monitoring 완성** 이고,
history 전체 서버 연동은 그 다음 단계로 분리하는 것이 좋습니다.
