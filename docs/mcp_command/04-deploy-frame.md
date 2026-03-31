Pencil MCP, Serena MCP 를 사용해서 아래 요청사항을 진행해 주세요.

이번 작업은 `deploy 전용 backend API` 와 연결하지 않는 **frontend 1차 구현**입니다.
목표는 `design.pen` 의 deploy 화면 2개 frame을 기준으로, 실제 앱에서 동작하는 `/deploy` 화면을 먼저 만드는 것입니다.

핵심 원칙:

1. 이번 단계에서는 **Deploy 전용 API 호출을 구현하지 않습니다.**
2. 이번 단계에서는 **local mock data + Zustand 상태**로 화면과 상호작용을 완성합니다.
3. 화면 구조는 `Register / Deploy / Deploy_History` 3개 모드를 가지되, 라우트는 `/deploy` 하나만 사용합니다.
4. 디자인은 최대한 `design.pen` 을 따르되, 데이터는 deploy 도메인에 맞게 재구성합니다.
5. 이번 문서는 **UI 선구현용 명세**이며, deploy backend 연동은 다음 단계에서 별도 문서로 진행합니다.

─────────────────────────────
📌 이번 단계 목표
─────────────────────────────

`design.pen` 에서 읽을 기준 frame:

- `Deploy Frame`
- `Deploy Frame - Register`

이 두 frame을 바탕으로 아래 3개 모드를 구현합니다.

1. `Register`
2. `Deploy`
3. `Deploy_History`

주의:

- `Deploy_History` 는 `design.pen` 에 별도 top-level frame가 없습니다.
- 따라서 `Deploy Frame` 의 shell/layout 을 재사용해서 history 전용 모드로 구현합니다.

─────────────────────────────
🚫 비목표 (이번 단계에서 하지 않을 것)
─────────────────────────────

아래 항목은 **이번 단계 범위 밖**입니다.

1. `POST /api/deploys`
2. `GET /api/deploys/{deployKey}`
3. `GET /api/deploys/{deployKey}/targets`
4. deploy 생성 후 polling
5. CSRF 토큰 발급/헤더 처리
6. Business Jar 업로드 API 연동
7. deploy 목록/검색 API 연동
8. deploy history API 연동
9. deploy backend 응답 스펙에 맞춘 에러 처리

즉, 이번 단계는 다음 성격이어야 합니다.

- 화면이 실제 앱 안에서 보인다.
- 모드 전환이 된다.
- 검색/선택/추가/초기화 UI가 동작한다.
- Deploy 버튼 클릭 시 **로컬 상태 기준의 deploy 항목**이 생성된다.
- 생성된 항목이 `Deploy` / `Deploy_History` 모드에서 보인다.

─────────────────────────────
📁 생성/수정할 파일 목록 (필수)
─────────────────────────────

1. `src/features/deploy/types/deploy.types.ts`
2. `src/features/deploy/mocks/deploy.mock.ts`
3. `src/features/deploy/stores/deploy-ui.store.ts`
4. `src/features/deploy/components/DeployPage.tsx`
5. `src/features/deploy/components/DeploySidebar.tsx`
6. `src/features/deploy/components/DeployRegisterPanel.tsx`
7. `src/features/deploy/components/DeployMonitorPanel.tsx`
8. `src/features/deploy/components/DeployHistoryPanel.tsx`
9. `src/app/Router.tsx`
10. `src/features/eqp/components/EqpPage.tsx`
11. `src/features/model/components/ModelPage.tsx`
12. (선택) 최소 범위의 공통 추상화 파일

이번 단계에서 **만들지 않을 파일**:

- `src/features/deploy/api/deploy.api.ts`
- `src/features/deploy/hooks/useCreateDeploy.ts`
- `src/features/deploy/hooks/useDeploySummary.ts`
- `src/features/deploy/hooks/useDeployTargets.ts`

위 4개 파일은 deploy backend 연동을 시작하는 2차 단계에서 추가합니다.

─────────────────────────────
🛠 기술/구현 규칙
─────────────────────────────

- 언어: TypeScript (`.ts/.tsx`)
- 스타일: Tailwind CSS v4
- 상태 관리: Zustand
- UI 컴포넌트: 기존 shadcn/ui 래퍼 우선 사용
- 라우팅: 기존 `Routes/Route` 방식 유지
- 기존 Foundation 설정은 변경하지 않습니다.
- 필요 없는 리팩토링, 공통화, 구조 변경은 하지 않습니다.

재사용 원칙:

1. 기존 `EqpPage`, `ModelPage` 의 TopBar 시각 스타일을 우선 참고합니다.
2. 기존 `Button`, `Input`, `Select`, `Table`, `Badge` 패턴을 재사용합니다.
3. 기존 `UserProfileModal` 은 현재 앱 공통 동작이므로 기존 방식 재사용은 허용합니다.
4. 다만 이번 단계에서 deploy feature 때문에 **새로운 backend 의존 코드**를 추가하지는 않습니다.

중요:

- `useEqpList`, `useEqpManageOptions`, `useModelList` 같은 기존 훅은 backend 요청을 발생시킵니다.
- 이번 단계는 deploy feature를 **backend 비연동**으로 구현하는 것이 목적이므로,
  deploy 화면 내부 데이터는 `local mock data` 로 처리하세요.
- 즉, 기존 훅은 “UI 패턴 참고” 용도이고, deploy 1차 구현의 직접 데이터 소스로 강제하지 않습니다.

─────────────────────────────
🧱 화면 구조
─────────────────────────────

### 전체 구조 (`Deploy Frame`, `Deploy Frame - Register` 공통)

- 전체 페이지: `min-h-screen + w-screen`
- 상단 헤더: 높이 52px
- 헤더 아래 border 1px
- 본문:
  - 좌측 Sidebar: 240px
  - Sidebar border: 1px
  - 우측 MainContent: fill

### TopBar

`design.pen` 의 `ECnVQ` 기준 톤을 최대한 유지합니다.

- 좌측: `Nori-TC` 로고
- 중앙: `Eqp / Model / Deploy / Dlq / User`
- 우측: 로그아웃 버튼 + 프로필 아이콘

이번 단계에서 필요한 실제 동작:

- `Eqp` 클릭 시 `/eqp`
- `Model` 클릭 시 `/model`
- `Deploy` 클릭 시 `/deploy`
- `Dlq`, `User` 는 기존과 동일하게 비활성 또는 route 없음 유지 가능

### DeploySidebar

좌측 내부 Sidebar 항목:

1. 루트 제목: `▾ Deploy`
2. `Register`
3. `Deploy`
4. `Deploy_History`

구현 원칙:

- 라우트는 `/deploy` 단일 route
- 내부 Zustand state 로 `register | deploy | history` 전환
- active item 강조
- `design.pen` 의 expanded sidebar 톤을 최대한 유지

─────────────────────────────
🗂 모드별 요구사항
─────────────────────────────

### 1. Register 모드

`Deploy Frame - Register` 를 기준으로 구현합니다.

MainContent 구성:

1. `Target Equipment Search`
2. `Selected Equipments`
3. `Configuration & Deploy`

#### 1) Target Equipment Search

검색 필드:

- `Model`
- `Model Version`
- `Eqp ID`
- `Search`
- `Clear`

결과 테이블 컬럼:

- `Eqp ID`
- `Model`
- `Model Version / Status`

하단 액션:

- `Add to Selected`

동작 규칙:

- 검색은 local mock eqp 데이터에 대해 수행합니다.
- `Search` 는 현재 필터값을 적용합니다.
- `Clear` 는 검색 필터를 초기화합니다.
- 결과 테이블에서 한 건 이상 선택 후 `Add to Selected` 를 누르면 선택 영역으로 이동합니다.

#### 2) Selected Equipments

테이블 컬럼:

- `Eqp ID`
- `Model`
- `Selected Version`

동작 규칙:

- 선택된 설비 목록을 보여줍니다.
- `Selected Version` 은 아래 기준으로 표시합니다.
  - 기본: 해당 설비 mock 데이터의 현재 연결 version
  - `New Model Version` 을 선택한 뒤에는 배포 예정 version 표시

#### 3) Configuration & Deploy

구성:

- 좌측 제목: `Configuration & Deploy`
- 우측 버튼: `Deploy`, `Clear`
- 입력/선택 필드:
  - `New Model`
  - `New Model Version`
  - `Business Jar File`
  - `Upload` 버튼

동작 규칙:

- `New Model`, `New Model Version`, `Business Jar File` 은 모두 local mock option 사용
- `Upload` 버튼은 비활성화하고 `추후 연동 예정` 상태로 둡니다.
- `Clear` 는 Register 모드의 선택/필터/설정 상태를 초기화합니다.

#### Register 모드의 중요한 제약

1. 처음 선택된 EQP 의 `commInterface` 를 기준으로 `selectedInterfaceType` 을 정합니다.
2. 이후 다른 `commInterface` 설비는 선택할 수 없도록 막습니다.
3. 선택 불가 이유는 사용자에게 명확히 보여줍니다.
   - 예: `동일한 Interface Type 설비만 함께 선택할 수 있습니다.`

#### Deploy 버튼 클릭 시 처리

이번 단계에서는 서버 호출 대신 **로컬 deploy 생성**으로 처리합니다.

생성 규칙:

1. `deployName` 자동 생성
   - 예: `${modelName} ${modelVersion} Business Jar Update`
2. `eventType` 은 `EQP_BUSINESS_JARFILE_UPDATE` 고정
3. `executionPolicy` 는 `BEST_EFFORT` 고정
4. 선택된 EQP 기준으로 local target 목록 생성
5. synthetic `deployKey` 생성
6. `activeDeployKey` 저장
7. `localHistory` 에 새 deploy 항목 추가
8. 생성 직후 `Deploy` 모드로 이동

로컬 생성 결과 예시:

- deploy status: `RUNNING` 또는 `READY`
- target status:
  - 기본 `PENDING`
  - 일부 seed/mock 데이터는 `COMPLETED`, `FAILED` 섞어서 표현 가능

### 2. Deploy 모드

`Deploy Frame` 을 기준으로 구현합니다.

구성:

1. 상단 검색 카드
2. deploy 리스트 카드
3. 선택된 deploy 상세 영역
   - summary
   - target table

#### 상단 검색 카드

필드:

- `Model`
- `User`
- `기간`
- `Search`
- `Clear`

동작:

- `localHistory` 배열에 대한 필터링
- `Search` 는 현재 필터 적용
- `Clear` 는 monitor 필터 초기화

#### deploy 리스트 카드

컬럼 예시:

- `Deploy Name`
- `Event Type`
- `Status`
- `Target Count`
- `Completed`
- `Failed`
- `Requested By`
- `Created At`

중요:

- `design.pen` 내부 node 이름이 user placeholder 성격이어도,
  **카드 스타일 / header 높이 / row 톤**은 유지하고
  데이터 의미는 deploy 도메인으로 재구성합니다.

동작:

- 목록 데이터는 `localHistory`
- 행 클릭 시 `activeDeployKey` 변경

#### 상세 영역

선택된 deploy 에 대해 아래를 표시합니다.

summary 예시:

- Deploy Name
- Event Type
- Status
- Execution Policy
- Created At
- Total / Pending / Running / Completed / Failed

target table 컬럼:

- `Eqp ID`
- `Target Status`
- `Current Step`
- `Step Status`
- `Rollback Required`
- `Last Error`
- `Updated At`

주의:

- 이번 단계에서는 polling 하지 않습니다.
- 상세 데이터 역시 local store 기반입니다.

### 3. Deploy_History 모드

`Deploy` 모드 shell/layout 을 재사용합니다.

차이점:

- 데이터는 `localHistory` 중 terminal status 중심으로 보여줍니다.
- 권장 terminal status:
  - `COMPLETED`
  - `PARTIAL_FAILED`
  - `FAILED`
  - `CANCELED`

추가 규칙:

- empty state 문구를 제공합니다.
  - 예: `완료된 Deploy 이력이 없습니다.`

─────────────────────────────
🧾 local mock data 요구사항
─────────────────────────────

`src/features/deploy/mocks/deploy.mock.ts` 에 최소한 아래 데이터가 있어야 합니다.

1. EQP 목록
2. Model 목록
3. Model Version 옵션
4. Business Jar 옵션
5. 초기 deploy 목록(seed)
6. 초기 deploy target 목록(seed)
7. mock 사용자 정보

권장 EQP mock 필드:

- `eqpId`
- `modelName`
- `modelVersion`
- `modelVersionKey`
- `commInterface`
- `status`

권장 deploy history mock 필드:

- `deployKey`
- `deployName`
- `eventType`
- `deployStatus`
- `executionPolicy`
- `requestedBy`
- `createdAt`
- `targetSummary`

권장 target mock 필드:

- `deployTargetKey`
- `eqpId`
- `targetStatus`
- `currentStepCode`
- `currentStepStatus`
- `rollbackRequired`
- `lastErrorMessage`
- `updatedAt`

─────────────────────────────
📌 타입 요구사항
─────────────────────────────

`src/features/deploy/types/deploy.types.ts` 에 최소 아래 타입을 정의합니다.

1. `DeployMode`
   - `register`
   - `deploy`
   - `history`
2. `DeployEventType`
   - 우선 `EQP_BUSINESS_JARFILE_UPDATE`
   - 필요 시 future enum 확장 허용
3. `DeployExecutionPolicy`
   - `BEST_EFFORT`
   - `FAIL_FAST`
4. `DeployStatus`
5. `DeployTargetStatus`
6. `DeployStepStatus`
7. `DeployRegisterEqpItem`
8. `DeployModelOption`
9. `DeployModelVersionOption`
10. `DeployJarOption`
11. `DeployHistoryItem`
12. `DeployTargetItem`
13. `DeployRegisterFilters`
14. `DeployMonitorFilters`

이번 단계에서는 실제 backend request/response DTO보다
**UI 표현과 local state에 필요한 타입**을 우선 정의합니다.

─────────────────────────────
🧠 Zustand store 요구사항
─────────────────────────────

`src/features/deploy/stores/deploy-ui.store.ts`

최소 상태:

- `mode`
- `selectedEqpIds`
- `selectedInterfaceType`
- `activeDeployKey`
- `localHistory`
- `localTargetsByDeployKey`
- `registerFilters`
- `monitorFilters`
- `selectedModelName`
- `selectedModelVersionKey`
- `selectedBusinessJarRef`
- `isProfileModalOpen`

최소 액션:

- `setMode`
- `setRegisterFilters`
- `resetRegisterFilters`
- `toggleEqpSelection`
- `addSelectedEqps`
- `removeSelectedEqp`
- `clearSelectedEqps`
- `setSelectedModelName`
- `setSelectedModelVersionKey`
- `setSelectedBusinessJarRef`
- `setActiveDeployKey`
- `createLocalDeploy`
- `clearRegisterState`
- `setProfileModalOpen`

저장 정책:

- 이번 단계에서는 `sessionStorage` 기반 persist 를 권장합니다.
- 새로고침 시 현재 작업 상태가 유지되면 UX가 더 자연스럽습니다.
- 다만 장기 영속 보관까지는 이번 범위가 아닙니다.

─────────────────────────────
🔗 라우팅 변경
─────────────────────────────

필수:

- `/deploy` → `DeployPage`
- `/eqp`, `/model`, `/login` 유지
- `/` → `/login` 유지
- wildcard redirect 유지

추가로 필요한 수정:

- `EqpPage.tsx` 상단 메뉴의 `Deploy` route 를 `/deploy` 로 연결
- `ModelPage.tsx` 상단 메뉴의 `Deploy` route 를 `/deploy` 로 연결

주의:

- `/deploy/register`
- `/deploy/history`

같은 하위 route 는 만들지 않습니다.

─────────────────────────────
🎨 디자인 구현 포인트
─────────────────────────────

반드시 지킬 것:

1. TopBar 높이, 배경, border 톤 유지
2. Sidebar 240px 유지
3. 카드 radius, border, background tone 유지
4. 검색 영역과 테이블 영역의 간격 유지
5. 테이블 컬럼이 많으므로 `overflow-x-auto` 허용
6. 데스크탑 우선 레이아웃 유지
7. 모바일에서도 레이아웃이 깨지지 않도록 최소 너비 보장

해석 기준:

- `Deploy Frame` 은 monitor shell
- `Deploy Frame - Register` 는 register shell
- `Deploy_History` 는 monitor shell 재사용

─────────────────────────────
✅ 완료 기준 (DoD)
─────────────────────────────

`pnpm dev` 기준:

1. `/deploy` 라우트 진입 가능
2. 좌측 Sidebar 의 `Register / Deploy / Deploy_History` 모드 전환 정상
3. `Register` 모드에서 3개 카드가 design.pen 레이아웃에 맞게 표시
4. `Model / Model Version / Eqp ID` 검색 필드와 `Search / Clear` 동작 정상
5. 선택 target EQP 는 동일 `commInterface` 만 허용
6. `Selected Equipments` 영역이 선택 상태에 맞게 갱신
7. `New Model / New Model Version / Business Jar File` 선택 UI 정상
8. `Upload` 버튼은 비활성 또는 `추후 연동 예정` 상태
9. `Deploy` 클릭 시 서버 호출 없이 로컬 deploy 생성
10. 생성 성공 후 `activeDeployKey` 저장 및 `Deploy` 모드 전환
11. `Deploy` 모드에서 생성된 항목이 목록에 보임
12. `Deploy` 모드에서 summary / target table 표시 정상
13. `Deploy_History` 모드에서 terminal status 중심 목록 표시 정상
14. `EqpPage`, `ModelPage` 상단 `Deploy` 메뉴 클릭 시 `/deploy` 이동
15. base `Deploy Frame` 의 카드/테이블 시각 스타일은 유지하되, 데이터는 deploy 도메인으로 재구성
16. TypeScript 컴파일 에러 0
17. 런타임 에러 0

권장 검증:

- `pnpm lint`
- `pnpm build`

가능하면 함께 확인:

- `/eqp` → `/deploy` 이동
- `/model` → `/deploy` 이동
- `/deploy` 내부 3개 모드 전환 후 새로고침 시 상태 유지 여부

─────────────────────────────
🧭 2차 단계 메모
─────────────────────────────

deploy backend 연동을 시작할 때 다음 순서로 확장합니다.

1. `deploy.api.ts` 추가
2. `useCreateDeploy.ts` 추가
3. `useDeploySummary.ts` 추가
4. `useDeployTargets.ts` 추가
5. local mock data source 를 실제 API source 로 교체
6. 필요 시 CSRF 처리 추가
7. 필요 시 polling 추가

이번 단계에서는 위 항목을 **미리 구현하지 않습니다.**
