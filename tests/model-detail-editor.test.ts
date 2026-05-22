import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildActionDataIndexValue,
  buildFlowFilterValue,
  parseActionDataIndexEditor,
  parseFlowFilterEditor,
  summarizeActionDataIndexValue,
  summarizeFlowFilterValue,
} from '../src/features/model/lib/model-detail-editor.ts'

const WORKFLOW_CANONICAL = `{
  "and": [
    {
      "from": "data",
      "path": "status",
      "comparison": "equals",
      "expected": "OK",
      "transforms": ["trim", "upper"]
    },
    {
      "or": [
        {
          "from": "metadata",
          "path": "eventType",
          "comparison": "equals",
          "expected": "READY"
        },
        {
          "from": "data",
          "path": "retryCount",
          "comparison": "greater_than_or_equal",
          "expected": 4
        }
      ]
    }
  ]
}`

const ACTION_CANONICAL_WITH_SHORTHAND = `{
  "mdfTemplateName": "TOOL_CONDITION_REPLY_MES",
  "fields": {
    "EQPID": "eqpId",
    "EVENT_TYPE": {
      "from": "metadata",
      "path": "eventType",
      "transforms": ["trim", "upper"]
    }
  }
}`

test('workflow_filter canonical JSON은 structured parse/build/summarize를 유지합니다', () => {
  const editor = parseFlowFilterEditor(WORKFLOW_CANONICAL)

  assert.equal(editor.mode, 'structured')
  assert.equal(editor.rootGroup.groupType, 'and')
  assert.equal(editor.rootGroup.children.length, 2)

  const rebuilt = buildFlowFilterValue(editor)
  assert.deepEqual(JSON.parse(rebuilt), JSON.parse(WORKFLOW_CANONICAL))

  const editableCondition = editor.rootGroup.children[0]
  assert.equal(editableCondition.nodeType, 'condition')
  editableCondition.path = 'result.status'
  editableCondition.expectedText = '"READY"'

  const rebuiltAfterEdit = JSON.parse(buildFlowFilterValue(editor))
  assert.equal(rebuiltAfterEdit.and[0].path, 'result.status')
  assert.equal(rebuiltAfterEdit.and[0].expected, 'READY')

  assert.equal(
    summarizeFlowFilterValue(WORKFLOW_CANONICAL),
    'and(data.status{comparison=equals, expected="OK", transforms=[trim, upper]}, or(metadata.eventType{comparison=equals, expected="READY"}, data.retryCount{comparison=greater_than_or_equal, expected=4}))',
  )
})

test('workflow_filter 구계약 또는 invalid path 입력은 raw fallback으로 보존합니다', () => {
  const legacyWorkflow = `{
  "rows": [
    {
      "left": "MSG.status",
      "op": "eq",
      "right": "OK"
    }
  ]
}`
  const invalidAbsolutePath = `{
  "and": [
    {
      "from": "data",
      "path": "data.status",
      "comparison": "equals",
      "expected": "OK"
    }
  ]
}`

  const legacyEditor = parseFlowFilterEditor(legacyWorkflow)
  const invalidEditor = parseFlowFilterEditor(invalidAbsolutePath)

  assert.equal(legacyEditor.mode, 'raw')
  assert.equal(invalidEditor.mode, 'raw')
  assert.equal(buildFlowFilterValue(legacyEditor), legacyWorkflow.trim())
  assert.equal(buildFlowFilterValue(invalidEditor), invalidAbsolutePath.trim())
})

test('action_data_index canonical JSON은 shorthand를 포함해 structured parse/build/summarize를 유지합니다', () => {
  const editor = parseActionDataIndexEditor(ACTION_CANONICAL_WITH_SHORTHAND)

  assert.equal(editor.mode, 'structured')
  assert.equal(editor.mdfTemplateName, 'TOOL_CONDITION_REPLY_MES')
  assert.equal(editor.fields.length, 2)
  assert.equal(editor.fields[0].fieldName, 'EQPID')
  assert.equal(editor.fields[0].from, 'data')
  assert.equal(editor.fields[0].path, 'eqpId')
  assert.equal(editor.fields[1].fieldName, 'EVENT_TYPE')
  assert.equal(editor.fields[1].from, 'metadata')
  assert.equal(editor.fields[1].path, 'eventType')

  const rebuilt = buildActionDataIndexValue(editor)
  assert.deepEqual(JSON.parse(rebuilt), {
    mdfTemplateName: 'TOOL_CONDITION_REPLY_MES',
    fields: {
      EQPID: {
        from: 'data',
        path: 'eqpId',
      },
      EVENT_TYPE: {
        from: 'metadata',
        path: 'eventType',
        transforms: ['trim', 'upper'],
      },
    },
  })

  editor.mdfTemplateName = 'TOOL_CONDITION_REPLY_EQP'
  editor.fields[0].path = 'equipment.id'

  const rebuiltAfterEdit = JSON.parse(buildActionDataIndexValue(editor))
  assert.equal(rebuiltAfterEdit.mdfTemplateName, 'TOOL_CONDITION_REPLY_EQP')
  assert.equal(rebuiltAfterEdit.fields.EQPID.path, 'equipment.id')

  assert.equal(
    summarizeActionDataIndexValue(ACTION_CANONICAL_WITH_SHORTHAND),
    'mdfTemplateName=TOOL_CONDITION_REPLY_MES / EQPID {from=data, path=eqpId}',
  )
})

test('action_data_index 구계약 입력은 raw fallback으로 보존합니다', () => {
  const legacyActionDataIndex = `{
  "messageName": "TOOL_CONDITION_REPLY_MES",
  "fields": {
    "EQPID": {
      "source": "MSG",
      "var": "eqpId"
    }
  }
}`

  const editor = parseActionDataIndexEditor(legacyActionDataIndex)

  assert.equal(editor.mode, 'raw')
  assert.equal(buildActionDataIndexValue(editor), legacyActionDataIndex.trim())
})

test('workflow_filter는 param from을 structured parse/build/summarize에 포함합니다', () => {
  const workflowWithParam = `{
  "and": [
    {
      "from": "param",
      "path": "recipeId",
      "comparison": "equals",
      "expected": "RCP-01"
    }
  ]
}`

  const editor = parseFlowFilterEditor(workflowWithParam)

  assert.equal(editor.mode, 'structured')
  const condition = editor.rootGroup.children[0]
  assert.equal(condition.nodeType, 'condition')
  assert.equal(condition.from, 'param')
  assert.equal(condition.path, 'recipeId')
  assert.deepEqual(JSON.parse(buildFlowFilterValue(editor)), JSON.parse(workflowWithParam))
  assert.equal(
    summarizeFlowFilterValue(workflowWithParam),
    'and(param.recipeId{comparison=equals, expected="RCP-01"})',
  )
})

test('action_data_index는 param from을 structured parse/build/summarize에 포함합니다', () => {
  const actionDataIndexWithParam = `{
  "mdfTemplateName": "TOOL_CONDITION_REPLY_MES",
  "fields": {
    "RECIPE_ID": {
      "from": "param",
      "path": "recipeId"
    }
  }
}`

  const editor = parseActionDataIndexEditor(actionDataIndexWithParam)

  assert.equal(editor.mode, 'structured')
  assert.equal(editor.fields[0].from, 'param')
  assert.equal(editor.fields[0].path, 'recipeId')
  assert.deepEqual(JSON.parse(buildActionDataIndexValue(editor)), JSON.parse(actionDataIndexWithParam))
  assert.equal(
    summarizeActionDataIndexValue(actionDataIndexWithParam),
    'mdfTemplateName=TOOL_CONDITION_REPLY_MES / RECIPE_ID {from=param, path=recipeId}',
  )
})
