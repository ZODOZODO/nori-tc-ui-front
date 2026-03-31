import { useMutation } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import type { DeployCreateRequest } from '../types/deploy.types'

/**
 * Deploy 생성 mutation 훅입니다.
 */
export function useCreateDeploy() {
  return useMutation({
    mutationFn: (request: DeployCreateRequest) => deployApi.createDeploy(request),
  })
}
