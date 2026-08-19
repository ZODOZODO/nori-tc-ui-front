import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Box, Cylinder, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/i18n-context'
import type { ShapeJson, LiveMapObjectKind } from '../lib/live-map-layout.model'
import type { LiveMapObjectResponse } from '../api/layout.api'
import { useCreateObject, useDeleteObject, useLayoutObjects, useUpdateObject } from '../hooks/useLayout'
import {
  isLiveMap3DShape,
  LIVE_MAP_BUILTIN_STRUCTURES,
  LIVE_MAP_STRUCTURE_COLOR_BY_NAME,
  type LiveMap3DPrim,
  type LiveMap3DPrimType,
  type LiveMap3DShape,
  type LiveMapBuiltinStructure,
} from '../lib/live-map-3d.model'
import { LiveMap3DObject } from './LiveMap3DObject'

const PRIM_DEFAULT: Record<LiveMap3DPrimType, Omit<LiveMap3DPrim, 'id'>> = {
  box: { type: 'box', size: { x: 2, y: 2, z: 2 }, position: { x: 0, y: 1, z: 0 }, rotationY: 0, color: '#9aa7b8' },
  cylinder: { type: 'cylinder', size: { x: 2, y: 2, z: 2 }, position: { x: 0, y: 1, z: 0 }, rotationY: 0, color: '#6b7a8f' },
  plane: { type: 'plane', size: { x: 4, y: 1, z: 4 }, position: { x: 0, y: 0, z: 0 }, rotationY: 0, color: '#334155' },
}

type Axis = 'x' | 'y' | 'z'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
}

function NumberField({ label, value, onChange }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-muted-foreground">
      {label}
      <input
        type="number"
        step={0.5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-14 rounded border border-border bg-background px-1.5 py-1 text-xs text-foreground"
      />
    </label>
  )
}

/**
 * 구조물 편집 = STRUCTURE 객체 라이브러리 CRUD (SPEC live-map-3d Phase 2).
 *
 * <p>뷰어가 쓸 구조물(벽/바닥/고정물 등 STRUCTURE) 3D 객체(shape_json v2)를 기본 도형(box/cylinder/plane)
 * 조합으로 만들고/수정/삭제한다. 설비(EQUIPMENT)는 실데이터 기반 빌트인 fab tool 로 자동 표시되므로 여기서
 * 다루지 않는다. 폼으로 도형 크기/위치/색을 입력, 우측 3D 미리보기로 확인. 배치는 뷰어 담당(Phase 3).</p>
 */
export function LiveMapObjectEditor() {
  const { t } = useI18n()
  const objectsQuery = useLayoutObjects(true)
  const createObject = useCreateObject()
  const updateObject = useUpdateObject()
  const deleteObject = useDeleteObject()

  const idRef = useRef(0)
  const nextPrimId = () => {
    idRef.current += 1
    return `p-${idRef.current}`
  }

  const [editingKey, setEditingKey] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<LiveMapObjectKind>('STRUCTURE')
  const [prims, setPrims] = useState<LiveMap3DPrim[]>([])
  const [status, setStatus] = useState<string | null>(null)

  const shape: LiveMap3DShape = { v: 2, prims }

  const resetDraft = () => {
    setEditingKey(null)
    setName('')
    setKind('STRUCTURE')
    setPrims([])
    setStatus(null)
  }

  const addPrim = (type: LiveMap3DPrimType) => {
    setStatus(null)
    setPrims((previous) => [...previous, { id: nextPrimId(), ...PRIM_DEFAULT[type] }])
  }

  // 빌트인(벽/파티션) 선택 → 새 객체 초안으로 로드(이름/도형 채움). Save 하면 내 STRUCTURE 객체로 영속.
  const loadBuiltin = (builtin: LiveMapBuiltinStructure) => {
    setEditingKey(null)
    setName(builtin.objectName)
    setKind('STRUCTURE')
    setPrims(builtin.shapeJson.prims.map((prim) => ({ ...prim, id: prim.id || nextPrimId() })))
    setStatus(null)
  }

  const updatePrimVec = (id: string, field: 'size' | 'position', axis: Axis, value: number) => {
    setPrims((previous) =>
      previous.map((prim) => (prim.id === id ? { ...prim, [field]: { ...prim[field], [axis]: value } } : prim)),
    )
  }

  // 높이(H) 변경 시 바닥을 고정한다 — box/cylinder geometry 는 원점 중심이라 H 만 키우면 도형이 위아래로
  // 함께 자라 바닥(과 하층 천장)을 뚫는다. position.y 를 ΔH/2 만큼 올려 바닥(y − H/2)을 유지하고 위로만
  // 자라게 한다. plane 은 수직 두께가 없어(planeGeometry 는 x/z 만 사용) 보정에서 제외.
  const updatePrimHeight = (id: string, height: number) => {
    setPrims((previous) =>
      previous.map((prim) => {
        if (prim.id !== id) {
          return prim
        }
        if (prim.type === 'plane') {
          return { ...prim, size: { ...prim.size, y: height } }
        }
        const deltaY = (height - prim.size.y) / 2
        return { ...prim, size: { ...prim.size, y: height }, position: { ...prim.position, y: prim.position.y + deltaY } }
      }),
    )
  }

  const updatePrimColor = (id: string, color: string) => {
    setPrims((previous) => previous.map((prim) => (prim.id === id ? { ...prim, color } : prim)))
  }

  const removePrim = (id: string) => {
    setPrims((previous) => previous.filter((prim) => prim.id !== id))
  }

  const loadObject = (object: LiveMapObjectResponse) => {
    if (!isLiveMap3DShape(object.shapeJson)) {
      setStatus(t('livemap.builder.notV2Object'))
      return
    }
    setEditingKey(object.objectKey)
    setName(object.objectName)
    setKind(object.objectKind)
    // 로드한 prim 에 편집용 localId 부여(저장 시 그대로 직렬화).
    setPrims(object.shapeJson.prims.map((prim) => ({ ...prim, id: prim.id || nextPrimId() })))
    setStatus(null)
  }

  const handleSave = () => {
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setStatus(t('livemap.builder.errNameRequired'))
      return
    }
    if (prims.length === 0) {
      setStatus(t('livemap.builder.errNoShape'))
      return
    }
    // shape_json 컬럼은 opaque JSONB — v2 스펙을 ShapeJson 자리에 저장(백엔드 무변경).
    const body = { objectName: trimmedName, objectKind: kind, shapeJson: shape as unknown as ShapeJson }
    const onDone = (doneKey: string) => () => {
      setStatus(t(doneKey))
      resetDraft()
    }
    const onFail = (error: unknown) =>
      setStatus(error instanceof Error ? error.message : t('livemap.builder.saveFailed'))

    if (editingKey != null) {
      updateObject.mutate({ objectKey: editingKey, body }, { onSuccess: onDone('livemap.builder.objectUpdated'), onError: onFail })
    } else {
      createObject.mutate(body, { onSuccess: onDone('livemap.builder.objectCreated'), onError: onFail })
    }
  }

  // 설비(EQUIPMENT)는 빌트인 fab tool 자동 표시 — 빌더는 STRUCTURE 만 다룬다(FK용 '기본 설비' 등 EQUIPMENT 숨김).
  const objects = (objectsQuery.data ?? []).filter((object) => object.objectKind === 'STRUCTURE')
  // 빌트인 벽/파티션은 항상 목록 상단에 노출 — 같은 이름의 내 STRUCTURE 객체가 이미 있으면 그쪽으로 갈음(중복 숨김).
  const savedStructureNames = new Set(objects.map((object) => object.objectName))
  const builtinStructures = LIVE_MAP_BUILTIN_STRUCTURES.filter((builtin) => !savedStructureNames.has(builtin.objectName))

  return (
    <section
      data-testid="live-map-object-editor"
      className="flex h-[calc(100dvh-16rem)] min-h-110 gap-3 overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft-lg"
    >
      {/* 객체 리스트 */}
      <div data-testid="object-editor-list" className="flex w-56 min-h-0 shrink-0 flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t('livemap.builder.objects')}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="object-editor-new"
            className="rounded-md border border-primary px-2 py-1 text-[11px] font-semibold text-primary"
            onClick={resetDraft}
          >
            + {t('livemap.builder.new')}
          </Button>
        </div>
        <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
          {builtinStructures.map((builtin) => (
            <div
              key={builtin.objectKey}
              className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border px-2 py-1.5"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid={`object-builtin-item-${builtin.slug}`}
                className="flex h-auto min-w-0 flex-1 flex-col items-start justify-start gap-0 px-0 text-left"
                title={t('livemap.builder.builtinHint')}
                onClick={() => loadBuiltin(builtin)}
              >
                <span className="w-full truncate text-xs font-semibold text-foreground">{builtin.objectName}</span>
                <span className="text-[10px] text-muted-foreground">{t('livemap.builder.builtinBadge')}</span>
              </Button>
            </div>
          ))}
          {objects.length === 0 ? (
            <span className="text-[10px] text-muted-foreground">{t('livemap.builder.emptyObjects')}</span>
          ) : (
            objects.map((object) => (
              <div
                key={object.objectKey}
                className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${
                  editingKey === object.objectKey ? 'border-primary bg-brand-primary/5' : 'border-border'
                }`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`object-list-item-${object.objectKey}`}
                  className="flex h-auto min-w-0 flex-1 flex-col items-start justify-start gap-0 px-0 text-left"
                  onClick={() => loadObject(object)}
                >
                  <span className="w-full truncate text-xs font-semibold text-foreground">{object.objectName}</span>
                  <span className="text-[10px] text-muted-foreground">{object.objectKind}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`object-list-delete-${object.objectKey}`}
                  className="text-danger"
                  aria-label={t('livemap.builder.deleteObject', { name: object.objectName })}
                  onClick={() => deleteObject.mutate(object.objectKey)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 컴포저 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {t('livemap.builder.fieldName')}
            <input
              data-testid="object-editor-name"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="flex flex-col gap-1 text-xs font-semibold">
            {t('livemap.builder.fieldKind')}
            <span
              data-testid="object-editor-kind"
              className="inline-flex h-8.5 items-center rounded-md border border-border bg-muted/40 px-2.5 text-xs font-bold text-muted-foreground"
            >
              STRUCTURE
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5" role="group" aria-label={t('livemap.builder.addShape')}>
            <Button type="button" variant="ghost" size="sm" data-testid="object-editor-add-box" title={t('livemap.builder.addBox')} aria-label={t('livemap.builder.addBox')} className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => addPrim('box')}>
              <Box className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" data-testid="object-editor-add-cylinder" title={t('livemap.builder.addCylinder')} aria-label={t('livemap.builder.addCylinder')} className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => addPrim('cylinder')}>
              <Cylinder className="size-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            data-testid="object-editor-save"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={handleSave}
          >
            {editingKey != null ? t('livemap.builder.update') : t('livemap.builder.save')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('livemap.builder.shapesLabel')} <span data-testid="object-editor-prim-count">{prims.length}</span>
          </span>
        </div>

        <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          {prims.length === 0 ? (
            <span className="text-xs text-muted-foreground">{t('livemap.builder.emptyShapeHint')}</span>
          ) : (
            prims.map((prim) => (
              <div key={prim.id} className="flex flex-wrap items-end gap-2 rounded-[12px] border border-border bg-background/40 px-3 py-2">
                <span className="w-16 text-xs font-bold text-foreground">{prim.type}</span>
                <NumberField label="W" value={prim.size.x} onChange={(value) => updatePrimVec(prim.id, 'size', 'x', value)} />
                <NumberField label="H" value={prim.size.y} onChange={(value) => updatePrimHeight(prim.id, value)} />
                <NumberField label="D" value={prim.size.z} onChange={(value) => updatePrimVec(prim.id, 'size', 'z', value)} />
                <NumberField label="X" value={prim.position.x} onChange={(value) => updatePrimVec(prim.id, 'position', 'x', value)} />
                <NumberField label="Y" value={prim.position.y} onChange={(value) => updatePrimVec(prim.id, 'position', 'y', value)} />
                <NumberField label="Z" value={prim.position.z} onChange={(value) => updatePrimVec(prim.id, 'position', 'z', value)} />
                <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-muted-foreground">
                  {t('livemap.builder.color')}
                  <input
                    type="color"
                    value={prim.color}
                    onChange={(event) => updatePrimColor(prim.id, event.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                </label>
                <Button type="button" variant="ghost" size="sm" className="ml-auto text-danger" aria-label={t('livemap.builder.removeShape')} onClick={() => removePrim(prim.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {status ? (
          <div data-testid="object-editor-status" className="rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {status}
          </div>
        ) : null}
      </div>

      {/* 3D 미리보기 */}
      <div
        data-testid="object-editor-preview"
        className="h-full w-80 shrink-0 overflow-hidden rounded-[18px] border border-border bg-[#0e1422]"
      >
        <Canvas frameloop="demand" shadows orthographic camera={{ position: [7, 7, 7], zoom: 42, near: -100, far: 100 }}>
          <color attach="background" args={['#0e1422']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[6, 10, 4]} intensity={1.1} castShadow />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
            <planeGeometry args={[30, 30]} />
            <meshStandardMaterial color="#0b0f1a" />
          </mesh>
          {/* 표준 구조물(벽/파티션/바닥/기둥)은 뷰어와 동일한 모던 색으로 미리보기 — 저장된 옛 색도 일관되게 보이게. */}
          <LiveMap3DObject shape={shape} colorOverride={LIVE_MAP_STRUCTURE_COLOR_BY_NAME[name.trim()]} />
          <OrbitControls target={[0, 1, 0]} makeDefault />
        </Canvas>
      </div>
    </section>
  )
}
