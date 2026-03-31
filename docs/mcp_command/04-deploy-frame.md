Pencil MCP, Serena MCP 를 사용해서 아래의 요청사항을 진행해줘.

Pencil MCP 작업 요청:

1. Pencil 캔버스에서 `design.pen` 의 아래 2개 Frame을 읽고, 해당 디자인(레이아웃/여백/타이포/색/컴포넌트 구성 등)을 최대한 유지한 React 컴포넌트로 변환해 주세요.
   - `Deploy Frame`
   - `Deploy Frame - Register`
2. 변환 결과는 "현재 백엔드 API 계약 기준으로 구현 가능한 완전한 Deploy 페이지"여야 합니다.
3. 아래 기술/규칙을 반드시 준수하고, 기존 프로젝트 설정(Foundation)은 임의로 변경하지 마세요. (필요한 import/route 추가만)
4. 기존에 작성된 EQP / Model / Profile 구현을 우선 재사용하고, 유사한 UI 패턴이 반복되면 최소 범위에서 공통화해 중복 구현을 피하세요.

─────────────────────────────
📁 생성/수정할 파일 목록 (필수)
─────────────────────────────

1. `src/features/deploy/types/deploy.types.ts`
2. `src/features/deploy/api/deploy.api.ts`
3. `src/features/deploy/hooks/useCreateDeploy.ts`
4. `src/features/deploy/hooks/useDeploySummary.ts`
5. `src/features/deploy/hooks/useDeployTargets.ts`
6. `src/features/deploy/stores/deploy-ui.store.ts`
7. `src/features/deploy/components/DeployPage.tsx`
8. `src/features/deploy/components/DeploySidebar.tsx`
9. `src/features/deploy/components/DeployRegisterPanel.tsx`
10. `src/features/deploy/components/DeployMonitorPanel.tsx`
11. `src/features/deploy/components/DeployHistoryPanel.tsx`
12. `src/app/Router.tsx` (기존 스타일 유지, 최소 변경)
13. (선택) 공통 추상화가 필요하면 기존 공통 컴포넌트 위치 또는 `src/shared/components` 하위에 최소 범위로 추가

─────────────────────────────
🔌 API 스펙 (백엔드 구현 기준)
─────────────────────────────

### POST `/api/deploys` — Deploy 생성 및 background execution 시작

- Request Body:
```json
{
  "deployName": "PHOTO Business Jar Update",
  "eventType": "EQP_BUSINESS_JARFILE_UPDATE",
  "executionPolicy": "BEST_EFFORT",
  "commonRequest": {
    "interfaceType": "SOCKET",
    "uiMessage": {
      "modelInfo": {
        "modelVersionKey": 1001,
        "modelKey": 500,
        "modelVersion": "v1"
      },
      "businessJar": {
        "jarRef": 9002,
        "jarFileName": "next-business.jar",
        "expectedSha256": "next-sha",
        "sourceType": "DB"
      }
    }
  },
  "targets": [
    {
      "eqpId": "PHOTO_001",
      "uiMessageOverride": {}
    }
  ]
}
```

- Success Response (202):
```json
{
  "success": true,
  "data": {
    "deployKey": 1001,
    "deployStatus": "RUNNING",
    "polling": {
      "summaryUrl": "/api/deploys/1001",
      "targetsUrl": "/api/deploys/1001/targets"
    },
    "resultCode": "DEPLOY_ACCEPTED",
    "resultMessage": {
      "title": "작업이 접수되었습니다.",
      "message": "설비 2대에 대한 작업이 등록되었습니다.",
      "severity": "INFO"
    }
  },
  "errorCode": null,
  "errorMsg": null
}
```

- 중요 계약:
1. 모든 응답은 `ApiResponse<T>` 래퍼(`success/data/errorCode/errorMsg`)를 사용합니다.
2. `executionPolicy` 가 null/blank 이면 서버가 `BEST_EFFORT` 로 보정합니다.
3. `targets` 는 1건 이상이어야 하며, 현재 기본 설정 기준 최대 100건입니다.
4. `uiMessage` 는 반드시 JSON object 여야 합니다.
5. 현재 `Deploy Frame - Register` 디자인과 가장 정합성이 높은 1차 구현 eventType 은 `EQP_BUSINESS_JARFILE_UPDATE` 입니다.
6. `commonRequest.interfaceType` 는 단일 값이므로, 선택 가능한 target EQP 는 동일 `commInterface` 집합으로 제한해야 합니다.
7. design.pen 에 `deployName` 입력 필드가 없으므로, 프론트는 `deployName` 을 자동 생성해야 합니다.
   - 예: `${modelName} ${modelVersion} Business Jar Update`
8. design.pen 에 `executionPolicy` 선택 UI가 없으므로, 1차 구현은 `BEST_EFFORT` 고정 또는 생략(서버 기본값 사용)으로 처리합니다.
9. design.pen 에 target별 override UI가 없으므로, `targets[].uiMessageOverride` 는 기본적으로 빈 object `{}` 를 전송합니다.
10. 모든 target 이 `NO_CHANGE` 인 경우에도 HTTP 202 로 응답될 수 있으며, body 의 `deployStatus` 가 즉시 `COMPLETED` 일 수 있습니다.

### GET `/api/deploys/{deployKey}` — Deploy summary polling

- Path Variable: `deployKey`
- Success Response (200):
```json
{
  "success": true,
  "data": {
    "deployKey": 1001,
    "deployName": "PHOTO Update",
    "eventType": "EQP_UPDATE",
    "deployStatus": "RUNNING",
    "executionPolicy": "BEST_EFFORT",
    "createdAt": "2026-03-28T05:30:00Z",
    "startedAt": "2026-03-28T05:30:01Z",
    "finishedAt": null,
    "targetSummary": {
      "total": 10,
      "pending": 1,
      "noChange": 0,
      "running": 2,
      "completed": 7,
      "failed": 0,
      "rollingBack": 0,
      "rolledBack": 0,
      "compensationFailed": 0,
      "canceled": 0
    },
    "terminal": false,
    "popupRequired": false,
    "resultCode": "DEPLOY_RUNNING",
    "resultMessage": {
      "title": "설비 변경 작업 진행 중",
      "message": "10대 중 7대 완료, 2대 진행 중입니다.",
      "severity": "INFO"
    }
  },
  "errorCode": null,
  "errorMsg": null
}
```

- `deployStatus` enum:
  - `PLANNING`
  - `READY`
  - `RUNNING`
  - `COMPLETED`
  - `PARTIAL_FAILED`
  - `FAILED`
  - `CANCELED`

### GET `/api/deploys/{deployKey}/targets` — Deploy target 목록 polling

- Query Params:
  - `page` (기본 0)
  - `size` (기본 50, 최대 200)
  - `status` (선택)
  - `eqpId` (선택)

- Success Response (200):
```json
{
  "success": true,
  "data": {
    "deployKey": 1001,
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1,
    "targets": [
      {
        "deployTargetKey": 2001,
        "eqpId": "PHOTO_001",
        "targetStatus": "FAILED",
        "currentStepOrder": 10,
        "currentStepCode": "SEND_MESSAGE",
        "currentStepStatus": "FAILED",
        "rollbackRequired": false,
        "lastErrorCode": "SEND_MESSAGE_FAILED",
        "lastErrorMessage": "설비 메시지 송신에 실패했습니다.",
        "updatedAt": "2026-03-28T05:31:10Z"
      }
    ]
  },
  "errorCode": null,
  "errorMsg": null
}
```

- `targetStatus` enum:
  - `PENDING`
  - `NO_CHANGE`
  - `RUNNING`
  - `COMPLETED`
  - `FAILED`
  - `ROLLING_BACK`
  - `ROLLED_BACK`
  - `COMPENSATION_FAILED`
  - `CANCELED`

- `currentStepStatus` enum:
  - `PENDING`
  - `SKIPPED`
  - `RUNNING`
  - `WAITING_REPLY`
  - `COMPLETED`
  - `FAILED`
  - `ROLLING_BACK`
  - `ROLLED_BACK`
  - `COMPENSATION_FAILED`
  - `CANCELED`

### 공통 실패 응답

- 400: `INVALID_REQUEST`
  - 예: `eventType is required`
  - 예: `Unsupported eventType: ...`
  - 예: `targets는 1건 이상이어야 합니다.`
  - 예: `size는 200 이하여야 합니다.`
- 404: `NOT_FOUND`
  - 예: `deploy를 찾을 수 없습니다. deployKey=...`
  - 예: `설비를 찾을 수 없습니다. eqpId=...`
- 409: `CONFLICT`
  - 예: `이미 등록된 설비입니다. eqpId=...`
- 500: `INTERNAL_ERROR`
  - 예: `요청 처리 중 내부 오류가 발생했습니다.`

### 현재 공개 API 기준에서 추가로 재사용 가능한 기존 엔드포인트

1. `GET /api/eqp`
   - target EQP 목록 조회용
2. `GET /api/eqp/options`
   - model / jar select 옵션 재사용용
3. `GET /api/model`
   - model version 보강 표시용
4. `GET /api/auth/me`, `GET /api/user/{userPk}`, `PUT /api/user/{userPk}`
   - TopBar 프로필 모달 재사용용

### 현재 백엔드 계약상 없는 것들 (중요)

1. `GET /api/deploys` 형태의 deploy 목록/검색 API는 아직 공개되어 있지 않습니다.
2. `Business Jar File` 옆 `Upload` 버튼에 대응하는 JAR 업로드 REST API는 아직 공개되어 있지 않습니다.
3. `Deploy_History` 전용 별도 REST API도 아직 없습니다.

따라서 1차 구현에서는 아래 원칙을 따르세요.

1. `Deploy` / `Deploy_History` 리스트는 프론트 로컬 상태(Zustand/session 메모리)로 관리하고, `POST /api/deploys` 성공 후 받은 `deployKey` 와 polling snapshot 을 누적해서 화면을 구성하세요.
2. `Upload` 버튼은 임의 API를 만들지 말고, 비활성화 또는 "추후 연동 예정" 안내 상태로 처리하세요.
3. 전용 목록 API가 추가되면 교체할 수 있도록 `DeployMonitorPanel` / `DeployHistoryPanel` 의 데이터 소스를 훅 단위로 분리하세요.

─────────────────────────────
🛡 CSRF 계약 (필수)
─────────────────────────────

1. `POST /api/deploys` 호출 전에 `GET /api/auth/csrf` 로 CSRF 쿠키(`XSRF-TOKEN`)를 확보하세요.
2. 상태 변경 요청 시 `X-XSRF-TOKEN` 헤더에 쿠키 값을 넣어 전송하세요.
3. API 클라이언트는 반드시 `src/shared/lib/api-client.ts` 의 `apiClient` 를 사용하세요.
4. CSRF 처리 방식은 기존 `src/features/eqp/api/eqp.api.ts` 의 패턴과 일관성 있게 맞추세요.

─────────────────────────────
🛠 기술 요구사항 (필수)
─────────────────────────────

- 언어: TypeScript (`.ts/.tsx`), UTF-8
- 스타일: Tailwind CSS v4
- UI: shadcn/ui 우선 (`Table`, `Button`, `Input`, `Select`, `Badge`, `Dialog` 계열)
- 서버 상태/요청: TanStack Query v5 (`useQuery`, `useMutation`)
- 상태 관리: Zustand (`sidebar mode`, `selectedEqpIds`, `activeDeployKey`, `local deploy history`)
- API 클라이언트: 반드시 `src/shared/lib/api-client.ts` 의 `apiClient` 사용
- 기존 구현 재사용 우선:
  1. `useEqpList`
  2. `useEqpManageOptions`
  3. `useModelList`
  4. `UserProfileModal`
  5. TopBar / dropdown / table / button 패턴

─────────────────────────────
🗂 페이지 레이아웃 (design.pen 기준)
─────────────────────────────

### 전체 구조 (`Deploy Frame`, `Deploy Frame - Register` 공통)

- 전체 Frame: 1440x900 ~ 1440x902
- 상단 헤더(TopBar, 높이 52px): `ECnVQ` ref 기준
  - 좌측: `NORI` 로고
  - 중앙: 메뉴 (`Eqp / Model / Deploy / Dlq / User`)
  - 우측: 사용자 프로필 아이콘
- 헤더 아래 구분선(NavBorder, 1px)
- 본문 영역:
  - 좌측 Sidebar: 240px
  - SidebarBorder: 1px
  - 우측 MainContent: fill

### DeploySidebar (좌측 내부 Sidebar)

design.pen 기준 Sidebar 항목:

1. 루트 제목: `▾ Deploy`
2. 하위 메뉴:
   - `Register`
   - `Deploy`
   - `Deploy_History`
3. 1차 구현 권장:
   - 라우트는 `/deploy` 단일 route 유지
   - 내부 모드(state)로 `register | deploy | history` 전환
4. 주의:
   - 현재 design.pen 에는 `Deploy_History` 전용 top-level frame가 없습니다.
   - 따라서 `Deploy_History` 는 `Deploy` 와 같은 shell/layout 을 재사용하고, 문구/데이터만 history 중심으로 바꾸세요.

### Deploy Frame (`Deploy` 모드)

확인된 디자인 요소:

1. 상단 검색 카드
   - 필드: `Model`, `User`, `기간`
   - 액션: `Search`, `Clear`
2. 메인 테이블 카드
   - design.pen 내부 노드명은 `UserInfoPanel` / `UserInfoHead` 이지만, 이는 deploy 도메인과 불일치하는 placeholder 성격입니다.
   - 구현 시에는 **카드 스타일 / 헤더 높이 / 행 높이 / 테이블 톤은 유지**하되, 컬럼/데이터는 deploy 도메인에 맞춰 재구성하세요.
3. 별도 loose node 로 존재하는 보조 카드
   - `DeployInfoSection`
   - `RecentHistorySection`
   - 필요 시 `Deploy` 모드 상단 요약 카드로 재배치 가능

### Deploy 모드의 데이터 표현 원칙

현재 백엔드에는 deploy 목록 API가 없으므로, 아래 기준으로 구성하세요.

1. 상단 검색 카드
   - 프론트 로컬 히스토리 배열에 대해 `model / user / 기간` 필터 수행
2. 메인 테이블 카드
   - 컬럼 예시:
     - `Deploy Name`
     - `Event Type`
     - `Status`
     - `Target Count`
     - `Completed`
     - `Failed`
     - `Requested By`
     - `Created At`
   - 데이터 소스:
     - `POST /api/deploys` 성공 후 저장한 로컬 history
     - active deploy 가 있으면 `GET /api/deploys/{deployKey}` polling 결과로 실시간 갱신
3. 행 클릭 시
   - active `deployKey` 를 선택하고 하단 또는 같은 카드 내부에서 target polling 결과를 보여주세요.

### Deploy Frame - Register (`Register` 모드)

MainContent 는 padding 24, 세로 gap 24 기준이며 다음 3개 섹션으로 구성됩니다.

1. **Target Equipment Search**
   - 카드 높이 352
   - 검색 행:
     - `Model` select
     - `Model Version` select
     - `Eqp ID` select
     - `Search`
     - `Clear`
   - 검색 결과 테이블 컬럼:
     - `Eqp ID`
     - `Model`
     - `Model Version / Status`
   - 테이블 아래 중앙 액션:
     - `Add to Selected`

2. **Selected Equipments**
   - 카드 fill height
   - 선택 테이블 컬럼:
     - `Eqp ID`
     - `Model`
     - `Selected Version`
   - `Selected Version` 표시는 아래 규칙을 따릅니다.
     - 기본: 현재 선택된 model version 또는 현재 EQP 바인딩 version
     - `New Model Version` 선택 후: 배포 예정 version 으로 갱신

3. **Configuration & Deploy**
   - 헤더 좌측: `Configuration & Deploy`
   - 헤더 우측 버튼:
     - `Deploy`
     - `Clear`
   - 설정 행:
     - `New Model`
     - `New Model Version`
     - `Business Jar File` select + `Upload` 버튼

### Register 모드의 설계 해석 (중요)

현재 디자인과 백엔드 계약을 함께 보면 다음 해석이 가장 정합적입니다.

1. 이 화면은 1차적으로 `EQP_BUSINESS_JARFILE_UPDATE` deploy 등록 화면으로 구현합니다.
2. `New Model` + `New Model Version` + `Business Jar File` 은 모두 **공통 요청(commonRequest)** 영역에 들어갑니다.
3. 선택된 EQP 들은 모두 동일 `commInterface` 여야 하므로, 처음 선택된 EQP 와 다른 protocol 의 설비는 선택 불가 처리하세요.
4. `Business Jar File` 의 `Upload` 버튼은 현재 백엔드 업로드 계약이 없으므로 비활성화 또는 안내 tooltip 상태로만 둡니다.

### User Profile Modal

- 기존 `UserProfileModal` 구현을 그대로 재사용하세요.
- TopBar 우측 프로필 아이콘 클릭 시 오픈
- `Deploy` / `Register` / `History` 어느 모드에서도 동일하게 동작

─────────────────────────────
📐 반응형 요구사항 (필수)
─────────────────────────────

- 전체 페이지: `min-h-screen + w-screen`
- Sidebar: 기본 240px
- MainContent 카드: `overflow-x-auto` 가능해야 함
- 테이블 컬럼이 많아질 수 있으므로 horizontal scroll 허용
- 데스크탑 우선 레이아웃 유지, 모바일에서도 레이아웃이 깨지지 않도록 최소 너비 보장

─────────────────────────────
🔗 라우터 변경 (필수)
─────────────────────────────

- `/deploy` → `DeployPage`
- `/eqp`, `/model`, `/login` 기존 라우트 유지
- `/` 접근 시 `/login` 리다이렉트 유지
- 기존 `Router` 구현 방식(`Routes/Route`) 유지
- 임의의 `/deploy/register`, `/deploy/history` 라우트는 만들지 말고, 1차 구현은 `/deploy` 단일 route + 내부 sidebar state 로 처리

─────────────────────────────
📌 구현 디테일 요구 (필수)
─────────────────────────────

1. **`deploy.types.ts`**
   - `DeployEventType`
     - `EQP_CREATE`
     - `EQP_UPDATE`
     - `EQP_DELETE`
     - `EQP_START`
     - `EQP_END`
     - `EQP_SEND_MESSAGE`
     - `EQP_RECONNECT`
     - `EQP_PARAMETER_UPDATE`
     - `EQP_GATEWAY_JARFILE_UPDATE`
     - `EQP_BUSINESS_JARFILE_UPDATE`
   - `DeployExecutionPolicy`
     - `BEST_EFFORT`
     - `FAIL_FAST`
   - `DeployStatus`, `DeployTargetStatus`, `DeployStepStatus`
   - `DeployCreateRequest`
   - `DeployCreateResponse`
   - `DeploySummary`
   - `DeployTargetPage`
   - `DeployResultMessage`
   - `ApiResponse<T>` 는 기존 auth/types 와 일관성 유지
   - 로컬 history item 타입 포함

2. **`deploy.api.ts`**
   - `createDeploy(request): POST /api/deploys`
   - `getDeploySummary(deployKey): GET /api/deploys/{deployKey}`
   - `getDeployTargets(deployKey, params): GET /api/deploys/{deployKey}/targets`
   - `apiClient` 사용
   - `withCredentials` 유지
   - CSRF 헤더 처리 적용
   - 성공/실패 응답 파싱 분리

3. **`useCreateDeploy.ts`**
   - TanStack Query `useMutation`
   - 성공 시 `deployKey`, `deployStatus`, `polling` URL 을 소비 가능한 형태로 반환
   - `deployStatus === COMPLETED` 인 즉시 완료 케이스도 처리

4. **`useDeploySummary.ts`**
   - TanStack Query `useQuery`
   - `queryKey: ['deploy', 'summary', deployKey]`
   - `enabled: deployKey 있을 때만`
   - polling 주기 옵션(`refetchInterval`) 사용 가능하게 구성

5. **`useDeployTargets.ts`**
   - TanStack Query `useQuery`
   - `queryKey: ['deploy', 'targets', deployKey, page, size, status, eqpId]`
   - 기본 page 0 / size 50
   - size > 200 요청 금지

6. **`deploy-ui.store.ts`**
   - `mode: 'register' | 'deploy' | 'history'`
   - `selectedEqpIds`
   - `selectedInterfaceType`
   - `activeDeployKey`
   - `localHistory`
   - `registerFilters`
   - `monitorFilters`
   - `selectedModelVersionKey`
   - `selectedBusinessJarRef`
   - `isProfileModalOpen`

7. **`DeploySidebar.tsx`**
   - design.pen Sidebar 톤 유지
   - `Register / Deploy / Deploy_History` 전환
   - active item 강조

8. **`DeployRegisterPanel.tsx`**
   - `Target Equipment Search` / `Selected Equipments` / `Configuration & Deploy` 3개 카드를 조합
   - 기존 `useEqpList`, `useEqpManageOptions`, `useModelList` 재사용
   - Search 결과는 `/api/eqp` 데이터 기반으로 필터링
   - 선택 EQP 는 동일 `commInterface` 만 허용
   - `Deploy` 클릭 시 아래 규칙으로 request 생성
     1. `eventType = EQP_BUSINESS_JARFILE_UPDATE`
     2. `executionPolicy = BEST_EFFORT` 또는 생략
     3. `deployName` 자동 생성
     4. `commonRequest.interfaceType = selectedInterfaceType`
     5. `commonRequest.uiMessage.modelInfo.modelVersionKey` 채움
     6. `commonRequest.uiMessage.businessJar.jarRef` 채움
     7. `targets = selectedEqpIds.map(eqpId => ({ eqpId, uiMessageOverride: {} }))`

9. **`DeployMonitorPanel.tsx`**
   - `Deploy Frame` 디자인 shell 재현
   - 상단 검색 카드 + deploy 리스트 카드
   - active deploy 선택 시 summary / target table 표시
   - target table 컬럼:
     - `Eqp ID`
     - `Target Status`
     - `Current Step`
     - `Step Status`
     - `Rollback Required`
     - `Last Error`
     - `Updated At`
   - target status 는 Badge 로 표시

10. **`DeployHistoryPanel.tsx`**
    - `Deploy` 와 동일한 shell 재사용
    - terminal status(`COMPLETED`, `PARTIAL_FAILED`, `FAILED`, `CANCELED`) 위주 필터링
    - 현재는 전용 API가 없으므로 로컬 history 데이터 기반

11. **`DeployPage.tsx`**
    - TopBar + DeploySidebar + mode별 panel + `UserProfileModal`
    - 첫 진입 기본 모드는 `register` 또는 `deploy` 중 하나를 명시적으로 선택
      - 권장: 디자인상 실제 등록 플로우가 구체적이므로 `register`
    - create 성공 후:
      1. 로컬 history 에 item 추가
      2. `activeDeployKey` 저장
      3. 필요 시 `deploy` 모드로 자동 전환
      4. summary/targets polling 시작
    - summary 가 terminal 이고 `popupRequired=true` 이면 완료 토스트/배지/상태 표시 갱신

12. **기존 컴포넌트 재사용/공통화**
    - `UserProfileModal` 그대로 재사용
    - button/input/table/badge 는 기존 shadcn/ui 래퍼 사용
    - CSRF 처리 로직은 기존 `eqp.api.ts` 패턴 재사용
    - EQP/Model 쪽 훅을 중복 작성하지 말고 기존 훅 활용

─────────────────────────────
✅ 완료 기준(DoD) (필수)
─────────────────────────────

- `pnpm dev` 실행 시:
1. TypeScript 컴파일 에러 0
2. 런타임 에러 0
3. 로그인 후 `/deploy` 라우트 진입 가능
4. 좌측 Sidebar 의 `Register / Deploy / Deploy_History` 모드 전환 정상
5. `Register` 모드에서 `Target Equipment Search / Selected Equipments / Configuration & Deploy` 3개 섹션이 design.pen 레이아웃에 맞게 표시
6. Search 필드(`Model / Model Version / Eqp ID`)와 `Search / Clear` 동작 정상
7. 선택 target EQP 는 동일 `commInterface` 만 허용
8. `New Model / New Model Version / Business Jar File` 옵션이 기존 API(`/api/eqp/options`, `/api/model`) 재사용으로 로드
9. `Upload` 버튼은 임의 업로드 API 호출 없이 비활성화 또는 안내 상태로 처리
10. `Deploy` 클릭 시 `POST /api/deploys` 호출이 `apiClient + withCredentials + CSRF 헤더` 로 정상 전송
11. request body 가 `eventType=EQP_BUSINESS_JARFILE_UPDATE`, 자동 생성 `deployName`, 공통 `interfaceType`, `targets[].uiMessageOverride={}` 규칙을 만족
12. 생성 성공 후 `deployKey` 저장 및 summary/targets polling 시작
13. `deployStatus === COMPLETED` 즉시 완료 케이스도 UI에서 정상 처리
14. `Deploy` 모드에서 summary / target 상태 표시 정상
15. `Deploy_History` 모드에서 로컬 history 기반 필터/목록 표시 정상
16. base `Deploy Frame` 의 카드/테이블 시각 스타일은 유지하되, 도메인 데이터는 deploy 기준으로 재구성
17. TopBar 프로필 아이콘 클릭 시 `UserProfileModal` 정상 표시

