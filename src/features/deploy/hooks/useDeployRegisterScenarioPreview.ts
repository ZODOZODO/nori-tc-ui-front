import { useMutation } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import type { DeployRegisterScenarioPreviewRequest } from '../types/deploy.types'

/**
 * Register deploy 시나리오 preview mutation 훅입니다.
 */
export function useDeployRegisterScenarioPreview() {
  return useMutation({
    mutationFn: (request: DeployRegisterScenarioPreviewRequest) =>
      deployApi.previewRegisterScenario(request),
  })
}
