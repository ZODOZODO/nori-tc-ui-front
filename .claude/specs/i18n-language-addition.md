# SPEC: i18n-language-addition (다국어 추가 정책 + 절차, vi 첫 실행)

> 이 SPEC 은 **언어 비종속(reusable)** 이다. 여기 정의한 jargon 정책 + 추가 절차 + Acceptance
> Criteria 는 **앞으로 추가되는 모든 언어(vi/zh/ja/...)가 동일하게** 따른다. 본 문서 하단
> "First Execution" 섹션에 첫 대상 언어 **베트남어(vi)** 의 구체 결정을 기록한다. 이후 언어는
> 같은 절차를 반복하고 "Execution Log" 에 한 섹션씩 append 한다.

## Why

nori-tc-ui-front 다국어는 현재 `ko`, `en` 2개만 지원한다([config.ts:11](../../src/i18n/config.ts#L11) `supportedLngs: ['ko','en']`). 주 사용자는 **해외 공장 현장 작업자**(1차: 베트남)이므로, 한국어로 된 실제 UI 문구를 현지어로 보여줘야 한다.

문제: 기존 jargon 정책이 두 문서에 **서로 다른 개수 + "등"(열린 목록)** 으로 적혀 정합성이 깨져 있다 — 메모리 11개([project_ui_front_i18n_jargon_policy.md] L10), audit SPEC 16개([i18n-hardcoded-audit.md:10](i18n-hardcoded-audit.md#L10)). "등" 때문에 언어를 추가할 때마다 경계 케이스 판단이 갈린다. → **정책 원칙을 불변으로 못 박고**, 언어 추가가 항상 이 SPEC 대로 재현되도록 한다.

## Canonical Jargon Policy (불변 — 모든 언어 공통)

### 원칙 (Invariant)

> **TC 고유명칭/도메인 식별자(proper noun)는 ko·en·zh·ja·vi 전 언어에서 영어 그대로 유지한다.
> 한글(번역 가능) 내용과 jargon 이 섞인 문자열은 한글 부분만 번역하고 임베드된 jargon 토큰은
> 영어 그대로 둔다.** (예: ko "신규 Model 선택" → vi "Chọn Model mới" — "Model" 보존)

음역 금지: `Business` → "비지니스"(한글 음역) ❌, 베트남어 음역/번역 ❌.

### 두 층위로 검증 (데이터 기준, 2026-06-02 실측)

`ko.json ↔ en.json` 전수 비교 결과: 전체 **893 키**, 값이 ko==en 인 키는 **13개**, 나머지 880개는 한글 prose 를 가져 en 과 다르다(`only in ko`/`only in en` 모두 0 — parity 정상).

**Layer 1 — 값-동일 키 (ko==en 인 13개).** 한글 prose 가 아예 없는 순수 토큰/라벨/브랜드. 새 언어에서도 **값을 en 과 동일하게 유지**(단, 아래 Tier B 의 현장-번역 후보는 예외 — First Execution 에서 결정):

| key | 값 | 분류 |
|---|---|---|
| `dlq.sidebar.gateway` / `dlq.panel.gateway` | `Gateway DLQ` | **Tier A jargon** |
| `dlq.sidebar.business` / `dlq.panel.business` | `Business DLQ` | **Tier A jargon** |
| `dlq.sidebar.repairTask` / `dlq.panel.repairTask` | `Repair Task` | **Tier A jargon** |
| `livemap.demo.colEqp` | `Eqp ID` | **Tier A jargon** |
| `deploy.register.upload` | `Upload` | **Tier B** (현장-번역 후보) |
| `livemap.kpi.total` | `TOTAL` | **Tier B** (현장-번역 후보) |
| `livemap.live` | `Map Live` | **Tier B** (현장-번역 후보) |
| `language.ko` / `language.en` | `한국어` / `English` | **네이티브 라벨** (전 언어 동일) |
| `login.copyright` | `© 2026 Nori-TC · v1.0.0` | **브랜드/버전** (전 언어 동일) |

**Layer 2 — 토큰 글로사리 (880개 번역 문자열에 임베드된 jargon).** 진짜 jargon 의 대부분은 여기. 번역 문자열 안에 영어로 박혀 있어야 한다.

- **Tier A — 하드 jargon (불변, 전 언어 영어 verbatim, 자동 검증 대상)**: 변별력 높은 TC 도메인 식별자.
  `Business`, `Model`, `Eqp`, `Gateway`, `DLQ`, `MES`, `Flow`, `Jar`, `Param`, `Step`, `PORT`, `MDF`, `DCOP`, `Repair Task`, `Interface Type`, `SECS`, `HSMS`, `Check In`, `Identity`, `Trigger`, `Collection Rule`, `Variable Id`, `EventId`, `Source MDF`, `Parent Model Commit`, `Diff Preview`, `Reference`
- **Tier B — 소프트 영어 (언어별 현장 triage, 자동 verbatim 검증 제외)**: 일반 UI/데이터 단어로 현재 영어 유지 중. 현장 작업자 대상이면 **번역 후보** — 언어별로 결정.
  `Upload`, `TOTAL`, `Map Live`, `Prev`, `Next`, `AS-IS`, `TO-BE`, `Add`/`Change`/`Delete`(diff 라벨), 컬럼 헤더(`userId`/`userName`/`group`/`department`/`company`/`email`/`password`/`status`), 상태 enum(`ACTIVE`/`LOCKED`/`DISABLED`/`DELETED`)
- **자동 검증에서 제외하는 일반 영단어**: `from`/`path`/`field`/`branch`/`Root`/`Action`/`Collect`/`transform` 등은 일반 영어 prose 에도 등장해 verbatim-presence 검사 시 false positive 유발 → Tier A 자동 검사 토큰에 넣지 않는다. (정책상 영어 유지지만 기계 검증은 안 함)

### Deploy 예외 (명시)

`Deploy` 는 ko 에서 **"배포" 로 번역 완료**([i18n-hardcoded-audit.md:10](i18n-hardcoded-audit.md#L10) "Deploy(→ko는 '배포'로 통일 완료)"). 따라서 Deploy 는 **jargon 이 아니라 번역 대상**으로 확정한다. 새 언어에서도 해당 언어로 번역한다(vi: "배포" → 베트남어). Tier A/B 글로사리에 **넣지 않는다**.

### 글로사리 변경 규칙

Tier A/B 목록에 용어를 추가/제거하려면 **이 SPEC 을 수정**해야 한다. 개인 기억/직감으로 즉석 판단 금지. 이로써 "등"의 모호함을 제거하고 언어 추가마다 재현 가능하게 한다.

## Per-Language Addition Procedure (재사용 — 모든 언어 동일)

`<lang>` = 추가할 언어의 BCP-47 코드(vi/zh/ja...).

1. `src/i18n/locales/<lang>.json` 생성 — ko.json 의 **모든 키**(현재 893 + 신규 `language.<lang>`)를 가지며, 각 값은 위 정책대로 번역(한글 prose → <lang>, jargon 토큰 영어 보존, Layer 1 규칙 적용).
2. [config.ts](../../src/i18n/config.ts#L11) `supportedLngs` 에 `<lang>` 추가.
3. [i18n-context.ts:4](../../src/i18n/i18n-context.ts#L4) `type Lang` 에 `<lang>` 추가.
4. [LanguageToggle.tsx:7](../../src/i18n/LanguageToggle.tsx#L7) `LANGUAGES` 배열에 `{ code: '<lang>', label: '<네이티브 라벨>' }` 추가.
5. 모든 기존 locale(ko/en + 기존 언어들)에 `language.<lang>` 키(네이티브 라벨) 추가 → parity 유지.
6. [index.ts:20](../../src/i18n/index.ts#L20) 의 detector **localStorage 화이트리스트**(현재 `stored==='ko'||'en'`)를 `supportedLngs` 추종으로 일반화 — 새 언어 선택이 새로고침 후에도 영속되게. **[index.ts:23](../../src/i18n/index.ts#L23) 의 navigator fallback(비-ko → 'en') 줄은 무변경** (브라우저 자동 감지 확장은 Out of Scope).
7. 별도 언어 토글/라벨(예: [LoginPage.tsx:287,292](../../src/features/auth/components/LoginPage.tsx#L287) 의 이진 토글)이 있으면 `LANGUAGES` 순환 + `t('language.${lang}')` 라벨로 일반화 — 모든 진입 화면에서 새 언어 노출·정상 라벨 보장.
8. 검증 스크립트/테스트(아래 AC) 실행 → PASS 확인.

## Requirements

- [ ] 위 Canonical Jargon Policy 가 이 SPEC 에 불변으로 고정됨 (Specify 산출물)
- [ ] `src/i18n/locales/vi.json` 생성 — 893 키 + `language.vi`, 정책대로 번역
- [ ] `supportedLngs` / `Lang` / `LANGUAGES` 3곳에 `vi` 등록 + 전 locale 에 `language.vi` 라벨
- [ ] index.ts detector localStorage 화이트리스트 supportedLngs 추종(vi 새로고침 영속) + LoginPage 별도 토글 LANGUAGES 기반 일반화
- [ ] locale parity 검증 자동화 — 새 언어 locale 이 en 과 키 집합 동일함을 기계 검증
- [ ] Layer 1 / Tier A jargon 보존 자동 검증 — vi 에서 해당 토큰이 verbatim 유지됨을 기계 검증
- [ ] Deploy → vi 번역 적용 (jargon 아님)
- [ ] Tier B(Upload/TOTAL/Map Live 등) 현장-번역 여부 First Execution 에서 결정·반영

## Constraints

- 헥사고날/ModuleConfiguration 무관(프런트 레포). 단 i18n **6 touch-point**(json/supportedLngs/Lang/LANGUAGES + index.ts detector localStorage 화이트리스트 + LoginPage 별도 토글) 누락 시 런타임 미반영·새 언어 영속/노출 누락.
- flat key + `keySeparator:false`/`nsSeparator:false` 계약 유지([config.ts:13-14](../../src/i18n/config.ts#L13-L14)) — 키에 `.` 있어도 중첩 금지.
- `fallbackLng:'ko'` 유지 — 새 언어에 누락 키 있으면 ko 로 폴백(빌드는 통과하나 raw key 노출 회피 위해 parity AC 강제).
- 기존 ko/en 값 **무변경** (이번 작업은 추가만). Tier B 번역 결정으로 Layer 1 값 변경 시 ko/en 은 건드리지 않고 vi 값만 다르게.
- jargon 글로사리 변경은 SPEC 수정 경유 (즉석 판단 금지).

## Acceptance Criteria

> 모든 항목 단일 명령/단일 assertion. `<lang>` 인스턴스 = vi.

- **AC1 (parity)**: 검증 스크립트가 `Object.keys(vi)` 와 `Object.keys(en)` 집합 차이 0 을 출력 (`only in vi` = 0 AND `only in en(vs vi)` = 0). 키 수 == en 키 수.
- **AC2 (Layer1 jargon 값 보존)**: Tier A 로 분류된 Layer 1 키(`dlq.sidebar.gateway`/`dlq.panel.gateway`/`dlq.sidebar.business`/`dlq.panel.business`/`dlq.sidebar.repairTask`/`dlq.panel.repairTask`/`livemap.demo.colEqp`)에 대해 `vi[k] === en[k]`.
- **AC3 (Tier A 토큰 verbatim 보존)**: 검증 스크립트가 Tier A 자동 검사 토큰 각각에 대해 "en[k] 에 토큰이 있으면 vi[k] 에도 동일 토큰 존재" 위반 0건 출력.
- **AC4 (네이티브 라벨)**: `vi['language.ko']==='한국어'` AND `vi['language.en']==='English'` AND `vi['language.vi']` 와 ko/en 의 `language.vi` 가 모두 존재(동일 네이티브 라벨).
- **AC5 (빌드)**: `npm run build` (`tsc -b && vite build`) PASS — vi.json valid JSON + 동적 import 해석.
- **AC6 (단위테스트 회귀 없음)**: `npm run test:unit` PASS (현재 89/89 기준 회귀 0). parity/jargon 검증을 단위 테스트로 추가했다면 그 테스트 포함 PASS.
- **AC7 (전환 동작)**: e2e 또는 수동 — LanguageToggle 에 3개 언어 노출 + `vi` 선택 시 대표 화면(예: `eqp.sidebar.title`)이 vi 문자열로 렌더, `page.on('console'/'pageerror')` error 0건.
- **AC8 (vi 영속, 선택)**: e2e — `vi` 선택 후 `page.reload()` 시 LanguageToggle 활성 언어가 여전히 `vi` (index.ts detector localStorage 화이트리스트 supportedLngs 추종 수정의 회귀 가드).

## First Execution: Vietnamese (vi)

vi 고유 결정(다른 언어는 자기 섹션에서 별도 결정):

- 네이티브 라벨: `language.vi = "Tiếng Việt"`, `LANGUAGES` 라벨 `'Tiếng Việt'`.
- **Tier B 현장-번역 결정 (Plan 단계 사용자 승인 완료, 2026-06-04)**: `deploy.register.upload "Upload"` → **vi 번역 "Tải lên"** (배포 패널 전체가 Triển khai 로 번역돼 일관성, disabled 라 저위험). `livemap.kpi.total "TOTAL"` → **영어 유지** (형제 RUN/IDLE/ERROR/DOWN 이 하드코딩 영어라 단독 vi 면 5칸 중 1칸 불일치). `livemap.live "Map Live"` → **영어 유지** (워크스페이스 전체 grep 결과 코드 참조 0건 dead key, parity 위해 값만 보존). 근거 상세: [i18n-language-addition-plan.md](i18n-language-addition-plan.md) D1.
- `Deploy` → 베트남어 번역(예: "Triển khai" — 최종 표현은 번역 검수 시 확정).
- 번역 산출물 품질: 기계 번역 초안 금지 아님(허용)하되, Tier A 토큰 보존은 AC3 로 강제 검증.

## Out of Scope

- zh / ja / 기타 언어 — 본 SPEC 의 절차를 그대로 따르되 **별 작업(별 Execution Log 섹션)**.
- 브라우저 언어 자동 감지로 vi 수렴([index.ts:19-23](../../src/i18n/index.ts#L19-L23) detector 확장) — 현재 수동 토글 유지.
- ui-backend / gateway 등 **서버 측 i18n** (메시지/예외 현지화) — 프런트 범위 밖.
- ko/en 기존 값의 표현 개선/오타 수정 — 이번은 추가만(별 작업).
- Tier B 자동 verbatim 검증 — false positive 위험으로 의도적 제외(수동 triage).

## SDD 진행 상태

- [x] **Specify** — 이 SPEC 작성 완료 (산출물: `.claude/specs/i18n-language-addition.md`)
- [x] **Plan** — 완료 (산출물: `.claude/specs/i18n-language-addition-plan.md`). 검증으로 touch-point 4→6 확장 + Tier B=Upload만 번역 결정.
- [ ] **Implement** — 별 세션, AC 만족 구현 (산출물: `.claude/specs/i18n-language-addition-dev-report.md`)
- [ ] **Validate** — 별 세션, SPEC + Plan + Dev report 입력 검증

## 다음 단계 진입 프롬프트

**Plan 진입 (새 세션 + Plan Mode)**:
```
@.claude/specs/i18n-language-addition.md 보고 vi(베트남어) 추가 구현 계획 수립.
영향 파일 / 단계 / 위험 / 롤백 방법 + Tier B(Upload/TOTAL/Map Live) 현장-번역 결정안 + Deploy vi 표현 포함.
parity/jargon 자동 검증을 단위 테스트로 넣을지 standalone 스크립트로 할지 결정.
실행 / 코드 수정 금지. 산출물: .claude/specs/i18n-language-addition-plan.md 에 저장.
```

**Implement 진입 (새 세션)**:
```
@.claude/specs/i18n-language-addition.md @.claude/specs/i18n-language-addition-plan.md 둘 다 읽고 vi 추가 구현.
각 AC(AC1~AC7) 당 검증 먼저. Canonical Jargon Policy(Layer1/Tier A 보존, Deploy 번역, Tier B 결정) 엄수.
산출물: .claude/specs/i18n-language-addition-dev-report.md 에 변경 파일 / 테스트 결과 / 결정 기록.
```

**Validate 진입 (새 세션)**:
```
@.claude/specs/i18n-language-addition.md @.claude/specs/i18n-language-addition-plan.md @.claude/specs/i18n-language-addition-dev-report.md
셋 다 읽고 AC1~AC7 + 정책 준수 검증. 누락/위반 보고. 통과 항목은 SPEC 체크박스 + SDD 진행 상태 [x] 업데이트.
```
