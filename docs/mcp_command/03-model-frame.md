Pencil MCP, Serena MCP 를 사용해서 아래의 요청사항을 진행해줘.

Pencil MCP 작업 요청:

1. Pencil 캔버스에서 design.pen 의 아래 12개 Frame을 읽고, 해당 디자인(레이아웃/여백/타이포/색/컴포넌트 구성 등)을 최대한 유지한 React 컴포넌트로 변환해 주세요.
   - "Model Frame"
   - "Model Frame - Model"
   - "Model Frame - Version"
   - "Model Frame - Version Edit Mode"
   - "Model Frame - CheckIn Modal"
   - "Model Frame - Sidebar Collapsed"
   - "Model Frame - Profile Modal Open"
   - "Model Frame - Model - Profile Modal Open"
   - "Model Frame - Version - Profile Modal Open"
   - "Model Frame - Version Edit Mode - Profile Modal Open"
   - "Model Frame - CheckIn Modal - Profile Modal Open"
   - "Model Frame - Sidebar Collapsed - Profile Modal Open"
2. 변환 결과는 "현재 백엔드 API 계약과 정확히 맞는 완전한 Model Info 페이지"여야 합니다.
3. 아래 기술/규칙을 반드시 준수하고, 기존 프로젝트 설정(Foundation)은 임의로 변경하지 마세요. (필요한 import/route 추가만)
4. 기존에 작성된 컴포넌트를 우선 재사용하고, 유사 컴포넌트가 여러 군데 존재하면 공통 컴포넌트로 추상화해서 중복 구현을 피하세요.

─────────────────────────────
📁 생성/수정할 파일 목록 (필수)
─────────────────────────────

1. src/features/model/types/model.types.ts
2. src/features/model/api/model.api.ts
3. src/features/model/hooks/useModelList.ts
4. src/features/model/hooks/useModelDetail.ts
5. src/features/model/hooks/useModelMutations.ts
6. src/features/model/stores/model-ui.store.ts
7. src/features/model/components/ModelPage.tsx
8. src/features/model/components/ModelSidebar.tsx
9. src/features/model/components/ModelInfoTable.tsx
10. src/features/model/components/ModelDetailPanel.tsx
11. src/features/model/components/ModelCheckInModal.tsx
12. src/app/Router.tsx (기존 스타일 유지, 최소 변경)
13. (선택) 공통 추상화가 필요하면 기존 공통 컴포넌트 위치 또는 src/shared/components 하위에 최소 범위로 추가

─────────────────────────────
🔌 API 스펙 (백엔드 구현 기준)
─────────────────────────────

### GET /api/model — 모델 목록 조회 (페이지네이션)

- Query Params: offset (기본 0), limit (기본 100, 최대 500)
- Success Response (200):
{
  "success": true,
  "data": {
    "items": [
      {
        "modelVersionKey": 101,
        "modelKey": 10,
        "modelName": "Model_1",
        "modelVersion": "v2.1.0",
        "commInterface": "HSMS",      // ProtocolType: HSMS | SOCKET
        "status": "ACTIVE",           // ModelStatus: DRAFT | ACTIVE | DEPRECATED
        "description": "대표 모델",
        "maker": "NORI",
        "createdAt": "2026-03-05T09:31:00+09:00",
        "updatedAt": "2026-03-05T09:31:00+09:00",
        "createdBy": "admin",
        "updatedBy": "admin"
      }
    ],
    "offset": 0,
    "limit": 100,
    "count": 1
  },
  "errorCode": null,
  "errorMsg": null
}

### GET /api/model/{modelVersionKey} — 모델 단건 조회

- Path Variable: modelVersionKey
- Success Response (200): GET /api/model items[0] 과 동일한 단건 객체
- Not Found Response (404):
{
  "success": false,
  "data": null,
  "errorCode": "NOT_FOUND",
  "errorMsg": "모델을 찾을 수 없습니다."
}

### POST /api/model — 모델 등록

- Request Body:
{
  "modelName": "Model_4",
  "modelVersion": "v1.0.0",
  "commInterface": "HSMS",
  "status": "DRAFT",
  "description": "초기 버전",
  "maker": "NORI",
  "createdBy": "admin",
  "updatedBy": "admin"
}
- Success Response (200): ApiResponse<ModelInfoResponse>

### PUT /api/model/{modelVersionKey} — 모델 수정

- Path Variable: modelVersionKey
- Request Body: POST /api/model 과 동일
- Success Response (200): ApiResponse<ModelInfoResponse>
- Not Found Response (404):
{
  "success": false,
  "data": null,
  "errorCode": "NOT_FOUND",
  "errorMsg": "수정할 모델을 찾을 수 없습니다."
}

### DELETE /api/model/{modelVersionKey} — 모델 삭제

- Path Variable: modelVersionKey
- Request Body 없음
- Success Response (200):
{
  "success": true,
  "data": null,
  "errorCode": null,
  "errorMsg": null
}
- 중요: 삭제는 멱등(idempotent)으로 동작하므로, 대상이 없어도 서버가 내부적으로 실패로 보지 않을 수 있습니다.
- Conflict Response (409) 예시:
{
  "success": false,
  "data": null,
  "errorCode": "CONFLICT",
  "errorMsg": "해당 모델을 참조 중인 데이터가 있어 삭제할 수 없습니다."
}

### 공통 실패 응답

- 400: INVALID_REQUEST + 검증/파라미터/본문 형식 오류 메시지
  - 예: "modelName은 필수입니다.", "modelVersion은 필수입니다.", "commInterface는 필수입니다.", "status는 필수입니다."
- 500: INTERNAL_ERROR + "요청 처리 중 내부 오류가 발생했습니다."

### 모델 체크아웃/체크인 도메인 규칙 (필수)

1. 체크아웃은 EQP의 tc_eqp_param 체크아웃과 유사한 정책을 따릅니다.
2. 체크아웃 시 대상 모델은 tc_model_version 의 model_version 이 "EDIT" 상태가 됩니다.
3. EDIT 상태 모델은 체크아웃한 사용자만 수정 가능하고, 다른 사용자는 수정할 수 없습니다.
4. 체크인은 version, description 입력 후 Save 시 신규 버전을 생성하는 방식으로 동작해야 합니다.
5. 체크아웃/체크인 API 경로는 현재 백엔드 계약에 맞추되, 위 상태 전이 규칙은 반드시 준수하세요.

### 중요 계약

1. 모든 응답은 ApiResponse 래퍼(success/data/errorCode/errorMsg) 계약을 따릅니다.
2. 인증은 쿠키 기반이며, 요청은 withCredentials(또는 동등 설정)를 포함해야 합니다.
3. 현재 백엔드에는 Model 상세 하위 데이터(SocketMessage/Workflow/MDF) 전용 REST API가 노출되어 있지 않습니다.
   - 상세 패널 데이터는 우선 화면 상태 또는 임시 데이터로 구성하고, 추후 API 확장 시 교체 가능한 구조로 설계하세요.

─────────────────────────────
🛡 CSRF 계약 (필수)
─────────────────────────────

1. 상태 변경 요청(POST/PUT/DELETE) 전에 GET /api/auth/csrf 호출로 CSRF 쿠키(XSRF-TOKEN)를 확보하세요.
2. 상태 변경 요청 시 X-XSRF-TOKEN 헤더에 쿠키 값을 넣어 전송하세요.
3. apiClient (src/shared/lib/api-client.ts) 를 그대로 사용할 것 — apiClient 실제 시그니처를 현재 프로젝트에서 읽고 정확히 맞춰 호출하세요.

─────────────────────────────
🛠 기술 요구사항 (필수)
─────────────────────────────

- 언어: TypeScript (.ts/.tsx), UTF-8
- 스타일: Tailwind CSS v4
- UI: shadcn/ui 우선 (Table, Button, Badge, Dialog, Input, Select 계열)
- 서버 상태/요청: TanStack Query v5 (useQuery, useMutation)
- API 클라이언트: 반드시 src/shared/lib/api-client.ts 의 apiClient 사용
- 상태 관리: Zustand (선택 modelVersionKey, sidebar open/close, mode, detail node, profile modal open)
- 로그인/인증 흐름, 401 처리, UserProfileModal 패턴은 기존 EqpPage 구현과 일관성 유지
- 기존 컴포넌트 재사용을 최우선으로 하고, sidebar/datatable/button 계열은 공통 구현을 우선 사용
- 기존 구현과 유사하지만 일부 차이가 있는 경우, 분기 난립보다 공통 컴포넌트 추상화로 통합

─────────────────────────────
🗂 페이지 레이아웃 (design.pen 기준)
─────────────────────────────

### 전체 구조 (1440x900)

- 상단 헤더(TopBar, 높이 52px): design.pen의 ECnVQ ref 컴포넌트 기준
  - 좌측: "NORI" 로고
  - 중앙: 메뉴 (Eqp / Model / Deploy / Dlq / User)
    - Eqp → 드롭다운: Eqp Info
    - Model → 드롭다운: Model Info
    - Deploy → 드롭다운: Eqp Deploy, Model Deploy
    - Dlq → 드롭다운: Gateway Dlq, Business Dlq
    - User → 드롭다운: User Info, Group Info
  - 우측: 사용자 프로필 아이콘
- 헤더 아래 구분선(NavBorder, 1px)
- 콘텐츠 영역:
  - 좌측: ModelSidebar (240px 확장 / 56px 축소)
  - 구분선(sidebarBorder, 1px)
  - 우측: MainContent

### ModelSidebar 상태 (좌측 전역 Sidebar)

1. Expanded Sidebar
   - 제목: "▾ Model 목록"
   - 루트 노드: SECS, Socket
   - 각 루트 하위: tc_model 테이블의 model_name 목록
     - 분류 기준: comm_interface (SECS/HSMS 계열은 SECS, SOCKET 계열은 Socket)
   - model_name 하위에는 추가 자식 노드가 없어야 함
   - 검색 입력(SidebarSearch) 포함

2. Collapsed Sidebar
   - 너비 56px
   - CollapseToggleButton만 노출

3. 선택 상태
   - Model Page 최초 진입 시 선택된 모델은 없음
   - 선택 전에는 MainContent가 비어 있는 상태(Model Frame)를 유지

### MainContent 전환 규칙 (필수)

1. **초기 진입**
   - Sidebar만 보이고, 가운데 MainContent에는 표시 콘텐츠 없음 (Model Frame 상태)

2. **Sidebar에서 model 선택**
   - "Model Frame - Model"처럼 Model 정보 테이블만 표시

3. **Model 정보 테이블 row 더블 클릭**
   - "Model Frame - Version"으로 전환
   - 상단 Model 정보 + 하단 DetailTabsRow/DetailSidebar/DetailMain 구조 노출

### Model Frame 상태별 화면 구성

1. **Model Frame - Model**
   - 단일 "Model 정보" 테이블 카드
   - 기본 컬럼: Model Name | Model Version | status | updated_by | updated_at
   - 정렬: updated_at 내림차순(최신순)
   - description 컬럼이 없다면 status 오른쪽에 description 컬럼 추가

2. **Model Frame - Version**
   - 상단: "Model 정보" 테이블 카드(높이 300)
   - 중간: Split Bar (8px)
     - EQP 페이지의 "설비 정보 layout ↔ 설비 param layout" 사이 리사이즈 바와 동일하게, 위/아래 드래그로 상/하단 영역 높이를 조절 가능해야 함
   - 하단:
     - DetailTabsRow: 더블 클릭으로 열린 모델 탭 표시
       - 힌트: "Read-only (Check Out): table locked"
     - 우측 버튼: Check Out
     - 좌측 DetailSidebar + 우측 DetailMain 2단 구조

3. **Model Frame - Version Edit Mode**
   - Version 상태와 동일한 구조
   - 힌트 텍스트: "Editable (Check In): table unlocked"
   - 우측 버튼: Check In
   - 편집 모드 스타일(강조 stroke #7C9082) 반영

4. **Model Frame - CheckIn Modal**
   - Check In 클릭 시 오버레이 + 저장 모달
   - 오버레이: #1B1F1D66, 콘텐츠 영역 전체(1440x847)
   - 모달(500px):
     - 제목: "Save your changes?"
     - 메시지: "Save changes and return to Check Out mode?"
     - 버튼: Cancel | Undo | Save

### DetailTabsRow / DetailSidebar 규칙

1. DetailTabsRow
   - Model 정보 테이블 row 더블 클릭 시 탭 생성
   - 탭별로 해당 모델 상세 컨텍스트(버전, 인터페이스, 상세 데이터)를 유지

2. DetailSidebar (Version 화면 내부 좌측)
   - SECS 모델 선택 시:
     - Model Parameter
     - SECS Message
     - Variableides
     - ReportIdes
     - EventIdes
     - Workflow
     - MDF
     - Dcop Itemes
   - Socket 모델 선택 시:
     - Model Parameter
     - Socket Message
     - Workflow
     - MDF
     - Dcop Itemes

3. 노드-데이터 매핑
   - 각 노드 클릭 시 tc_model_* 테이블 계열 데이터와 매핑
   - 예: tc_model_param, tc_model_secs_message, tc_model_variables, tc_model_eventid, tc_model_message_flow, tc_model_mdf, tc_model_dcop_item

### User Profile Modal 동시 표시

- "Model Frame - * - Profile Modal Open" 상태 반영
- TopBar 프로필 아이콘 클릭 시 UserProfileModal 오픈
- CheckIn Modal과 동시 오픈 시 Profile Modal이 상위 z-index에 위치해야 함

─────────────────────────────
📐 반응형 요구사항 (필수)
─────────────────────────────

- 전체 페이지: min-h-screen + w-screen
- 사이드바: 기본 240px, 토글 시 56px
- 테이블/상세 패널: overflow-x-auto 처리
- 모바일에서도 깨지지 않도록 최소 너비 보장 (데스크탑 우선 레이아웃 유지)

─────────────────────────────
🔗 라우터 변경 (필수)
─────────────────────────────

- /model → ModelPage
- /eqp, /login 기존 라우트 유지
- / 접근 시 /login 리다이렉트 유지
- 기존 Router 구현 방식(Routes/Route) 유지
- 임의의 라우트 신설 금지 (기존 경로 체계 준수)

─────────────────────────────
📌 구현 디테일 요구 (필수)
─────────────────────────────

1. **model.types.ts**
   - ProtocolType: HSMS | SOCKET
   - ModelStatus: DRAFT | ACTIVE | DEPRECATED
   - ModelInfo: modelVersionKey, modelKey, modelName, modelVersion, commInterface, status, description, maker, createdAt, updatedAt, createdBy, updatedBy
   - ModelPageResponse: items, offset, limit, count
   - ModelUpsertRequest 타입
   - ApiResponse<T> 래퍼 타입 (auth.types.ts 와 일관성 유지)
   - 실패 응답 정규화/타입가드 함수 포함

2. **model.api.ts**
   - getModelList(offset?, limit?): GET /api/model
   - getModelDetail(modelVersionKey): GET /api/model/{modelVersionKey}
   - createModel(request): POST /api/model
   - updateModel(modelVersionKey, request): PUT /api/model/{modelVersionKey}
   - deleteModel(modelVersionKey): DELETE /api/model/{modelVersionKey}
   - withCredentials + CSRF 헤더 처리(상태 변경 요청)
   - success wrapper, errorCode/errorMsg 파싱 분리

3. **useModelList.ts**
   - useQuery
   - queryKey: ['model', 'list']
   - 기본 목록 조회: offset 0, limit 500

4. **useModelDetail.ts**
   - useQuery
   - queryKey: ['model', 'detail', modelVersionKey]
   - enabled: modelVersionKey 있을 때만 실행

5. **useModelMutations.ts**
   - createModelMutation, updateModelMutation, deleteModelMutation
   - checkoutModelMutation, checkinModelMutation (백엔드 계약에 맞는 경로/요청 형식 사용)
   - 성공 시 ['model', 'list'] 무효화
   - update/delete 성공 시 선택 상세 캐시도 무효화
   - 체크아웃 충돌(다른 사용자 EDIT 점유) 에러를 구분해 전달

6. **model-ui.store.ts**
   - selectedModelVersionKey
   - sidebarOpen
   - openedTabs / activeTab
   - detailNode (SECS/Socket 타입별 상세 노드 집합)
   - isEditMode
   - isCheckInModalOpen
   - isProfileModalOpen
   - 최초 진입 상태: selectedModelVersionKey = null

7. **ModelSidebar.tsx**
   - design.pen의 Sidebar 패턴 반영
   - 루트 노드: SECS, Socket
   - 하위 노드: comm_interface 기준으로 분류된 model_name 목록
   - model_name 하위에는 자식 노드를 만들지 않음
   - 검색 입력으로 modelName/modelVersion 필터링
   - 선택된 모델 하이라이트 스타일 유지
   - 확장/축소 토글 구현

8. **ModelInfoTable.tsx**
   - "Model 정보" 테이블 렌더링
   - updated_at 기준 최신순(desc) 정렬
   - status는 Badge 형태로 표시
   - description 컬럼이 없다면 status 오른쪽에 description 컬럼 추가
   - 행 클릭 시 selectedModelVersionKey 갱신
   - 행 더블 클릭 시 Version 화면 전환 + DetailTabsRow 탭 생성
   - Version 화면에서는 상단 요약 테이블(높이 300)로 표시

9. **ModelDetailPanel.tsx**
   - 하단 상세 영역(탭 + 좌측 상세 트리 + 우측 상세 테이블) 구현
   - 상단 Model 정보 영역과 하단 Detail 영역 사이에 세로 리사이즈 바를 두고, EQP 페이지와 동일한 UX로 높이 조절 가능하게 구현
   - DetailTabsRow는 더블 클릭으로 열린 모델들만 표시
   - 탭별로 모델 상세 컨텍스트를 유지하고 탭 전환 시 상태 복원
   - DetailSidebar 노드 구성:
     - SECS: Model Parameter, SECS Message, Variableides, ReportIdes, EventIdes, Workflow, MDF, Dcop Itemes
     - Socket: Model Parameter, Socket Message, Workflow, MDF, Dcop Itemes
   - Check Out / Check In 버튼 전환
   - Read-only/Editable 힌트 문구 상태 전환
   - 노드 선택 시 tc_model_* 데이터 소스 매핑 (tc_model_param, tc_model_secs_message, tc_model_variables, tc_model_eventid, tc_model_message_flow, tc_model_mdf, tc_model_dcop_item 등)
   - 주의: 상세 데이터 전용 API가 없으면 초기에는 화면 상태/임시 데이터로 구성하고, 추후 API 연결을 위한 인터페이스 분리

10. **ModelCheckInModal.tsx**
    - Dialog 기반 모달
    - 제목/설명/버튼(Cancel, Undo, Save) 디자인 유지
    - version, description 입력 필드 제공
    - Cancel: 모달 닫기
    - Undo: 편집 상태 원복 후 읽기 모드 복귀
    - Save: 신규 version 생성 + description 반영 + 읽기 모드 복귀

11. **ModelPage.tsx**
    - TopBar + ModelSidebar + ModelInfoTable + ModelDetailPanel + ModelCheckInModal + UserProfileModal 조합
    - 최초 진입 시 선택 모델 없음(중앙 영역 비표시)
    - Sidebar에서 모델 선택 시 Model 정보 테이블만 표시
    - Model 정보 row 더블 클릭 시 Version 화면으로 전환
    - 체크아웃/체크인 모드 전환
    - EDIT 점유자만 수정 가능하도록 잠금 상태 UI 처리
    - 프로필 아이콘 클릭 시 UserProfileModal 오픈
    - 401/로그아웃 흐름은 EqpPage와 동일 UX 유지

12. **공통 컴포넌트 재사용/추상화**
    - 기존 sidebar/datatable/button 컴포넌트를 우선 재사용
    - 유사한 컴포넌트가 반복되면 공통 컴포넌트로 추상화 후 Model/Eqp 양쪽에서 재사용

─────────────────────────────
✅ 완료 기준(DoD) (필수)
─────────────────────────────

- pnpm dev 실행 시:
1. TypeScript 컴파일 에러 0
2. 런타임 에러 0
3. 로그인 후 /model 라우트 진입 가능
4. GET /api/model 호출 성공 및 목록 표시
5. 최초 진입 시 선택 모델 없이 Sidebar만 보이고 MainContent는 비표시
6. Sidebar에서 모델 선택 시 Model 정보 테이블만 표시 (Model Frame - Model 상태)
7. Model 정보 row 더블 클릭 시 Version 화면 전환 및 탭 생성
8. 좌측 Sidebar가 SECS/Socket 루트 + model_name 하위 구조로 표시
9. Model 정보 테이블이 updated_at 최신순 정렬 + description 컬럼 위치 규칙 반영
10. DetailTabsRow가 더블 클릭한 모델 기준으로 동작하고 탭별 상태 유지
11. DetailSidebar 노드(SECS/Socket별)가 요구된 목록으로 표시
12. 노드 선택 시 tc_model_* 데이터 매핑 규칙 반영
13. Create/Update/Delete/Checkout/CheckIn 요청 시 CSRF 헤더 처리 정상
14. 모델 등록/수정/삭제 및 체크인 후 목록/상세 데이터 갱신
15. 체크아웃 시 EDIT 잠금 정책(점유자만 수정 가능) 반영
16. Check In Modal(version/description 포함)의 Cancel/Undo/Save 동작 정상
17. Sidebar 확장(240px) ↔ 축소(56px) 전환 정상
18. TopBar 프로필 아이콘 클릭 시 UserProfileModal 표시
19. CheckIn Modal과 Profile Modal 동시 오픈 시 Profile Modal 최상단 표시
20. Model Frame - Version에서 상/하단 레이아웃 사이 리사이즈 바를 위/아래 드래그해 영역 높이 조절이 가능하며, 동작/스타일이 EQP 페이지와 동일
