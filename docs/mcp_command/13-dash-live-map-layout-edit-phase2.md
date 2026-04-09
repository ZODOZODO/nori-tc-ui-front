# Dash Live Map Front Phase 2 Draft

이번 문서는 `/eqp/live-map` 화면의 2차 UI 개선 범위를 정리한 초안입니다.

## 목표

1. 설비 배치를 10개 공정 단위 카드 형태로 더 정돈된 dashboard 구조로 재배치합니다.
2. 선택 설비 카드에서 `A-EQ17 [ERROR]` 같은 거친 표기를 제거하고 읽기 쉬운 정보 구조로 바꿉니다.
3. `live sync` 왼쪽에 보드 편집 스위치를 추가합니다.
4. 편집 스위치가 켜진 동안에만 설비 노드와 공정 카드 전체를 마우스 드래그로 이동할 수 있게 합니다.

## 비목표

1. backend 저장 API 추가
2. drag 결과의 서버 영속화
3. multi-select, alignment guide, 자동 정렬 기능
4. cluster / buffer / transport 객체의 드래그 편집

## 변경 원칙

1. 기존 `src/features/live-map` 경계를 유지합니다.
2. 새 의존성은 추가하지 않고 React pointer event와 기존 Zustand store만 사용합니다.
3. 드래그 좌표는 현재 세션의 client state로만 관리합니다.
4. 편집 스위치가 꺼져 있을 때는 현재 화면과 동일하게 고정형 지도처럼 동작해야 합니다.

## UI 변경안

### 1. 보드 상단 제어 영역

1. 보드 편집 스위치를 `live sync` 왼쪽에 둡니다.
2. 스위치는 현재 페이지의 dark board 톤과 어울리는 pill 형태로 만듭니다.
3. 스위치 라벨은 `배치 편집`으로 표시합니다.
4. 켜졌을 때만 설비 노드 커서를 `grab / grabbing`으로 바꿉니다.

### 2. 설비 배치

1. 공정 카드 10개를 한눈에 비교할 수 있도록 균일한 grid로 배치합니다.
2. 설비 노드는 각 공정 카드 내부에서 읽기 쉬운 순서로 정렬합니다.
3. 버퍼 / 반송 장비 / sector 표현은 제거합니다.

### 3. 선택 설비 카드

1. 카드 타이틀은 `eqpId`만 노출합니다.
2. 상태는 별도 badge와 설명 문구로 분리합니다.
3. 영어 bracket status 표기(`[ERROR]`)는 제거합니다.
4. 공정 / 라인 외에 처리 방식(`Single` / `Batch`)을 함께 노출합니다.
5. 설비별 port 개수와 각 port 상태(`RUN` / `IDLE` / `DOWN`)를 확인할 수 있게 합니다.

## 상태 설계

`live-map-ui.store.ts`

1. `isLayoutEditEnabled`
2. `clusterPositionDrafts`
3. `equipmentPositionDrafts`
4. `setLayoutEditEnabled`
5. `updateClusterLayout`
6. `updateEquipmentPosition`

## 검증 계획

1. `pnpm test:unit`
2. `pnpm lint`
3. `pnpm build`
