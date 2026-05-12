/**
 * 사용자 비밀번호 초기화 UX 용 임시 비밀번호 생성 유틸입니다.
 * - 정확히 12자 길이
 * - 대문자/소문자/숫자/특수문자(!@#$%^&*) 각 1개 이상 보장
 * - 브라우저 / Node 모두에서 동작하도록 globalThis.crypto.getRandomValues 사용
 */

const UPPERCASE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWERCASE_CHARS = 'abcdefghijkmnpqrstuvwxyz'
const DIGIT_CHARS = '23456789'
const SPECIAL_CHARS = '!@#$%^&*'

const CHAR_POOLS: readonly string[] = [
  UPPERCASE_CHARS,
  LOWERCASE_CHARS,
  DIGIT_CHARS,
  SPECIAL_CHARS,
]

const PASSWORD_LENGTH = 12

/**
 * `globalThis.crypto.getRandomValues` 기반 안전한 uint32 시퀀스를 가져옵니다.
 * Node 19+ 와 모든 모던 브라우저에서 동작합니다 (Node --test 환경 포함).
 */
const getRandomUint32Sequence = (count: number): Uint32Array => {
  const buffer = new Uint32Array(count)
  globalThis.crypto.getRandomValues(buffer)
  return buffer
}

const pickFromPool = (pool: string, randomValue: number): string => {
  const index = randomValue % pool.length
  return pool[index]
}

/**
 * 4 클래스 보장 슬롯과 잔여 슬롯을 모두 채운 뒤 Fisher–Yates 셔플로 위치를 무작위화합니다.
 */
export const generateTemporaryPassword = (): string => {
  // 4 클래스 + 잔여 슬롯(8) + 셔플용 swap 인덱스(11) = 23 uint32
  const randomValues = getRandomUint32Sequence(PASSWORD_LENGTH + (PASSWORD_LENGTH - 1))
  const allPools = UPPERCASE_CHARS + LOWERCASE_CHARS + DIGIT_CHARS + SPECIAL_CHARS

  const characters: string[] = []
  for (let classIndex = 0; classIndex < CHAR_POOLS.length; classIndex += 1) {
    characters.push(pickFromPool(CHAR_POOLS[classIndex], randomValues[classIndex]))
  }

  for (let slot = CHAR_POOLS.length; slot < PASSWORD_LENGTH; slot += 1) {
    characters.push(pickFromPool(allPools, randomValues[slot]))
  }

  // Fisher–Yates 셔플로 4 클래스 보장 슬롯의 위치를 분산시킵니다.
  for (let cursor = characters.length - 1; cursor > 0; cursor -= 1) {
    const swapRandom = randomValues[PASSWORD_LENGTH + cursor - 1]
    const swapIndex = swapRandom % (cursor + 1)
    const temp = characters[cursor]
    characters[cursor] = characters[swapIndex]
    characters[swapIndex] = temp
  }

  return characters.join('')
}
