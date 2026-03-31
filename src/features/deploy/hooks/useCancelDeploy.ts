import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'

/**
 * 진행 중 Deploy 취소 mutation 훅입니다.
 */
export function useCancelDeploy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (deployKey: number) => deployApi.cancelDeploy(deployKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deployQueryKeys.all })
    },
  })
}
