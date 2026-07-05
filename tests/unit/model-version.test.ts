import assert from 'node:assert/strict'
import test from 'node:test'
import { createNextDailyModelVersion } from '@/features/model/lib/model-version.ts'

test('model version은 Asia/Seoul 날짜 기준 yy.MM.dd.0000 형식으로 생성됩니다.', () => {
  const nextVersion = createNextDailyModelVersion(
    'ROOT',
    [],
    new Date('2026-04-17T00:00:00.000Z'),
  )

  assert.equal(nextVersion, '26.04.17.0000')
})

test('같은 modelName의 오늘 버전 중 가장 큰 sequence 다음 값을 생성합니다.', () => {
  const nextVersion = createNextDailyModelVersion(
    'ROOT',
    [
      { modelName: 'ROOT', modelVersion: '26.04.17.0000' },
      { modelName: 'ROOT', modelVersion: '26.04.17.0002' },
      { modelName: 'ROOT', modelVersion: '26.04.16.9999' },
      { modelName: 'ROOT', modelVersion: 'EDIT' },
      { modelName: 'OTHER', modelVersion: '26.04.17.0009' },
    ],
    new Date('2026-04-17T00:00:00.000Z'),
  )

  assert.equal(nextVersion, '26.04.17.0003')
})
