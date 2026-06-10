import { useCallback, useMemo, useState } from 'react'
import type { LiveMapPlacementInput } from '../api/layout.api'
import {
  buildLiveMapFlowCanvasJson,
  createDefaultLiveMapFlow,
  parseLiveMapFlow,
  type LiveMapFlowJson,
} from '../lib/live-map-flow.model'
import { useLayout, useSaveLayout } from './useLayout'

/**
 * 공정 흐름(board) 그룹 배치의 로드/편집(draft)/저장 훅입니다.
 *
 * <p>라인 layout(canvas_json.flow)을 읽어 flow 를 만들고(없으면 미배정 그룹만 있는 기본 flow),
 * 편집은 로컬 draft 로 쌓다가 저장 시 PUT /live-map/layout 로 영속한다. canvas_json 의 다른 키(빌더
 * 메타)와 placements(3D 배치)는 서버 값 그대로 되돌려 보낸다 — 3D 저장이 flow 를 보존하는 것과 대칭.</p>
 */
export function useLiveMapFlow(lineKey: number | null) {
  const layoutQuery = useLayout(lineKey)
  const saveMutation = useSaveLayout(lineKey)
  const [draft, setDraft] = useState<LiveMapFlowJson | null>(null)

  // 라인 전환 시 편집 중 draft 폐기 — 다른 라인 layout 에 섞여 저장되지 않게(render 시점 보정).
  const [draftLineKey, setDraftLineKey] = useState(lineKey)
  if (draftLineKey !== lineKey) {
    setDraftLineKey(lineKey)
    setDraft(null)
  }

  const savedFlow = useMemo(
    () => parseLiveMapFlow(layoutQuery.data?.canvasJson) ?? createDefaultLiveMapFlow(),
    [layoutQuery.data?.canvasJson],
  )
  const flow = draft ?? savedFlow
  const isDirty = draft !== null

  const updateFlow = useCallback(
    (updater: (current: LiveMapFlowJson) => LiveMapFlowJson) => {
      setDraft((current) => updater(current ?? savedFlow))
    },
    [savedFlow],
  )

  const { mutateAsync, isPending, error, reset } = saveMutation
  const saveFlow = useCallback(async () => {
    const placements: LiveMapPlacementInput[] = (layoutQuery.data?.placements ?? []).map(
      (placement) => ({
        objectKey: placement.objectKey,
        eqpKey: placement.eqpKey,
        transformJson: placement.transformJson,
      }),
    )
    await mutateAsync({
      canvasJson: buildLiveMapFlowCanvasJson(layoutQuery.data?.canvasJson ?? null, draft ?? savedFlow),
      placements,
    })
    setDraft(null)
  }, [draft, savedFlow, layoutQuery.data, mutateAsync])

  return {
    flow,
    isDirty,
    updateFlow,
    saveFlow,
    isSaving: isPending,
    saveError: error,
    resetSaveError: reset,
  }
}
