# PLAN: i18n-language-addition — vi(베트남어) 첫 실행 구현 계획

> SDD Plan 단계 산출물. 입력 SPEC: [.claude/specs/i18n-language-addition.md](i18n-language-addition.md).
> 본 계획은 vi 1개 언어 추가의 구체 실행 계획이다. 코드 수정/명령 실행은 Implement 단계에서 수행.

## 0. 검증 결과 요약 (Plan 단계에서 파일로 직접 확인한 사실)

| 항목 | SPEC 기재 | 재실측 결과 | 출처 |
|---|---|---|---|
| 전체 키 수 | 893 | **893** (ko=en=893) | node 전수 비교 |
| ko==en 값-동일 키 | 13 | **13** (SPEC 표와 키·값 완전 일치) | node 전수 비교 |
| only-in-ko / only-in-en | 0 / 0 | **0 / 0** (parity 정상) | node 전수 비교 |
| Deploy(배포) 번역 범위 | 명시 없음 | ko 값에 "배포" 포함 **16개 키** | node grep |

**검증으로 드러난 SPEC 4-touch-point 밖 추가 영향점 2곳** (워크스페이스 전체 grep `=== 'ko'|=== 'en'` 결과 정확히 이 2개 파일에만 존재):

1. **[src/i18n/index.ts:20](../../src/i18n/index.ts#L20)** — detector `lookup()` 의 localStorage 화이트리스트가 `stored === 'ko' || stored === 'en'` 로 하드코딩. vi 선택 후 `cacheUserLanguage('vi')` 로 localStorage='vi' 저장되지만, 다음 로드 시 lookup 이 'vi' 를 통과시키지 않아 navigator fallback → 'en' 복귀. **vi 가 새로고침 후 유실됨** (주 사용자=베트남 현장 작업자에게 치명적 UX).
2. **[src/features/auth/components/LoginPage.tsx:287,292](../../src/features/auth/components/LoginPage.tsx#L287)** — LanguageToggle 과 **별개의 이진 토글**. line287 `setLang(lang === 'ko' ? 'en' : 'ko')` (ko↔en 만 순환, vi 도달 불가), line292 `lang === 'ko' ? t('language.ko') : t('language.en')` (vi 일 때 'English' 오표시).

**`language.ko`/`language.en` 는 dead 아님** — 위 LoginPage.tsx:292 삼항식에서 렌더에 사용 중. (LanguageToggle 은 LANGUAGES 배열 라벨을 하드코딩하지만, LoginPage 는 t() 경유.)

**`livemap.live` ("Map Live") 는 dead 확정** — 워크스페이스 전체 grep 결과 `en.json`/`ko.json`/SPEC 에만 존재, 코드 `t()` 참조 0건. (parity 위해 키는 보존.)

**Tier B 컴포넌트 맥락**:
- `deploy.register.upload "Upload"` → [DeployRegisterPanel.tsx:1390](../../src/features/deploy/components/DeployRegisterPanel.tsx#L1390), `disabled` + title="추후 연동 예정"(coming soon) 버튼. 배포 등록 패널.
- `livemap.kpi.total "TOTAL"` → [LiveMapHeader.tsx:38](../../src/features/live-map/components/LiveMapHeader.tsx#L38). 5개 KPI 타일 중 i18n 키는 이것뿐. 형제 RUN/IDLE/ERROR/DOWN 은 [LiveMapHeader.tsx:9-18](../../src/features/live-map/components/LiveMapHeader.tsx#L9) `KPI_TILES` 배열에 **하드코딩 영어**(i18n 미경유, 번역 불가).
- `livemap.live "Map Live"` → dead (위).

**Tier A 토큰 매칭 실측** (AC3 설계 근거 — en 값에서 substring vs `\b토큰\b` word-boundary 매치 수):

| 분류 | 토큰 | substr=wb (FP 무) |
|---|---|---|
| 정확 일치 (FP 위험 없음) | Business(11) Eqp(3) Gateway(5) DLQ(7) MES(1) Jar(6) Param(3) PORT(1) MDF(8) DCOP(12) Repair Task(3) Interface Type(2) SECS(2) HSMS(1) Check In(1) EventId(1) Reference(1) | substr==wb |
| 복수형만 차이 (substr>wb) | Model(24/22; "All Models") Flow(24/23; "No Flows") Step(3/2; "Steps") | 영어 복수형이 유일 차이 |
| en 출현 0건 (현재 vacuous) | Identity Trigger Collection Rule Variable Id Source MDF Parent Model Commit Diff Preview | 검사 no-op |

→ **case-sensitive `\b토큰\b` (ASCII word boundary)** 매칭이 안전. 유일한 substr>wb 차이는 영어 복수형(Models/Flows/Steps)이며, 이는 그 자체가 jargon 어근이라 vi 에서도 "Model"/"Flow"/"Step" 보존됨 → word-boundary 미검사여도 실질 위반 불가. en 출현 0건 토큰 7개는 현재 검사 no-op(미래 대비 글로사리) — 침묵 누락 아니라 테스트에 명시 기록.

---

## A. 영향 파일 목록 (총 9개: 신규 2, 수정 7)

### A-1. 핵심 i18n touch-point (SPEC 4개 + 검증으로 추가된 2개 = 6개)

| # | 파일 | 변경 요지 | SPEC 절차 / 추가 |
|---|---|---|---|
| 1 | [src/i18n/locales/vi.json](../../src/i18n/locales/vi.json) | **신규**. 894 키(현 893 + `language.vi`), 정책대로 vi 번역 | SPEC 절차 1 |
| 2 | [src/i18n/config.ts:11](../../src/i18n/config.ts#L11) | `supportedLngs: ['ko','en']` → `['ko','en','vi']` | SPEC 절차 2 |
| 3 | [src/i18n/i18n-context.ts:4](../../src/i18n/i18n-context.ts#L4) | `type Lang = 'ko'|'en'` → `'ko'|'en'|'vi'` | SPEC 절차 3 |
| 4 | [src/i18n/LanguageToggle.tsx:7-10](../../src/i18n/LanguageToggle.tsx#L7) | `LANGUAGES` 배열에 `{ code:'vi', label:'Tiếng Việt' }` 추가 + `export LANGUAGES` (LoginPage 재사용 위해) | SPEC 절차 4 |
| 5 | [src/i18n/index.ts:20](../../src/i18n/index.ts#L20) | localStorage 화이트리스트를 `i18nBaseOptions.supportedLngs` 기반으로 일반화 (**사용자 승인**, SPEC 절차 6 보강) | **추가** |
| 6 | [src/features/auth/components/LoginPage.tsx:287,292](../../src/features/auth/components/LoginPage.tsx#L287) | 라벨 `t('language.${lang}')` + 토글을 LANGUAGES 순환으로 (**사용자 승인**) | **추가** |

### A-2. 전 locale parity 유지 (`language.vi` 키 추가)

| # | 파일 | 변경 요지 |
|---|---|---|
| 7 | [src/i18n/locales/ko.json](../../src/i18n/locales/ko.json) | `"language.vi": "Tiếng Việt"` 추가 (893→894). **그 외 값 무변경** |
| 8 | [src/i18n/locales/en.json](../../src/i18n/locales/en.json) | `"language.vi": "Tiếng Việt"` 추가 (893→894). **그 외 값 무변경** |

### A-3. 검증 자산 (신규)

| # | 파일 | 변경 요지 |
|---|---|---|
| 9 | tests/i18n-vi-parity.test.ts | **신규**. AC1/AC2/AC3/AC4 단위 테스트. raw JSON 직접 import (i18next 미경유) |
| (선택) | tests/e2e/i18n-language-toggle.spec.ts | **신규(권장)**. AC7 e2e. auth mock + LanguageToggle 에서 vi 선택 → vi 렌더 + console/pageerror 0 |

---

## B. 단계별 순서 (각 단계 끝에 검증 방법 명시)

> Implement 는 SPEC 의 "각 AC 당 실패 테스트 먼저" 원칙을 따른다. 단위 테스트(9) 를 먼저 작성하면
> vi.json 부재로 import 에러(red) → vi.json 생성 후 assertion red → 보정 후 green 의 TDD 흐름.

### Step 1 — 검증 테스트 골격 작성 (red)
- tests/i18n-vi-parity.test.ts 작성: `import vi from '../src/i18n/locales/vi.json' with { type:'json' }` + ko/en 동일. (기존 [i18n-test-instance.ts:2-3](../../tests/i18n-test-instance.ts#L2) 이 같은 JSON import attribute 사용 → node 22 + `--experimental-strip-types` 에서 동작 확인됨.)
- **검증**: `npm run test:unit` → vi.json 미존재로 import 실패(red). 이 red 가 "테스트가 실제 대상을 본다"는 증거.

### Step 2 — vi.json 생성 (parity 우선 확보)
- en.json 을 **키 구조 그대로 복사**(894 키, `language.vi` 포함)하여 vi.json 시드 → AC1(parity) 구조적 보장.
- 각 값 채우기:
  - **Layer1 13키**: en 값 verbatim 유지. 예외 — `deploy.register.upload` → `"Tải lên"`(D1 결정), `language.vi` → `"Tiếng Việt"`. (`language.ko`="한국어", `language.en`="English" 유지.)
  - **나머지 880키**: ko.json 의 한글 prose 를 vi 로 번역, 임베드 Tier A 토큰 영어 보존. Deploy(배포) 16키 → "Triển khai" 계열(D2).
- **검증**: `npm run test:unit` → AC1(parity) PASS, AC2/AC4 PASS, AC3 는 jargon 보존 위반 키 목록 출력(red 가능).

### Step 3 — AC3 위반 보정 루프
- Step1 테스트의 AC3 assertion 이 출력하는 "Tier A 토큰이 en 엔 있으나 vi 에서 사라진 키" 목록을 보고 해당 키만 토큰 복원.
- **검증**: `npm run test:unit` → 4 test PASS(AC1~AC4) + 기존 테스트 회귀 0.

### Step 4 — touch-point 6개 반영
- config.ts(2) / i18n-context.ts(3) / LanguageToggle.tsx(4) / index.ts(5) / LoginPage.tsx(6) / ko.json·en.json(7,8) 수정.
- index.ts(5) 변경 sketch:
  ```ts
  const stored = window.localStorage.getItem(STORAGE_KEY)
  const supported = i18nBaseOptions.supportedLngs
  if (stored && Array.isArray(supported) && supported.includes(stored)) {
    return stored
  }
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en'  // 이 줄(SPEC step6)은 무변경
  ```
- LoginPage.tsx(6) 변경 sketch: 라벨 `<span>{t(`language.${lang}`)}</span>`(language.{ko,en,vi} 키 live 유지), 토글은 `LANGUAGES`(export 받음) 순환 — 현재 lang 인덱스 +1 modulo.
- **검증**: `npm run build` (`tsc -b && vite build`) PASS → AC5. (vi.json valid JSON + Lang 타입 정합 + 동적 import 경로 해석.)

### Step 5 — e2e(AC7/AC8, 권장)
- tests/e2e/i18n-language-toggle.spec.ts: [eqp-line-select.spec.ts](../../tests/e2e/eqp-line-select.spec.ts) 의 auth mock 패턴(`**/api/auth/me` → 사용자) 답습, `page.goto('/eqp')` → AppTopBar 의 LanguageToggle 노출.
  - LanguageToggle 드롭다운 펼쳐 옵션 3개(한국어/English/**Tiếng Việt**) 노출 확인.
  - "Tiếng Việt" 클릭 → `eqp.sidebar.title` 가 vi 값으로 렌더. (브리틀 회피: 스펙에서 `vi.json` import 해 `vi['eqp.sidebar.title']` 와 비교, 또는 en 값 "Equipment" 아님 + raw key 아님 단언.) → **AC7**.
  - `page.reload()` 후 LanguageToggle 활성 언어가 여전히 vi 단언(화이트리스트 supportedLngs 추종 회귀 가드) → **AC8**.
  - `page.on('console'|'pageerror')` error 0건 단언.
- **검증**: `npm run test:e2e -- i18n-language-toggle` PASS → AC7/AC8.

### Step 6 — 전체 회귀 + dev-report
- **검증**: `npm run test:unit`(전체) + `npm run build` + `npm run test:e2e` PASS, 출력 마지막 5~10줄 인용.
- `.claude/specs/i18n-language-addition-dev-report.md` 작성(변경 파일/테스트 결과/결정).

---

## C. 위험 & 롤백

| # | 위험 | 시나리오 | 완화 | 롤백 |
|---|---|---|---|---|
| R1 | parity 깨짐 | vi.json 키 누락/오타로 en 과 키 집합 불일치 → fallbackLng:'ko' 가 raw key 노출 숨김(빌드는 통과해 은닉) | AC1 단위 테스트가 빌드 전 차단. en 복사 시드로 구조 보장 | vi.json 되돌림. en/ko 무변경이라 격리됨 |
| R2 | jargon 오번역 | 기계번역이 "Model"→"Mô hình", "Gateway"→"Cổng" 등 Tier A 토큰 번역 | AC3 word-boundary 검사가 위반 키 목록 출력 → Step3 보정 | 해당 키만 토큰 복원 |
| R3 | 빌드 실패 | vi.json invalid JSON / Lang 타입 누락 / 동적 import 미해석 | AC5 `npm run build` 게이트 | touch-point 6개 개별 revert 가능(독립 diff) |
| R4 | 단위테스트 회귀 | i18n-test-instance(ko/en) 변경 없음 → 기존 89 테스트 영향 무. 새 test 만 추가 | 신규 test 는 독립 파일, 기존 import 미변경 | 신규 test 파일 삭제 |
| R5 | 번역 품질(기계검증 불가) | parity/Tier A 는 통과하나 vi prose 가 어색/오역 | AC 범위 밖 — **네이티브 검수 권장**(머지 전/후). main 직접 commit 이므로 검수 게이트 사용자 판단 | 키 단위 값 교체(추가 commit) |
| R6 | index.ts 일반화 부작용 | 화이트리스트를 supportedLngs 기반으로 바꿔 의도치 않은 locale 통과 | supportedLngs=['ko','en','vi'] 로 한정, navigator fallback 줄 무변경 | index.ts 1줄 revert(하드코딩 복귀) |
| R7 | LoginPage 회귀 | 토글 순환/라벨 변경이 로그인 화면 깨뜨림 | 기존 [login-page.smoke.spec.ts](../../tests/e2e/login-page.smoke.spec.ts) 회귀 미발생 확인 | LoginPage 2줄 revert |

**전체 롤백**: 9개 파일 모두 추가/격리 변경이며 ko/en 기존 값 무변경이라, 각 파일 단위 `git checkout -- <file>` 로 부분 롤백 가능. 핵심 안전판: AC1·AC5 가 빌드 전에 parity/유효성 차단.

---

## D. 열린 항목 결정 (사용자 승인 완료)

### D1 — Tier B 현장-번역 (사용자 승인: Upload 만 번역)
| 키 | 결정 | vi 값 | 근거 |
|---|---|---|---|
| `deploy.register.upload` | **번역** | `"Tải lên"` | 배포 패널 전체가 Triển khai 로 번역되는데 'Upload' 만 영어면 부자연. disabled 라 저위험 |
| `livemap.kpi.total` | **영어 유지** | `"TOTAL"` | 형제 RUN/IDLE/ERROR/DOWN 이 하드코딩 영어 → TOTAL 만 vi 면 5칸 중 1칸 불일치 |
| `livemap.live` | **영어 유지** | `"Map Live"` | dead key(렌더 0). parity 위해 값만 보존 |

→ ko/en 의 이 3키는 **무변경**(SPEC Constraint). vi 만 `deploy.register.upload` 가 다름.

### D2 — Deploy vi 표현
- ko "배포" → vi **"Triển khai"** 확정. 파생: "배포 관리"→"Quản lý triển khai", "배포 이력"→"Lịch sử triển khai" (Implement 시 번역 검수).
- **범위**: ko 값에 "배포" 포함 **16개 키**(node 실측). en 은 이미 "Deploy"/"Deployment" 로 번역돼 있어 jargon 아님(SPEC Deploy 예외와 정합) → vi 도 번역 대상.

### D3 — parity/jargon 검증: **단위 테스트** (standalone 스크립트 아님)
- **근거**: (a) AC6 가 "단위 테스트로 추가했다면 그 테스트 포함 PASS" 를 명시 — SPEC 이 단위 테스트 경로 상정. (b) 기존 `npm run test:unit`(=AC6) 에 자동 편입돼 CI/회귀 게이트로 동작(standalone 은 별도 호출 필요·미게이트). (c) `tests/*.test.ts` glob 이 신규 파일 자동 포함.
- **로드 방식**: i18n-test-instance.ts 확장이 **아니라** vi/en/ko **raw JSON 직접 import**. 근거: i18next 인스턴스 경유 시 `fallbackLng:'ko'` 가 누락 키를 ko 로 폴백해 **parity 버그를 은닉**(rule 11 "항상 통과하는 mock" 안티패턴). 순수 데이터 비교는 raw JSON 이 정직.
- **AC별 assertion 형태**:
  - **AC1**: `new Set(Object.keys(vi))` vs `Object.keys(en)` — `onlyInVi`/`onlyInEn` 배열 length 0 단언 + `vi.length === en.length`.
  - **AC2**: 7개 Layer1 Tier A 키 배열 순회, `assert.equal(vi[k], en[k])`.
  - **AC3**: TOKENS 배열 순회 × en 키 순회, `new RegExp('\\b'+esc(token)+'\\b')` 가 `en[k]` 매치하면 같은 정규식이 `vi[k]` 도 매치 단언. 위반 키는 메시지에 누적 출력.
  - **AC4**: `vi['language.ko']==='한국어'` && `vi['language.en']==='English'` && `vi['language.vi']` && `ko['language.vi']` && `en['language.vi']` 존재 && 세 값 동일.

### D4 — Tier A verbatim 매칭: **case-sensitive `\b토큰\b` (ASCII word boundary)**
- **근거**: 0절 실측 — substr 매치와 word-boundary 매치 수가 영어 복수형(Models/Flows/Steps) 3개 키 외 전부 동일. word boundary 가 "Param⊂Parameter, MES⊂messages, Step⊂Steps" 류 부분단어 FP 를 차단.
- **case-sensitive 필수**: 대문자 약어(DLQ/MES/SECS/HSMS/MDF/DCOP/PORT)·"Model" 등이 소문자 일반 prose 와 충돌하지 않도록.
- **복수형 비검사 명시**: Models/Flows/Steps 는 word-boundary 밖 → 미검사. 단 jargon 어근이라 vi 가 자연히 보존. 테스트 주석에 "복수형 미검사 — 의도적, 어근 보존 신뢰" 기록(침묵 누락 회피).
- **en 출현 0건 토큰**(Identity/Trigger/Collection Rule/Variable Id/Source MDF/Parent Model Commit/Diff Preview): 현재 검사 no-op. 테스트가 `enHits===0` 인 토큰을 로그로 보고(미래 글로사리, 현재 무력 검사임을 명시).
- **제외 일반 영단어**(from/path/field/branch/Root/Action/Collect/transform): TOKENS 배열에 **미포함** — SPEC L48 정책대로 자동검사 제외 확인.

### D5 — vi.json 880키 번역 생성 방법
- **흐름** (Implement 단계, 작업량 대부분):
  1. **시드**: en.json → vi.json 키 복사(parity 보장).
  2. **초안**: Implement 세션이 ko prose → vi 기계번역 초안 생성(SPEC L107 기계번역 허용). Tier A 토큰은 번역 안 하도록 프롬프트 + 후처리.
  3. **자동 게이트**: `npm run test:unit` 의 AC3 가 토큰 소실 키를 적발 → 해당 키 보정(Step3 루프). 반복까지 green.
  4. **품질 검수(AC 밖, 권장)**: parity/Tier A 통과 ≠ 번역 품질 보장. main 직접 commit 이므로 네이티브/번역 검수 1회 권장(R5). 검수는 키 단위 값 교체 = 추가 commit(parity 불변).
- **결론**: 자동검증(AC1~AC4)이 jargon·구조를 강제하고, prose 품질은 별도 검수 게이트. "초안→자동검증→보정" 루프가 핵심.

### D6 — `language.vi` 라벨 추가 범위
- LANGUAGES 배열(4) + ko.json(7)/en.json(8)/vi.json(2) 의 `language.vi` 키 모두 `"Tiếng Việt"`.
- **language.* 키 상태 기록**: `language.ko`/`language.en` 은 현재 LoginPage.tsx:292 에서 live. LoginPage 를 `t('language.${lang}')` 로 일반화(D 결정)하면 **여전히 live**(동적 키) — vi 도 자동 표시. 즉 키 dead 화 없음. AC4 의 JSON 라벨이 실렌더에 쓰임이 유지됨.

---

## E. AC ↔ 단계 매핑

| AC | 검증 대상 | 충족 단계 | 검증 명령/assertion |
|---|---|---|---|
| **AC1** parity | vi 키집합 == en, 키수 동일 | Step2 | `npm run test:unit` — onlyInVi/onlyInEn length 0 + length 동일 |
| **AC2** Layer1 값보존 | 7 Tier A Layer1 키 `vi[k]===en[k]` | Step2 | 단위 테스트 assert.equal |
| **AC3** Tier A verbatim | en 토큰⊂vi (word-boundary) 위반 0 | Step3 | 단위 테스트 정규식 매칭 |
| **AC4** 네이티브 라벨 | language.{ko,en,vi} 존재·일치 | Step2 | 단위 테스트 존재·동일 단언 |
| **AC5** 빌드 | tsc + vite build PASS | Step4 | `npm run build` 출력 인용 |
| **AC6** 단위테스트 회귀 0 | 기존 + 신규 PASS | Step3,6 | `npm run test:unit` 출력 인용 |
| **AC7** 전환 동작 | LanguageToggle 3언어 + vi 렌더 + error 0 | Step5 | `npm run test:e2e` (i18n-language-toggle) |
| **AC8** vi 영속(선택) | vi 선택→reload 후 vi 유지 | Step5 | 동일 e2e, `page.reload()` 후 활성 언어 단언 |

---

## F. SPEC 수정 제안 (계획서에서 즉석 확정 금지 — Implement 전 SPEC 반영)

검증으로 SPEC 의 "i18n 4 touch-point" 모델과 절차 6이 vi 실사용을 완전히 커버하지 못함이 드러남. 아래는 **SPEC 본문 수정 제안**(Constraint: 정책/절차 변경은 SPEC 경유):

1. **절차에 touch-point 2개 추가** (4→6): (5) index.ts detector localStorage 화이트리스트를 supportedLngs 기반으로(절차 6의 navigator fallback 줄은 무변경 유지), (6) LoginPage 의 별도 토글/라벨을 LANGUAGES·`t('language.${lang}')` 기반으로.
2. **절차 6 문구 명확화**: "detector 무변경" 은 *navigator 자동감지 fallback 줄* 한정임을 명시. localStorage 화이트리스트(영속성)는 별개로 supportedLngs 추종.
3. (선택) AC7 에 "새로고침 후 vi 영속" 보조 단언 추가 — 화이트리스트 수정의 회귀 가드.

→ 이 3건은 jargon 글로사리 변경이 **아님**(Tier A/B 목록 불변). touch-point/절차 보강이므로 SPEC 의 "Per-Language Addition Procedure" + "Out of Scope(브라우저 자동감지는 여전히 제외)" 와 충돌 없음.

---

## G. Out of Scope 재확인 (SPEC 준수)

- zh/ja, 브라우저 언어 자동 감지(navigator fallback 줄 무변경), 서버측 i18n, ko/en 기존 값 표현 개선 — **모두 미포함**.
- LiveMap KPI 형제 라벨(RUN/IDLE/ERROR/DOWN) i18n 화 — TOTAL 영어 유지 결정으로 불필요. 별 작업.
- Tier B 자동 verbatim 검증 — SPEC대로 의도적 제외(수동 triage).

## H. 다음 단계 진입 (Implement)
```
@.claude/specs/i18n-language-addition.md @.claude/specs/i18n-language-addition-plan.md 둘 다 읽고 vi 추가 구현.
각 AC(AC1~AC7) 당 검증 먼저. Canonical Jargon Policy(Layer1/Tier A 보존, Deploy 번역, Tier B=Upload만 번역) 엄수.
touch-point 6개(SPEC 4 + index.ts 화이트리스트 + LoginPage 토글) 모두 반영.
산출물: .claude/specs/i18n-language-addition-dev-report.md 에 변경 파일 / 테스트 결과 / 결정 기록.
```
