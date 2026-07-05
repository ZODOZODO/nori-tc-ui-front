import assert from 'node:assert/strict'
import test from 'node:test'
import i18next from 'i18next'
import { i18nBaseOptions } from '@/i18n/config.ts'

/**
 * prod 와 동일한 i18nBaseOptions 로 i18next 인스턴스를 띄워, P0 전환의 핵심 계약을 검증한다.
 * (DOM/React 비의존이라 node --test 에서 실행 가능. shim 동작 자체는 e2e 가 커버.)
 */
async function createInstance() {
  const instance = i18next.createInstance()
  await instance.init({
    ...i18nBaseOptions,
    lng: 'en',
    resources: {
      ko: {
        translation: {
          'eqp.sidebar.title': '설비',
          'deploy.feedback.deleted': '배포 #{{id}} 항목을 삭제했습니다.',
          'common.onlyKo': '한국어 전용',
        },
      },
      en: {
        translation: {
          'eqp.sidebar.title': 'Equipment',
          'deploy.feedback.deleted': 'Deploy #{{id}} deleted.',
        },
      },
    },
  })
  return instance
}

test('flat key("a.b.c") 가 중첩 해석 없이 그대로 조회된다', async () => {
  const i18n = await createInstance()
  // keySeparator:false 가 아니면 "eqp.sidebar.title" 를 nested 로 파싱 → key 문자열 그대로 반환.
  assert.equal(i18n.t('eqp.sidebar.title'), 'Equipment')
  assert.notEqual(i18n.t('eqp.sidebar.title'), 'eqp.sidebar.title')
})

test('interpolation {{var}} 가 적용된다', async () => {
  const i18n = await createInstance()
  assert.equal(i18n.t('deploy.feedback.deleted', { id: 7 }), 'Deploy #7 deleted.')
})

test('en 에 없는 키는 fallbackLng:ko 값으로 폴백된다', async () => {
  const i18n = await createInstance()
  assert.equal(i18n.t('common.onlyKo'), '한국어 전용')
})
