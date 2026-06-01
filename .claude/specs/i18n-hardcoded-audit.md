# i18n 하드코딩 한글 문자열 전수 감사 (surface B)

> 작성: 2026-06-01. 8개 병렬 에이전트가 src 전체 .tsx/.ts(test/mock/dev 제외)를 **전체 정독**한 실측 결과.
> 이전 "약 185개" 추정치는 grep 샘플 기반 과소집계였음 — 실측 **≈795건**.

## Why
nori-tc-ui-front 다국어(react-i18next, `src/i18n/locales/{ko,en}.json` + `t('key')`)에서 **t() 를 우회하고 코드에 직접 박힌 한국어 포함 문자열**은 언어 전환이 불가능하다. ko 가 번역 베이스이고 향후 zh/ja/vi 를 추가하려면 이 문자열들을 i18n 키로 추출해야 한다.

## 정책 (확정)
- Business / Model / Deploy(→ko는 "배포"로 통일 완료) / Eqp / Gateway / DLQ / MES / Flow / Jar / Interface Type / Param / Step / PORT / MDF / DCOP / Repair Task 등 **TC 고유명칭은 전 언어 영어 유지** — 번역 대상 아님.
- 대상 = **한글(번역 가능) 내용을 가진 t() 미경유 문자열**. 한글+jargon 혼합("Flow 데이터를 불러오는 중입니다.")은 한글 부분만 키화, jargon 유지.
- 순수 영어/jargon 리터럴(`title="Identity"`, `"Action"`)은 **범위 밖** (전 언어 동일하므로 다국어 안 깨짐).

## 집계 (≈795건)

| 영역 | 건수 | 최대 밀집 파일 |
|---|---|---|
| deploy | 173 | DeployRegisterPanel 69, DeployMonitorPanel 64 |
| model (components set1) | 112 | FlowCard 25, ActionDataIndexEditorModal 25 |
| model (components set2 + lib/api) | 153 | model.api 33, model-detail-editor 28 |
| eqp (components) | 125 | EqpManageFormModal 48, EqpPage 29 |
| eqp(api) + group | 76 | eqp.api 24, GroupAddMembersModal 16 |
| user/profile/auth | 84 | UserUpsertModal 21, UserProfileModal 16 |
| live-map + dlq | 64 | BusinessDlqPanel 12, live-map-demo.api 11 |
| shared/components/ui/app | 8 | SelectableTable 2, confirm-dialog 2 |
| **합계** | **≈795** | |

## 마이그레이션 난이도별 카테고리 (단순 문자열 치환이 아닌 것 주의)

### C1. 컴포넌트 내부 인라인 (쉬움 — t() 직접 치환)
JSX 텍스트, placeholder, title, aria-label, setFeedbackMessage/setErrorMessage, DialogTitle/Description, 버튼. 컴포넌트가 이미 `useI18n()` 호출 중이면 바로 `t('key')`.

### C2. 삼항/동적 분기 (중간 — 분기마다 키 또는 조건부 키)
- ModelDetailPanel hintText 5분기(L296-304), topSaveTooltip(L636), lock(L795-796)
- DialogTitle "등록|수정" 삼항: GroupUpsertModal/UserUpsertModal/EqpManageFormModal
- 동적 placeholder: UserProfileModal L240, UserUpsertModal L261

### C3. 템플릿 리터럴 보간 (중간 — t() interpolation `{{var}}`)
- aria-label `"{eqpId} 삭제"`, `"{code} 선택"`, `"그룹 {code} 수정"`
- Badge `"선택 {n}건"`, `"{n}개 매핑"`, 페이지네이션 `"총 {n}건 · {p}/{t} 페이지"`
- toast `"Deploy #{n} 항목을 삭제했습니다."`, `"요청 완료: {n}대 시작, {n}대 제외"`

### C4. 모듈 상수 (배열/객체) — 컴포넌트 밖이라 t() 직접 불가 (구조 변경 필요)
- DLQ 컬럼 헤더 상수: BusinessDlqPanel/GatewayDlqPanel/QuarantinePanel/RepairTaskPanel/DashboardPanel FEED_COLUMNS (~35건)
- deploy-utils.ts 작업 라벨 맵/switch (18건)
- EqpLifecycleActionDialog ACTION_MESSAGES, EqpLifecycleResultDialog ACTION_RESULT_MESSAGES
- ModelCheckInDiffModal KIND_BADGE_LABEL, ColumnDef header
- CheckInModal ColumnDef header
→ 패턴: 상수에는 i18n **키**만 담고 렌더 시점에 `t(key)` 적용, 또는 컴포넌트 내부에서 `header: t('...')` 매핑.

### C5. api/types/lib 레이어 한글 fallback — t() 접근 불가 (구조 변경 필요)
- `*.api.ts` 의 `throw`/`fallbackMessage` 한글: deploy.api 14, eqp.api 24, model.api 33, model-flow.api 6, group.api 9, user.api 12, auth.api 6, profile.api 2, dlq.api 4, live-map*.api 13, comm-log.api 1
- `*.types.ts` 의 `DEFAULT_*_ERROR_MESSAGE` 상수: eqp/group/model/user/auth (각 1)
- lib 검증/요약: model-detail-editor 28(JSON 에디터 검증), model-flow-editor 6(summary), deploy-register-utils 6
→ 패턴: 호출부(컴포넌트)에서 errorCode→i18n 키 매핑하거나, BE `errorMsg` 우선·fallback만 키화. **백엔드가 errorMsg 채우면 대부분 미노출**이나 네트워크 실패 시 노출되므로 대상.

## 제외 / 보류 (번역하면 안 되거나 우선순위 낮음)
- **ModelDetailPanel.tsx:382** `"workflow {n}행"` — BE 에러 메시지 **매칭용 비교 prefix** (화면 표시 아님). 번역 시 매칭 깨짐 → **절대 변경 금지**.
- **useModelFlowMutations.ts:29/43/57** `"modelVersionKey 가 지정되지 않았습니다."` — 내부 invariant 가드. 정상 흐름 미노출 → 우선순위 낮음.
- **live-map-demo.ts:188-189** 완료/대기/진행 중 — `buildLiveMapDemoRunRows` 가 production 미사용(dead/mock). grep 확인됨. dead path 보존(글로벌 룰) → i18n 보류.
- **live-map-data.ts:42**, 각 api CSRF invariant 등 — 개발자용 메시지 성격, 정상 흐름 미노출. 정책 판단 필요.

## 이미 t() 적용 완료(참고 패턴)
- LoginPage 전체, AppTopBar/ThemeToggle/LanguageToggle, EqpSidebar/ModelSidebar/ModelInfoTable, GroupAdminPanel/UserAdminPanel, DeployStatusChart/DeploySidebar, live-map 컴포넌트 대부분, DlqPage/DlqSidebar/DlqTableShell.
→ 같은 feature 내 모달/패널만 미적용. `t('eqp.*')`, `t('model.*')`, `t('dlq.*')` 네임스페이스 컨벤션 존재.

---

## 전체 카탈로그 (file:line | 문자열 | 유형)

### deploy/components/SelectedEquipmentRow.tsx (2)
- 103 | "설비 파라미터 버전 목록을 조회하지 못했습니다." | error
- 115 | "{eqpId} 삭제" | aria-label(템플릿)

### deploy/components/DeployMonitorPanel.tsx (64)
- 325 | "Deploy 목록을 조회하지 못했습니다…" | error
- 417 / 1414 | "Hold 요청됨" | JSX Badge / ContextMenuItem
- 556/563/577/583 | "Deploy …를 조회하지 못했습니다" 계열 | error
- 643/653/672/675 | "모델:/시나리오:/인터페이스:" | const 템플릿(comment lines)
- 724 | "진행 중 Deploy 는 다시 실행할 수 없습니다." | toast
- 729 | "선택한 Deploy를 다시 실행하시겠습니까?" | confirm()
- 747/752/762/768/777/783/807/819/823/830/845/848/863/866 | 재실행/삭제/시작/hold toast 계열 | toast(일부 템플릿 #n)
- 891/892 | "Deploy 이력을 삭제하시겠습니까?"/"Deploy 를 삭제하시겠습니까?" | dialog-title(삼항)
- 896 | "{name} (#{n}) 항목이 삭제됩니다…" | dialog desc(템플릿)
- 899/900/1103 | "삭제"/"취소"/"닫기" | button
- 926/933/935/941/945 | "선택한 deploy의…"/"대상별 진행 현황"/"전체 {n}건·실패 {n}건"/로딩/빈상태 | JSX
- 953-959 | "작업/결과/상세 상태/현재 Step/Step 상태/오류 요약/갱신 시각" | column-header
- 1008/1010-1013/1017/1032/1042 | "요약"/"전체 대상:{n}대"/…/"모델:"/"결과 코드:"/"작업" | JSX 템플릿
- 1054/1055/1066/1071-1077/1085 | AS-IS/TO-BE 상세 라벨·fallback | JSX 템플릿
- 1422 | "동작 없음" | JSX
- 1450 | "총 {n}건 · {p}/{t} 페이지" | JSX 템플릿

### deploy/components/DeployRegisterPanel.tsx (69)
- 398/412 | "Deploy interfaceType 이 선택되지 않았습니다." | error throw (가드 선행, 노출 가능)
- 433/437/446/450/459/463/479/525/529/538/542/551/555/564/568 | 설비/Interface/Model Version/시나리오 검증 | toast + dialog message (다수 중복쌍)
- 436/449/462/485/528/541/554/567/638/681 | "Deploy 생성 실패"/"시나리오 Preview 실패" | dialog-title
- 502 | "변경이 없는 설비 {n}대를 Selected Equipments에서…" | toast 템플릿(혼합)
- 506/677/1114/1392/1396 | preview/생성/목록/옵션/사용자 조회 실패 | error fallback
- 632/648/657/668 | "Deploy 처리 중…"/"Deploy 탭에서 실행…"/"생성 직후 상세 조회 실패…" | dialog
- 652/667 | "Deploy 생성 완료" | dialog-title
- 740/746/753 | "추가할 설비를 먼저…"/"active Deploy에 포함된 설비는 Selected Equipments에…"/"…추가했습니다" | toast(혼합)
- 845/859/1000/1008 | "닫기"/"Deploy 탭으로 이동"·"확인"/"닫기"/"Deploy 중…"·"선택한 시나리오로 Deploy" | button(삼항)
- 877/879 | "시나리오 선택"/"권장 시나리오를 확인한 뒤…" | dialog
- 889/893/898/904/906/917 | "배포 대상"/"변경 없음 {n}대 제외"/"감지된 변경"/"권장 시나리오"/"권장 시나리오 없음"/빈상태 | JSX
- 923-929 | "선택/권장/시나리오명/코드/포함 변경/단계 수/설명" | column-header
- 954/961/988/1173 | "{code} 선택"/"권장"/preview 로딩/"{eqpId} 선택" | aria-label·JSX

### deploy/lib/deploy-utils.ts (18) — C4
- 55-60 REGISTER_SCENARIO_TASK_LABELS: "모델 변경"/"Business JAR 변경"/"EQP PARAM 변경"/"모델 + EQP PARAM 변경"/"모델 + Business JAR 변경"/"모델 + Business JAR + EQP PARAM 변경"
- 74-98 resolveDeployTaskLabel switch: "모델 변경"/"EQP PARAM 변경"/"Business JAR 변경"/"Gateway JAR 변경"/"설비 설정 변경"/"설비 등록"/"설비 삭제"/"설비 재연결"/"설비 시작"/"설비 종료"/"메시지 전송"/"Deploy 작업"

### deploy/lib/deploy-register-utils.ts (6) — C5
- 20 "오류 코드: {…}" / 97 "설비 {eqpId}: {msg}" / 100 / 104 "설비 {eqpId} 처리 상태:" / 112 "Deploy #{n} · 상태 {status}" / 137 "요청자 {…}"

### deploy/api/deploy.api.ts (14) — C5
- 25-36 DEFAULT 상수 12건(Deploy 대상/생성/목록/정보/상태/실행/hold/취소/재실행/이력삭제/시나리오/preview) + 165 CSRF + 626 "권장 시나리오를 계산하지 못했습니다."

### eqp/components/EqpPage.tsx (29)
- 117 PASSIVE 안내 / 774/780/792 등록·저장·수정 실패 / 816 "{id} 설비가 정상적으로 삭제…"(템플릿) / 824 삭제 실패 / 865/871/876/879 시작·종료 timeout / 889/908 lifecycle / 972 체크아웃 실패 / 1077/1081/1085/1100/1105/1110 파라미터 검증(템플릿 "중복된 Param Name…{}") / 1125/1144/1153/1168 저장·undo·체크인 / 1209 "{owner}님이 편집 중"(템플릿) / 1217/1220/1223/1226 목록·버전·상세·옵션 로드실패 / 1423 "{owner}님이 체크아웃 중"(title 템플릿)

### eqp/components/EqpManageFormModal.tsx (48)
- 203-282 parse 헬퍼 동적 조사 에러 "{label}을(를) 입력해 주세요." 등 10건(템플릿) | error
- 412 "사용"/"미사용" 삼항 / 600 is_dev hint(템플릿) / 611/615/619/686/691/695 throw 검증 / 751 폼 에러 fallback
- 766/767 DialogDescription 삼항 / 775 로딩 / 780/781 "공통 정보"·desc / 790/849/861/1012/1022/1166 placeholder "예:…"(한글 "예") / 807/873/907/926/948/993/1149 SelectValue "…를 선택해 주세요." / 876/951 "미선택" / 823/969 ToggleField·ReadOnly hint / 891/895/962/983/975/1032/1139 섹션 desc/label/경고

### eqp/components/EqpModelBindingModal.tsx (16)
- 98/216/221 throw 검증 / 231 fallback / 242 desc / 250 로딩 / 263/270/277/352 섹션 label("허용 모델 상태"/"현재 Model"/"현재 Version"/"선택 상태") / 293/318/338 SelectValue / 305 hint(템플릿) / 341 "미선택" / 364 경고

### eqp/components/CheckInModal.tsx (6)
- 75 desc / 95·203 "구분"(TableHead·ColumnDef) / 117 빈상태 / 137 "저장 시 자동 생성…" / 149 textarea placeholder "변경 내용 설명 (선택)"

### eqp/components/EqpInfoTable.tsx (4) / GatewayGroupTable.tsx (8)
- EqpInfoTable 53/54 "오프라인"(title·aria) 89/90 "주의 상태"
- GatewayGroupTable 62/63/98/99 "오프라인"·"주의 상태" / 122 "DB에서 설비를 찾을 수 없음…"(title) / 124 "미확인" / 405/406 "DB에서 찾을 수 없는 설비 {n}대…"·"최근 삭제되었을 수…"(JSX 템플릿)

### eqp/components/EqpParamTable.tsx (1)
- 121 "{paramName||'새 파라미터'} 행 삭제" | aria-label 템플릿

### eqp/components/EqpLifecycleActionDialog.tsx (5) — C4 / EqpLifecycleResultDialog.tsx (4) — C4
- ActionDialog 31-33 ACTION_MESSAGES "시작"/"종료"/"재시작" / 59-60 "{eqpId} 설비를 {action}하시겠습니까?"(삼항 템플릿)
- ResultDialog 32-34 ACTION_RESULT_MESSAGES 완료/실패 쌍 / 52 "{eqpId ?? '선택한 설비'} …"

### eqp/components/EqpDeleteConfirmDialog.tsx (2) / EqpDeleteResultDialog.tsx (2)
- ConfirmDialog 47/48 "{eqpId} 설비를 삭제하시겠습니까?…"/"선택한 설비를…"(삼항)
- ResultDialog 37/38 "{eqpId ?? '선택한 설비'} 삭제가 완료/실패…"

### eqp/api/eqp.api.ts (24) — C5
- 42 EQP_LIST_FALLBACK / 79 CSRF / 243~706 각 메서드 throw·fallback 한글(설비 상세/관리상세/batch/옵션/파라미터버전/연결모델/런타임/체크아웃상태/파라미터목록/체크아웃/EDIT저장/되돌리기/체크인/등록/수정/삭제/시작/종료/traceId없음/async 등 22 고유 문자열)

### eqp/types/eqp.types.ts (1) — C5
- 407 DEFAULT_EQP_ERROR_MESSAGE

### group/api/group.api.ts (9) — C5
- 25/26 fallback 상수 2 / 55 CSRF / 240/260/280/300/346/369 그룹 상세/생성/저장/삭제/멤버추가/멤버제거 실패

### group/types/group.types.ts (1) — C5
- 82 DEFAULT_GROUP_ERROR_MESSAGE

### group/components/GroupAddMembersModal.tsx (16)
- 98/107/124/131/151 setErrorMessage / 166 DialogTitle "그룹 멤버 추가" / 169 desc(템플릿) / 170 / 176 placeholder "userId 또는 이름으로 검색" / 191/195 로딩·빈상태 / 229 "멤버 제거" / 252 "추가 {n}건 / 실패 {n}건" / 253 " — 첫 오류: {…}" / 261 "닫기" / 269 "추가"

### group/components/GroupDeleteConfirmDialog.tsx (6) / GroupUpsertModal.tsx (15) / GroupListTable.tsx (4)
- DeleteConfirm 41 fallback / 46/47 desc(삼항) / 53 title "그룹 삭제" / 55/56 삭제·취소
- Upsert 95/111/123 setErrorMessage / 131 DialogTitle "그룹 등록|수정"(삼항) / 134/135 desc(삼항) / 142/153/164/184 label("그룹 코드"/"그룹 이름"/"설명"/"활성화 (사용자에게 부여 가능)") / 171 placeholder "(선택)" / 196/206 "취소"/"등록|저장"(삼항)
- ListTable 96/106/116 aria "그룹 {code} 사용자 추가/수정/삭제"(템플릿) / 181 "총 {n}건 · {p}/{t} 페이지"

### model/components/ModelDetailPanel.tsx (23) — hintText C2
- 297/299/301/303/304 hintText 5분기("모델을 선택해 주세요."/"Root model은 항상 읽기 전용…"/"DEPRECATED branch는…"/"읽기 전용입니다. 수정하려면 Check Out…"/"편집 중입니다. Save로 저장하고 Check In으로…")
- 636 "Flow 저장"/"Reference 저장"(삼항 tooltip) / 664 빈상태 / 695 "{name} {ver} 탭 닫기" / 945 "행 추가"
- 795/796 lock 안내(삼항) / 865/867/887/901/909 Flow/MDF 로딩·에러·빈상태 / 1028 "{val||'새 row'} 삭제" / 1048/1049 emptyState(삼항)
- 1069/1070/1071/1072 ConfirmDialog "Flow 를 삭제하시겠습니까?"/desc/"삭제"/"취소"
- (제외) 382 "workflow {n}행" — BE 매칭 prefix, 변경 금지

### model/components/modelDetailColumnDefs.tsx (2)
- 239 "{val??'flow'} {col} 편집"(aria 템플릿) / 273 "다른 행에 동일한 Flow Name이 있습니다."(title)

### model/components/FlowCard.tsx (25)
- 237/240 헤더 fallback "(flow 미지정)"·"(message 미지정)"·"Flow ID #신규" / 259 "삭제" / 264/278/282/294/297/312/323/326/340/344/353/360/371/383/389/398/423/435/437/442/464/490 — section description·placeholder·SelectValue·hint·버튼(대부분 jargon+한글: "Flow 의 고유 식별값입니다."/"신규 Flow 이름을 입력하세요"/"메시지를 선택하세요"/"DCOP 추가" 등)

### model/components/DcopItemPickerModal.tsx (20)
- 174 DialogTitle "DCOP Item 선택" / 176 desc(템플릿) / 189 안내 / 193 "선택 {n}건"(Badge) / 203 "모두 해제|모두 선택"(삼항) / 215/216 placeholder·aria "DCOP item 검색" / 223 빈상태 / 244/332 "{name} 선택"·"{name} 매핑 해제"(aria) / 252 "매핑됨" / 269 "선택한 DCOP item 추가" / 282/284 "현재 Flow 의 DCOP"·안내 / 288 "{n}개 매핑" / 299 "모두 제거" / 310 "삭제"(TableHead) / 318 빈상태 / 349/353 "취소"/"저장"

### model/components/FlowFilterEditorModal.tsx (17)
- 157 DialogTitle "Flow 편집"(삼항) / 159/174/192/195/349/460/485/550 desc·안내(jargon+한글) / 216/219/581/590 "취소"/"저장"/"조건 추가"/"그룹 추가" / 359/528 aria "조건 삭제"·"transform 삭제" / 449 placeholder "예: …" / 481 "transform 추가"

### model/components/ActionDataIndexEditorModal.tsx (25)
- 210 DialogTitle "Flow 편집"(삼항) / 212/226/273/286/290/297 desc·안내·상태(jargon+한글) / 259 SelectValue "MDF message를 선택해 주세요." / 261 "선택 안 함" / 278 label "선택된 XML Preview" / 319/525 "field 추가"·"transform 추가" / 327/332 TableHead "순서"·"작업" / 357/369/381 aria "{field} 순서 드래그/위로/아래로"(템플릿) / 358/370/382 title "드래그해서 순서 변경"/"위로 이동"/"아래로 이동" / 454 "transform 없음" / 499/545 aria "transform 삭제"·"field 삭제" / 561/564 "취소"/"저장"

### model/components/ModelPage.tsx (17) — C5(fallback)
- 652/743/764/897/934/954/999/1072/1161/1294/1326/1331 fallback(상세/저장/MDF/root/branch/parent diff/parent commit/모델삭제/체크아웃/원복/체크인/목록) / 1133/1138/1250/1264/1300 직접 한글(root readonly/DEPRECATED/Undo 없음/checkout 이전 없음/체크인 EDIT 없음)

### model/components/ModelCheckInDiffModal.tsx (10) — C4(상수 일부)
- 43-45 KIND_BADGE_LABEL "추가"/"변경"/"삭제" / 93·106 ColumnDef header "구분"·"식별자" / 235 DialogTitle "변경사항 미리보기" / 237 desc / 245/249 로딩·빈상태 / 269 "추가 {n} / 변경 {n} / 삭제 {n}"

### model/components 기타
- ModelCheckInModal 107 placeholder "변경 내용을 입력해 주세요." (1)
- ModelCreateOrUpdateModal 54/55/97 desc·안내(삼항) / 60 검증 "Model Name을 입력해 주세요." / 95 "기본 정보" / 113/122 placeholder "예: MODEL_A"·"제조사명을 입력해 주세요." (7)
- ModelDeleteConfirmDialog 38/39/42/43/45/46 description 삼항 6분기(jargon+한글) (6)
- ModelFlowSidebar 158 "표시할 Flow 가 없습니다." (1)
- ParentModelCommitModal 83/87 diff header "항목" / 198 "{n}건" / 258 검증 / 279/313/315/346/352/358 desc·안내·로딩·빈상태 / 392/399/406 DiffTable title "추가/변경/삭제 항목" (13)
- BranchModelCreateModal 97/102/107/113 검증 / 133/191 desc·안내 / 160 SelectValue / 176 "설명 없음" / 189 placeholder "예: hotfix" / 204/206/207 hint(삼항·템플릿 "{n}자 초과"/"남은 길이 {n}자") (12)

### model/api/model.api.ts (33) — C5 / model-flow.api.ts (6) — C5
- model.api 37/38 상수 fallback 2 / 77 CSRF / 315~733 각 메서드 fallback(상세/checkout/checkin/저장/MDF/root생성/root수정/branch생성/parent diff/parent commit/deprecated삭제/등록/수정/삭제) — try/catch 양쪽 중복
- model-flow.api 21-25 FLOW_*_FALLBACK 5 / 60 CSRF

### model/hooks (5) — borderline
- useModelMutations 72/73 "{owner}님이 체크아웃한 모델…"/"다른 사용자가…"(삼항) — checkout 충돌 에러(노출됨)
- useModelFlowMutations 29/43/57 "modelVersionKey 가 지정되지 않았습니다." — 내부 invariant, 우선순위 낮음

### model/lib/model-detail-editor.ts (28) — C5 / model-flow-editor.ts (6) — C5
- model-detail-editor 113~579 JSON 에디터 검증 throw 한글(workflow_filter/action_data_index 구조 검증, 대부분 jargon+한글) — FlowFilterEditorModal/ActionDataIndexEditorModal 로 전파
- model-flow-editor 124/128/132 "필터 없음" / 146/150/154 "매핑 없음" — FlowCard summary 노출

### model/types/model.types.ts (1) — C5
- 302 DEFAULT_MODEL_ERROR_MESSAGE

### live-map/components/LiveMapDemoModal.tsx (9)
- 207/310 fallback / 307 "요청 완료: {n}대 시작, {n}대 제외"(템플릿) / 319/324 "{type} 테스트 종료를 요청/실패…"(템플릿) / 395 "{label} 라인 일괄 선택"·"공정 일괄 선택"(삼항 aria) / 406 "{label} 접기|펼치기"(삼항) / 426 "{n}대"

### live-map/lib + api (16) — C5 / borderline
- live-map-data.ts 42 invariant(개발자용) / live-map-demo.ts 188-189 dead/mock(보류) / comm-log.api 16 / live-map-demo.api 77/103/153/171/192/225 fallback·CSRF / live-map.api 34 LIVE_MAP_ERROR_MESSAGE

### dlq/components (35) — C4(컬럼 헤더 상수)
- DashboardPanel 45 "격리 설비"(CATEGORY_STYLES) / 64/69/89/94/99 FEED_COLUMNS header
- BusinessDlqPanel 13-31 컬럼 header 12건(출처/단계/토픽/파티션/오프셋/설비/타입/이름/사유 코드/사유/발생 시각/"payload 참조")
- GatewayDlqPanel 13-27 7건(설비/소켓/단계/사유 코드/사유/발생 시각/"payload 참조")
- QuarantinePanel 12-22 4건(설비/사유 코드/사유/격리 시각)
- RepairTaskPanel 13-23 6건(설비/커맨드/액션/에러 코드/에러 메시지/생성 시각)

### dlq/api/dlq.api.ts (4) — C5
- 52/58/64/70 Gateway DLQ/Business DLQ/격리 설비/Repair Task 목록 조회 실패 fallback

### user/auth/profile
- auth.api 16-24/126 (6) C5 / useLogin 19-24 zod 검증 4 / auth.types 62 (1) C5
- profile.api 73/76 (2) C5 / UserProfileModal 95/121/127/134/148/155 setFeedbackMessage / 179/180/187/279 JSX / 226 "user_id는 수정할 수 없습니다." / 240 placeholder(삼항) / 260/300/309 버튼 (16)
- user.api 26/55/191-344 (12) C5 / user.types 130 (1) C5
- UserDeleteConfirmDialog 41/46/47/53/55/56 (6) / UserListTable 111/121/131 aria(템플릿)·201 페이지요약 (4)
- UserPasswordResetModal 76/106/109/110/111/128/132/138/149/152/158 (11)
- UserUpsertModal 135/142/157/178 검증 / 186 DialogTitle(삼항) / 189/190 desc / 197-266 label 다수 / 253/261 한글혼합·placeholder(삼항) / 299/308 버튼 (21)

### shared / components/ui / app (8) — C4(공용 default)
- Router.tsx 54 "화면을 불러오는 중입니다." | Suspense fallback
- SelectableTable.tsx 519 "작업"(action header fallback) / 531 "표시할 데이터가 없습니다."(emptyState fallback)
- confirm-dialog.tsx 140/141 "확인"/"취소"(default prop) — 가장 광범위 노출
- dialog.tsx 68 "닫기"(aria) / resizable-divider.tsx 95 "패널 크기 조절 핸들" / sidebar-resize-handle.tsx 92 "사이드바 크기 조절 핸들"

---

## 제안 작업 순서 (SDD Implement 단계)
키 추출은 회귀 위험이 크므로 **카테고리·feature 단위로 쪼개** 각 단계마다 빌드+e2e 회귀 확인.

1. **공용 default (shared/ui 8)** — 가장 광범위 노출(confirm-dialog/SelectableTable). 먼저.
2. **C5 api/types fallback** — errorCode→키 매핑 전략 확정 후 feature별. (BE errorMsg 우선이라 노출 빈도 낮으나 양 많음)
3. **C4 모듈 상수(DLQ 헤더, deploy-utils, lifecycle 상수)** — 구조 변경(키만 담고 렌더 t()).
4. **C1/C2/C3 컴포넌트 인라인** — feature별(deploy → eqp → model → user → live-map). 가장 양 많음(≈500).

각 feature 단계 = 실패 e2e/스냅샷 먼저 → ko/en 키 추가 → 컴포넌트 t() 치환 → 빌드+e2e PASS.

## 사용자 결정 필요
- C5 api 레이어 fallback: (a) 호출부 translate vs (b) errorCode 매핑 vs (c) 보류(BE errorMsg 신뢰) — 양이 ~120건이라 영향 큼.
- borderline(useModelFlowMutations invariant, live-map-demo dead, 개발자용 invariant): i18n 대상 포함 여부.
- 작업을 한 SDD 로 묶을지, feature별 다중 PR 로 쪼갤지.
