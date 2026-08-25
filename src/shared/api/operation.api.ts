import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import { ApiError, createFailResponse, normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'
import type { OperationStatus } from '@/shared/lib/operation-status'
import type { ApiResponse } from '@/shared/types/api.types'

type OperationStatusApiResponse = ApiResponse<OperationStatus>

export const operationApi = {
  /**
   * operation 상태를 조회합니다(`GET /api/async/{id}`).
   *
   * `{id}` 는 operationId 와 레거시 traceId 를 모두 받습니다(백엔드 §13.3 / Plan B1).
   *
   * <p>상태 코드 의미를 뭉개지 않습니다 — `404` 는 "그런 operation 이 없다", `503` 은 "조정 원장을
   * 지금 읽을 수 없다" 로 서로 다른 조치를 요구합니다. 503 을 404 로 환원하면 화면이 "작업이
   * 사라졌다" 로 읽고 같은 변경을 다시 요청해 중복 mutation 을 만듭니다.</p>
   */
  getOperationStatus: async (operationId: string): Promise<OperationStatus> => {
    try {
      const response = await apiClient.get<OperationStatusApiResponse>(
        `/async/${encodeURIComponent(operationId)}`,
        {
          withCredentials: true,
          validateStatus: (status) => status >= 200 && status < 600,
        },
      )

      if (response.status === 404) {
        throw new ApiError(
          createFailResponse(
            {
              success: false,
              data: null,
              errorCode: 'NOT_FOUND',
              errorMsg: i18n.t('error.operation.notFound'),
            },
            i18n.t('error.operation.notFound'),
          ),
          404,
        )
      }

      return resolveSuccessPayload<OperationStatus>(
        response.data,
        response.status,
        i18n.t('error.operation.status'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.operation.status'))
    }
  },
}
