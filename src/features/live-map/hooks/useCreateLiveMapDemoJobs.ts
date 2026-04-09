import { useMutation, useQueryClient } from '@tanstack/react-query'
import { liveMapDemoApi, type LiveMapDemoJobCreateRequest } from '../api/live-map-demo.api'

export function useCreateLiveMapDemoJobs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: LiveMapDemoJobCreateRequest) => liveMapDemoApi.createJobs(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['live-map-demo-jobs'] })
    },
  })
}
