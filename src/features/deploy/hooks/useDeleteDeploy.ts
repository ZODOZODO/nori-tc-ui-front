import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'

/**
 * 종료된 Deploy 이력 삭제 mutation 훅입니다.
 */
export function useDeleteDeploy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (deployKey: number) => deployApi.deleteDeploy(deployKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deployQueryKeys.all })
    },
  })
}
