import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'

/**
 * RUNNING Deploy hold mutation 훅입니다.
 */
export function useHoldDeploy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (deployKey: number) => deployApi.holdDeploy(deployKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deployQueryKeys.all })
    },
  })
}
