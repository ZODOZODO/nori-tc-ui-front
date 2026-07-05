import test from 'node:test'
import assert from 'node:assert/strict'
import { extractMdfMessageOptions } from '@/features/model/lib/mdf-message-parser.ts'

test('message name 속성이 있는 MDF XML은 message name 기준 dropdown option을 추출합니다', () => {
  const options = extractMdfMessageOptions([
    {
      id: 'mdf-1',
      name: 'MAIN_MDF',
      xml: `
        <mdf>
          <message name="TOOL_CONDITION_REQUEST" target="EQP" output="RAW_MESSAGE">
            <template>CMD=TOOL_CONDITION_REQUEST EQPID={EQPID}</template>
            <field name="EQPID" var="EQPID" required="true"/>
          </message>
          <message name="TOOL_CONDITION_REPLY" target="MES" output="KAFKA">
            <field name="EQPID" var="EQPID" required="true"/>
            <field name="STATUS" var="STATUS" required="true"/>
          </message>
        </mdf>
      `,
    },
  ])

  assert.deepEqual(
    options.map((option) => option.messageName),
    ['TOOL_CONDITION_REQUEST', 'TOOL_CONDITION_REPLY'],
  )
  assert.equal(options[0]?.targetType, 'EQP')
  assert.equal(options[0]?.outputType, 'RAW_MESSAGE')
  assert.equal(options[1]?.targetType, 'MES')
  assert.equal(options[1]?.outputType, 'KAFKA')
})

test('KAFKA output message는 template 없이도 정상 추출됩니다', () => {
  const options = extractMdfMessageOptions([
    {
      id: 'mdf-2',
      name: 'KAFKA_MDF',
      xml: `
        <mdf>
          <message name="TOOL_CONDITION_REPLY" target="MES" output="KAFKA">
            <field name="EQPID" var="EQPID" required="true"/>
            <field name="STATUS" var="STATUS" required="true"/>
          </message>
        </mdf>
      `,
    },
  ])

  assert.equal(options.length, 1)
  assert.equal(options[0]?.messageName, 'TOOL_CONDITION_REPLY')
  assert.equal(options[0]?.outputType, 'KAFKA')
})

test('태그 이름 자체가 메시지인 XML도 dropdown option과 preview 조각을 추출합니다', () => {
  const options = extractMdfMessageOptions([
    {
      id: 'mdf-3',
      name: 'TAG_STYLE_MDF',
      xml: `
        <ROOT>
          <TEST>CMD=TEST EQPID=[EQPID]</TEST>
          <PING>CMD=PING</PING>
        </ROOT>
      `,
    },
  ])

  assert.deepEqual(
    options.map((option) => option.messageName),
    ['TEST', 'PING'],
  )
  assert.equal(
    options[0]?.xmlSnippet.trim(),
    '<TEST>CMD=TEST EQPID=[EQPID]</TEST>',
  )
  // 축약 포맷은 target/output 속성이 없으므로 null
  assert.equal(options[0]?.targetType, null)
  assert.equal(options[0]?.outputType, null)
})

test('output/target 속성이 없는 message는 null로 처리됩니다', () => {
  const options = extractMdfMessageOptions([
    {
      id: 'mdf-4',
      name: 'LEGACY_MDF',
      xml: `
        <mdf>
          <message name="LEGACY_REQUEST">
            <template>CMD=LEGACY EQPID={EQPID}</template>
          </message>
        </mdf>
      `,
    },
  ])

  assert.equal(options.length, 1)
  assert.equal(options[0]?.messageName, 'LEGACY_REQUEST')
  assert.equal(options[0]?.targetType, null)
  assert.equal(options[0]?.outputType, null)
})
