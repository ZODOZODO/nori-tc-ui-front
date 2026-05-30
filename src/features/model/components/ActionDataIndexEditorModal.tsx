import { useMemo, useState, type DragEvent } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  buildActionDataIndexValue,
  createEmptyActionDataIndexField,
  createTransformDraft,
  LOOKUP_SOURCE_OPTIONS,
  parseActionDataIndexEditor,
  type ActionDataIndexEditorDraft,
  type ActionDataIndexFieldDraft,
  type TransformDraft,
  type FlowLookupSource,
} from '../lib/model-detail-editor'
import { extractMdfMessageOptions, type MdfMessageOption } from '../lib/mdf-message-parser'
import type { ModelMdfContent } from '../types/model.types'

/**
 * action_data_index 편집 모달입니다.
 *
 * ModelDetailPanel.tsx 의 inline Dialog 블록(line 1659~1996) 을 별 파일로 추출.
 * 외부 props 시그니처는 `open / value / readOnly / titleLabel / errorMessage /
 * flowMdfContents / onClose / onSave` 로 자기완결 — 내부 draft state 와
 * MDF dropdown 옵션 가공도 모달 안에서 관리합니다.
 */

const EMPTY_MDF_TEMPLATE_VALUE = '__empty__'

interface ActionDataIndexEditorModalProps {
  open: boolean
  value: string
  readOnly: boolean
  titleLabel: string
  errorMessage: string | null
  flowMdfContents: ModelMdfContent[]
  onClose: () => void
  onSave: (nextValue: string) => void
}

export function ActionDataIndexEditorModal({
  open,
  value,
  readOnly,
  titleLabel,
  errorMessage,
  flowMdfContents,
  onClose,
  onSave,
}: ActionDataIndexEditorModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      {open ? (
        <ActionDataIndexEditorModalBody
          // key 로 open 전환 시 body 를 새로 mount — draft 가 새 value 로 자연 reset.
          key={value}
          value={value}
          readOnly={readOnly}
          titleLabel={titleLabel}
          errorMessage={errorMessage}
          flowMdfContents={flowMdfContents}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  )
}

interface ActionDataIndexEditorModalBodyProps {
  value: string
  readOnly: boolean
  titleLabel: string
  errorMessage: string | null
  flowMdfContents: ModelMdfContent[]
  onClose: () => void
  onSave: (nextValue: string) => void
}

function ActionDataIndexEditorModalBody({
  value,
  readOnly,
  titleLabel,
  errorMessage,
  flowMdfContents,
  onClose,
  onSave,
}: ActionDataIndexEditorModalBodyProps) {
  const [draft, setDraft] = useState<ActionDataIndexEditorDraft>(() =>
    parseActionDataIndexEditor(value),
  )
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null)

  const mdfMessageOptions = useMemo(
    () => buildMdfMessageOptions(flowMdfContents, draft.mdfTemplateName),
    [draft.mdfTemplateName, flowMdfContents],
  )

  const selectedMdfMessage = useMemo(
    () =>
      mdfMessageOptions.find(
        (option) => option.messageName === draft.mdfTemplateName.trim(),
      ) ?? null,
    [draft.mdfTemplateName, mdfMessageOptions],
  )

  const handleMoveField = (fieldId: string, targetIndex: number) => {
    if (readOnly) {
      return
    }
    setDraft((previousDraft) => ({
      ...previousDraft,
      fields: moveActionDataIndexDraftRow(previousDraft.fields, fieldId, targetIndex),
    }))
  }

  const handleFieldDragStart = (
    event: DragEvent<HTMLButtonElement>,
    fieldId: string,
  ) => {
    if (readOnly) {
      event.preventDefault()
      return
    }

    setDraggingFieldId(fieldId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', fieldId)
  }

  const handleFieldDragOver = (
    event: DragEvent<HTMLTableRowElement>,
    targetFieldId: string,
  ) => {
    if (readOnly || !draggingFieldId || draggingFieldId === targetFieldId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleFieldDrop = (
    event: DragEvent<HTMLTableRowElement>,
    targetFieldId: string,
  ) => {
    if (readOnly) {
      return
    }

    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || draggingFieldId
    if (!sourceId || sourceId === targetFieldId) {
      setDraggingFieldId(null)
      return
    }

    setDraft((previousDraft) => {
      const targetIndex = previousDraft.fields.findIndex((field) => field.id === targetFieldId)
      return {
        ...previousDraft,
        fields: moveActionDataIndexDraftRow(previousDraft.fields, sourceId, targetIndex),
      }
    })
    setDraggingFieldId(null)
  }

  const handleFieldDragEnd = () => {
    setDraggingFieldId(null)
  }

  const handleSave = () => {
    if (readOnly) {
      return
    }
    onSave(buildActionDataIndexValue(draft))
  }

  return (
    <DialogContent
      className="!left-4 !right-4 !top-4 !bottom-4 !w-auto !max-w-none !translate-x-0 !translate-y-0 overflow-hidden p-0 md:!left-6 md:!right-6 md:!top-6 md:!bottom-6"
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      <div className="flex h-full min-h-0 flex-col">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
          <DialogTitle>{titleLabel || 'Flow 편집'}</DialogTitle>
          <DialogDescription>
            action_data_index를 mdfTemplateName과 field 매핑 기준으로 편집합니다.
          </DialogDescription>
        </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
            <div className="flex h-full min-h-0 flex-col gap-3">
              {errorMessage ? (
                <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {errorMessage}
                </p>
              ) : null}

              {draft.mode === 'raw' ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <p className="text-sm text-danger">
                    현재 값은 structured editor가 안전하게 해석할 수 없어 raw 모드로 유지합니다.
                  </p>
                  <textarea
                    value={draft.rawValue}
                    onChange={(event) =>
                      setDraft((previousDraft) => ({
                        ...previousDraft,
                        rawValue: event.target.value,
                      }))
                    }
                    className="min-h-0 w-full flex-1 resize-none overflow-auto rounded-xl border border-border bg-muted p-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                    readOnly={readOnly}
                  />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="grid gap-4 rounded-2xl border border-border bg-muted px-4 py-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                    <div className="space-y-2.5">
                      <label className="text-xs font-semibold text-foreground">MDF Message</label>
                      <Select
                        value={draft.mdfTemplateName || EMPTY_MDF_TEMPLATE_VALUE}
                        disabled={readOnly}
                        onValueChange={(nextValue) =>
                          setDraft((previousDraft) => ({
                            ...previousDraft,
                            mdfTemplateName:
                              nextValue === EMPTY_MDF_TEMPLATE_VALUE ? '' : nextValue,
                          }))
                        }
                      >
                        <SelectTrigger disabled={readOnly}>
                          <SelectValue placeholder="MDF message를 선택해 주세요." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_MDF_TEMPLATE_VALUE}>선택 안 함</SelectItem>
                          {mdfMessageOptions.map((messageOption) => (
                            <SelectItem
                              key={`${messageOption.sourceName}-${messageOption.messageName}`}
                              value={messageOption.messageName}
                            >
                              {messageOption.messageName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        현재 model의 MDF XML 내부 메시지 이름을 선택하면 `mdfTemplateName`으로 저장됩니다.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <label className="text-xs font-semibold text-foreground">선택된 XML Preview</label>
                      <div className="min-h-[124px] max-h-[180px] overflow-auto rounded-xl border border-border bg-card px-3 py-2.5">
                        {selectedMdfMessage?.xmlSnippet ? (
                          <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
                            {selectedMdfMessage.xmlSnippet}
                          </pre>
                        ) : draft.mdfTemplateName.trim() ? (
                          <p className="text-sm text-muted-foreground">
                            현재 `mdfTemplateName`과 일치하는 MDF 메시지를 찾지 못했습니다.
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            MDF 메시지를 선택하면 전체 XML 조각을 여기에서 바로 확인할 수 있습니다.
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedMdfMessage?.sourceName
                          ? `Source MDF: ${selectedMdfMessage.sourceName}`
                          : '업로드된 MDF XML에 정의된 메시지 본문을 그대로 보여 줍니다.'}
                      </p>
                    </div>
                  </div>

                  {/* Fields 테이블 레이블 및 '+field 추가' 버튼 영역 */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-foreground">Fields</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg px-2 text-xs"
                      onClick={() =>
                        setDraft((previousDraft) => ({
                          ...previousDraft,
                          fields: [...previousDraft.fields, createEmptyActionDataIndexField()],
                        }))
                      }
                      disabled={readOnly}
                    >
                      <Plus className="size-3" aria-hidden="true" />
                      field 추가
                    </Button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-muted">
                        <TableRow className="bg-muted">
                          <TableHead className="w-[112px]">순서</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>from</TableHead>
                          <TableHead>path</TableHead>
                          <TableHead>transforms</TableHead>
                          <TableHead className="w-[72px]">작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {draft.fields.map((field, fieldIndex) => (
                          <TableRow
                            key={field.id}
                            className={cn(
                              'align-top',
                              draggingFieldId === field.id && 'bg-muted opacity-70',
                            )}
                            onDragOver={(event) => handleFieldDragOver(event, field.id)}
                            onDrop={(event) => handleFieldDrop(event, field.id)}
                          >
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-8 cursor-grab rounded-lg text-muted-foreground hover:bg-muted active:cursor-grabbing"
                                  draggable={!readOnly}
                                  onDragStart={(event) => handleFieldDragStart(event, field.id)}
                                  onDragEnd={handleFieldDragEnd}
                                  disabled={readOnly}
                                  aria-label={`${field.fieldName || 'field'} 순서 드래그`}
                                  title="드래그해서 순서 변경"
                                >
                                  <GripVertical className="size-4" aria-hidden="true" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-8 rounded-lg text-muted-foreground hover:bg-muted"
                                  onClick={() => handleMoveField(field.id, fieldIndex - 1)}
                                  disabled={readOnly || fieldIndex === 0}
                                  aria-label={`${field.fieldName || 'field'} 위로 이동`}
                                  title="위로 이동"
                                >
                                  <ArrowUp className="size-4" aria-hidden="true" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-8 rounded-lg text-muted-foreground hover:bg-muted"
                                  onClick={() => handleMoveField(field.id, fieldIndex + 1)}
                                  disabled={readOnly || fieldIndex === draft.fields.length - 1}
                                  aria-label={`${field.fieldName || 'field'} 아래로 이동`}
                                  title="아래로 이동"
                                >
                                  <ArrowDown className="size-4" aria-hidden="true" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={field.fieldName}
                                onChange={(event) =>
                                  setDraft((previousDraft) => ({
                                    ...previousDraft,
                                    fields: updateActionDataIndexDraftRow(
                                      previousDraft.fields,
                                      field.id,
                                      {
                                        fieldName: event.target.value,
                                      },
                                    ),
                                  }))
                                }
                                placeholder="EQPID"
                                readOnly={readOnly}
                              />
                            </TableCell>
                            <TableCell>
                              <select
                                value={field.from}
                                onChange={(event) =>
                                  setDraft((previousDraft) => ({
                                    ...previousDraft,
                                    fields: updateActionDataIndexDraftRow(
                                      previousDraft.fields,
                                      field.id,
                                      {
                                        from: event.target.value as FlowLookupSource,
                                      },
                                    ),
                                  }))
                                }
                                className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                                disabled={readOnly}
                              >
                                {LOOKUP_SOURCE_OPTIONS.map((source) => (
                                  <option key={source} value={source}>
                                    {source}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={field.path}
                                onChange={(event) =>
                                  setDraft((previousDraft) => ({
                                    ...previousDraft,
                                    fields: updateActionDataIndexDraftRow(
                                      previousDraft.fields,
                                      field.id,
                                      {
                                        path: event.target.value,
                                      },
                                    ),
                                  }))
                                }
                                placeholder="eqpId"
                                readOnly={readOnly}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                {field.transforms.length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground">transform 없음</p>
                                ) : (
                                  field.transforms.map((transform) => (
                                    <div key={transform.id} className="flex items-center gap-2">
                                      <Input
                                        value={transform.value}
                                        onChange={(event) =>
                                          setDraft((previousDraft) => ({
                                            ...previousDraft,
                                            fields: updateActionDataIndexDraftRow(
                                              previousDraft.fields,
                                              field.id,
                                              {
                                                transforms: updateTransforms(
                                                  field.transforms,
                                                  transform.id,
                                                  { value: event.target.value },
                                                ),
                                              },
                                            ),
                                          }))
                                        }
                                        placeholder="trim"
                                        readOnly={readOnly}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-danger"
                                        onClick={() =>
                                          setDraft((previousDraft) => ({
                                            ...previousDraft,
                                            fields: updateActionDataIndexDraftRow(
                                              previousDraft.fields,
                                              field.id,
                                              {
                                                transforms: field.transforms.filter(
                                                  (item) => item.id !== transform.id,
                                                ),
                                              },
                                            ),
                                          }))
                                        }
                                        disabled={readOnly}
                                        aria-label="transform 삭제"
                                      >
                                        <Trash2 className="size-4" aria-hidden="true" />
                                      </Button>
                                    </div>
                                  ))
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setDraft((previousDraft) => ({
                                      ...previousDraft,
                                      fields: updateActionDataIndexDraftRow(
                                        previousDraft.fields,
                                        field.id,
                                        {
                                          transforms: [...field.transforms, createTransformDraft()],
                                        },
                                      ),
                                    }))
                                  }
                                  disabled={readOnly}
                                >
                                  <Plus className="size-3.5" aria-hidden="true" />
                                  transform 추가
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-danger"
                                onClick={() =>
                                  setDraft((previousDraft) => ({
                                    ...previousDraft,
                                    fields:
                                      previousDraft.fields.length > 1
                                        ? previousDraft.fields.filter((item) => item.id !== field.id)
                                        : [createEmptyActionDataIndexField()],
                                  }))
                                }
                                disabled={readOnly}
                                aria-label="field 삭제"
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          {!readOnly ? <Button onClick={handleSave}>저장</Button> : null}
        </DialogFooter>
      </div>
    </DialogContent>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers — ModelDetailPanel.tsx 에서 그대로 옮긴 draft 변환 헬퍼.
// 외부 export 하지 않음 (file split 의 일부, surgical change).
// ─────────────────────────────────────────────────────────────────────────────

const updateActionDataIndexDraftRow = (
  rows: ActionDataIndexFieldDraft[],
  targetId: string,
  patch: Partial<ActionDataIndexFieldDraft>,
): ActionDataIndexFieldDraft[] =>
  rows.map((row) => (row.id === targetId ? { ...row, ...patch } : row))

const moveActionDataIndexDraftRow = (
  rows: ActionDataIndexFieldDraft[],
  sourceId: string,
  targetIndex: number,
): ActionDataIndexFieldDraft[] => {
  const sourceIndex = rows.findIndex((row) => row.id === sourceId)
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= rows.length ||
    sourceIndex === targetIndex
  ) {
    return rows
  }

  const nextRows = [...rows]
  const [movedRow] = nextRows.splice(sourceIndex, 1)
  nextRows.splice(targetIndex, 0, movedRow)
  return nextRows
}

const updateTransforms = (
  transforms: TransformDraft[],
  targetId: string,
  patch: Partial<TransformDraft>,
): TransformDraft[] =>
  transforms.map((transform) =>
    transform.id === targetId ? { ...transform, ...patch } : transform,
  )

const buildMdfMessageOptions = (
  flowMdfContents: ModelMdfContent[],
  currentValue: string,
): MdfMessageOption[] => {
  const optionMap = new Map<string, MdfMessageOption>()
  extractMdfMessageOptions(flowMdfContents).forEach((option) => {
    optionMap.set(option.messageName, option)
  })

  const normalizedCurrentValue = currentValue.trim()
  if (normalizedCurrentValue && !optionMap.has(normalizedCurrentValue)) {
    optionMap.set(normalizedCurrentValue, {
      messageName: normalizedCurrentValue,
      sourceName: '',
      xmlSnippet: '',
      targetType: null,
      outputType: null,
    })
  }

  return [...optionMap.values()]
}
