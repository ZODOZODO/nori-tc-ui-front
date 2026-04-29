import { useMutation, useQueryClient } from '@tanstack/react-query'
import { liveMapDemoApi } from '../api/live-map-demo.api'

export function useCancelLiveMapDemoJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: string) => liveMapDemoApi.cancelJob(jobId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['live-map-demo-jobs'] })
    },
  })
}
