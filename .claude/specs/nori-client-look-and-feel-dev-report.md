# DEV REPORT — nori-client Look & Feel Migration

> 작성일: 2026-05-29
> 입력: [SPEC](nori-client-look-and-feel.md) + [PLAN](nori-client-look-and-feel-plan.md)
> 대상 레포: `nori-tc-ui-front` (branch `docs/nori-client-look-and-feel-spec`)
> 본 문서는 phase 별 Implement 산출물 누적 기록.

## ⚠️ 2026-05-29 D14/R8/D15/R9 정정에 따른 재검토

SPEC 의도 정정 (commit `072e3a4` *틀=nori-client/내용=ui-front + R8 layout shell* + `4b49691` *ui-front 우위 + R9 품질 개선*) 후 **본 dev-report 의 Phase 1 + 1.5 + 2 결과물 보존 + 재검토 식별**:

### 보존 (사실 기록 — 변경 금지)

- **Phase 1 (commit `fb0b39f`)** — index.css 토큰 + Pretendard + AppTopBar 시각 토큰. D14 의 *내용* 영역 기반 토큰. **재작업 불필요**.
- **Phase 1.5 (commit `321fe90`)** — shadcn primitives 11 + AppPageShell + SelectableTable 시각 토큰. D14 의 *내용* 영역 토큰. **재작업 불필요**.
- **D1 재정의 (commit `3f53e4b`)** — coral monochrome, indigo 폐기. **재작업 불필요**.

### 재검토 필요 (D14 정정으로 의도 갱신)

- **Phase 2 LoginPage (본 문서 § Phase 2)** — 작업 시점 의도 = "*nori-client 자매품 레이아웃·인상은 거의 동일하게 유지, 색만 brand 토큰으로 치환*" (틀=ui-front 그대로). 그러나 D14 정정 후 의도 = "*틀 = nori-client 공통 shell + 내용 = ui-front 폼 위젯 재배치*". → **Phase 2 재작업 필요**.
  - 재작업 의도 차이: 기존 = LoginPage.tsx 의 인라인 hex/색만 토큰 치환 / 갱신 = R8 의 `<PageLayoutShell variant="single-card">` 으로 LoginPage wrap + 좌측 일러스트 영역 + 중앙 카드 + soft shadow + CTA 패턴 적용 (nori-client `login.jsx` / `_login.scss` 인상).
  - **결정 보류** — 사용자 명시 확인 필요 (재작업 진행 vs Phase 2 결과 보존하고 Phase 3~8 만 D14 적용).

### 신규 Phase 진입 의도 (D14/R8/D15/R9 기준)

- **Phase 1.7 (R8 신설)** — nori-client layout 위젯 시각 패턴을 ui-front `src/shared/layout/` 6 개 신규 컴포넌트로 추출. 페이지 phase 의 전제 조건. **Phase 2 의 재작업 (또는 신규 Phase 2 결정) 전 선행 필수**.
- **Phase 2~8** — 각 phase = R8 의 `<PageLayoutShell>` 적용 + ui-front 기능 위젯 (Sidebar / Table / Panel / Modal) 재배치 + R9 4 축 품질 게이트 (변경 파일 회귀 0 + 가능한 개선).

---

## Phase 2 — LoginPage (2026-05-29)

### 변경 파일

| 파일 | 변경 | 비고 |
|---|---|---|
| [src/features/auth/components/LoginPage.tsx](../../src/features/auth/components/LoginPage.tsx) | className 토큰 치환만 (31 insert / 31 delete, 라인 추가/제거 0) | 로직/라우팅/API/Query hook/radix prop/JSX 구조 0 변경 |

- 신규 라이브러리: **없음** (Phase 2 dep 없음, Plan §3 일치)
- `git diff` 검증: 변경 라인 전부 `className` / ternary class string 한정 (logic/import/JSX 구조 0 라인) — grep 으로 확정.

### 토큰 매핑표

원칙(사용자 확정 2026-05-29): **nori-client 자매품 레이아웃·인상은 거의 동일하게 유지, 색만 brand 토큰(= Phase 1/1.5 N 아이콘 코랄 `brand-primary`)으로 치환.** 모든 코랄을 단일 `brand-primary` 토큰에 귀속.

#### ① grayscale 인라인 hex → shadcn grayscale 토큰

| 인라인 hex | 사용처 | 토큰 |
|---|---|---|
| `#1D2A24` | modal title | `text-foreground` |
| `#2D2D2D` | 로고/h1/input value | `text-foreground` |
| `#33413A` | modal label / modal input value | `text-foreground` |
| `#50615A` | Cancel 버튼 텍스트 | `text-muted-foreground` |
| `#5A5A5A` | form label (ID/Password) | `text-muted-foreground` |
| `#5A6A62` | modal subtitle | `text-muted-foreground` |
| `#6A7C74` | Forgot 버튼 inactive | `text-muted-foreground` |
| `#9AA8A2` | modal placeholder | `placeholder:text-muted-foreground` |
| `#ADADAD` | form placeholder | `placeholder:text-muted-foreground` |
| `#A6B2AC` | 구분 bullet `•` | `text-muted-foreground` |
| `#DDE5DF` | modal panel border | `border-border` |
| `#E8E4DF` | card panel border | `border-border` |
| `#E8E4DF` | form input border | `border-input` (input role) |
| `#D3DED8` | modal input / cancel border | `border-input` |
| `#FAF8F5` | 페이지 배경 | `bg-muted` |
| `#F5F3EF` | form input 배경 | `bg-muted` |
| `#F7F8F5` | modal input 배경 | `bg-muted` |
| `#F4F7F5` | cancel 버튼 배경 | `bg-muted` |
| `#00000033` | modal overlay | `bg-black/20` (0x33 = 20% 정확 일치, pixel-identical) |

> 패널/컨테이너 = `border-border`, 입력/컨트롤 = `border-input` 으로 역할 분리. `bg-white`(modal/card panel)는 인라인 hex 아닌 표준 utility → 미변경(surgical). 결과적으로 white card on `bg-muted` 페이지 = shadcn 표준 카드 인상.

#### ② coral 인라인 hex → brand-primary utility

| 인라인 hex | 사용처 | 토큰 |
|---|---|---|
| `#D95D39` | icon/N 로고 text | `text-brand-primary` |
| `#D95D39` | N 로고 circle border | `border-brand-primary` |
| `#D95D39` | OK/Login 버튼 배경 | `bg-brand-primary` |
| `#D95D39` (focus) | input focus border | `focus-visible:border-brand-primary` |
| `#F4EEE7` | modal icon 원형 배경 | `bg-brand-primary/10` (warm beige → 옅은 coral tint, D1 coral monochrome 정합) |
| `#D95D39/30` | ring (input/modal) | `ring-brand-primary/30` |
| `#D95D39/40` | ring (Forgot 버튼) | `ring-brand-primary/40` |
| `#D95D39/50` | ring (OK/Login 버튼) | `ring-brand-primary/50` |
| `#C85332` (hover) | Login CTA hover | `hover:bg-brand-primary/90` |

#### ③ bracket → 토큰 (D11 점진)

| bracket | 사용처 | 토큰 |
|---|---|---|
| `rounded-[20px]` | modal/card panel | `rounded-xl` (14px, token 표준) |
| `rounded-[10px]` | modal input / cancel / OK 버튼 | `rounded-lg` (10px 정확 일치) |
| `rounded-[17px]` | icon 원형 (34px) | `rounded-full` |
| `tracking-[3px]` | "Nori-TC" wordmark | `tracking-wide` (0.04em, R1.2 표준) |
| `tracking-[-1px]` | h1 "Nori-TC" | `tracking-tight` (-0.01em, heading 표준) |

> step 3 범위 밖 bracket(`text-[Npx]` font-size, `px-/gap-/max-w-/w-` spacing, `border-[1.5px]` width, `h-/w-[34px]`)은 미변경 — surgical.

#### ④ 인라인 form error → danger 토큰 (구조 미변경, 색만)

| 인라인 | 사용처 | 토큰 |
|---|---|---|
| `text-red-500` | userId/password error `<p role="alert">` | `text-danger` |
| `text-red-500` | serverError `<p role="alert">` | `text-danger` |
| `aria-[invalid=true]:border-red-500` | input invalid border | `aria-[invalid=true]:border-danger` |

> `react-hook-form`/`zod` 구조·resolver·schema·`role="alert"` 미변경 (R7/OoS 경계 준수).

### 시각 결정 기록 (사용자 confirm 게이트 검토 대상)

1. **CTA hover = `hover:bg-brand-primary/90`** — 사용자 원칙("색은 N 코랄 단일") + [button.tsx:12,14,18](../../src/components/ui/button.tsx#L12) solid 버튼 hover 컨벤션(`bg-<color>/90`)에 정합. 단 흰 배경에서 코랄이 hover 시 살짝 **밝아짐**(원본 `#C85332`는 어두워짐). Phase 3~8 CTA hover 인상의 기준. *대안*: `hover:bg-link-hover`(index.css:141 deep coral, 어두워지는 hover 보존) — confirm 단계에서 거부 시 전환 가능.
2. **modal icon 배경 `#F4EEE7`(warm beige) → `bg-brand-primary/10`(옅은 coral)** — D1 coral monochrome 정합. beige→pinkish 변화. confirm 대상.
3. **"Nori-TC" wordmark `tracking-[3px]` → `tracking-wide`(0.04em)** — D11 inline tracking 표준화. 로고 자간이 **좁아짐**(font-fraunces 폰트 자체는 보존 — task 제약 준수). confirm 대상.
4. **panel radius `rounded-[20px]`(20px) → `rounded-xl`(14px)** — token 표준. 카드 모서리가 약간 작아짐. confirm 대상.
5. **페이지/입력 배경 warm off-white → `bg-muted`(neutral 0.97)** — warm tint 제거. card는 `bg-white` 유지 → white-on-muted 대비 인상.

### i18n 비고 (R6)

- LoginPage 는 **하드코딩 영문 문자열만** ("ID"/"Password"/"Log In"/"Nori-TC"/"Forgot ID?" 등), i18n-context 미사용 + **LanguageToggle 부재**. → 이 페이지에 ko/en 토글/한글 텍스트 자체가 없음. R6(Pretendard ko/en 글자 깨짐)은 본 페이지에 비적용. 단 사용자 육안 확인은 권장.

### 검증 결과 (자동 4종)

#### `npm run build` (tsc -b && vite build) — **PASS**
```
dist/assets/select-DG9EleHN.js                   81.81 kB │ gzip: 28.30 kB
dist/assets/form-vendor-BIm4yxB2.js              86.85 kB │ gzip: 26.05 kB
dist/assets/index-Csep9Rn3.js                   185.89 kB │ gzip: 59.03 kB
✓ built in 7.84s
```

#### `npm run lint` — LoginPage **0 errors**
```
✖ 14 problems (14 errors, 0 warnings)
```
- 14 errors 전부 baseline (setState-in-effect): `EqpManageFormModal` / `EqpModelBindingModal` / `EqpPage` / `LiveMapDemoModal` / `ModelPage` / `UserPasswordResetModal`. **auth/LoginPage 0건** (grep 확인). 별 SPEC 분리 대상.

#### `npx playwright test tests/e2e/login-page.smoke.spec.ts` — **PASS**
```
Running 1 test using 1 worker
[1/1] [chromium] › tests\e2e\login-page.smoke.spec.ts:7:1 › 로그인 페이지 핵심 요소가 렌더링됩니다.
  1 passed (4.2s)
```
- smoke 는 heading/label/button 구조 렌더링만 검증 → 시각 토큰 치환과 정합 (구조 무변경).

#### `git diff` className 한정 — **확인**
- 인라인 hex / `tracking-[` / `rounded-[` / `shadow-[` / `red-500` 잔재: **0 hits** (grep).
- 변경 라인 전부 className/ternary class — logic/import/JSX 구조 0 라인.

### commit 상태

- **미커밋** — SPEC Phase 분해 "시각 사용자 confirm 필수" 게이트 대기 중.
- 사용자 dev(`npm run dev`) `/login` 육안 확인(특히 위 시각 결정 5건) 후 commit 예정.
- commit 메시지에 변경 전/후 스크린샷 경로 명시 예정 (R4 AC).
