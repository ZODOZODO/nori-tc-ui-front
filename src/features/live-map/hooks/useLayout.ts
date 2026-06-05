import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  layoutApi,
  type LiveMapLayoutPutBody,
  type LiveMapObjectSaveBody,
} from '../api/layout.api'

export const layoutQueryKeys = {
  layout: (lineKey: number) => ['live-map-layout', lineKey] as const,
  objects: () => ['live-map-objects'] as const,
}

/**
 * 선택 라인의 캔버스 + 배치를 조회합니다. lineKey 가 없으면(전체 스코프) 비활성.
 */
export function useLayout(lineKey: number | null) {
  return useQuery({
    queryKey: layoutQueryKeys.layout(lineKey ?? -1),
    queryFn: () => layoutApi.getLayout(lineKey as number),
    enabled: lineKey != null && lineKey > 0,
    // 저작 직후/새로고침 후 항상 서버 최신 배치를 다시 가져온다(마운트 시 refetch).
    staleTime: 0,
  })
}

/**
 * 재사용 객체 라이브러리(팔레트)를 조회합니다. 저작 권한이 있을 때만 활성.
 */
export function useLayoutObjects(enabled: boolean) {
  return useQuery({
    queryKey: layoutQueryKeys.objects(),
    queryFn: () => layoutApi.listObjects(),
    enabled,
    staleTime: 30_000,
  })
}

export function useSaveLayout(lineKey: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LiveMapLayoutPutBody) => layoutApi.putLayout(lineKey as number, body),
    onSuccess: (data) => {
      if (lineKey != null) {
        queryClient.setQueryData(layoutQueryKeys.layout(lineKey), data)
      }
    },
  })
}

export function useCreateObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: LiveMapObjectSaveBody) => layoutApi.createObject(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: layoutQueryKeys.objects() })
    },
  })
}

export function useUpdateObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { objectKey: number; body: LiveMapObjectSaveBody }) =>
      layoutApi.updateObject(vars.objectKey, vars.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: layoutQueryKeys.objects() })
    },
  })
}

export function useDeleteObject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (objectKey: number) => layoutApi.deleteObject(objectKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: layoutQueryKeys.objects() })
    },
  })
}
