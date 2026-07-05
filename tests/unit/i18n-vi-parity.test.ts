import assert from 'node:assert/strict'
import test from 'node:test'
import vi from '@/i18n/locales/vi.json' with { type: 'json' }
import en from '@/i18n/locales/en.json' with { type: 'json' }
import ko from '@/i18n/locales/ko.json' with { type: 'json' }

/**
 * vi(베트남어) locale 의 Canonical Jargon Policy 준수를 raw JSON 직접 비교로 검증한다.
 * (SPEC .claude/specs/i18n-language-addition.md AC1~AC4, Plan D3/D4.)
 *
 * i18next 인스턴스 경유 금지 — fallbackLng:'ko' 가 누락 키를 ko 로 폴백해 parity 버그를
 * 은닉하기 때문이다(rule 11 "항상 통과하는 mock" 안티패턴). 순수 데이터 비교는 raw JSON 이 정직.
 */
const viMap = vi as Record<string, string>
const enMap = en as Record<string, string>
const koMap = ko as Record<string, string>

// AC2 — ko==en 인 Layer1 키 중 Tier A jargon 으로 분류된 7개. vi 도 en 과 값 동일해야 한다.
const TIER_A_LAYER1_KEYS = [
  'dlq.sidebar.gateway',
  'dlq.panel.gateway',
  'dlq.sidebar.business',
  'dlq.panel.business',
  'dlq.sidebar.repairTask',
  'dlq.panel.repairTask',
  'livemap.demo.colEqp',
]

// AC3 — Tier A 하드 jargon (SPEC L45). 전 언어 영어 verbatim. case-sensitive \b토큰\b 매칭.
// 제외 일반 영단어(from/path/field/branch/Root/Action/Collect/transform)는 FP 위험으로 미포함(SPEC L48).
const TOKENS = [
  'Business',
  'Model',
  'Eqp',
  'Gateway',
  'DLQ',
  'MES',
  'Flow',
  'Jar',
  'Param',
  'Step',
  'PORT',
  'MDF',
  'DCOP',
  'Repair Task',
  'Interface Type',
  'SECS',
  'HSMS',
  'Check In',
  'Identity',
  'Trigger',
  'Collection Rule',
  'Variable Id',
  'EventId',
  'Source MDF',
  'Parent Model Commit',
  'Diff Preview',
  'Reference',
]

// SPEC L48 FP 원칙의 키 단위 적용 — en 값이 해당 토큰을 jargon 이 아닌 일반 영어로 쓰는 자리.
// 'Process Flow'(공정 흐름 탭/보드 제목)의 Flow 는 Message Flow 엔티티가 아닌 일반 영어 —
// vi 는 livemap.board.subtitle 과 동일하게 'Luồng công đoạn' 으로 번역한다.
const TOKEN_FP_EXCEPTIONS = new Set(['livemap.mode.viewer::Flow', 'livemap.board.title::Flow'])

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test('AC1 — vi 와 en 의 키 집합이 동일하다 (parity)', () => {
  const viKeys = new Set(Object.keys(viMap))
  const enKeys = new Set(Object.keys(enMap))

  const onlyInVi = [...viKeys].filter((key) => !enKeys.has(key))
  const onlyInEn = [...enKeys].filter((key) => !viKeys.has(key))

  assert.deepEqual(onlyInVi, [], `only in vi: ${onlyInVi.join(', ')}`)
  assert.deepEqual(onlyInEn, [], `only in en (missing from vi): ${onlyInEn.join(', ')}`)
  assert.equal(viKeys.size, enKeys.size)
})

test('AC2 — Layer1 Tier A jargon 키는 vi[k] === en[k]', () => {
  for (const key of TIER_A_LAYER1_KEYS) {
    assert.equal(viMap[key], enMap[key], `${key}: vi="${viMap[key]}" en="${enMap[key]}"`)
  }
})

test('AC3 — en[k] 에 Tier A 토큰이 있으면 vi[k] 에도 동일 토큰이 verbatim 유지된다', () => {
  // 영어 복수형(Models/Flows/Steps)은 word-boundary 밖이라 미검사 — 의도적. 그 자체가 jargon
  // 어근이라 vi 가 자연히 보존하므로 위반 불가(Plan D4).
  const allViolations: string[] = []
  const vacuousTokens: string[] = []

  for (const token of TOKENS) {
    const re = new RegExp(`\\b${escapeRegExp(token)}\\b`) // case-sensitive (no i flag) — 대문자 약어/Model 충돌 방지
    let enHits = 0
    for (const key of Object.keys(enMap)) {
      if (re.test(enMap[key])) {
        enHits += 1
        if (!re.test(viMap[key]) && !TOKEN_FP_EXCEPTIONS.has(`${key}::${token}`)) {
          allViolations.push(`${key} [${token}]: vi="${viMap[key]}"`)
        }
      }
    }
    if (enHits === 0) {
      vacuousTokens.push(token)
    }
  }

  // en 출현 0건 토큰은 현재 검사 no-op(미래 글로사리). 침묵 누락 회피를 위해 명시 로그.
  if (vacuousTokens.length > 0) {
    console.log(`[AC3] en 출현 0건 토큰(현재 vacuous): ${vacuousTokens.join(', ')}`)
  }

  assert.deepEqual(allViolations, [], `Tier A 토큰 소실 키:\n${allViolations.join('\n')}`)
})

test('AC4 — 네이티브 언어 라벨이 전 locale 에 존재하고 일치한다', () => {
  assert.equal(viMap['language.ko'], '한국어')
  assert.equal(viMap['language.en'], 'English')

  // language.vi 가 ko/en/vi 세 locale 에 모두 존재하고 동일 네이티브 라벨.
  assert.ok(viMap['language.vi'], 'vi 에 language.vi 누락')
  assert.ok(koMap['language.vi'], 'ko 에 language.vi 누락')
  assert.ok(enMap['language.vi'], 'en 에 language.vi 누락')
  assert.equal(viMap['language.vi'], koMap['language.vi'])
  assert.equal(viMap['language.vi'], enMap['language.vi'])
})
