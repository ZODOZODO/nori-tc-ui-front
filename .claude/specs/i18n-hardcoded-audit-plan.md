# i18n 하드코딩 마이그레이션 — 구현 계획 (Plan)

> 입력: [i18n-hardcoded-audit.md](./i18n-hardcoded-audit.md) (≈795건 전수 카탈로그)
> 단계: SDD Plan. 코드 수정 없음. 산출물 = 본 문서.
> 작성: 2026-06-01.

## 0. 가장 중요한 발견 — 현재 i18n 원시 함수의 한계

`src/i18n/` 는 react-i18next 가 아니라 **자체 경량 Context i18n** 이다 ([I18nProvider.tsx:39](../../src/i18n/I18nProvider.tsx#L39)):

```ts
const t = useCallback((key: string) => dictionaries[lang][key] ?? key, [lang])
```

확인된 제약 (grep `t\('[^']+',` 결과 2번째 인자 사용처 **0건**):
1. **interpolation 미지원** — `t(key, {var})` 불가. 동적 문자열은 현재 전부 하드코딩이거나 문자열 concat.
2. **전역 인스턴스 없음 / hook 전용** — `useI18n()` 으로만 `t` 접근. api/lib/types/모듈상수(React 밖)에서 번역 불가.

→ 카탈로그 ≈795건 중 **C3(템플릿 ~80) + C4(모듈상수 ~70) + C5(api/lib ~160) ≈ 310건은 현재 원시 함수로 마이그레이션 불가.** 따라서 **i18n 기반 교체(P0)가 모든 후속 작업의 선행 조건.**

**기반 결정(확정): react-i18next 로 전환.** 다국어(zh/ja/vi) 로드맵에서 자체 Context 보다 표준이 유리한 확정 근거:
1. **정적 번들 미확장** — 현재 `import ko / import en` 정적 import 라 전 언어가 메인 번들에 포함. 5개 언어 × ~600키는 lazy-load 필요(react-i18next backend).
2. **날짜 로컬라이제이션 갭** — `Intl.DateTimeFormat('ko-KR')` 가 여러 컴포넌트에 하드코딩(영어 모드도 한국식 날짜). 문자열 키로 안 풀림.
3. **커스텀 i18n 소유 비용** — interpolation/plural/formatting 재구현 = 표준의 부분 복제.

## 1. 영향 범위 요약

| | 파일 수 | 건수 | 비고 |
|---|---|---|---|
| 변경 대상 (한글 하드코딩) | ~55 | ≈795 | 카탈로그 참조 |
| 신규/교체 (i18n 코어) | 3 + deps | — | index.ts(신규 init), I18nProvider.tsx(교체), i18n-context.ts(shim) + react-i18next 의존성 |
| locale 추가 (키 신설) | 2 | ≈600 키 | ko.json, en.json |
| 미변경(이미 t() 적용) | ~30 | — | 참고 패턴 |

## 2. P0 — react-i18next 전환 (선행 필수, 단독 PR)

**목표:** 자체 Context i18n → react-i18next. 기존 `useI18n()/t(key)` 호출처를 **한 번에 안 고치도록 호환 shim** 으로 점진 전환. 동작·표시 텍스트 무변경(값 보존).

### 의존성
- `i18next`, `react-i18next`, `i18next-browser-languagedetector` (localStorage `nori-tc-lang` 우선 + navigator 폴백 = 현 `resolveInitialLang` 동등).
- lazy-load: `i18next-resources-to-backend` (언어별 `./locales/<lng>.json` 동적 import). → zh/ja/vi 추가 시 json 파일만 드롭.

### 변경/신규 파일
- `src/i18n/index.ts` (신규) — `i18n.use(...).init({...})`:
  - **`keySeparator: false`, `nsSeparator: false`** ⚠️ 현재 키가 `"eqp.sidebar.title"` 처럼 `.` 포함 flat key 라 필수. 미설정 시 중첩 해석으로 전 키 깨짐.
  - `fallbackLng: 'ko'` (ko 가 번역 베이스), `supportedLngs: ['ko','en']`(추후 확장), `interpolation.escapeValue: false`(React 가 이미 escape).
  - detection: localStorage key `nori-tc-lang`, caches localStorage.
  - resourcesToBackend 로 ko/en 동적 import.
- `src/i18n/I18nProvider.tsx` — `<I18nextProvider i18n={i18n}>` 로 교체. `document.documentElement.lang` 동기화는 `i18n.on('languageChanged')` 로 이전.
- `src/i18n/i18n-context.ts` (호환 shim 유지) — `useI18n()` 를 `useTranslation()` 위에 래핑: `{ lang: i18n.language, setLang: i18n.changeLanguage, t }`. **기존 수백 개 `useI18n().t(key)` 호출처 무수정** → 점진 전환.
- 기존 `import ko from './locales/ko.json'` 정적 import 제거(번들 축소).

### React 밖(api/lib/상수) 번역 — D1 해결
react-i18next 는 standalone `i18n` 인스턴스를 export 하므로 `import i18n from '@/i18n'; i18n.t('error.eqp.list')` 로 hook 없이 호출 가능. (자체 `translate()` 불필요 — 표준이 제공.)

### 날짜 로컬라이제이션 (P0 포함)
하드코딩 `Intl.DateTimeFormat('ko-KR'|'en-US')` → `i18n.language` 또는 `{ ko:'ko-KR', en:'en-US' }` 매핑으로 lang 연동. 대상: DeployMonitorPanel/ModelInfoTable/DlqTableShell/BusinessGroupModelTable/model-version.ts 등(grep 으로 전수 확보).

### 위험 / 완화
- **flat key `.` 충돌**: `keySeparator:false`/`nsSeparator:false` 로 해결. P0 머지 직후 ko/en 전 키 렌더 e2e 로 회귀 확인 필수.
- **호환 shim 시그니처**: `useI18n().t` 가 `t(key, vars?)` 로 react-i18next `t` 위임 → 기존 `t(key)` 무영향, interpolation 자동 획득.
- **초기 로드 flash**: lazy-load 시 Suspense 또는 `react: { useSuspense: false }` + 초기 ko/en preload 로 완화.
- **detection 동등성**: 기존 `resolveInitialLang`(localStorage→navigator)와 LanguageDetector 순서 일치 확인.

### 검증
- 신규 단위 테스트: shim `useI18n()` 이 기존과 동일 동작 / `i18n.t(key, {var})` interpolation / flat key 조회.
- 기존 e2e 전부 PASS(회귀 0, console.error 0). ko 텍스트 값 보존 확인.

## 3. 결정 사항 (근거 기반 권장 — 사용자 확정 필요)

### D1. C5 api/lib fallback (~160건) 전략 → **확정: react-i18next standalone `i18n.t` 직접 사용**
- 근거: react-i18next 가 export 하는 `i18n` 싱글톤은 hook 없이 `i18n.t('error.eqp.list')` 호출 가능. api/lib/types 가 `import i18n from '@/i18n'` 로 바로 번역. 기존 `throw new Error(...)`/fallback 인자만 `i18n.t(...)` 로 교체 = 최소 침습.
- BE `ApiError.payload.errorMsg`(서버 메시지 우선) + 한글 fallback 구조 유지, **fallback 만** `i18n.t` 로. 네트워크 실패 등 fallback 노출 시에도 언어 반영.

### D2. borderline → **권장: 1차 제외(보류)**
- ModelDetailPanel:382 (BE 매칭 prefix) **절대 변경 금지**.
- useModelFlowMutations invariant(3), live-map-data invariant, 각 CSRF invariant: 정상 흐름 미노출 → 1차 제외, 카탈로그에 "보류"로 남김.
- live-map-demo `buildLiveMapDemoRunRows`(dead/mock): dead path 보존(글로벌 룰), i18n 제외.

### D3. 작업 단위 → **권장: P0 단독 PR + feature별 분할 PR**
- 미커밋 51개 + ≈795건 동시 변경은 리뷰/롤백 불가. P0 먼저 머지 → feature 단위로 순차 PR.
- 분할: P0 → 공용(shared/ui) → deploy → eqp → model → user/profile/auth → live-map/dlq. 각 PR 독립 빌드+e2e.

## 4. 마이그레이션 단계 (P0 머지 후)

> 각 단계 공통 절차: ① 해당 feature e2e 스냅샷/회귀 기준 확보 → ② ko/en 키 신설(동수) → ③ 컴포넌트/모듈 `t()`·`translate()` 치환 → ④ `npm run build` + `tsc` + 해당 e2e PASS(console.error 0) → ⑤ 미달 시 롤백.

| 단계 | 범위 | 건수 | 주 카테고리 | 특이 |
|---|---|---|---|---|
| P1 | shared/components/ui + app | 8 | C4(default prop) | confirm-dialog/SelectableTable default — 광범위 노출, 먼저 |
| P2 | deploy | 173 | C1/C3 + C4(deploy-utils) + C5(deploy.api) | 최대. RegisterPanel/MonitorPanel toast·dialog 다수 |
| P3 | eqp | 125+24 | C1/C2/C3 + C5(eqp.api) + C4(lifecycle 상수) | ManageFormModal 동적 조사 에러(템플릿) |
| P4 | model | 112+153 | 전 카테고리 + C5(model.api 33, model-detail-editor 28) | 최난도. hintText 삼항, JSON 에디터 검증 |
| P5 | user/profile/auth | 84 | C1/C2/C3 + C5(api) + zod(useLogin) | Upsert/Profile 모달, zod 메시지 |
| P6 | live-map + dlq | 64 | C4(DLQ 헤더 상수 35) + C5(api) | DLQ 컬럼 헤더 상수 구조 변경 |

### 키 네임스페이스 컨벤션 (기존 확장)
- 기존: `eqp.* / model.* / deploy.* / dlq.* / user.* / group.* / livemap.*`
- 신설 패턴: `<feature>.dialog.* / .feedback.* / .error.* / .col.*(컬럼헤더) / .placeholder.* / .aria.*`
- api fallback: `error.<feature>.<action>` (예: `error.eqp.list`, `error.model.checkout`)
- 공용: `common.confirm/cancel/close/delete/save`, `common.table.empty/action`, `common.pagination.summary`

### C4 모듈 상수 처리 패턴
컴포넌트 밖 상수는 **i18n 키만** 담고 렌더 시 `t(key)`:
```ts
// before: const FEED_COLUMNS = [{ header: '발생 시각' }, ...]
// after:  const FEED_COLUMNS = [{ headerKey: 'dlq.col.occurredAt' }, ...]
//         render: <TableHead>{t(col.headerKey)}</TableHead>
```
deploy-utils 라벨 switch / lifecycle ACTION_MESSAGES 도 동일(키 반환 → 호출부 t).

### C3 템플릿 처리 패턴 (P0 interpolation 사용)
```ts
// before: `Deploy #${id} 항목을 삭제했습니다.`
// after:  t('deploy.feedback.deleted', { id })   // ko: "배포 #{{id}} 항목을 삭제했습니다."
```

## 5. 전역 위험 / 롤백
- **위험 1 — 키 누락 시 fallback**: `t` 는 키 미존재 시 key 문자열 노출. P0 후 CI 에서 ko/en 키 동수 + 코드 참조 키 존재 검증 스크립트 추가 권장(별도).
- **위험 2 — 회귀(텍스트 변경으로 e2e 셀렉터 깨짐)**: e2e 가 한글 텍스트로 요소를 찾는 경우 키 전환 후 텍스트 동일하면 무영향(값 보존). 단 영어 모드 테스트는 별도.
- **위험 3 — 미커밋 51개와 충돌**: P0/각 PR 을 작은 단위로 분리, 기존 작업과 파일 겹침 최소(locale·i18n 코어는 거의 안 겹침).
- **롤백**: locale 키 추가는 additive(기존 키 불변) → 안전. 컴포넌트 치환은 PR 단위 `git revert`. P0 는 하위호환이라 단독 revert 가능.

## 6. 결정 확정 / 잔여 미결
**확정(2026-06-01):**
- P0 = **react-i18next 전환** (useI18n 호환 shim 점진 전환 + lazy-load + 날짜 로컬라이제이션 포함).
- D1 = api/lib fallback 은 standalone `i18n.t` 직접 사용.
- D2 = borderline(invariant/dead/BE매칭 L382) 1차 제외. **L382 절대 변경 금지.**
- D3 = P0 단독 PR + feature 분할(shared→deploy→eqp→model→user→live-map/dlq).

**잔여(Implement 중 확인):**
- e2e 영어 모드 회귀 테스트 추가 여부(현재 e2e 가 ko 기준인지 P0 에서 확인).
- lazy-load Suspense vs `useSuspense:false` 초기화 방식(P0 구현 시 flash 측정 후 결정).

## 7. 다음 단계 진입 프롬프트 (Implement)
```
@.claude/specs/i18n-hardcoded-audit.md @.claude/specs/i18n-hardcoded-audit-plan.md 둘 다 읽고 P0(react-i18next 전환)부터 구현.
i18next/react-i18next/languagedetector/resources-to-backend 설치 → src/i18n/index.ts init(keySeparator:false, nsSeparator:false, fallbackLng:'ko').
useI18n 호환 shim 으로 기존 호출처 무수정 점진 전환. flat key 렌더 회귀 e2e 먼저.
Plan 의 결정(D1 i18n.t 직접 / D2 borderline·L382 제외 / D3 feature 분할) 엄수.
산출물: .claude/specs/i18n-hardcoded-audit-dev-report.md.
```
