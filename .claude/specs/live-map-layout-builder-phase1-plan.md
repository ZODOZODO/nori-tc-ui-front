# Plan: live-map-layout-builder — Phase 1

> 입력: `.claude/specs/live-map-layout-builder.md` (Phase 1 섹션)
> 산출 주체: Plan 세션 (실행/코드 수정 없음 — 검증 read-only 만 수행)
> 다음 단계: `.claude/specs/live-map-layout-builder-phase1-dev-report.md` (Implement)

이 문서는 **워크스페이스 전체(7 레포) read-only 검증**으로 확정한 사실에 기반한다.
모든 파일/라인 인용은 실제 도구 확인 결과다.

---

## 0. Plan 단계 검증으로 드러난 핵심 사실 (SPEC 보강/확인)

### 0.1 ⚠ tc_line ORM 매핑은 nori-tc-common 에 풀 매핑되어야 한다 (SPEC common 불릿보다 범위 큼)

SPEC 의 nori-tc-common Requirement 는 "tc_eqp 두 ORM 에 line_key 반영"만 명시하고 **tc_line 테이블의 ORM 매핑 위치를 명시하지 않는다.** 그러나 형제 마스터 테이블 검증 결과:

- `tc_user_group` / `tc_ui_permission` 은 **nori-tc-common 공유 DB 레이어**에 풀 매핑된다:
  - 도메인 record: `db/tc-db-domain/.../user/`
  - core 포트: [TcUserGroupStore.java](../../../nori-tc-common/db/tc-db-core/src/main/java/com/nori/tc/db/core/user/store/TcUserGroupStore.java)
  - JPA: `entity/user/TcUserGroupEntity` + `mapper/user/...EntityMapper` + `repository/user/...` + `store/user/TcUserGroupJpaStore`
  - MyBatis: `mapper/user/TcUserGroupMapper` + `store/user/TcUserGroupMybatisStore` + `resources/mybatis/common/user/TcUserGroupMapper.xml`
  - 등록: `TcDbJpaStoreConfiguration` / `TcDbJpaMapperConfiguration` / `TcDbMybatisStoreConfiguration`
- ui-backend `JpaGroupCrudPort` 는 **자체 엔티티 없이** common `TcUserGroupStore` 를 주입해 래핑한다 ([JpaGroupCrudPort.java:3,35,42](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/JpaGroupCrudPort.java)).

→ **결론: tc_line 도 tc_user_group 을 그대로 답습해 nori-tc-common 에 풀 매핑**(TcLine record + TcLineStore core 포트 + JPA + MyBatis + config 등록). ui-backend 의 "tc_line 조회 포트/어댑터/서비스"(SPEC req)는 JpaGroupCrudPort 처럼 **common TcLineStore 를 래핑하는 ui-backend 포트**다.
→ **이는 SPEC common 작업 범위 확대다.** Implement 시 nori-tc-common 변경은 (a) tc_eqp.line_key 양 ORM 반영 **+ (b) tc_line 신규 풀 매핑** 두 갈래다.

`tc_line` / `TcLine` / `TcLineStore` 식별자는 워크스페이스 어디에도 존재하지 않음(greenfield 확정).

### 0.2 GET /api/line 은 권한 카탈로그 시드가 필요하다 (closed-by-default)

ui-backend 권한 게이트는 **closed-by-default** — `tc_ui_permission` 에 매핑 없는 API 경로는 무조건 차단된다 ([UiApiPermissionCache.java:130-163](../../../nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/src/main/java/com/nori/tc/ui/adapters/web/security/UiApiPermissionCache.java), "API 권한 미등록 경로 차단 / Closed by default"). 따라서 신규 `GET /api/line` 은 `tc_ui_permission` 행이 없으면 모든 사용자가 403 을 받는다.
→ 라인 드롭다운은 상단바에서 **전 사용자**에게 보여야 하므로(SPEC: 비-admin 도 동일 맵), GET /api/line 권한은 admin 만이 아니라 **로그인 사용자 그룹 전반에 backfill** 되어야 한다. → 신규 `LINE_READ` 를 ADMIN/DEVELOPER/OPERATOR 3그룹에 backfill (확정 [D3](#d3)).

### 0.3 라인 조인 경로 — live-map 의 lineValue/lineLabel 은 tc_eqp 가 아니라 tc_line 에서 온다

`tc_eqp` 는 `line_key`(FK)만 갖는다. live-map 이 반환할 `lineValue`(=line_code) / `lineLabel`(=line_name)은 `tc_line` 에 있다. 현재 prefetch 경로:

- [JpaLiveMapPrefetchPort.java:83](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/JpaLiveMapPrefetchPort.java) `eqpStore.findAll()` → `TcEqp` → `UiEqpDbMapper::toDomain` → `UiEqp`.
- 6 batch sub-query 로 state/param/port/modelParam 을 묶는다.
- 행 조립 시 `LiveMapEqpPrefetchRow(eqp, params, portStatuses, runtimeState)` ([line 163](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/JpaLiveMapPrefetchPort.java)).
- [LiveMapQueryService.java:77-78](../../../nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/service/LiveMapQueryService.java) 가 `DEFAULT_LINE_VALUE`/`DEFAULT_LINE_LABEL` 하드코딩을 view 에 주입.

→ prefetch 에 **7번째 batch query**(tc_line) 추가: distinct `line_key` 수집 → `tcLineStore.findAllByKeyIn(...)`(또는 findAll) → `Map<Long, TcLine>` → row 에 line_code/line_name 부착. 이후 service 가 하드코딩 대신 row 의 실제 라인을 사용.

### 0.4 Kafka 계약 변경 0 (검증 완료)

[GatewayEquipmentProfileSnapshot.java:17-37](../../../nori-tc-common/messaging/kafka/tc-messaging-kafka-contract/src/main/java/com/nori/tc/messaging/kafka/contract/GatewayEquipmentProfileSnapshot.java) 에 line 필드 **없음**. gateway 메모리 갱신은 snapshot 의 `routePartition`만 라우팅 SSOT 로 사용 → **line 추가 안 함 = 계약/메모리 경로 무영향.** SPEC Constraint 그대로 유지. **이 파일은 Phase 1 에서 손대지 않는다.**

---

## 1. 영향 레포 + 변경 갈래

| 레포 | 변경 성격 | 핵심 파일 |
|---|---|---|
| **nori-tc-exec** | DDL/패치 (4 벤더) | create_all_table 4개 + patch SQL (tc_line / tc_eqp.line_key / 권한) |
| **nori-tc-common** | tc_eqp.line_key 양 ORM + **tc_line 신규 풀 매핑** + publish | TcEqp/UpsertTcEqp record, JPA entity/mapper/store, MyBatis xml/mapper/store, 신규 TcLine 일습 |
| **nori-tc-ui-backend** | line 조회 포트/서비스/컨트롤러 + eqp create/update line_key 수용 + live-map 실 라인 조인 | LiveMap*, Eqp*, 신규 Line*, UiEqp(+lineKey) |
| **nori-tc-ui-front** | 상단바 라인 드롭다운 + 전역 라인 스코프 + eqp 폼 line Select + 권한 상수 | AppTopBar, live-map store/hooks/mock, EqpManageFormModal, permission.ts |
| **nori-tc-gateway** | **런타임 무변경.** 재컴파일 + positional `new TcEqp(...)` 테스트 1곳 수정 | (test only) GatewaySocketPluginRuntimeManagerTest |
| **nori-tc-business** | **런타임 무변경.** 재컴파일 + positional `new TcEqp(...)` 테스트 2파일 수정 | (test only) BusinessModelRuntimeCacheTest, BusinessWorkflowPluginRuntimeManagerTest |

### 1.1 nori-tc-common 모듈 경로 (settings.gradle.kts 확인)

- `:db:tc-db-domain` → `db/tc-db-domain` (TcEqp record, 신규 TcLine record)
- `:db:tc-db-core` → `db/tc-db-core` (TcEqpStore / UpsertTcEqp, 신규 TcLineStore)
- `:db:jpa:tc-db-jpa-common-schema` → JPA entity/mapper/repo/store + config
- `:db:mybatis:tc-db-mybatis-common-schema` → MyBatis mapper/store/xml + config

### 1.2 nori-tc-ui-backend 모듈 경로

- `ui/tc-ui-domain` — UiEqp(+lineKey), 신규 UiLine
- `ui/tc-ui-core` — LiveMapQueryService, EqpManagementCommand, LiveMapEqpPrefetchRow, 신규 Line 서비스/포트
- `ui/adapter/tc-ui-db-adapter` — JpaEqpCrudPort, JpaLiveMapPrefetchPort, UiEqpDbMapper, 신규 JpaLineQueryPort
- `ui/adapter/tc-ui-web-adapter` — EqpController, Eqp*Request, 신규 LineController

---

## 2. tc_eqp.line_key 의 데이터 타입·위치 결정 (근거 포함)

- **타입: NOT NULL → `long` 원시 타입** (record/command). 동급 NOT NULL FK 인 `modelVersionKey` 가 `long` 이므로 답습 ([TcEqp.java:49](../../../nori-tc-common/db/tc-db-domain/src/main/java/com/nori/tc/db/domain/eqp/TcEqp.java)). JPA 엔티티 필드는 `Long`(nullable=false), 웹 DTO 는 `Long`(@NotNull).
- **record/resultMap/INSERT 내 위치: `eqpId` 바로 다음(index 2)**.
  - 근거: 현재 `TcEqp` record 필드 순서가 **DDL 컬럼 순서와 정확히 일치**한다(eqpKey→eqpId→commInterface→commMode→...). SPEC 이 DDL 에서 line_key 를 `eqp_id`↔`comm_interface` 사이에 두라 했으므로, 그 불변식을 지키려면 record 에서도 eqpId 다음(commInterface 앞)에 둔다.
  - 영향: record + MyBatis resultMap `<constructor>` + `TcEqpColumns` + INSERT 컬럼 + 모든 positional `new TcEqp(...)` 호출이 **동일 index 2 에 인자 삽입**.
  - 대안(append 끝): diff 노이즈는 줄지만 record↔DDL 순서 불변식이 깨짐 → **비권장**.

---

## 3. 단계별 구현 계획 (순서 = 의존성 순서)

> 원칙: 하위(공유) → 상위(소비) 순. common 빌드/발행 → ui-backend → ui-front. exec DDL 은 병행 가능하나 통합 검증 전 준비.

### STAGE A — nori-tc-exec: DDL + 패치 (4 벤더)

**A1. create_all_table 4개에 tc_line 신규 + tc_eqp.line_key 반영**

- tc_line DDL 은 **반드시 tc_eqp 정의보다 앞**에 위치(인라인 FK + 위상 정렬 컨벤션). 현재 postgres 기준 tc_eqp 는 line 326, tc_user_group 은 918 — tc_line 을 326 **이전**에 배치. (검증: tc_model_version(97) < tc_eqp(326) 처럼 참조 대상이 먼저 정의됨)
- tc_line 스키마: SPEC DDL 그대로 (tc_user_group 컨벤션 — `pk_tc_line` / `uk_tc_line_line_code` / `ck_tc_line_is_active` / `ix_tc_line_is_active`).
- tc_eqp 에 `line_key` 컬럼을 `eqp_id`↔`comm_interface` 사이 + `CONSTRAINT fk_tc_eqp_line_key__tc_line FOREIGN KEY (line_key) REFERENCES tc_line(line_key)` + `CREATE INDEX ix_tc_eqp_line_key`.
- 4 벤더 IDENTITY/BOOLEAN 표기 답습 (검증된 표기):

| 벤더 | IDENTITY PK | BOOLEAN |
|---|---|---|
| postgres | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | `BOOLEAN` |
| mysql | `BIGINT AUTO_INCREMENT NOT NULL` | `TINYINT(1)` |
| mssql | `BIGINT IDENTITY(1,1) NOT NULL` | `BIT` |
| oracle | `NUMBER(19) GENERATED BY DEFAULT AS IDENTITY` | `NUMBER(1)` |

→ 검증: `*_create_all_table.sql` 4개에서 tc_line/tc_eqp 컬럼·위치·FK·제약·명명이 SPEC AC 와 정합(AC 마지막 항목).

**A2. 마이그레이션 패치 SQL (운영 DB 용, 4 벤더) — backfill 순서 엄수**

파일명 규칙 `<vendor>_<YYYY_MM_DD>_<설명>.sql` ([patch/ 디렉터리 컨벤션 확인](../../../nori-tc-exec/docs/db_table/patch/)). **단일 트랜잭션 내 4-step 순서**:

1. `CREATE TABLE tc_line (...)` + 기본 라인 1행 시드 (`INSERT INTO tc_line(line_code, line_name, ...) VALUES('A_LINE','A Line',...)`). 시드 line_key 를 backfill 에서 참조.
2. `ALTER TABLE tc_eqp ADD COLUMN line_key BIGINT NULL` (먼저 **nullable**).
3. `UPDATE tc_eqp SET line_key = (SELECT line_key FROM tc_line WHERE line_code='A_LINE') WHERE line_key IS NULL` (기존 행 전부 기본 라인 backfill).
4. `ALTER TABLE tc_eqp ALTER COLUMN line_key SET NOT NULL` + `ADD CONSTRAINT fk_tc_eqp_line_key__tc_line ...` + `CREATE INDEX ix_tc_eqp_line_key`.

→ 순서 위반(예: ②④ 사이 backfill 누락) 시 기존 행 NOT NULL 위반으로 ALTER 실패. **3→4 사이 0 행이 NULL 임을 보장**해야 NOT NULL 적용 성공.
→ 벤더별 ALTER/IDENTITY/시드 IDENTITY 반환 문법 차이 주의(mssql `ALTER TABLE ... ALTER COLUMN`, oracle `MODIFY`, mysql `MODIFY COLUMN`).

**A3. LIVE_MAP_LAYOUT_WRITE 권한 패치 + GET /api/line 권한 패치 (4 벤더)**

- 패턴: [postgres_2026_04_07_add_live_map_api_permission.sql](../../../nori-tc-exec/docs/db_table/patch/postgres_2026_04_07_add_live_map_api_permission.sql) 답습 — `tc_ui_permission` INSERT (멱등) + `tc_user_group_permission` 에 그룹 backfill (멱등).
- `tc_ui_permission` 시드 컬럼: `perm_code, perm_name, resource_type('API'), match_type, resource, http_method, description, is_active, created_at, updated_at, created_by('PATCH'), updated_by('PATCH')`.
- **권한 2종 (확정값)**:
  - `LIVE_MAP_LAYOUT_WRITE` ([D4](#d4)) — `resource_type='API'`, `match_type='PREFIX'`, `resource='/api/live-map/layout'`, `http_method=NULL`. backfill `WHERE g.group_code='ADMIN'` (SPEC req, Phase 2 사용).
  - `LINE_READ` ([D3](#d3), [0.2](#02-get-apiline-은-권한-카탈로그-시드가-필요하다-closed-by-default) 사유) — `resource_type='API'`, `match_type='EXACT'`, `resource='/api/line'`, `http_method='GET'`. backfill `WHERE g.group_code IN ('ADMIN','DEVELOPER','OPERATOR')` (전 그룹 — 상단바 전역 노출).
- ⚠ **벤더 멱등 INSERT 문법 차이**: postgres `ON CONFLICT (...) DO NOTHING`, mysql `INSERT IGNORE` / `ON DUPLICATE KEY UPDATE`, mssql `IF NOT EXISTS(...) INSERT` 또는 `MERGE`, oracle `MERGE`. 단순 복붙 불가 — 벤더별 작성.
- ⚠ **선례 불일치**: 기존 LIVE_MAP_READ 패치는 **postgres 단독**(mysql/mssql/oracle 부재 — 검증됨). SPEC 은 "4 벤더"를 명시하므로 **SPEC 을 따라 4 벤더 작성**(선례의 postgres-only 를 답습하지 않음).

→ 검증: A3 의 4 벤더 SQL 각각 문법 유효 + create_all_table 권한 테이블 구조와 정합.

### STAGE B — nori-tc-common: tc_eqp.line_key 양 ORM + tc_line 풀 매핑 + publish

> 각 변경마다 실패 테스트 먼저(AC 원칙). 모듈 단위 `./gradlew :db:...:test`.

**B1. 도메인 record (tc-db-domain)**

- `TcEqp` record 에 `long lineKey` 를 **eqpId 다음(index 2)** 삽입 ([TcEqp.java:40-58](../../../nori-tc-common/db/tc-db-domain/src/main/java/com/nori/tc/db/domain/eqp/TcEqp.java)). javadoc 스키마 요약에 line_key 추가.
- 신규 `TcLine` record (tc_user_group 답습): `lineKey, lineCode, lineName, description, isActive, createdAt, updatedAt`. (감사컬럼 created_at/updated_at 만, sort_order 없음)

**B2. UpsertTcEqp command (tc-db-core)**

- `long lineKey` 를 eqpId 다음 삽입 + compact 생성자 검증 `if (lineKey <= 0) throw ...` ([UpsertTcEqp.java:26-79](../../../nori-tc-common/db/tc-db-core/src/main/java/com/nori/tc/db/core/eqp/upsert/UpsertTcEqp.java)).
- 신규 `TcLineStore` core 포트 (TcUserGroupStore 답습): 최소 `findAll(PageRequest)` + `findAllByKeyIn(Collection<Long>)`(live-map 조인용) + `findByKey`(eqp create 검증용) + `findByLineCode`. 정렬 line_code.

**B3. JPA (tc-db-jpa-common-schema)**

- `TcEqpEntity`: `@Column(name="line_key", nullable=false) private Long lineKey;` + getter/setter + **all-args 생성자 (15→16 args)** 에 lineKey 추가 ([TcEqpEntity.java:116-148](../../../nori-tc-common/db/jpa/tc-db-jpa-common-schema/src/main/java/com/nori/tc/db/jpa/common/entity/eqp/TcEqpEntity.java)). @PrePersist 는 lineKey 기본값 **금지**(NOT NULL, 반드시 command 제공).
- `TcEqpEntityMapper`: `toDomain` 은 이름 기반 자동 매핑(lineKey 자동). `updateEntity(command, entity)` 도 lineKey 가 @Mapping ignore 목록에 없으므로 자동 매핑됨 → 별도 코드 불요(확인: [TcEqpEntityMapper.java:30-35](../../../nori-tc-common/db/jpa/tc-db-jpa-common-schema/src/main/java/com/nori/tc/db/jpa/common/mapper/eqp/TcEqpEntityMapper.java) ignore 에 lineKey 없음 → JPA upsert 경로 자동 반영).
- 신규 `TcLineEntity` + `TcLineEntityMapper` + `TcLineJpaRepository` + `TcLineJpaStore` (user 패키지 답습, `line` 패키지).
- `TcDbJpaStoreConfiguration` / `TcDbJpaMapperConfiguration` 에 TcLine 빈 등록 (tc_user_group 등록 방식 답습 — ComponentScan 아님).

**B4. MyBatis (tc-db-mybatis-common-schema) — 공유 INSERT line_key 반영 (SPEC 강조)**

[TcEqpMapper.xml](../../../nori-tc-common/db/mybatis/tc-db-mybatis-common-schema/src/main/resources/mybatis/common/eqp/TcEqpMapper.xml) 변경 (모두 positional 정합 유지):
- `resultMap <constructor>`: `<arg column="line_key" javaType="_long"/>` 를 **eqp_id arg 다음**(index 2) 삽입.
- `TcEqpColumns` sql fragment: `line_key` 추가 (eqp_id 다음).
- **INSERT**: 컬럼 목록 + VALUES 에 `line_key` / `#{e.lineKey}` 추가 ← **SPEC 핵심: 누락 시 eqp 생성 깨짐**.
- **UPDATE SET**: `line_key = #{e.lineKey}` 추가 (eqp 수정 시 라인 재배정 허용).
- `TcEqpMybatisStore.upsert` 의 `new TcEqp(...)` ([line 76-94](../../../nori-tc-common/db/mybatis/tc-db-mybatis-common-schema/src/main/java/com/nori/tc/db/mybatis/common/store/eqp/TcEqpMybatisStore.java)): `command.lineKey()` 를 index 2 삽입.
- 신규 `TcLineMapper` + `TcLineMapper.xml` + `TcLineMybatisStore` (user 답습).
- `TcDbMybatisStoreConfiguration` 에 TcLine 등록.

**B5. 공유 record 변경 blast radius — common 내부 테스트 수정**

`new TcEqp(...)` positional (common, index 2 에 lineKey 삽입):
- [TcEqpMybatisStore.java:76](../../../nori-tc-common/db/mybatis/tc-db-mybatis-common-schema/src/main/java/com/nori/tc/db/mybatis/common/store/eqp/TcEqpMybatisStore.java) (생산 — B4 에서 처리)
- `TcEqpModelMapperIntegrationTest.java`, `TcEqpHsmsMybatisStoreTest.java`, `TcEqpSocketMybatisStoreTest.java` (MyBatis 테스트)

`new TcEqpEntity(...)` positional (15→16 args):
- `TcEqpHsmsJpaStoreTest.java`, `TcEqpSocketJpaStoreTest.java`

`new UpsertTcEqp(...)`:
- `UpsertTcEqpValidationTest.java` — + lineKey 검증 케이스 신규(`lineKey<=0` 거부) 추가.

신규 테스트(AC): tc_eqp line_key 매핑/INSERT/스토어 라운드트립(JPA+MyBatis 각), TcLineStore CRUD/조회.

**B6. publish 버전 발행**

- `./gradlew build` PASS → `./gradlew publishToMavenLocal` (의존 레포 통합 검증용). 버전 bump 정책은 기존 컨벤션 따름.

→ 검증: `cd nori-tc-common && ./gradlew build` PASS (출력 마지막 5~10줄 인용) → `publishToMavenLocal`.

### STAGE C — nori-tc-ui-backend

> common 산출물(publishToMavenLocal) 소비. 각 AC 당 실패 테스트 먼저.

**C1. UiEqp + 매퍼에 lineKey (tc-ui-domain / tc-ui-db-adapter)**

- `UiEqp` record 에 `long lineKey` index 2 삽입 ([UiEqp.java:10-28](../../../nori-tc-ui-backend/ui/tc-ui-domain/src/main/java/com/nori/tc/ui/domain/eqp/UiEqp.java)).
- `UiEqpDbMapper.toDomain(TcEqp)` ([UiEqpDbMapper.java:36](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/mapper/UiEqpDbMapper.java) positional `new UiEqp(...)`): lineKey 매핑 추가.
- `new UiEqp(...)` blast radius (전부 index 2 삽입):
  - 생산: UiEqpDbMapper.java:36, [EqpDirectScenarioLocalMutationCoordinator.java:211](../../../nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/service/EqpDirectScenarioLocalMutationCoordinator.java) (publish-first finalize 의 updatedEqp 합성)
  - 테스트: DemoControllerTest, DeployServiceTest(2), EqpDirectScenarioServiceTest(3), LiveMapQueryServiceTest

**C2. 신규 Line 조회 포트/어댑터/서비스 + GET /api/line (헥사고날 @Import)**

JpaGroupCrudPort/GroupController 패턴 mirror:
- core: `LineQueryPort`(포트) + `LineQueryService` 또는 facade. (GroupAdminFacade 대응)
- db-adapter: `JpaLineQueryPort implements LineQueryPort` — common `TcLineStore` 주입해 래핑.
- web-adapter: `LineController` `@GetMapping("/api/line")` → 활성 라인 목록, line_code 정렬. 응답 DTO `LineResponse(lineKey, lineCode, lineName)`.
- ⚠ **ModuleConfiguration @Import 등록 필수 (ComponentScan 금지)**:
  - `UiDbAdapterModuleConfiguration` 에 `JpaLineQueryPort`
  - `UiCoreServiceModuleConfiguration` 에 `LineQueryService`
  - `UiWebAdapterModuleConfiguration` 에 `LineController` (+ facade/assembler 있으면)
  - 누락 시 컴파일 성공·런타임 `NoResourceFoundException`. PR 전 `validate-module-imports` skill 권장.

**C3. eqp 생성/수정에 line_key 필수 수용 + 사전등록 검증**

line_key 관통 체인 (전부 record 라 컴파일러가 누락 강제):
- 웹 DTO: `EqpCreateRequest` + `EqpUpdateRequest` 에 `Long lineKey` (@NotNull) 추가.
- 명령: [EqpManagementCommand.Create](../../../nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/eqp/EqpManagementCommand.java) (line 100-117) + `.Update` (136-151) 에 `long lineKey` 추가.
- 변환: `EqpControllerCommandSupport.toCreateCommand/toUpdateCommand` 에 lineKey 전달.
- 영속화: [JpaEqpCrudPort.java:124-139(create), 176-191(update)](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/JpaEqpCrudPort.java) 의 `new UpsertTcEqp(...)` 에 `command.lineKey()` index 2 삽입.
- **사전등록 검증(서버, SPEC: 미등록·누락 거부)**: eqp create/update validator 에서 `tcLineStore.findByKey(lineKey)` 부재 시 거부. 위치는 EqpDirectScenarioService 의 validator 단계(기존 검증 흐름) 또는 JpaEqpCrudPort 진입부. 기존 검증 패턴 답습.

**C4. live-map 실 라인 조인 (하드코딩 A_LINE 제거)**

- [JpaLiveMapPrefetchPort](../../../nori-tc-ui-backend/ui/adapter/tc-ui-db-adapter/src/main/java/com/nori/tc/ui/adapter/db/JpaLiveMapPrefetchPort.java): prefetch 에 7번째 query — eqps 의 distinct `lineKey` → `tcLineStore.findAllByKeyIn(...)` → `Map<Long, TcLine>`.
- `LiveMapEqpPrefetchRow` ([record](../../../nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/eqp/LiveMapEqpPrefetchRow.java))에 line 정보 부착 — `String lineCode, String lineName` 2 필드 추가(또는 `LiveMapPrefetchSnapshot` 에 lineByKey 맵 추가). row 부착 방식이 service 변경 최소.
- [LiveMapQueryService.java:77-78](../../../nori-tc-ui-backend/ui/tc-ui-core/src/main/java/com/nori/tc/ui/core/service/LiveMapQueryService.java): `DEFAULT_LINE_VALUE`/`DEFAULT_LINE_LABEL` 상수 제거 → row 의 lineCode/lineName 사용. (`LiveMapEquipmentView` 는 lineValue/lineLabel @NonNull 이므로 라인 없는 eqp 가 없도록 NOT NULL FK 가 보장)
- 신규 테스트: "설비는 자신의 tc_line 의 lineValue/lineLabel 을 반환한다"(하드코딩 회귀 차단) + "line_key 누락·미등록 거부".

→ 검증: `cd nori-tc-ui-backend && ./gradlew build` PASS (출력 인용).

### STAGE D — nori-tc-gateway / nori-tc-business: 재컴파일 + 테스트 수정 (런타임 무변경)

검증 결과 **둘 다 tc_eqp READ-ONLY** (route_partition 기반 로딩/라우팅, INSERT 0건):
- gateway: [GatewayEquipmentService.java:113,205](../../../nori-tc-gateway/gateway/adapter/tc-gateway-db-adapter/src/main/java/com/nori/tc/gateway/adapters/db/GatewayEquipmentService.java) `findAllByRoutePartitionsAndEnabled` 만. line 조건 불요·불추가.
- business: `BusinessEqpRoutePartitionDbAdapter` 는 인메모리 스냅샷 read-only, `BusinessModelRuntimeCache` 는 `eqpStore.findAll` read-only.

**positional `new TcEqp(...)` 테스트 수정만 (index 2 lineKey 삽입)**:
- gateway: `GatewaySocketPluginRuntimeManagerTest.java` (createSocketEqp fixture)
- business: `BusinessModelRuntimeCacheTest.java`(3곳), `BusinessWorkflowPluginRuntimeManagerTest.java`(createEqp fixture)

→ 검증: **build-trace** skill — common 재발행 후 gateway/business bootJar 빌드 PASS (회귀 0). 대상 앱: `gateway/starter/tc-gateway-starter`, `business/starter/tc-business-starter`.

### STAGE E — nori-tc-ui-front

> tsc/eslint/unit/e2e 게이트.

**E1. 권한 상수 (permission.ts)**

- [permission.ts:5](../../src/shared/lib/permission.ts) `DASH_READ_PERMISSION='LIVE_MAP_READ'` 다음에 `export const LIVE_MAP_LAYOUT_WRITE_PERMISSION = 'LIVE_MAP_LAYOUT_WRITE'` 추가. `hasPermission(useMe().permissionCodes, ...)` 배선만 (Phase 1 은 사용처 시드, 실제 게이팅은 Phase 2).

**E2. GET /api/line 훅 + 라인 도메인**

- `useLiveMap` 패턴 mirror ([useLiveMap.ts](../../src/features/live-map/hooks/useLiveMap.ts)): `lineApi.getLineList()` + `useLineList()` (`staleTime: 60_000`, refetchInterval 없음 — 마스터성). api-client(`baseURL:'/api'`) 사용.
- 응답 타입 `LineOption { value: line_code, label: line_name }` (드롭다운/폼 공용).

**E3. 상단바 라인 드롭다운 (AppTopBar)**

- [AppTopBar.tsx:182-184](../../src/shared/components/AppTopBar.tsx) `<ThemeToggle/>` ↔ `<LanguageToggle/>` 사이(=dark/light 버튼 왼쪽)에 라인 셀렉터 삽입. `LanguageToggle.tsx` 드롭다운 스타일 답습.
- `GET /api/line` 로 채움, line_code 정렬. mock `LIVE_MAP_LINE_OPTIONS` 대체.

**E4. 전역 라인 스코프 (Zustand)**

- 현재 `live-map-ui.store.ts` 에 `selectedLine` 상태 **없음** → 추가. 선택 라인 = 전역 스코프, 선택 라인 설비만 표시.
- `live-map.mock.ts` 의 하드코딩 `lineValue:'A_LINE'` 제거 — 실 API(`GET /live-map`)가 라인 반환(STAGE C4) → 셀렉터에서 라인 필터링.
- ~~⚠ `LiveMapToolbar.tsx` 는 lineOptions prop 보유하나 현재 미연결 — 통합 필요.~~
  → **통합 계획 폐기, 파일 제거됨**(wm-parity-foundation SPEC 결정 2). 검색/상태 필터는
  [LiveMapBoard.tsx:571](../../src/features/live-map/components/LiveMapBoard.tsx#L571)(검색어) 와
  [LiveMapBoard.tsx:579](../../src/features/live-map/components/LiveMapBoard.tsx#L579)(상태) 가 담당한다.

**E5. eqp 폼 line Select (필수, 자유입력 금지)**

- [EqpManageFormModal.tsx:1147-1164](../../src/features/eqp/components/EqpManageFormModal.tsx) 의 'Socket Protocol Type' shadcn Select 답습 → line Select 추가. `useLineList()` 옵션. 미선택 시 저장 차단(기존 검증 패턴 `throw new Error(t('eqp.form.lineRequired'))`).
- `EqpCreateRequest`/`EqpUpdateRequest` (프론트 타입)에 `lineKey` 추가, `useEqpMutations` 통해 전송.

**E6. i18n**

- 라벨("라인 선택" 등)은 ko 카탈로그 `src/i18n/locales/ko.json` t() 경유. **라인 코드/이름 값 자체는 데이터(번역 대상 아님)** — TC jargon 영어 유지 정책과 무관(값은 DB 데이터).

**E7. 테스트**

- unit: 라인 스코프 selector 유닛 테스트.
- e2e `tests/e2e/live-map-line-scope.spec.ts`: 상단바 드롭다운 전환 시 설비가 해당 라인만 + `page.on('console')` error 0 + `page.on('pageerror')` 0.
- e2e `tests/e2e/eqp-line-select.spec.ts`: 폼 line 드롭다운 `GET /api/line` 채움·선택·저장, 미선택 저장 차단 + console.error 0 + pageerror 0.

→ 검증: `npx tsc -b` exit 0 / `npx eslint src` exit 0 / `npm run test:unit` PASS / e2e 2 spec PASS(출력 인용).

---

## 4. 통합 검증 순서 (AC 매핑)

1. `cd nori-tc-common && ./gradlew build` → PASS (AC1)
2. `cd nori-tc-common && ./gradlew publishToMavenLocal` (AC2 전제)
3. `cd nori-tc-ui-backend && ./gradlew build` (로컬 산출물 소비) → PASS (AC2, AC4, AC5, AC6)
4. **build-trace** (gateway/business bootJar) → PASS, 회귀 0 (AC3)
5. ui-front: `npx tsc -b` / `npx eslint src` / `npm run test:unit` / e2e 2종 (AC7~AC11)
6. exec 4 벤더 create_all_table ↔ patch 정합 (AC12)

---

## 5. 위험 (Risk)

| # | 위험 | 영향 | 완화 |
|---|---|---|---|
| R1 | positional record(TcEqp/UiEqp/UpsertTcEqp/TcEqpEntity) index 2 삽입 시 일부 호출처 누락 | 컴파일 실패(가벼움) 또는 잘못된 컬럼 매핑(무거움) | 컴파일러가 record arg 수 강제. 단 **resultMap `<constructor>` arg 순서는 컴파일 검증 안 됨** → 런타임 매핑 오류 위험. MyBatis 라운드트립 테스트로 차단 |
| R2 | MyBatis INSERT 에 line_key 누락 | eqp 생성 시 NOT NULL 위반 런타임 실패 | B4 INSERT 명시 변경 + 생성 라운드트립 테스트 (SPEC 강조점) |
| R3 | tc_line 을 create_all_table 에서 tc_eqp **뒤**에 배치 | fresh install 시 FK 참조 대상 부재로 DDL 실패 | tc_eqp(326) **앞** 배치 강제 (위상 정렬) |
| R4 | backfill 순서 위반(②④ 사이 backfill 누락) | 기존 행 NOT NULL 위반으로 ALTER 실패 | 단일 트랜잭션 4-step 엄수, 3→4 사이 NULL 0행 보장 |
| R5 | GET /api/line 권한 미시드 | closed-by-default 로 전 사용자 403 → 드롭다운 빈값/에러 | A3 권한 패치 + 전 그룹 backfill ([D3](#d3)). e2e console.error 0 게이트로 탐지 |
| R6 | ModuleConfiguration @Import 누락(Line* 신규 빈) | 컴파일 성공·런타임 NoResourceFoundException | C2 3개 ModuleConfiguration 등록 + validate-module-imports skill |
| R7 | 벤더별 멱등 INSERT/ALTER 문법 차이 무시(복붙) | mysql/mssql/oracle 패치 실행 실패 | 벤더별 작성, A2/A3 문법 표 참조 |
| R8 | common publish 버전 미반영 → ui-backend 가 구 산출물 빌드 | line_key 없는 옛 TcEqp 로 컴파일/런타임 불일치 | publishToMavenLocal 후 ui-backend clean build, 버전 bump 확인 |
| R9 | UiEqp 에 lineKey 추가가 deploy/demo 등 무관 서비스 테스트 다수 깨뜨림 | 광범위 테스트 수정 | C1 blast radius 목록(9곳) 기반 일괄 수정 |

---

## 6. 롤백 (Rollback)

> 미커밋 branch `docs/nori-client-forked-migration` 기준 작업. 단계별 격리.

- **exec DDL/패치**: 신규 SQL 파일 삭제 + create_all_table diff revert. 운영 DB 적용 전이면 무비용. 적용 후면 역마이그레이션 SQL(드롭 FK→드롭 컬럼→드롭 tc_line, 권한 행 삭제) 필요 — patch 파일에 역순 주석 포함 권장.
- **common**: line_key/tc_line 커밋 revert + 이전 publish 버전으로 ui-backend 의존 고정. **이미 publish 된 버전은 immutable** → 새 패치 버전으로 롤포워드(되돌림 발행)이 안전. (gateway/business 는 read-only 라 common revert 만으로 원복)
- **ui-backend**: STAGE C 커밋 revert. live-map 은 DEFAULT_LINE_VALUE 하드코딩으로 자동 복귀(STAGE C4 revert 시).
- **ui-front**: STAGE E 커밋 revert. mock LIVE_MAP_LINE_OPTIONS 복원.
- **gateway/business**: 테스트 fixture revert (런타임 코드 무변경이라 위험 최소).

권장: **레포별 분리 커밋 + 단계 게이트**(common 통과 → ui-backend → ui-front)로 부분 롤백 용이하게.

---

## 7. Decisions — 사용자 확정 완료 (2026-06-02)

> 4 항목 모두 사용자가 권장안 선택. Implement 는 아래 확정값을 입력으로 사용한다.

<a id="d1"></a>**D1. tc_line ORM 매핑 위치 → ✅ nori-tc-common 풀 매핑** (tc_user_group 답습). 근거: [0.1](#01--tc_line-orm-매핑은-nori-tc-common-에-풀-매핑되어야-한다-spec-common-불릿보다-범위-큼). TcLine record + TcLineStore core 포트 + JPA/MyBatis 양 ORM + config 등록을 common 에 신설. ui-backend 는 common TcLineStore 를 래핑(JpaGroupCrudPort 패턴). **SPEC common 작업 범위 확대 승인됨.**

<a id="d2"></a>**D2. lineKey record 위치 → ✅ eqpId 다음(index 2)**. 근거: 현 TcEqp record 순서가 DDL 컬럼 순서와 정확히 일치하는 불변식([2장](#2-tc_eqpline_key-의-데이터-타입위치-결정-근거-포함)). record/UpsertTcEqp/UiEqp/resultMap `<constructor>`/TcEqpColumns/INSERT/전 positional 호출처 모두 index 2 삽입.

<a id="d3"></a>**D3. GET /api/line 노출 + 권한 → ✅ 전역 상단바 + 신규 `LINE_READ` 3그룹 backfill**. 근거: [0.2](#02-get-apiline-은-권한-카탈로그-시드가-필요하다-closed-by-default) closed-by-default + AppTopBar 전역 렌더([AppPageShell.tsx:23](../../../nori-tc-ui-front/src/shared/components/AppPageShell.tsx)) + 그룹 3종 확정([postgres_insert_sample_data.sql:732-734](../../../nori-tc-exec/docs/db_table/sample_data/postgres_insert_sample_data.sql)).
- 신규 `tc_ui_permission` 행: `perm_code='LINE_READ'`, `resource_type='API'`, `match_type='EXACT'`, `resource='/api/line'`, `http_method='GET'`.
- `tc_user_group_permission` backfill: `WHERE g.group_code IN ('ADMIN','DEVELOPER','OPERATOR')` (기존 IN-3그룹 backfill 선례 답습). 4 벤더 멱등.
- 드롭다운은 상단바 전역 노출(SPEC 문면). 비-admin(DEVELOPER/OPERATOR) 도 LINE_READ 보유 → 403/console.error 없음.

<a id="d4"></a>**D4. LIVE_MAP_LAYOUT_WRITE Phase 1 시드 → ✅ Phase 2 경로 예약 + PREFIX**. 시드값: `perm_code='LIVE_MAP_LAYOUT_WRITE'`, `resource_type='API'`, `match_type='PREFIX'`, `resource='/api/live-map/layout'`, `http_method=NULL`. ADMIN backfill(SPEC req). Phase 2 enforce 가 재시드 없이 정합. 4 벤더 멱등.

<a id="d5"></a>**D5. tc_line schema 모듈 → ✅ common-schema** (site-schema 아님). tc_eqp/tc_user_group 모두 common-schema(검증됨). 추가 확인 불요.

---

## 8. Out of Scope 재확인 (Phase 1 에서 손대지 않음)

- `GatewayEquipmentProfileSnapshot` Kafka 계약 — line 미포함 유지 ([0.4](#04-kafka-계약-변경-0-검증-완료)).
- gateway/business 런타임 line 활용(라우팅/조건) — 컬럼 추가 + read-only 호환까지만.
- Phase 2 캔버스/3 테이블(tc_live_map_object/layout/placement)/react-konva — 별도.
- 라인별 **조회** 권한 분리 — 전 라인 조회 가정.

---

## 9. Implement 진입 시 산출물

`.claude/specs/live-map-layout-builder-phase1-dev-report.md` 에 기록:
- 변경 파일 경로 목록 (레포별)
- 각 `./gradlew build` / build-trace / tsc / eslint / unit / e2e 결과 PASS/FAIL + 출력 마지막 5~10줄
- 어떤 ModuleConfiguration @Import 에 무엇 추가했는지 (Line* 3개)
- D1~D4 결정 확정값 + 근거
- lineKey 삽입 index 2 가 적용된 positional 호출처 전수 처리 확인
