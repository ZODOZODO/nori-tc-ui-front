import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'

/**
 * READY Deploy 실행 mutation 훅입니다.
 */
export function useStartDeploy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (deployKey: number) => deployApi.startDeploy(deployKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deployQueryKeys.all })
    },
  })
}
