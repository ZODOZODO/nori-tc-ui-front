import i18n from '@/i18n'

const LOOKUP_SOURCE_OPTIONS = ['data', 'metadata', 'param'] as const
const FLOW_COMPARISON_OPTIONS = [
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
type FlowGroupType = 'and' | 'or'

export type FlowLookupSource = (typeof LOOKUP_SOURCE_OPTIONS)[number]
export type FlowComparison = (typeof FLOW_COMPARISON_OPTIONS)[number]

export interface TransformDraft {
  id: string
  value: string
}

export interface FlowConditionDraft {
  id: string
  nodeType: 'condition'
  from: FlowLookupSource
  path: string
  comparison: FlowComparison
  expectedText: string
  transforms: TransformDraft[]
}

export interface FlowGroupDraft {
  id: string
  nodeType: 'group'
  groupType: FlowGroupType
  children: FlowNodeDraft[]
}

export type FlowNodeDraft = FlowConditionDraft | FlowGroupDraft

export interface FlowFilterEditorDraft {
  mode: EditorMode
  rawValue: string
  rootGroup: FlowGroupDraft
}

export interface ActionDataIndexFieldDraft {
  id: string
  fieldName: string
  from: FlowLookupSource
  path: string
  transforms: TransformDraft[]
}

export interface ActionDataIndexEditorDraft {
  mode: EditorMode
  rawValue: string
  mdfTemplateName: string
  fields: ActionDataIndexFieldDraft[]
}

const FLOW_CONDITION_KEYS = new Set(['from', 'path', 'comparison', 'expected', 'transforms'])
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
    throw new Error(`${label} ${i18n.t('model.editor.disallowedKeys', { keys: invalidKeys.join(', ') })}`)
  }
}

const parseLookupSource = (value: unknown, label: string): FlowLookupSource => {
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

const parseFlowComparison = (value: unknown): FlowComparison => {
  const normalized = normalizeText(typeof value === 'string' ? value : '')
  if (
    !FLOW_COMPARISON_OPTIONS.includes(normalized as FlowComparison)
  ) {
    throw new Error(i18n.t('model.editor.comparison'))
  }
  return normalized as FlowComparison
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
      throw new Error(i18n.t('model.editor.transformEmpty'))
    }
    return normalized
  }

  if (!isRecord(value)) {
    throw new Error(i18n.t('model.editor.transformType'))
  }

  const name = normalizeText(typeof value.name === 'string' ? value.name : '')
  if (!name) {
    throw new Error(i18n.t('model.editor.transformName'))
  }

  if (value.args === undefined || value.args === null) {
    return name.toLowerCase()
  }

  if (!Array.isArray(value.args)) {
    throw new Error(i18n.t('model.editor.transformArgs'))
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

const summarizeFlowNode = (node: FlowNodeDraft): string => {
  if (node.nodeType === 'group') {
    return `${node.groupType}(${node.children.map((child) => summarizeFlowNode(child)).join(', ')})`
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

const parseFlowConditionDraft = (candidate: Record<string, unknown>): FlowConditionDraft => {
  validateAllowedKeys(
    candidate,
    FLOW_CONDITION_KEYS,
    i18n.t('model.editor.conditionAllowedKeys'),
  )

  if (isRecord(candidate.expected)) {
    throw new Error(i18n.t('model.editor.expectedObject'))
  }

  return {
    id: createEditorId(),
    nodeType: 'condition',
    from: parseLookupSource(
      candidate.from,
      i18n.t('model.editor.conditionFrom'),
    ),
    path: parseRelativePath(
      candidate.path,
      i18n.t('model.editor.conditionPath'),
    ),
    comparison: parseFlowComparison(candidate.comparison),
    expectedText: stringifyExpectedText(candidate.expected),
    transforms: parseTransforms(
      candidate.transforms,
      i18n.t('model.editor.conditionTransforms'),
    ),
  }
}

const parseFlowNodeDraft = (candidate: unknown, isRoot = false): FlowNodeDraft => {
  if (!isRecord(candidate)) {
    throw new Error(i18n.t('model.editor.nodeObject'))
  }

  const hasAnd = Array.isArray(candidate.and)
  const hasOr = Array.isArray(candidate.or)

  if (hasAnd || hasOr || 'and' in candidate || 'or' in candidate) {
    if (hasAnd && hasOr) {
      throw new Error(i18n.t('model.editor.groupBothAndOr'))
    }

    const groupType: FlowGroupType | null = hasAnd ? 'and' : hasOr ? 'or' : null
    if (!groupType) {
      throw new Error(
        isRoot
          ? i18n.t('model.editor.rootGroup')
          : i18n.t('model.editor.groupAndOr'),
      )
    }

    if (Object.keys(candidate).length !== 1) {
      throw new Error(i18n.t('model.editor.groupKeysOnly'))
    }

    const rawChildren = candidate[groupType]
    if (!Array.isArray(rawChildren)) {
      throw new Error(i18n.t('model.editor.groupValueArray', { groupType }))
    }
    if (rawChildren.length === 0) {
      throw new Error(i18n.t('model.editor.groupEmpty', { groupType }))
    }

    return {
      id: createEditorId(),
      nodeType: 'group',
      groupType,
      children: rawChildren.map((child) => parseFlowNodeDraft(child)),
    }
  }

  if (isRoot) {
    throw new Error(i18n.t('model.editor.rootGroup'))
  }

  return parseFlowConditionDraft(candidate)
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
        i18n.t('model.editor.fieldPath', { fieldName }),
      ),
      transforms: [],
    }
  }

  if (!isRecord(candidate)) {
    throw new Error(i18n.t('model.editor.fieldType', { fieldName }))
  }

  validateAllowedKeys(
    candidate,
    ACTION_DATA_INDEX_FIELD_KEYS,
    i18n.t('model.editor.fieldAllowedKeys', { fieldName }),
  )

  return {
    id: createEditorId(),
    fieldName,
    from: parseLookupSource(
      candidate.from,
      i18n.t('model.editor.fieldFrom', { fieldName }),
    ),
    path: parseRelativePath(
      candidate.path,
      i18n.t('model.editor.fieldPath', { fieldName }),
    ),
    transforms: parseTransforms(
      candidate.transforms,
      i18n.t('model.editor.fieldTransforms', { fieldName }),
    ),
  }
}

const serializeFlowNode = (node: FlowNodeDraft): Record<string, unknown> | null => {
  if (node.nodeType === 'group') {
    const children = node.children
      .map((child) => serializeFlowNode(child))
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

const createStructuredRootGroup = (): FlowGroupDraft => ({
  id: createEditorId(),
  nodeType: 'group',
  groupType: 'and',
  children: [createEmptyFlowFilterCondition()],
})

export const createTransformDraft = (value = ''): TransformDraft => ({
  id: createEditorId(),
  value,
})

export const createEmptyFlowFilterCondition = (): FlowConditionDraft => ({
  id: createEditorId(),
  nodeType: 'condition',
  from: 'data',
  path: '',
  comparison: 'equals',
  expectedText: '',
  transforms: [],
})

export const createEmptyFlowGroup = (
  groupType: FlowGroupType = 'and',
): FlowGroupDraft => ({
  id: createEditorId(),
  nodeType: 'group',
  groupType,
  children: [createEmptyFlowFilterCondition()],
})

export const createEmptyActionDataIndexField = (): ActionDataIndexFieldDraft => ({
  id: createEditorId(),
  fieldName: '',
  from: 'data',
  path: '',
  transforms: [],
})

export const parseFlowFilterEditor = (value: string): FlowFilterEditorDraft => {
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
    const rootGroup = parseFlowNodeDraft(parsed, true)
    if (rootGroup.nodeType !== 'group') {
      throw new Error(i18n.t('model.editor.rootGroup'))
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

export const buildFlowFilterValue = (draft: FlowFilterEditorDraft): string => {
  if (draft.mode === 'raw') {
    return draft.rawValue.trim()
  }

  const rootGroup = serializeFlowNode(draft.rootGroup)
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
      i18n.t('model.editor.rootAllowedKeys'),
    )

    const fieldsValue = parsed.fields
    if (!isRecord(fieldsValue)) {
      throw new Error(i18n.t('model.editor.fieldsObject'))
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

export const summarizeFlowFilterValue = (value: string): string => {
  const fallback = normalizeFirstLine(value)
  if (!fallback) {
    return ''
  }

  const editor = parseFlowFilterEditor(value)
  if (editor.mode === 'raw') {
    return fallback
  }

  return summarizeFlowNode(editor.rootGroup)
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

export { LOOKUP_SOURCE_OPTIONS, FLOW_COMPARISON_OPTIONS }
