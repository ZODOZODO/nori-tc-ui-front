# Plan: live-map-layout-builder — Phase 2

> 입력: `.claude/specs/live-map-layout-builder.md` (Phase 2 섹션) + `-phase1-plan.md` + `-phase1-dev-report.md`
> 산출 주체: Plan 세션 (실행/코드 수정 없음 — read-only 검증만 수행)
> 다음 단계: `.claude/specs/live-map-layout-builder-phase2-dev-report.md` (Implement)

이 문서는 **워크스페이스 전체(common + ui-backend + gateway + business + ui-front + exec)의 영속화 레이어 전수 조사**로
확정한 사실에 기반한다. 모든 파일/라인 인용은 실제 도구 확인 결과다. Phase 1 plan 의 구조를 답습한다.

---

## 0. Plan 단계 검증으로 드러난 핵심 사실 (설계 원칙 확정)

> ⚠ Phase 2 의 가장 큰 결정은 "3 테이블(JSONB 보유)을 어디에·어떤 메커니즘으로 영속화하는가" 다.
> SPEC Decisions(319줄)은 "RDB(JPA, tc-ui-db-adapter)"로 적었으나, **전수 조사 결과 진짜 설계 축은
> JPA/JDBC 의 선택이 아니라 "JSONB 보유 여부"** 임이 드러났다. 아래는 그 검증 결과다.

### 0.1 nori-tc DB 영속화의 2-트랙 — "JSONB 여부"가 ORM 매핑 소유권을 가른다

전수 인벤토리(검증된 사실):

- **트랙 1 — nori-tc-common 공유 ORM 레이어 (42 테이블 전부 JPA + MyBatis 이중 매핑, 100%)**:
  - `tc_eqp*` / `tc_model*` / `tc_work*` / `tc_user*` / `tc_ui_permission` / `tc_ui_auth_session` / `tc_jar_*` / `tc_line` 등 42 개.
  - 각 테이블 = 도메인 record(`tc-db-domain`) + core Store 포트(`tc-db-core`) + JPA(`tc-db-jpa-common-schema`) + MyBatis(`tc-db-mybatis-common-schema`).
  - 이중 매핑 이유: ui-backend 는 JPA store(`TcDbJpaStoreConfiguration`), gateway/business 는 MyBatis store(`TcDbMybatisStoreConfiguration`)를 활성화. 같은 도메인 record·같은 core 포트 의미론 공유.
  - **이 42 테이블엔 JSONB 컬럼이 0 개.** JPA `@JdbcTypeCode`/`@Convert`/`@Type` 0건, MyBatis JSON typeHandler 0건 (grep 검증). common ORM = **순수 scalar/관계형, 벤더 중립**.
  - ⚠ **단일 앱 전용 테이블도 common 에 있다**: `tc_work_*`(business 만 write), `tc_ui_auth_session`/`tc_ui_permission`/`tc_user_info`(ui-backend 도메인)도 common 이중 매핑. → **"단일 앱 전용 ⇒ common 밖"은 거짓.** common 포함 기준은 앱 수가 아니라 "정규화된 scalar 관계형 도메인인가"다.

- **트랙 2 — 소유 앱의 raw JDBC 어댑터 (JSONB 보유 테이블)**:
  - common 42 테이블 밖에서 ORM 매핑되는 유일한 테이블군 = `tc_deploy` / `tc_deploy_target_plan` / `tc_deploy_target_state` / `tc_deploy_target_snapshot` / `tc_deploy_scenario_catalog_meta`.
  - 전부 ui-backend 가 `NamedParameterJdbcTemplate` 로 직접 SQL ([DeployJdbcStorePort.java:57-69](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/DeployJdbcStorePort.java), `@Repository implements DeployStorePort`).
  - **공통점 = JSONB 컬럼 보유** (`desired_common_state_json`/`desired_state_json`/`delta_json`/`resolved_step_plan_json`/`snapshot_data_json` 전부 JSONB). 설계 의도 주석: *"plan/state/snapshot을 분리한 DDL 구조를 그대로 사용하여 hot update 시 큰 JSONB를 반복 갱신하지 않도록 설계"* ([DeployJdbcStorePort.java:54-55](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/DeployJdbcStorePort.java)).
  - JSONB CRUD 패턴: write `JsonNode → objectMapper.writeValueAsString() → CAST(:x AS JSONB)`; read `getString() → objectMapper.readTree() → JsonNode`; IDENTITY 반환 `RETURNING <pk>`; mutation 에 `@Transactional`. Jackson 3(`tools.jackson.databind`) ([DeployJdbcStoreSupport.java:117,150-151,437-451](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/DeployJdbcStoreSupport.java)).

- **gateway / business 는 100% common store 래핑** — 자체 JDBC/JPA 없음. 공유 테이블은 read-only(`tc_eqp` 로딩) 또는 자기 도메인 write(`tc_eqp_state`/`tc_work_*` upsert via common store). gateway/business 전용 JSONB 테이블 0개. build.gradle 의존: `tc-db-core` + `tc-db-domain` 만.

### 0.2 결론 — tc_live_map_* 의 영속화 트랙

`tc_live_map_object` / `tc_live_map_layout` / `tc_live_map_placement` 는:
1. **JSONB 보유**(`shape_json` / `transform_json` / `canvas_json`) → 트랙 1(common, 벤더 중립 scalar) 에 부적합. common 엔 JSONB 매핑 선례·인프라가 0.
2. **ui-backend 전용**(gateway/business 무관, Phase 1 에서 Kafka 계약에도 line 미포함 = downstream 무관 확정).
3. 사용자 프롬프트 영향 레포 목록에 common 부재(Phase 1 프롬프트엔 common 명시됐던 것과 대조) + Q2 "postgres 전용 앱" 확정.

→ **`tc_deploy*` 와 동일한 트랙 2 = ui-backend `tc-ui-db-adapter` raw JDBC 어댑터(`DeployJdbcStorePort` 패턴).
nori-tc-common 은 손대지 않는다.** SPEC 319줄의 "JPA"는 "tc-ui-db-adapter 의 RDB 영속화"를 가리키는
느슨한 라벨이며, 이 설계 원칙(JSONB ⇒ 소유 앱 JDBC) 에 따라 **구현체는 JDBC 어댑터**다. (확정 [D1](#d1))

### 0.3 권한 모델 — closed-by-default + ANY-of 매칭이 write enforce 설계를 강제한다

[UiApiPermissionCache.isAuthorized():137-162](../../../nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/security/UiApiPermissionCache.java) 의미론(검증):
1. 요청을 `(resource matchType 매칭) AND (httpMethod 매칭)` 으로 필터 → 매칭 권한 집합.
2. 집합이 비면 **차단**(closed by default).
3. 비지 않으면 사용자가 매칭 집합 중 **하나라도 보유(`anyMatch`)** 하면 허용 — **ANY-of**.
4. `httpMethod=NULL` 이면 전 메서드 매칭. `matchType=PREFIX` 면 `startsWith`.

기존 시드(Phase 1, [postgres_2026_06_02_add_line_read_and_layout_write_permission.sql](../../../nori-tc-exec/docs/db_table/patch/postgres_2026_06_02_add_line_read_and_layout_write_permission.sql)):
- `LIVE_MAP_LAYOUT_WRITE` = `PREFIX /api/live-map/layout`, `http_method=NULL`(전 메서드), **ADMIN** 만. → Phase 2 enforce 용으로 이미 예약됨.
- `LIVE_MAP_READ` = `EXACT /api/live-map`, `GET`. (EXACT 라 `/api/live-map/layout` 하위경로 **미매칭** → write 경로에 간섭 없음 — 안전.)

⚠ **ANY-of 의 함정**: GET layout 을 비-admin 에게 열려면 read 권한이 필요한데, 그 read 권한이 `http_method=NULL`(전 메서드) 이거나 PREFIX 로 write 경로까지 덮으면 → PUT 도 read 권한에 매칭되어 read 사용자가 **PUT 허용**(보안 홀). → **read 권한은 반드시 `http_method='GET'` 로 메서드 한정**해야 PUT/POST/DELETE 가 write 권한에만 매칭되어 비-admin 차단. (설계 [D3](#d3))

---

## 1. 영향 레포 + 변경 갈래

| 레포 | 변경 성격 | 핵심 산출물 |
|---|---|---|
| **nori-tc-exec** | DDL 3 테이블 (4 벤더 create_all_table) + 권한 패치(4 벤더) + (선택)샘플데이터 | create_all_table 4개 CREATE+DROP, patch SQL `<vendor>_2026_06_02_add_live_map_layout_tables.sql` + `..._add_live_map_layout_read_permission.sql` |
| **nori-tc-ui-backend** | 트랙 2 JDBC 어댑터(object/layout/placement) + core 포트/서비스 + web 컨트롤러 + DTO. **헥사고날 @Import 3 ModuleConfiguration** | core: `LiveMap*StorePort`/`LiveMap*Service`; adapter-db: `LiveMap*JdbcStorePort`(+Support); adapter-web: `LiveMapLayoutController` |
| **nori-tc-ui-front** | live-map 을 react-konva 2.5D 캔버스로 재설계. 신규 의존성 `konva`+`react-konva`. 권한 게이팅·팔레트·우클릭·영속화 API | features/live-map/* 재설계, canvas store, layout/object api+hooks, e2e 2종 |
| **nori-tc-common** | **무변경** ([D1](#d1)). JSONB 트랙 2 라 common ORM 미해당 | (없음) |
| **nori-tc-gateway / business** | **무변경** (tc_live_map_* 무관, Kafka 계약 line 미포함 = downstream 무영향). build-trace 회귀 확인 불요(공유 record 변경 0) | (없음) |

### 1.1 nori-tc-ui-backend 모듈 경로 (검증)

- `ui/tc-ui-core` — `port/db/` 신규 Store 포트 인터페이스, `service/` 신규 서비스, 도메인 DTO record.
- `ui/adapter/tc-ui-db-adapter` — 신규 `*JdbcStorePort`(+`*Support`), `UiDbAdapterModuleConfiguration` @Import.
- `ui/adapter/tc-ui-web-adapter` — 신규 컨트롤러 + Request/Response DTO, `config/UiWebAdapterModuleConfiguration` @Import.
- `ui/tc-ui-domain` — (필요 시) 도메인 record. deploy 선례는 core(`com.nori.tc.ui.core.deploy.*`)에 record 를 둠 → live-map 도 core 패키지에 record 권장.

---

## 2. 영속화 패턴 결정 — JDBC 어댑터 (DeployJdbcStorePort 답습)

### 2.1 테이블↔포트 매핑 (3 테이블, 트랙 2)

| 테이블 | core 포트(신규) | adapter 구현(신규) | 비고 |
|---|---|---|---|
| `tc_live_map_object` | `LiveMapObjectStorePort` | `LiveMapObjectJdbcStorePort` | 객체 라이브러리 CRUD. `shape_json` JSONB |
| `tc_live_map_layout` | `LiveMapLayoutStorePort` | `LiveMapLayoutJdbcStorePort` | 라인당 1 캔버스. `canvas_json` JSONB(NULL 허용) + placement 일괄 |
| `tc_live_map_placement` | (layout 포트에 포함) | (layout store 가 함께 처리) | `transform_json` JSONB. 라인 PUT 시 placement 일괄 replace |

> object 와 layout(+placement)을 2 포트로 나눈다: object = 라인 독립 재사용 라이브러리, layout/placement = 라인 종속 배치.
> placement 는 layout 의 자식(CASCADE)이라 별도 포트 없이 layout 포트가 일괄 처리(GET 시 join, PUT 시 delete-then-insert 또는 diff).

### 2.2 JDBC 어댑터 정확 구조 (DeployJdbcStorePort 답습 — 확정 패턴)

```java
@Repository
public class LiveMapLayoutJdbcStorePort implements LiveMapLayoutStorePort {
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;   // tools.jackson (Jackson3) — Spring 빈 주입

    public LiveMapLayoutJdbcStorePort(NamedParameterJdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = Objects.requireNonNull(jdbcTemplate, "jdbcTemplate is null");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper is null");
    }

    @Override @Transactional
    public long upsertLayout(long lineKey, JsonNode canvasJson) {
        // INSERT ... CAST(:canvasJson AS JSONB) ... ON CONFLICT (line_key) DO UPDATE ... RETURNING layout_key
    }
    // findByLineKey(lineKey): canvas_json getString → objectMapper.readTree → JsonNode
    // replacePlacements(layoutKey, List<placement>): DELETE + 일괄 INSERT (transform_json CAST AS JSONB)
}
```

- write: `JsonNode → objectMapper.writeValueAsString() → CAST(:x AS JSONB)`.
- read: `resultSet.getString() → objectMapper.readTree() → JsonNode`.
- IDENTITY 반환: `RETURNING layout_key` + `queryForObject(..., Long.class)`.
- `JsonNode`/`String` 변환 헬퍼는 `DeployJdbcStoreSupport.toJson/parseJson` 답습 (각 store 의 `*Support` 로 분리 또는 공용 util). ([D2](#d2): 매핑 타입 = JsonNode↔String)
- `NamedParameterJdbcTemplate`/`ObjectMapper` 빈은 ui-backend starter 의 Spring Boot auto-config + 공유 DataSource 제공(deploy 와 동일, 신규 datasource 불요).

### 2.3 헥사고날 @Import 등록 (ComponentScan 금지 — 누락 시 런타임 NoResourceFoundException)

| ModuleConfiguration | 추가할 빈 |
|---|---|
| [UiDbAdapterModuleConfiguration](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/UiDbAdapterModuleConfiguration.java) | `LiveMapObjectJdbcStorePort.class`, `LiveMapLayoutJdbcStorePort.class` |
| `UiCoreServiceModuleConfiguration` | `LiveMapObjectService.class`, `LiveMapLayoutService.class` |
| `UiWebAdapterModuleConfiguration` | `LiveMapLayoutController.class` (단일 컨트롤러 권장 — 객체+레이아웃 통합 가능, 또는 2분리) |

→ PR 전 `validate-module-imports` skill 필수.

---

## 3. JSONB 키 스키마 동결안 (SPEC Specify 확정 — 재확인) + ORM 매핑

SPEC 196~260줄에서 3 컬럼 키 스키마는 **이미 동결**(DDL/FK/CHECK 도 불변). Plan 은 이를 **그대로 사용**하며,
ui-backend ORM 매핑 방식만 확정한다.

### 3.1 동결 키 스키마 (불변 — SPEC 인용)

- `shape_json` = `{ v:1, root:<Konva Group toObject()> }`. root.className=`"Group"`, root.children[] primitive 화이트리스트 `Rect/Line/Text/Image`(Image 는 `src` URL custom attr). 좌표 = 객체 로컬 원점.
- `transform_json` = `{ v:1, x,y, rotation, scaleX,scaleY, skewX,skewY, zIndex, depth }`. 2.5D = `skewX/skewY`(외관) + `depth`(painter 깊이정렬, custom), 나머지 Konva 네이티브. 논리 아이소 투영 미도입.
- `canvas_json` = `{ v:1, width,height, background, grid:{visible,size,color} }`. NULL 허용(빈 layout) → 프론트 기본값.

### 3.2 ORM 매핑 — JsonNode(서버) ↔ String(JDBC 경계) ([D2](#d2))

- **서버 표현 = `JsonNode`(tools.jackson)**. 서버는 JSONB 내부 키를 강타입 POJO 로 풀지 않는다(키 추가 시 마이그레이션 유발 회피 — SPEC JSONB 원칙). 검증(v 존재 등)은 최소.
- **DB 경계 = `String`** + `CAST(:x AS JSONB)`(write) / `getString` → `readTree`(read).
- DTO: 컨트롤러 Request/Response 의 JSONB 필드도 `JsonNode`(프론트가 보낸 konva 직렬화 트리를 그대로 통과). Jackson3 가 요청 본문 JSON → JsonNode 역직렬화, 응답 JsonNode → JSON 직렬화.
- **`v` 검증**: PUT 수신 시 최상위 `v` 누락/비정수면 400(스키마 버전 식별 보증). 그 외 키는 통과(자유 확장).

---

## 4. 권한 모델 + 엔드포인트 설계 (이중 차단)

### 4.1 엔드포인트 — 전부 `/api/live-map/layout` prefix 아래로 ([D3](#d3))

Phase 1 이 `LIVE_MAP_LAYOUT_WRITE` 를 `PREFIX /api/live-map/layout` 로 시드했으므로, **모든 Phase 2 저작 엔드포인트를 이 prefix 아래에 두어 단일 write 권한으로 전부 enforce**한다(신규 write 권한 0).

| 메서드·경로 | 용도 | 권한(매칭) |
|---|---|---|
| `GET /api/live-map/layout?lineKey=` | 라인 캔버스+placement+객체 shape 조회(렌더용, 전 사용자) | LAYOUT_READ(GET) ∪ WRITE |
| `PUT /api/live-map/layout?lineKey=` | 캔버스+placement 일괄 저장 | **WRITE 만** |
| `GET /api/live-map/layout/objects` | 객체 라이브러리 목록(팔레트) | LAYOUT_READ(GET) ∪ WRITE |
| `POST /api/live-map/layout/objects` | 합성 객체 저장 | **WRITE 만** |
| `PUT /api/live-map/layout/objects/{objectKey}` | 객체 수정 | **WRITE 만** |
| `DELETE /api/live-map/layout/objects/{objectKey}` | 객체 삭제 | **WRITE 만** |

> object 가 의미상 라인 독립이라 `/layout/objects` 경로가 다소 어색하나, **Phase 1 D4 의 prefix 예약 의도**(SPEC: "Phase 2 경로 예약")를 살려 권한 표면을 1 write + 1 read 로 최소화한다. 대안(`/api/live-map/object` 별도 경로 + 신규 object write 권한)은 권한 시드/매칭 표면 증가라 비채택.

### 4.2 권한 시드 (Phase 2 추가 = 신규 1개)

- **재사용**: `LIVE_MAP_LAYOUT_WRITE`(PREFIX `/api/live-map/layout`, method NULL, ADMIN) — Phase 1 시드 그대로. 재시드 불요(멱등).
- **신규**: `LIVE_MAP_LAYOUT_READ` = `match_type=PREFIX`, `resource='/api/live-map/layout'`, **`http_method='GET'`**, backfill `ADMIN/DEVELOPER/OPERATOR`(전 로그인 그룹 — 비-admin 도 맵 렌더). 4 벤더 멱등.

### 4.3 ANY-of 매칭 검증 (보안)

- `GET /api/live-map/layout*` → 매칭 {WRITE(null), LAYOUT_READ(GET)}. 비-admin 은 LAYOUT_READ 보유 → 허용 ✓. admin 은 WRITE → 허용 ✓.
- `PUT/POST/DELETE /api/live-map/layout*` → 매칭 {WRITE(null)} **만**(LAYOUT_READ 는 GET 한정이라 미매칭). 비-admin 은 WRITE 없음 → **403 차단** ✓. admin → 허용 ✓.
- → **서버 write enforce 성립** = 이중 차단의 백엔드 절반. (프론트 게이팅이 나머지 절반.)

### 4.4 EQUIPMENT/STRUCTURE ↔ eqp_key 서버 검증 (SPEC (d) 명문화 강제)

PUT layout 수신 시 각 placement 에 대해 **core 서비스(`LiveMapLayoutService`)에서 강제**(DB CHECK 불가 — object_kind 타 테이블):

1. `objectKey` 로 `tc_live_map_object.object_kind` 조회.
2. `EQUIPMENT` → `eqp_key` **NOT NULL 필수**. NULL 이면 400(`UiBadRequestException`).
3. `STRUCTURE` → `eqp_key` **NULL 강제**. 값 있으면 400.
4. `eqp_key` 주어지면: 공유 `TcEqpStore.findByKey(eqpKey)` 부재 시 400 + 해당 eqp 의 `line_key == layout.lineKey`(Phase 1 스코프) 아니면 400. **FK 500 이 아닌 명시 400**.

> 선례: [JpaEqpCrudPort.validateLineRegistered():322-329](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/JpaEqpCrudPort.java) (`lineStore.findByKey().isEmpty() → UiBadRequestException`). live-map 서비스는 공유 `TcEqpStore`(common, eqp 라인 조회) + 신규 object store(object_kind 조회)를 주입해 검증. eqp 라인 조회는 Phase 1 의 `JpaLiveMapPrefetchPort` 가 이미 `TcEqpStore`/`TcLineStore` 주입 — 동일 store 재사용.

---

## 5. 단계별 구현 계획 (순서 = 의존성 순서)

> 원칙: exec DDL 준비 → ui-backend(JDBC+포트+서비스+컨트롤러, 각 AC 당 실패 테스트 먼저) → ui-front(react-konva).
> nori-tc-common 무변경이라 Phase 1 의 publish/build-trace 단계 **불필요**(공유 record 변경 0 = gateway/business 회귀 0).

### STAGE A — nori-tc-exec: DDL 3 테이블 + 권한 패치 (4 벤더)

**A1. create_all_table 4개에 3 테이블 신설 (CREATE)**

- SPEC 142~193줄 postgres DDL 그대로(IDENTITY PK / JSONB / CASCADE FK / CHECK / 인덱스). 선례 정합 확인: [postgres tc_deploy:762-790](../../../nori-tc-exec/docs/db_table/create_all_table/postgres_create_all_table.sql) 가 `BIGINT GENERATED BY DEFAULT AS IDENTITY` + `JSONB NOT NULL` + `TIMESTAMPTZ(3)` + `fk_<child>__<parent>` 동일 컨벤션.
- **위치(위상 정렬)**: placement→{layout,object,tc_eqp}, layout→tc_line 참조. tc_line(326)·tc_eqp(342) 뒤 + deploy 섹션(762~) 근처 = ui-backend 기능 테이블 그룹. **deploy 섹션 직후(파일 끝 ~900)** 권장. 순서: `tc_live_map_object` → `tc_live_map_layout` → `tc_live_map_placement`.
- **벤더별 JSONB/JSON 타입** ([D4](#d4) — postgres 외엔 선례 없음, parity 목적):

| 벤더 | JSON 컬럼 타입 | IDENTITY PK | BOOLEAN |
|---|---|---|---|
| postgres | `JSONB` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | `BOOLEAN` |
| mysql | `JSON` | `BIGINT AUTO_INCREMENT NOT NULL` | `TINYINT(1)` |
| mssql | `NVARCHAR(MAX)` | `BIGINT IDENTITY(1,1) NOT NULL` | `BIT` |
| oracle | `CLOB`(+선택 `CHECK (col IS JSON)`) | `NUMBER(19) GENERATED BY DEFAULT AS IDENTITY` | `NUMBER(1)` |

> mysql 의 기존 `_json` 컬럼 선례는 `TEXT`([mysql_create_all_table.sql:873-874](../../../nori-tc-exec/docs/db_table/create_all_table/mysql_create_all_table.sql) `headers_json/payload_json TEXT`)이나, 신규는 구조화 JSON 이므로 native `JSON` 권장(parity 라 실행 안 됨). CHECK `object_kind IN ('STRUCTURE','EQUIPMENT')` 와 `is_active IN (...)` 는 4벤더 표기 차이(oracle `NUMBER(1)` → `IN (0,1)`, [oracle tc_line:329](../../../nori-tc-exec/docs/db_table/create_all_table/oracle_create_all_table.sql) 답습).

**A2. DROP 섹션 4개에 3 테이블 추가 (child→parent 역순) + tc_line 누락 보정(Phase 1 잔여)**

- 신규: `tc_live_map_placement` → `tc_live_map_layout` → `tc_live_map_object` 순으로, **tc_eqp/tc_line DROP 보다 앞**(leaf 의존). postgres 는 deploy DROP 블록([:15-19](../../../nori-tc-exec/docs/db_table/create_all_table/postgres_create_all_table.sql)) 근처에 추가.
- **Phase 1 잔여 보정**: 4 벤더 DROP 섹션에 `tc_line` 누락 확인됨([postgres DROP:13-65](../../../nori-tc-exec/docs/db_table/create_all_table/postgres_create_all_table.sql) 에 tc_line 없음). live-map placement 가 tc_eqp 를, layout 이 tc_line 을 참조하므로 비-CASCADE 벤더(mysql/mssql/oracle) 재실행 멱등성을 위해 **tc_eqp DROP 직후 tc_line DROP 추가**(Phase 1 Validate 권고 [SPEC:118]). 이 보정은 live-map DROP 추가와 함께 처리. (postgres 는 CASCADE 라 무해하나 정합 위해 동일 추가)

**A3. 권한 패치 SQL (4 벤더, 멱등) — LIVE_MAP_LAYOUT_READ 신규**

- 파일명 `<vendor>_2026_06_02_add_live_map_layout_read_permission.sql` (디렉터리 컨벤션 `<vendor>_<YYYY_MM_DD>_<설명>.sql`).
- `tc_ui_permission` INSERT: `LIVE_MAP_LAYOUT_READ`, `API`, `PREFIX`, `/api/live-map/layout`, `GET`. + `tc_user_group_permission` backfill `WHERE g.group_code IN ('ADMIN','DEVELOPER','OPERATOR')`.
- 벤더별 멱등: postgres `ON CONFLICT DO NOTHING` / mysql `INSERT IGNORE` / mssql `IF NOT EXISTS` / oracle `WHERE NOT EXISTS ... FROM dual` (Phase 1 [postgres_2026_06_02_add_line_read...](../../../nori-tc-exec/docs/db_table/patch/postgres_2026_06_02_add_line_read_and_layout_write_permission.sql) 4 벤더 패턴 답습).
- `LIVE_MAP_LAYOUT_WRITE` 는 Phase 1 시드 존재 → 재시드 불요(패치에 멱등 재확인 INSERT 포함은 무해, 선택).
- **테이블 DDL 패치**: A1 의 3 테이블을 운영 DB 에 적용하는 `<vendor>_2026_06_02_add_live_map_layout_tables.sql` (단순 CREATE TABLE + 인덱스 + FK, backfill 불요 — 신규 테이블이라 기존행 없음). 4 벤더.

→ 검증(AC 마지막): 4 벤더 create_all_table ↔ patch 정합(컬럼/위치/FK/CHECK/명명 동일).

### STAGE B — nori-tc-ui-backend (각 AC 당 실패 테스트 먼저)

**B1. core 포트 + 도메인 record (tc-ui-core)**

- `port/db/LiveMapObjectStorePort` (CRUD: `save/update/delete/findAllActive/findByKey`), `port/db/LiveMapLayoutStorePort` (`findByLineKey`/`upsertLayout`/`replacePlacements`).
- record(core 패키지 `com.nori.tc.ui.core.livemap.*`, deploy 선례 답습): `LiveMapObject(objectKey, objectName, objectKind, JsonNode shapeJson, isActive)`, `LiveMapLayoutView(layoutKey, lineKey, JsonNode canvasJson, List<LiveMapPlacementView> placements, Map<Long, LiveMapObjectRef> objects)`, `LiveMapPlacementView(placementKey, objectKey, eqpKey, JsonNode transformJson)`, `UpsertLiveMapLayout(...)` 등. objectKind enum `STRUCTURE/EQUIPMENT`.

**B2. JDBC 어댑터 (tc-ui-db-adapter) — DeployJdbcStorePort 답습 (2.2)**

- `LiveMapObjectJdbcStorePort` + `LiveMapLayoutJdbcStorePort` (+ 필요 시 `*Support` 로 SQL 분리, deploy 선례). `@Repository`, `@Transactional`(mutation), `CAST(:x AS JSONB)`, `RETURNING`, JsonNode↔String.
- layout GET = `tc_live_map_layout` + `tc_live_map_placement` join + 참조 `tc_live_map_object`(object_kind+shape_json) 를 **deduplicated objects 맵**으로 동봉(placement 마다 shape 중복 회피, 비-admin 렌더 자족).
- layout PUT = `upsertLayout(lineKey, canvasJson)` → `replacePlacements`(delete-then-insert) 트랜잭션 1개.

**B3. 서비스 (tc-ui-core) — 권한·검증 enforce 는 4.4**

- `LiveMapObjectService` (객체 CRUD), `LiveMapLayoutService` (GET/PUT + EQUIPMENT/STRUCTURE eqp_key 검증 4.4). eqp 라인 검증 위해 공유 `TcEqpStore` 주입(Phase 1 prefetch 와 동일).
- 서버 write 권한은 path 기반 필터(UiApiPermissionCache)가 담당 — 서비스는 비즈니스 검증(eqp_key 규칙)만. (메서드 레벨 권한 어노테이션 없음 — 전부 path 필터, 0.3 검증)

**B4. 컨트롤러 + DTO (tc-ui-web-adapter)**

- `LiveMapLayoutController` `@RequestMapping("/api/live-map/layout")` (기존 [LiveMapController:`/api/live-map`](../../../nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/controller/LiveMapController.java) prefix 컨벤션 답습). 4.1 의 6 엔드포인트.
- Request/Response DTO 의 JSONB 필드 = `JsonNode`(프론트 konva 트리 통과). `v` 누락 검증 400.

**B5. 테스트 (AC 매핑, 각 실패 테스트 먼저)**

- "LIVE_MAP_LAYOUT_WRITE 없는 사용자의 객체 저장/레이아웃 PUT 거부"(AC2): 권한 캐시/시큐리티 통합 또는 `UiApiPermissionCache.isAuthorized` 단위(WRITE 없는 principal + PUT → false; GET → LAYOUT_READ true). **PUT 차단 + GET 허용 둘 다** assert.
- "EQUIPMENT 배치 eqp_key 필수 / STRUCTURE eqp_key 금지 / 미등록·타라인 eqp_key 400"(AC3): `LiveMapLayoutService` 단위 — 각 위반당 `UiBadRequestException`.
- JDBC 라운드트립: layout upsert→findByLineKey, object save→findAllActive, placement replace, JSONB(JsonNode) 보존(직렬화/역직렬화 무손실). (resultMap 없는 JDBC 라 `getString`/`readTree` 경로 테스트로 매핑 오류 차단)

→ 검증: `cd nori-tc-ui-backend && ./gradlew build` PASS (출력 마지막 5~10줄 인용).

### STAGE C — nori-tc-ui-front (react-konva 2.5D 재설계)

> 게이트: `npx tsc -b` exit 0 / `npx eslint src` exit 0 / `npm run test:unit` PASS / e2e 2종 PASS(console.error·pageerror 0).

**C1. 신규 의존성 도입 (konva + react-konva)**

- lockfile 확인 후 동일 매니저로 추가(`react-konva` + 피어 `konva`). React 19/Vite 7 정합(react-konva 19 대응 버전). ([package.json](../../src/../package.json): React `^19.2.0`, Vite `^7.3.1`, TS `~5.9.3` strict).
- vite: konva 는 브라우저 canvas — SPA 라 SSR 무관. 필요 시 `optimizeDeps`(konva) 점검(보통 무설정 동작). 번들 크기 visualizer 로 확인.
- **테스트 환경 주의**: konva 는 canvas 의존 → jsdom 단위테스트에서 Stage 렌더 불가. → **단위테스트는 순수 직렬화 로직**(shape_json `{v,root}` build/parse, transform 모델, placement 검증)을 Konva 인스턴스 없이 plain object 로 테스트. **캔버스 인터랙션은 Playwright(실 브라우저)** e2e 로.

**C2. live-map 재설계 — cluster 폐기, Konva Stage**

- 폐기: `LIVE_MAP_CLUSTER_ITEMS`([live-map.mock.ts:51-62](../../src/features/live-map/mocks/live-map.mock.ts)), cluster/IN-OUT 종단 드래그([LiveMapBoard.tsx](../../src/features/live-map/components/LiveMapBoard.tsx)). LIVE_MAP_EQUIPMENT_NODES mock 은 실 `GET /api/live-map`(Phase 1) 사용.
- 신규 `LiveMapCanvas`(Konva `Stage`/`Layer`/`Group`): canvas_json(크기/배경/grid), placement 별 `Group`(객체 shape_json 의 root 를 `Node.create` 로 복원, transform_json 적용). EQUIPMENT 노드는 eqpKey 로 `GET /api/live-map` 실시간 상태(RUN/IDLE/ERROR/DOWN)·포트 오버레이 바인딩.
- 2.5D: transform `skewX/skewY` 적용 + `depth` 로 painter 정렬(겹침). `zIndex`=형제 draw order.

**C3. 저작 인터랙션 (admin 전용)**

- primitive 자유 그리기(Rect/Line/Text/Image) + 이동/리사이즈(Konva `Transformer`)/회전/scale/z-order/삭제.
- 다중선택 → 그룹화 → 이름·종류(STRUCTURE/EQUIPMENT) 부여 → `POST /api/live-map/layout/objects`(shape_json `{v,root}` 직렬화).
- 우클릭 컨텍스트 메뉴(shadcn `context-menu` 재사용): 복사/붙여넣기/복제 + 팔레트 신규 배치 = `tc_live_map_placement` 1행. 객체 팔레트/라이브러리 패널(`GET /api/live-map/layout/objects`, 검색, 드래그/클릭 배치).
- 저장(`PUT /api/live-map/layout?lineKey=`)/불러오기(`GET`), `useLineScopeStore.selectedLineValue` 스코프 연동. `ALL_LINES_VALUE` 선택 시 = 저작 불가(라인 1개 지정 안내) — layout 은 라인당 1.

**C4. 권한 게이팅 (프론트 = 이중 차단의 절반)**

- `hasPermission(useMe().permissionCodes, LIVE_MAP_LAYOUT_WRITE_PERMISSION)`([permission.ts:23](../../src/shared/lib/permission.ts), Phase 1 시드) 로 **그리기/Transformer/팔레트/우클릭 편집 메뉴 진입 admin 전용**. 비-admin = pan/zoom·선택 조회만, 편집 UI 미렌더.
- 서버 PUT/POST/DELETE 는 4.3 으로 추가 차단(비-admin 이 직접 호출해도 403).

**C5. API/훅 (Phase 1 패턴 답습)**

- `layout.api.ts`(`apiClient` baseURL `/api`): `getLayout(lineKey)` / `putLayout(lineKey, body)` / `listObjects()` / `createObject` / `updateObject` / `deleteObject`. 응답 JSONB = 그대로 통과(타입은 konva 직렬화 트리).
- `useLayout(lineKey)`(TanStack Query), `useLayoutMutations`(useMutation + invalidate). Phase 1 `useLineList`/`lineApi`/`useEqpMutations` 패턴 답습.

**C6. 테스트**

- unit: shape_json `{v,root}` 직렬화/파싱, transform 모델, placement EQUIPMENT/STRUCTURE 검증(프론트 측 사전검증), depth 정렬(순수 함수).
- e2e `live-map-object-reuse.spec.ts`(AC): admin → primitive 여러 개 → 합성 객체 저장 → 우클릭 복사·팔레트 신규 배치 → 레이아웃 저장 → 새로고침 후 영속 확인. `attachConsoleGuards`(console.error 0 + pageerror 0).
- e2e `live-map-readonly.spec.ts`(AC): 비-admin(LIVE_MAP_LAYOUT_WRITE 없음) → 그리기/편집/복제/우클릭 편집 메뉴 진입 불가 assert + console.error 0 + pageerror 0. (Phase 1 `setupMocks`/`attachConsoleGuards` 헬퍼 답습)

→ 검증: tsc/eslint/unit/e2e 출력 인용.

---

## 6. 통합 검증 순서 (AC 매핑)

1. exec 4 벤더 create_all_table ↔ patch 정합 (AC 마지막 항목).
2. `cd nori-tc-ui-backend && ./gradlew build` → PASS (AC1, AC2, AC3).
3. ui-front: `npx tsc -b` / `npx eslint src` / `npm run test:unit` / e2e 2종 (AC4~AC8).
4. (nori-tc-common 무변경 → publish/build-trace 단계 **없음**. gateway/business 회귀 검증 불요.)

---

## 7. 위험 (Risk)

| # | 위험 | 영향 | 완화 |
|---|---|---|---|
| R1 | read 권한을 method 미한정(NULL)/너무 넓은 PREFIX 로 시드 | ANY-of 로 read 사용자가 PUT 허용(보안 홀, AC2 실패) | LAYOUT_READ 를 **`http_method='GET'`** 한정([D3](#d3)). B5 "PUT 차단+GET 허용" 테스트로 회귀 차단 |
| R2 | 객체 CRUD 경로를 `/api/live-map/layout` prefix 밖에 둠 | WRITE 권한(PREFIX /layout) 미적용 → 비-admin 객체 저장 가능(AC2 실패) | 전 저작 엔드포인트 `/api/live-map/layout/*` 아래로(4.1). object POST/PUT/DELETE 차단 테스트 |
| R3 | JDBC resultMap 부재 — JSONB getString/readTree 매핑 오류 | 런타임 직렬화 실패/데이터 손상 | JDBC 라운드트립 테스트(B5)로 JsonNode 무손실 검증. deploy `parseJson/toJson` 답습 |
| R4 | EQUIPMENT/STRUCTURE eqp_key 검증 누락 → FK 위반이 500 으로 노출 | 잘못된 배치 저장 또는 불친절한 500 | 서비스 검증(4.4) + FK 의존 전 명시 400. 위반 케이스별 테스트(AC3) |
| R5 | @Import 누락(LiveMap* 신규 빈 3+ 클래스) | 컴파일 성공·런타임 NoResourceFoundException | 2.3 의 3 ModuleConfiguration 등록 + `validate-module-imports` skill |
| R6 | konva 가 jsdom 단위테스트에서 canvas 부재로 실패 | unit 게이트 깨짐 | 단위테스트는 **순수 직렬화 로직만**(Konva 인스턴스 회피), 캔버스는 Playwright e2e (C1) |
| R7 | react-konva 19 / React 19 / Vite 7 버전 비정합 | 빌드/런타임 깨짐 | React 19 대응 react-konva 버전 선택, lockfile 매니저 일치, tsc/eslint 게이트 |
| R8 | layout GET 이 placement 마다 shape_json 중복 반환 | 페이로드 비대 + 비-admin 렌더 비효율 | objects dedup 맵 동봉(B2). placement 는 objectKey 참조만 |
| R9 | 비-postgres 벤더에 JSONB-JDBC 선례 0 + app postgres 전용 | 비-postgres 에서 앱 미동작 오해 | DDL 은 parity 목적임을 명기([D4]). 앱은 deploy 와 동일 postgres 타겟(Q2 확정). 비-postgres 실행 AC 없음 |
| R10 | `ALL_LINES` 스코프에서 layout 저작 시도 | layout 은 라인당 1(uk_line_key) — 저장 불가 | 프론트: ALL 선택 시 저작 비활성+라인 지정 안내(C3) |

---

## 8. 롤백 (Rollback)

> 미커밋 branch 기준 작업. 레포별 분리 커밋 + 단계 게이트(exec → ui-backend → ui-front)로 부분 롤백 용이.

- **exec**: 신규 patch SQL 삭제 + create_all_table diff revert. 운영 적용 전이면 무비용. 적용 후면 역마이그레이션(DROP placement→layout→object + 권한행 삭제) — patch 파일에 역순 주석 포함 권장.
- **ui-backend**: STAGE B 커밋 revert. live-map 조회는 Phase 1 상태(layout 미연동)로 자동 복귀. **common 무변경이라 publish/다운스트림 롤백 불요**(Phase 1 과의 핵심 차이).
- **ui-front**: STAGE C 커밋 revert. konva 의존 제거(package/lock). cluster 기반 LiveMapBoard 복원(폐기 전 커밋에서).
- **gateway/business**: 무영향(변경 0).

---

## 9. Decisions — 권장안 (Implement 입력)

<a id="d1"></a>**D1. 영속화 트랙 → ✅ ui-backend `tc-ui-db-adapter` raw JDBC 어댑터(DeployJdbcStorePort 답습), nori-tc-common 무변경.**
근거([0.1](#01-nori-tc-db-영속화의-2-트랙--jsonb-여부가-orm-매핑-소유권을-가른다)/[0.2](#02-결론--tc_live_map_-의-영속화-트랙)): nori-tc-common 42 테이블 = 순수 scalar, JSONB 0건. common 밖 JDBC 매핑되는 테이블군 = JSONB 보유 `tc_deploy*` 유일. **설계 축 = JSONB 보유 여부**(앱 수 아님 — tc_work_* 가 business 단독이나 common 에 있음). tc_live_map_* 는 JSONB + ui-backend 전용 → deploy 트랙. SPEC "JPA" 는 "tc-ui-db-adapter RDB 영속화" 의 느슨한 라벨로 JDBC 로 실현. (사용자 지시: "다른 table·3앱 사용 분석 후 원래 설계에 맞게 결정")

<a id="d2"></a>**D2. JSONB ORM 매핑 → ✅ JsonNode(서버) ↔ String(JDBC 경계).**
서버는 JSONB 를 강타입 POJO 로 풀지 않고 `JsonNode`(tools.jackson/Jackson3) 통과. write `writeValueAsString → CAST(:x AS JSONB)`, read `getString → readTree`. DeployJdbcStoreSupport `toJson/parseJson` 답습. 키 검증은 최상위 `v` 만(나머지 자유 확장 — SPEC JSONB 원칙).

<a id="d3"></a>**D3. 권한 모델 → ✅ 기존 LIVE_MAP_LAYOUT_WRITE(PREFIX /layout, NULL, ADMIN) 재사용 + 신규 LIVE_MAP_LAYOUT_READ(PREFIX /layout, GET, 3그룹). 전 저작 엔드포인트 `/api/live-map/layout/*` 아래.**
근거([0.3](#03-권한-모델--closed-by-default--any-of-매칭이-write-enforce-설계를-강제한다)): UiApiPermissionCache = closed-by-default + ANY-of + (resource AND method) 필터. read 를 GET 한정해야 PUT 가 write 권한에만 매칭 → 비-admin PUT 403. Phase 1 D4 의 prefix 예약 의도 계승. 신규 write 권한 0.

<a id="d4"></a>**D4. 벤더 범위 → ✅ postgres 전용 앱(JDBC, deploy 답습) + 4 벤더 DDL parity (사용자 Q2 확정).**
선례 tc_deploy* 는 **postgres 단독 DDL**(mysql/mssql/oracle 0건 — 검증)이나, SPEC Phase 2 Requirement·사용자 Q2 가 4 벤더 명시 → 3 테이블 DDL 은 4 벤더 작성(postgres JSONB / mysql JSON / mssql NVARCHAR(MAX) / oracle CLOB). **비-postgres 는 schema parity 목적**(앱 JDBC 는 postgres 타겟이라 비-postgres 미실행, deploy 와 동일). 4 벤더 JSONB-app portability 는 비채택.

<a id="d5"></a>**D5. object/placement 모델 → ✅ object(라인 독립 라이브러리) CRUD 별도, layout(라인당 1)+placement(자식 CASCADE) 통합 포트.**
layout GET 시 placement + dedup objects 맵 동봉(shape 중복 회피, 비-admin 렌더 자족). PUT 시 placement delete-then-insert 트랜잭션.

---

## 10. Out of Scope (Phase 2 에서 손대지 않음)

- nori-tc-common (트랙 1) — JSONB 트랙 2 라 무변경. publish/build-trace 불요.
- gateway/business 의 tc_live_map_* / tc_eqp.line_key 활용 — 무관(Kafka 계약 line 미포함 유지).
- 이미지 바이너리 업로드 — `Image.src` URL 참조만(SPEC).
- 라인별 **조회** 권한 분리 — 전 라인 조회 가정(편집/조회 2단계만).
- 진짜 3D 카메라(Three.js) — skew 의사 2.5D 만.
- 비-postgres 벤더 앱 실행 — DDL parity 만([D4]).
- `RegularPolygon`/`Path`/`Circle` 등 primitive 확장 — JSONB 라 DB 변경 없이 후속 프론트 확장.

---

## 11. Implement 진입 시 산출물

`.claude/specs/live-map-layout-builder-phase2-dev-report.md` 에 기록:
- 변경 파일 경로 목록 (레포별: exec / ui-backend / ui-front).
- `cd nori-tc-ui-backend && ./gradlew build` / tsc / eslint / unit / e2e 결과 PASS/FAIL + 출력 마지막 5~10줄.
- 어느 ModuleConfiguration @Import 에 무엇 추가했는지(LiveMap* 3 ModuleConfiguration).
- D1~D5 확정값 + 근거. JSONB JsonNode↔String 경로·`CAST AS JSONB`·`RETURNING` 적용 확인.
- 권한: LIVE_MAP_LAYOUT_READ 신규 시드 + WRITE 재사용. PUT 차단/GET 허용 테스트 결과.
- EQUIPMENT/STRUCTURE eqp_key 검증 케이스 결과.
