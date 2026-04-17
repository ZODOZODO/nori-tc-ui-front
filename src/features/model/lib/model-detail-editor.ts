const LOOKUP_SOURCE_OPTIONS = ['data', 'metadata', 'param'] as const
const WORKFLOW_COMPARISON_OPTIONS = [
  'equals',
  'not_equals',
  'greater_than',
  'greater_than_or_equal',
  'less_than',
  'less_than_or_equal',
  'contains',
  'in',
] as const

type EditorMode = 'structured' | 'raw'
type WorkflowGroupType = 'and' | 'or'

export type WorkflowLookupSource = (typeof LOOKUP_SOURCE_OPTIONS)[number]
export type WorkflowComparison = (typeof WORKFLOW_COMPARISON_OPTIONS)[number]

export interface TransformDraft {
  id: string
  value: string
}

export interface WorkflowConditionDraft {
  id: string
  nodeType: 'condition'
  from: WorkflowLookupSource
  path: string
  comparison: WorkflowComparison
  expectedText: string
  transforms: TransformDraft[]
}

export interface WorkflowGroupDraft {
  id: string
  nodeType: 'group'
  groupType: WorkflowGroupType
  children: WorkflowNodeDraft[]
}

export type WorkflowNodeDraft = WorkflowConditionDraft | WorkflowGroupDraft

export interface WorkflowFilterEditorDraft {
  mode: EditorMode
  rawValue: string
  rootGroup: WorkflowGroupDraft
}

export interface ActionDataIndexFieldDraft {
  id: string
  fieldName: string
  from: WorkflowLookupSource
  path: string
  transforms: TransformDraft[]
}

export interface ActionDataIndexEditorDraft {
  mode: EditorMode
  rawValue: string
  mdfTemplateName: string
  fields: ActionDataIndexFieldDraft[]
}

const WORKFLOW_CONDITION_KEYS = new Set(['from', 'path', 'comparison', 'expected', 'transforms'])
const ACTION_DATA_INDEX_ROOT_KEYS = new Set(['mdfTemplateName', 'fields'])
const ACTION_DATA_INDEX_FIELD_KEYS = new Set(['from', 'path', 'transforms'])

const createEditorId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const normalizeText = (value: string | null | undefined): string => value?.trim() ?? ''
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const collapseWhitespace = (value: string): string => value.trim().replaceAll(/\s+/g, ' ')

const normalizeFirstLine = (value: string): string => {
  if (!value.trim()) {
    return ''
  }

  for (const line of value.split(/\r?\n/)) {
    const normalizedLine = collapseWhitespace(line)
    if (normalizedLine) {
      return normalizedLine
    }
  }

  return collapseWhitespace(value)
}

const parseRawJsonObject = (value: string): Record<string, unknown> | null => {
  const normalized = value.trim()
  if (!normalized) {
    return {}
  }

  try {
    const parsed = JSON.parse(normalized)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

const validateAllowedKeys = (
  candidate: Record<string, unknown>,
  allowedKeys: Set<string>,
  label: string,
) => {
  const invalidKeys = Object.keys(candidate).filter((key) => !allowedKeys.has(key))
  if (invalidKeys.length > 0) {
    throw new Error(`${label} 허용되지 않은 키: ${invalidKeys.join(', ')}`)
  }
}

const parseLookupSource = (value: unknown, label: string): WorkflowLookupSource => {
  const normalized = normalizeText(typeof value === 'string' ? value : '')
  if (normalized !== 'data' && normalized !== 'metadata' && normalized !== 'param') {
    throw new Error(label)
  }
  return normalized
}

const parseRelativePath = (value: unknown, label: string): string => {
  const normalized = normalizeText(typeof value === 'string' ? value : '')
  if (
    normalized.startsWith('data.')
    || normalized.startsWith('metadata.')
    || normalized.startsWith('param.')
  ) {
    throw new Error(label)
  }
  return normalized
}

const parseWorkflowComparison = (value: unknown): WorkflowComparison => {
  const normalized = normalizeText(typeof value === 'string' ? value : '')
  if (
    !WORKFLOW_COMPARISON_OPTIONS.includes(normalized as WorkflowComparison)
  ) {
    throw new Error('workflow_filter 조건의 comparison은 표준 연산만 허용됩니다.')
  }
  return normalized as WorkflowComparison
}

const stringifyExpectedText = (value: unknown): string => {
  if (value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  return JSON.stringify(value)
}

const stringifyPreviewValue = (value: unknown): string => {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'string') {
    return `"${value}"`
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyPreviewValue(item)).join(', ')}]`
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).map(
      ([key, childValue]) => `${key}=${stringifyPreviewValue(childValue)}`,
    )
    return `{${entries.join(', ')}}`
  }

  return String(value)
}

const parseTransformValue = (value: unknown): string => {
  if (typeof value === 'string') {
    const normalized = normalizeText(value)
    if (!normalized) {
      throw new Error('transform 문자열은 비어 있을 수 없습니다.')
    }
    return normalized
  }

  if (!isRecord(value)) {
    throw new Error('transform은 문자열 또는 object여야 합니다.')
  }

  const name = normalizeText(typeof value.name === 'string' ? value.name : '')
  if (!name) {
    throw new Error('transform의 name은 필수입니다.')
  }

  if (value.args === undefined || value.args === null) {
    return name.toLowerCase()
  }

  if (!Array.isArray(value.args)) {
    throw new Error('transform의 args는 배열이어야 합니다.')
  }

  return `${name.toLowerCase()}(${value.args
    .map((item) => stringifyPreviewValue(item))
    .join(', ')})`
}

const parseTransforms = (value: unknown, label: string): TransformDraft[] => {
  if (value === undefined || value === null) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new Error(label)
  }

  return value.map((item) => createTransformDraft(parseTransformValue(item)))
}

const parseEditorLiteral = (value: string): unknown => {
  const normalized = value.trim()
  if (!normalized) {
    return undefined
  }

  try {
    return JSON.parse(normalized)
  } catch {
    return normalized
  }
}

const serializeTransforms = (transforms: TransformDraft[]): string[] =>
  transforms
    .map((transform) => normalizeText(transform.value))
    .filter((transform) => transform.length > 0)

const summarizeWorkflowNode = (node: WorkflowNodeDraft): string => {
  if (node.nodeType === 'group') {
    return `${node.groupType}(${node.children.map((child) => summarizeWorkflowNode(child)).join(', ')})`
  }

  const summaryParts = [
    `${node.from}.${node.path}`,
    `{comparison=${node.comparison}`,
  ]

  const parsedExpected = parseEditorLiteral(node.expectedText)
  if (parsedExpected !== undefined) {
    summaryParts.push(`, expected=${stringifyPreviewValue(parsedExpected)}`)
  }

  const transforms = serializeTransforms(node.transforms)
  if (transforms.length > 0) {
    summaryParts.push(`, transforms=[${transforms.join(', ')}]`)
  }

  summaryParts.push('}')
  return summaryParts.join('')
}

const summarizeActionField = (
  fieldName: string,
  field: ActionDataIndexFieldDraft,
  mdfTemplateName: string,
): string => {
  const normalizedTemplateName = normalizeText(mdfTemplateName)
  const summaryParts = normalizedTemplateName
    ? [`mdfTemplateName=${normalizedTemplateName}`, ` / ${fieldName} {from=${field.from}, path=${field.path}`]
    : [`${fieldName} {from=${field.from}, path=${field.path}`]

  const transforms = serializeTransforms(field.transforms)
  if (transforms.length > 0) {
    summaryParts.push(`, transforms=[${transforms.join(', ')}]`)
  }

  summaryParts.push('}')
  return summaryParts.join('')
}

const parseWorkflowConditionDraft = (candidate: Record<string, unknown>): WorkflowConditionDraft => {
  validateAllowedKeys(
    candidate,
    WORKFLOW_CONDITION_KEYS,
    'workflow_filter 조건에는 from, path, comparison, expected, transforms만 허용됩니다.',
  )

  if (isRecord(candidate.expected)) {
    throw new Error('workflow_filter 조건의 expected는 object일 수 없습니다.')
  }

  return {
    id: createEditorId(),
    nodeType: 'condition',
    from: parseLookupSource(
      candidate.from,
      'workflow_filter 조건의 from은 data, metadata 또는 param만 허용됩니다.',
    ),
    path: parseRelativePath(
      candidate.path,
      'workflow_filter 조건의 path는 from 기준 상대 경로여야 합니다.',
    ),
    comparison: parseWorkflowComparison(candidate.comparison),
    expectedText: stringifyExpectedText(candidate.expected),
    transforms: parseTransforms(
      candidate.transforms,
      'workflow_filter 조건의 transforms는 배열이어야 합니다.',
    ),
  }
}

const parseWorkflowNodeDraft = (candidate: unknown, isRoot = false): WorkflowNodeDraft => {
  if (!isRecord(candidate)) {
    throw new Error('workflow_filter 노드는 JSON object여야 합니다.')
  }

  const hasAnd = Array.isArray(candidate.and)
  const hasOr = Array.isArray(candidate.or)

  if (hasAnd || hasOr || 'and' in candidate || 'or' in candidate) {
    if (hasAnd && hasOr) {
      throw new Error('workflow_filter 그룹 노드는 and와 or를 동시에 가질 수 없습니다.')
    }

    const groupType: WorkflowGroupType | null = hasAnd ? 'and' : hasOr ? 'or' : null
    if (!groupType) {
      throw new Error(
        isRoot
          ? 'workflow_filter 루트는 and 또는 or 그룹이어야 합니다.'
          : 'workflow_filter 그룹 노드는 and 또는 or 중 하나를 가져야 합니다.',
      )
    }

    if (Object.keys(candidate).length !== 1) {
      throw new Error('workflow_filter 그룹 노드는 and 또는 or 키만 가질 수 있습니다.')
    }

    const rawChildren = candidate[groupType]
    if (!Array.isArray(rawChildren)) {
      throw new Error(`workflow_filter의 ${groupType} 값은 배열이어야 합니다.`)
    }
    if (rawChildren.length === 0) {
      throw new Error(`workflow_filter의 ${groupType} 그룹은 비어 있을 수 없습니다.`)
    }

    return {
      id: createEditorId(),
      nodeType: 'group',
      groupType,
      children: rawChildren.map((child) => parseWorkflowNodeDraft(child)),
    }
  }

  if (isRoot) {
    throw new Error('workflow_filter 루트는 and 또는 or 그룹이어야 합니다.')
  }

  return parseWorkflowConditionDraft(candidate)
}

const parseActionDataIndexFieldDraft = (
  fieldName: string,
  candidate: unknown,
): ActionDataIndexFieldDraft => {
  if (typeof candidate === 'string') {
    return {
      id: createEditorId(),
      fieldName,
      from: 'data',
      path: parseRelativePath(
        candidate,
        `action_data_index 필드 ${fieldName}의 path는 from 기준 상대 경로여야 합니다.`,
      ),
      transforms: [],
    }
  }

  if (!isRecord(candidate)) {
    throw new Error(`action_data_index 필드 ${fieldName}는 문자열 또는 object여야 합니다.`)
  }

  validateAllowedKeys(
    candidate,
    ACTION_DATA_INDEX_FIELD_KEYS,
    `action_data_index 필드 ${fieldName}에는 from, path, transforms만 허용됩니다.`,
  )

  return {
    id: createEditorId(),
    fieldName,
    from: parseLookupSource(
      candidate.from,
      `action_data_index 필드 ${fieldName}의 from은 data, metadata 또는 param만 허용됩니다.`,
    ),
    path: parseRelativePath(
      candidate.path,
      `action_data_index 필드 ${fieldName}의 path는 from 기준 상대 경로여야 합니다.`,
    ),
    transforms: parseTransforms(
      candidate.transforms,
      `action_data_index 필드 ${fieldName}의 transforms는 배열이어야 합니다.`,
    ),
  }
}

const serializeWorkflowNode = (node: WorkflowNodeDraft): Record<string, unknown> | null => {
  if (node.nodeType === 'group') {
    const children = node.children
      .map((child) => serializeWorkflowNode(child))
      .filter((child): child is Record<string, unknown> => child !== null)

    if (children.length === 0) {
      return null
    }

    return {
      [node.groupType]: children,
    }
  }

  const transforms = serializeTransforms(node.transforms)
  const hasMeaningfulInput =
    normalizeText(node.path).length > 0 ||
    normalizeText(node.expectedText).length > 0 ||
    transforms.length > 0

  if (!hasMeaningfulInput) {
    return null
  }

  const serializedCondition: Record<string, unknown> = {
    from: node.from,
    path: normalizeText(node.path),
    comparison: node.comparison,
  }

  const parsedExpected = parseEditorLiteral(node.expectedText)
  if (parsedExpected !== undefined) {
    serializedCondition.expected = parsedExpected
  }

  if (transforms.length > 0) {
    serializedCondition.transforms = transforms
  }

  return serializedCondition
}

const createStructuredRootGroup = (): WorkflowGroupDraft => ({
  id: createEditorId(),
  nodeType: 'group',
  groupType: 'and',
  children: [createEmptyWorkflowFilterCondition()],
})

export const createTransformDraft = (value = ''): TransformDraft => ({
  id: createEditorId(),
  value,
})

export const createEmptyWorkflowFilterCondition = (): WorkflowConditionDraft => ({
  id: createEditorId(),
  nodeType: 'condition',
  from: 'data',
  path: '',
  comparison: 'equals',
  expectedText: '',
  transforms: [],
})

export const createEmptyWorkflowGroup = (
  groupType: WorkflowGroupType = 'and',
): WorkflowGroupDraft => ({
  id: createEditorId(),
  nodeType: 'group',
  groupType,
  children: [createEmptyWorkflowFilterCondition()],
})

export const createEmptyActionDataIndexField = (): ActionDataIndexFieldDraft => ({
  id: createEditorId(),
  fieldName: '',
  from: 'data',
  path: '',
  transforms: [],
})

export const parseWorkflowFilterEditor = (value: string): WorkflowFilterEditorDraft => {
  const rawValue = value ?? ''
  const normalized = rawValue.trim()

  if (!normalized) {
    return {
      mode: 'structured',
      rawValue,
      rootGroup: createStructuredRootGroup(),
    }
  }

  const parsed = parseRawJsonObject(rawValue)
  if (parsed === null) {
    return {
      mode: 'raw',
      rawValue,
      rootGroup: createStructuredRootGroup(),
    }
  }

  try {
    const rootGroup = parseWorkflowNodeDraft(parsed, true)
    if (rootGroup.nodeType !== 'group') {
      throw new Error('workflow_filter 루트는 and 또는 or 그룹이어야 합니다.')
    }

    return {
      mode: 'structured',
      rawValue,
      rootGroup,
    }
  } catch {
    return {
      mode: 'raw',
      rawValue,
      rootGroup: createStructuredRootGroup(),
    }
  }
}

export const buildWorkflowFilterValue = (draft: WorkflowFilterEditorDraft): string => {
  if (draft.mode === 'raw') {
    return draft.rawValue.trim()
  }

  const rootGroup = serializeWorkflowNode(draft.rootGroup)
  if (!rootGroup) {
    return ''
  }

  return JSON.stringify(rootGroup, null, 2)
}

export const parseActionDataIndexEditor = (value: string): ActionDataIndexEditorDraft => {
  const rawValue = value ?? ''
  const normalized = rawValue.trim()

  if (!normalized) {
    return {
      mode: 'structured',
      rawValue,
      mdfTemplateName: '',
      fields: [createEmptyActionDataIndexField()],
    }
  }

  const parsed = parseRawJsonObject(rawValue)
  if (parsed === null) {
    return {
      mode: 'raw',
      rawValue,
      mdfTemplateName: '',
      fields: [createEmptyActionDataIndexField()],
    }
  }

  try {
    validateAllowedKeys(
      parsed,
      ACTION_DATA_INDEX_ROOT_KEYS,
      'action_data_index 루트에는 mdfTemplateName, fields만 허용됩니다.',
    )

    const fieldsValue = parsed.fields
    if (!isRecord(fieldsValue)) {
      throw new Error('action_data_index의 fields는 JSON object여야 합니다.')
    }

    const fields = Object.entries(fieldsValue).map(([fieldName, candidate]) =>
      parseActionDataIndexFieldDraft(fieldName, candidate),
    )

    return {
      mode: 'structured',
      rawValue,
      mdfTemplateName: normalizeText(
        typeof parsed.mdfTemplateName === 'string' ? parsed.mdfTemplateName : '',
      ),
      fields: fields.length > 0 ? fields : [createEmptyActionDataIndexField()],
    }
  } catch {
    return {
      mode: 'raw',
      rawValue,
      mdfTemplateName: '',
      fields: [createEmptyActionDataIndexField()],
    }
  }
}

export const buildActionDataIndexValue = (draft: ActionDataIndexEditorDraft): string => {
  if (draft.mode === 'raw') {
    return draft.rawValue.trim()
  }

  const fields = draft.fields.reduce<Record<string, unknown>>((accumulator, field) => {
    const fieldName = normalizeText(field.fieldName)
    if (!fieldName) {
      return accumulator
    }

    const serializedField: Record<string, unknown> = {
      from: field.from,
      path: normalizeText(field.path),
    }

    const transforms = serializeTransforms(field.transforms)
    if (transforms.length > 0) {
      serializedField.transforms = transforms
    }

    accumulator[fieldName] = serializedField
    return accumulator
  }, {})

  const normalizedTemplateName = normalizeText(draft.mdfTemplateName)
  if (!normalizedTemplateName && Object.keys(fields).length === 0) {
    return ''
  }

  const serializedRoot: Record<string, unknown> = {
    fields,
  }

  if (normalizedTemplateName) {
    serializedRoot.mdfTemplateName = normalizedTemplateName
  }

  return JSON.stringify(serializedRoot, null, 2)
}

export const summarizeWorkflowFilterValue = (value: string): string => {
  const fallback = normalizeFirstLine(value)
  if (!fallback) {
    return ''
  }

  const editor = parseWorkflowFilterEditor(value)
  if (editor.mode === 'raw') {
    return fallback
  }

  return summarizeWorkflowNode(editor.rootGroup)
}

export const summarizeActionDataIndexValue = (value: string): string => {
  const fallback = normalizeFirstLine(value)
  if (!fallback) {
    return ''
  }

  const editor = parseActionDataIndexEditor(value)
  if (editor.mode === 'raw') {
    return fallback
  }

  const firstField = editor.fields.find((field) => normalizeText(field.fieldName).length > 0)
  if (!firstField) {
    return editor.mdfTemplateName
      ? `mdfTemplateName=${editor.mdfTemplateName} / fields=0`
      : fallback
  }

  return summarizeActionField(firstField.fieldName.trim(), firstField, editor.mdfTemplateName)
}

export { LOOKUP_SOURCE_OPTIONS, WORKFLOW_COMPARISON_OPTIONS }
