# DEV REPORT: i18n-language-addition — vi(베트남어) 첫 실행 구현

> SDD Implement 단계 산출물. 입력: [.claude/specs/i18n-language-addition.md](i18n-language-addition.md) + [.claude/specs/i18n-language-addition-plan.md](i18n-language-addition-plan.md).
> 작업 정책: main 직접 작업 + commit only (push 금지), ko/en 기존 값 무변경(추가만), flat key + keySeparator/nsSeparator:false + fallbackLng:'ko' 계약 유지, 각 AC 당 실패 테스트 먼저(TDD).

## 1. 변경 파일 (신규 4 + 수정 7 = 11)

### 신규
| 파일 | 내용 |
|---|---|
| `src/i18n/locales/vi.json` | **894 키**(en 키집합 + `language.vi`). Layer1 규칙 + 880키 ko prose → vi 번역, Tier A 토큰 영어 verbatim 보존 |
| `tests/i18n-vi-parity.test.ts` | AC1~AC4 단위 테스트. vi/en/ko **raw JSON 직접 import**(`with { type: 'json' }`), i18next 미경유 |
| `tests/e2e/i18n-language-toggle.spec.ts` | AC7/AC8 e2e. auth mock + `/eqp` → LanguageToggle 3언어 노출 / vi 렌더 / reload 영속 / console·pageerror 0 |
| `.claude/specs/i18n-language-addition-dev-report.md` | 본 산출물 |

### 수정 (i18n 6 touch-point + 전 locale parity 2)
| 파일 | 변경 | 라인 |
|---|---|---|
| `src/i18n/config.ts` | `supportedLngs: ['ko','en']` → `['ko','en','vi']` | :11 |
| `src/i18n/i18n-context.ts` | `type Lang = 'ko'\|'en'` → `'ko'\|'en'\|'vi'` | :4 |
| `src/i18n/LanguageToggle.tsx` | `LANGUAGES` 에 `{code:'vi',label:'Tiếng Việt'}` 추가 + `export` (LoginPage 재사용) | :7-11 |
| `src/i18n/index.ts` | detector lookup localStorage 화이트리스트를 `i18nBaseOptions.supportedLngs` 추종으로 일반화 (navigator fallback 줄 무변경) | :19-23 |
| `src/features/auth/components/LoginPage.tsx` | 별도 토글: 라벨 `t(\`language.${lang}\`)` + LANGUAGES 순환(`(index+1)%len`) | import:4, :287-294 |
| `src/i18n/locales/en.json` | `"language.vi": "Tiếng Việt"` 추가 (그 외 무변경) | :9 |
| `src/i18n/locales/ko.json` | `"language.vi": "Tiếng Việt"` 추가 (그 외 무변경) | :9 |

## 2. Acceptance Criteria 결과 (모든 AC 출력 인용)

### AC1~AC4 (단위 테스트, `node --test tests/i18n-vi-parity.test.ts`)
```
# [AC3] en 출현 0건 토큰(현재 vacuous): Identity, Trigger, Collection Rule, Variable Id, Source MDF, Parent Model Commit, Diff Preview
ok 1 - AC1 — vi 와 en 의 키 집합이 동일하다 (parity)
ok 2 - AC2 — Layer1 Tier A jargon 키는 vi[k] === en[k]
ok 3 - AC3 — en[k] 에 Tier A 토큰이 있으면 vi[k] 에도 동일 토큰이 verbatim 유지된다
ok 4 - AC4 — 네이티브 언어 라벨이 전 locale 에 존재하고 일치한다
# tests 4
# pass 4
# fail 0
```
- **AC1 (parity)**: `only in vi`=0, `only in en`=0, 키수 동일(894). PASS
- **AC2 (Layer1 값보존)**: 7 Tier A Layer1 키 `vi[k]===en[k]`. PASS
- **AC3 (Tier A verbatim)**: 토큰 소실 위반 0건. **첫 작성에서 위반 0 — Step3 보정 루프 불필요**. vacuous 7토큰(en 출현 0건)은 명시 로그 — Plan D4 예측과 정확히 일치.
- **AC4 (네이티브 라벨)**: `vi['language.ko']==='한국어'`, `vi['language.en']==='English'`, `language.vi` 가 ko/en/vi 셋 다 존재·동일. PASS

### AC5 (빌드, `npm run build` = `tsc -b && vite build`)
```
dist/assets/en-CTnSe1-W.js   53.43 kB │ gzip: 13.16 kB
dist/assets/ko-oh3_QF1z.js   60.81 kB │ gzip: 14.88 kB
dist/assets/vi-BhV-7h55.js   62.06 kB │ gzip: 14.26 kB     ← vi.json 동적 import 청크 분리 성공
...
✓ built in 11.94s
```
- `tsc -b` 타입 체크 PASS(Lang 타입 정합), vite build 가 `vi.json` 을 ko/en 과 동일하게 별도 청크로 분리. PASS

### AC6 (단위테스트 회귀 0, `npm run test:unit`)
```
# pass 116
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
- 기존 112 + 신규 4(vi-parity) = **116 pass / 0 fail**. 회귀 0. PASS

### AC7/AC8 (e2e, `npx playwright test i18n-language-toggle`)
```
[1/2] AC7 — LanguageToggle 3개 언어 노출 + Tiếng Việt 선택 시 vi 렌더 (console/pageerror 0)
[2/2] AC8 — vi 선택 후 reload 시 활성 언어가 vi 로 유지된다
  2 passed (6.4s)
```
- **AC7**: LanguageToggle 에 한국어/English/Tiếng Việt 3개 노출, Tiếng Việt 클릭 시 `eqp.sidebar.title` 가 vi 값("Thông tin thiết bị")으로 렌더(en "Equipment Info" 아님 + raw key 아님), console/pageerror 0. PASS
- **AC8**: vi 선택 후 `page.reload()` → 사이드바 vi 유지 + 토글 "Tiếng Việt" 활성. localStorage 화이트리스트 supportedLngs 추종 수정의 회귀 가드. PASS

**→ AC1~AC8 전부 PASS.**

## 3. 번역 방법 / 보정 키

- **시드**: en.json 키집합을 그대로 복사해 parity 구조 보장 → 880키는 ko.json 한글 prose 를 vi 로 번역.
- **Tier A 토큰 보존**: SPEC L45 27토큰을 영어 verbatim 유지. en 을 토큰 보존 기준으로 삼아, ko 가 한글로 쓴 jargon(특히 `모델`)도 vi 에서 **`Model`** 로 통일(deploy.task.* / model.sidebar/infoTable / error.model.* / deploy.monitor.lineModel 등). 그 외 임베드 jargon(Business/Eqp/Gateway/DLQ/MES/Flow/Jar/Param/Step/PORT/MDF/DCOP/Repair Task/Interface Type/SECS/HSMS/Check In/EventId/Reference)은 ko 와 정렬돼 자연 보존.
- **AC3 보정 루프**: **불필요** — 첫 작성에서 토큰 소실 위반 0건(AC3 PASS). 번역 시 en 토큰 매핑을 사전 grep(`\bModel\b` 등)으로 확인해 선제 반영한 결과.
- **보정한 키**: AC1/AC4 가 초기 red(ko/en 에 `language.vi` 미존재) → Step4 touch-point 7·8(ko.json/en.json 에 `language.vi` 추가)로 green 전환. vi.json 값 자체 보정은 없음.
- **vacuous 토큰 7개**(Identity/Trigger/Collection Rule/Variable Id/Source MDF/Parent Model Commit/Diff Preview): en 출현 0건이라 현재 검사 no-op. 침묵 누락 회피 위해 테스트가 명시 로그(Plan D4).

## 4. 내린 결정 (Plan D1~D6 엄수)

- **D1 Tier B**: `deploy.register.upload "Upload"` → vi **"Tải lên"**(번역). `livemap.kpi.total "TOTAL"`·`livemap.live "Map Live"` → **영어 유지**. ko/en 의 이 3키는 무변경, vi 만 upload 가 다름.
- **D2 Deploy**: ko "배포"/영어 "Deploy" → vi **"Triển khai"** 계열로 일관 번역(jargon 아님, AC3 비검사). 파생: "배포 관리"→"Quản lý triển khai", "배포 이력"→"Lịch sử triển khai".
- **D3 검증=단위 테스트**: standalone 스크립트 아닌 `tests/*.test.ts` glob 편입(AC6 자동 게이트). raw JSON 직접 import(fallbackLng 은닉 회피).
- **D4 매칭=case-sensitive `\b토큰\b`**: 영어 복수형(Models/Flows/Steps) word-boundary 밖 → 미검사(어근 보존 신뢰, 테스트 주석 명시).
- **D5 880키 번역**: 기계번역 초안 허용(SPEC L107). Tier A 토큰 미번역. prose 품질은 AC 밖 → 네이티브 검수 권장(R5).
- **D6 `language.vi` 라벨**: LANGUAGES(4) + ko/en/vi 의 `language.vi` 모두 `"Tiếng Việt"`. LoginPage 동적 키 일반화로 `language.*` dead 화 없음.

## 5. 작업 중 발생한 사건 — git stash 충돌 복구 (정합성 기록)

구현 중 외부 actor 가 작업 트리 전체를 `git stash push -u -m "item1-temp"` 로 stash(이 i18n 작업 + 무관한 live-map line-scope 작업 혼재) → 작업 트리가 HEAD 클린으로 리셋됨. 모든 변경이 stash@{0} 에 안전 보존됨을 확인 후, **사용자 승인 하에** `git checkout stash@{0}[^3] -- <i18n 파일만>` 으로 비파괴 복원(stash 보존, item1 의 live-map 4파일은 working tree 에 안 건드림). 복원 후 test:unit 116/build/e2e 재검증 동일 PASS.

## 6. 전체 e2e 회귀 — user-page 8~9 fail 은 **i18n 무관 pre-existing** (검증 완료)

- 내 변경 blast-radius(login-page.smoke / i18n-flat-key-render / i18n-language-toggle) e2e **전부 PASS**.
- `user-page.spec.ts` 9 fail: `/user` 진입 시 **로그인 화면으로 리다이렉트**(auth `/api/auth/me` mock 세션 미확립). i18n/locale/라우팅 무관.
- **반사실 검증**: 7 tracked i18n 파일을 HEAD 로 되돌린 클린 상태에서 user-page 재실행 → **동일하게 9 fail** (1 passed). 즉 HEAD 시점부터 존재한 실패로, 본 vi 작업과 무관함을 객관 확인.
- 권장: user-page e2e auth mock 은 별도 작업으로 추적(본 SPEC Out of Scope).

## 7. SDD 다음 단계
Validate 세션: SPEC + Plan + 본 dev-report 셋 입력 → AC1~AC8 + 정책 준수 재검증 → SPEC 체크박스/SDD 진행 상태 [x] 업데이트.
