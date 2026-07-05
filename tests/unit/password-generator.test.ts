import assert from 'node:assert/strict'
import test from 'node:test'
import { generateTemporaryPassword } from '@/features/user/lib/password-generator.ts'

const UPPER_RE = /[A-Z]/
const LOWER_RE = /[a-z]/
const DIGIT_RE = /[0-9]/
const SPECIAL_RE = /[!@#$%^&*]/

test('생성된 임시 비밀번호는 정확히 12자 길이입니다', () => {
  const password = generateTemporaryPassword()
  assert.equal(password.length, 12)
})

test('생성된 임시 비밀번호는 대/소문자/숫자/특수문자를 각각 1개 이상 포함합니다', () => {
  const password = generateTemporaryPassword()
  assert.ok(UPPER_RE.test(password), `대문자 누락: ${password}`)
  assert.ok(LOWER_RE.test(password), `소문자 누락: ${password}`)
  assert.ok(DIGIT_RE.test(password), `숫자 누락: ${password}`)
  assert.ok(SPECIAL_RE.test(password), `특수문자 누락: ${password}`)
})

test('100회 반복 호출해도 모든 출력이 길이 12 + 4 문자 클래스 보장을 만족합니다', () => {
  const generated = new Set<string>()
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const password = generateTemporaryPassword()
    assert.equal(password.length, 12, `반복 ${attempt} 회: 길이 mismatch`)
    assert.ok(UPPER_RE.test(password), `반복 ${attempt} 회: 대문자 누락`)
    assert.ok(LOWER_RE.test(password), `반복 ${attempt} 회: 소문자 누락`)
    assert.ok(DIGIT_RE.test(password), `반복 ${attempt} 회: 숫자 누락`)
    assert.ok(SPECIAL_RE.test(password), `반복 ${attempt} 회: 특수문자 누락`)
    generated.add(password)
  }
  const uniqueRatio = generated.size / 100
  assert.ok(uniqueRatio > 0.5, `중복 비율 과다 — 100회 중 ${generated.size}개만 고유`)
})

test('특수문자는 허용된 8자(!@#$%^&*) 외 문자를 포함하지 않습니다', () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const password = generateTemporaryPassword()
    const allowed = /^[A-Za-z0-9!@#$%^&*]+$/
    assert.ok(allowed.test(password), `허용 외 문자 포함: ${password}`)
  }
})
