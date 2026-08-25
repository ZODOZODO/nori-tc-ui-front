import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import { ApiError, assertSuccessResponse, createFailResponse, normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'
import { CSRF_HEADER_NAME, withCsrfHeaders } from '@/shared/lib/csrf'
import type { OperationAcceptance } from '@/shared/lib/operation-status'
import {
  type AsyncAcceptResponse,
  type EqpCheckinRequest,
  type EqpCheckoutRequest,
  type EqpCheckoutStatus,
  type EqpCheckoutStatusResponse,
  type EqpCreateRequest,
  type EqpOperationAcceptResponse,
  type EqpVoidResponse,
  type EqpInfo,
  type EqpInfoDetailResponse,
  type EqpInfoListResponse,
  type GatewayShardLease,
  type GatewayShardLeaseListResponse,
  type EqpManageDetail,
  type EqpManageDetailBatch,
  type EqpManageDetailBatchApiResponse,
  type EqpManageDetailResponse,
  type EqpManageOptions,
  type EqpManageOptionsResponse,
  type EqpModelInfo,
  type EqpModelInfoResponse,
  type EqpInfoPage,
  type EqpLifecycleRequest,
  type EqpParam,
  type EqpParamListResponse,
  type EqpParamSaveItem,
  type EqpParamVersionListResponse,
  type EqpRuntimeState,
  type EqpRuntimeStateResponse,
  type EqpUpdateRequest,
} from '../types/eqp.types'
import { isRecord } from '@/shared/types/api.types'

// 모듈 로드 시점이 아니라 호출 시점에 i18n.t 를 평가해야 런타임 언어 전환을 반영한다.
const eqpListFallbackMessage = () => i18n.t('error.eqp.list')

/**
 * 설비 목록 항목 최소 계약(문자열 eqpId)을 만족하는지 확인합니다.
 * 서버 응답이 일부 비정상인 경우에도 UI가 치명적으로 중단되지 않도록 유효 항목만 통과시킵니다.
 */
const isEqpInfoItem = (value: unknown): value is EqpInfo =>
  isRecord(value) && typeof value.eqpId === 'string' && value.eqpId.length > 0

/**
 * 설비 목록 payload를 페이지 형식으로 정규화합니다.
 * - 표준 계약: { items, offset, limit, count }
 * - 구계약 호환: data가 배열인 경우(legacy)도 허용
 */
const normalizeEqpListPayload = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): EqpInfoPage => {
  if (Array.isArray(payload)) {
    const normalizedItems = payload.filter(isEqpInfoItem)
    return {
      items: normalizedItems,
      offset: requestedOffset,
      limit: requestedLimit,
      count: normalizedItems.length,
    }
  }

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new ApiError(
      createFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: eqpListFallbackMessage(),
        },
        eqpListFallbackMessage(),
      ),
    )
  }

  const normalizedItems = payload.items.filter(isEqpInfoItem)
  const resolvedOffset = typeof payload.offset === 'number' ? payload.offset : requestedOffset
  const resolvedLimit = typeof payload.limit === 'number' ? payload.limit : requestedLimit
  const resolvedCount =
    typeof payload.count === 'number'
      ? Math.max(payload.count, normalizedItems.length)
      : normalizedItems.length

  return {
    items: normalizedItems,
    offset: resolvedOffset,
    limit: resolvedLimit,
    count: resolvedCount,
  }
}

export const eqpApi = {
  /**
   * 설비 목록을 조회합니다.
   */
  getEqpList: async (offset = 0, limit = 500): Promise<EqpInfoPage> => {
    try {
      const response = await apiClient.get<EqpInfoListResponse>('/eqp', {
        params: { offset, limit },
        withCredentials: true,
      })

      const successPayload = resolveSuccessPayload(
        response.data,
        response.status,
        eqpListFallbackMessage(),
      )

      return normalizeEqpListPayload(successPayload, offset, limit)
    } catch (error) {
      throw normalizeApiError(error, eqpListFallbackMessage())
    }
  },

  /**
   * Gateway shard lease 점유 현황을 조회합니다.
   * EQP 목록을 gateway 단위 그룹으로 분류하는 기준 데이터입니다.
   */
  getGatewayShardLeases: async (): Promise<GatewayShardLease[]> => {
    try {
      const response = await apiClient.get<GatewayShardLeaseListResponse>(
        '/eqp/gateway-shard-leases',
        {
          withCredentials: true,
        },
      )

      const payload = resolveSuccessPayload(
        response.data,
        response.status,
        i18n.t('error.eqp.shardLeases'),
      )

      if (!Array.isArray(payload)) {
        throw new ApiError(
          createFailResponse(
            {
              success: false,
              data: null,
              errorCode: 'INVALID_RESPONSE',
              errorMsg: i18n.t('error.eqp.shardLeases'),
            },
            i18n.t('error.eqp.shardLeases'),
          ),
          response.status,
        )
      }

      return payload as GatewayShardLease[]
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.shardLeases'))
    }
  },

  /**
   * 설비 단건 상세를 조회합니다.
   */
  getEqpDetail: async (eqpId: string): Promise<EqpInfo> => {
    try {
      const response = await apiClient.get<EqpInfoDetailResponse>(`/eqp/${encodeURIComponent(eqpId)}`, {
        withCredentials: true,
      })

      return resolveSuccessPayload<EqpInfo>(
        response.data,
        response.status,
        i18n.t('error.eqp.detail'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.detail'))
    }
  },

  /**
   * EQP 관리 상세를 조회합니다.
   */
  getEqpManageDetail: async (eqpId: string): Promise<EqpManageDetail> => {
    try {
      const response = await apiClient.get<EqpManageDetailResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/manage`,
        {
          withCredentials: true,
        },
      )

      return resolveSuccessPayload<EqpManageDetail>(
        response.data,
        response.status,
        i18n.t('error.eqp.manageDetail'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.manageDetail'))
    }
  },

  /**
   * 여러 설비의 관리 상세를 한 번에 조회합니다.
   *
   * 그룹 화면처럼 다건을 동시에 표시해야 할 때 N-fan-out HTTP 호출을 제거하기 위해 사용합니다.
   * 백엔드 한도(현재 200건)를 초과하지 않도록 호출자가 분할 책임을 가집니다.
   */
  getEqpManageDetailBatch: async (eqpIds: readonly string[]): Promise<EqpManageDetailBatch> => {
    if (eqpIds.length === 0) {
      return { items: [], missingEqpIds: [] }
    }

    try {
      const csv = eqpIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
        .join(',')
      const response = await apiClient.get<EqpManageDetailBatchApiResponse>(
        '/eqp/manage-batch',
        {
          params: { eqpIds: csv },
          withCredentials: true,
        },
      )

      return resolveSuccessPayload<EqpManageDetailBatch>(
        response.data,
        response.status,
        i18n.t('error.eqp.manageBatch'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.manageBatch'))
    }
  },

  /**
   * EQP 관리 화면 옵션을 조회합니다.
   */
  getEqpManageOptions: async (): Promise<EqpManageOptions> => {
    try {
      const response = await apiClient.get<EqpManageOptionsResponse>('/eqp/options', {
        withCredentials: true,
      })

      return resolveSuccessPayload<EqpManageOptions>(
        response.data,
        response.status,
        i18n.t('error.eqp.manageOptions'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.manageOptions'))
    }
  },

  /**
   * 설비별 파라미터 버전 목록을 조회합니다.
   */
  getEqpParamVersions: async (eqpId: string): Promise<string[]> => {
    try {
      const response = await apiClient.get<EqpParamVersionListResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/param-versions`,
        {
          withCredentials: true,
        },
      )

      const versions = resolveSuccessPayload<string[]>(
        response.data,
        response.status,
        i18n.t('error.eqp.paramVersions'),
      )

      return versions.filter((version) => typeof version === 'string' && version.trim().length > 0)
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.paramVersions'))
    }
  },

  /**
   * modelVersionKey로 모델 정보를 조회합니다.
   */
  getEqpModelInfoByVersionKey: async (modelVersionKey: number): Promise<EqpModelInfo> => {
    try {
      const response = await apiClient.get<EqpModelInfoResponse>(`/model/${modelVersionKey}`, {
        withCredentials: true,
      })

      return resolveSuccessPayload<EqpModelInfo>(
        response.data,
        response.status,
        i18n.t('error.eqp.modelInfo'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.modelInfo'))
    }
  },

  /**
   * 선택 설비의 런타임 상태를 조회합니다.
   */
  getEqpRuntimeState: async (eqpId: string): Promise<EqpRuntimeState> => {
    try {
      const response = await apiClient.get<EqpRuntimeStateResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/runtime-state`,
        {
          withCredentials: true,
        },
      )

      return resolveSuccessPayload<EqpRuntimeState>(
        response.data,
        response.status,
        i18n.t('error.eqp.runtimeState'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.runtimeState'))
    }
  },

  /**
   * 설비 체크아웃 상태를 조회합니다.
   */
  getEqpCheckoutStatus: async (eqpId: string): Promise<EqpCheckoutStatus> => {
    try {
      const response = await apiClient.get<EqpCheckoutStatusResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/checkout-status`,
        { withCredentials: true },
      )

      const payload = resolveSuccessPayload<{ checkedOut: boolean; checkedOutBy: string | null }>(
        response.data,
        response.status,
        i18n.t('error.eqp.checkoutStatus'),
      )

      return {
        isCheckedOut: payload.checkedOut,
        checkedOutBy: payload.checkedOutBy,
      }
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.checkoutStatus'))
    }
  },

  /**
   * 특정 버전의 설비 파라미터 목록을 조회합니다.
   */
  getEqpParams: async (eqpId: string, version: string): Promise<EqpParam[]> => {
    try {
      const response = await apiClient.get<EqpParamListResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/params`,
        {
          params: { version },
          withCredentials: true,
        },
      )

      return resolveSuccessPayload<EqpParam[]>(
        response.data,
        response.status,
        i18n.t('error.eqp.params'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.params'))
    }
  },

  /**
   * 설비 파라미터를 체크아웃합니다.
   * 이미 체크아웃 중이면 ApiError(status=409)를 던집니다.
   */
  checkoutEqp: async (eqpId: string, request: EqpCheckoutRequest): Promise<EqpParam[]> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<EqpParamListResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/checkout`,
          request,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      return resolveSuccessPayload<EqpParam[]>(
        response.data,
        response.status,
        i18n.t('error.eqp.checkout'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.checkout'))
    }
  },

  /**
   * EDIT 버전의 설비 파라미터를 저장합니다.
   */
  saveEqpEditParams: async (eqpId: string, params: EqpParamSaveItem[]): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<EqpVoidResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/edit-params`,
          { params },
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      assertSuccessResponse(response.data, response.status, i18n.t('error.eqp.saveEditParams'))
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.saveEditParams'))
    }
  },

  /**
   * 설비 파라미터 체크아웃을 되돌리고 EDIT 버전을 삭제합니다.
   */
  undoEqpCheckout: async (eqpId: string): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<EqpVoidResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/checkout`,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      assertSuccessResponse(response.data, response.status, i18n.t('error.eqp.undoCheckout'))
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.undoCheckout'))
    }
  },

  /**
   * 설비 파라미터를 체크인합니다.
   */
  checkinEqp: async (eqpId: string, request: EqpCheckinRequest): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<EqpVoidResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/checkin`,
          request,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      assertSuccessResponse(response.data, response.status, i18n.t('error.eqp.checkin'))
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.checkin'))
    }
  },

  /**
   * 설비 등록을 접수합니다(`202 Accepted`).
   *
   * 반환값은 **접수 결과**이지 변경 완료가 아니다 — 호출부는 `operationId` 로 operation 을 조회해
   * PASS 를 확인한 뒤에야 성공을 표시해야 한다(§14.1).
   */
  createEqp: async (request: EqpCreateRequest): Promise<OperationAcceptance> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<EqpOperationAcceptResponse>('/eqp', request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<OperationAcceptance>(
        response.data,
        response.status,
        i18n.t('error.eqp.create'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.create'))
    }
  },

  /**
   * 설비 수정을 접수합니다(`202 Accepted`).
   */
  updateEqp: async (eqpId: string, request: EqpUpdateRequest): Promise<OperationAcceptance> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<EqpOperationAcceptResponse>(`/eqp/${encodeURIComponent(eqpId)}`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<OperationAcceptance>(
        response.data,
        response.status,
        i18n.t('error.eqp.update'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.update'))
    }
  },

  /**
   * 설비 삭제를 접수합니다(`202 Accepted`).
   */
  deleteEqp: async (eqpId: string): Promise<OperationAcceptance> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<EqpOperationAcceptResponse>(`/eqp/${encodeURIComponent(eqpId)}`, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<OperationAcceptance>(
        response.data,
        response.status,
        i18n.t('error.eqp.delete'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.delete'))
    }
  },

  /**
   * 설비 start를 요청하고 polling traceId를 반환합니다.
   */
  startEqp: async (eqpId: string, request: EqpLifecycleRequest): Promise<string> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<AsyncAcceptResponse>(`/eqp/${encodeURIComponent(eqpId)}/start`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      const payload = resolveSuccessPayload<{ traceId: string }>(
        response.data,
        response.status,
        i18n.t('error.eqp.startRequest'),
      )

      if (!payload.traceId) {
        throw new ApiError(
          createFailResponse({
            success: false,
            data: null,
            errorCode: 'INVALID_RESPONSE',
            errorMsg: i18n.t('error.eqp.startNoTraceId'),
          }, i18n.t('error.eqp.startNoTraceId')),
          response.status,
        )
      }

      return payload.traceId
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.startRequest'))
    }
  },

  /**
   * 설비 end를 요청하고 polling traceId를 반환합니다.
   */
  endEqp: async (eqpId: string, request: EqpLifecycleRequest): Promise<string> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<AsyncAcceptResponse>(`/eqp/${encodeURIComponent(eqpId)}/end`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      const payload = resolveSuccessPayload<{ traceId: string }>(
        response.data,
        response.status,
        i18n.t('error.eqp.endRequest'),
      )

      if (!payload.traceId) {
        throw new ApiError(
          createFailResponse({
            success: false,
            data: null,
            errorCode: 'INVALID_RESPONSE',
            errorMsg: i18n.t('error.eqp.endNoTraceId'),
          }, i18n.t('error.eqp.endNoTraceId')),
          response.status,
        )
      }

      return payload.traceId
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.endRequest'))
    }
  },

  /**
   * 설비 reconnect(EQP_RECONNECT)를 요청하고 polling traceId를 반환합니다.
   *
   * stuck(desired_state=STARTED + control=OFFLINE) 인 ACTIVE 설비 복구용. EQP_START 는 desired!=ENDED 를
   * 거부하므로 이미 STARTED 인 stuck 설비의 재연결은 이 엔드포인트(EQP_RECONNECT)로 라우팅한다.
   */
  reconnectEqp: async (eqpId: string, request: EqpLifecycleRequest): Promise<string> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<AsyncAcceptResponse>(`/eqp/${encodeURIComponent(eqpId)}/reconnect`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      const payload = resolveSuccessPayload<{ traceId: string }>(
        response.data,
        response.status,
        i18n.t('error.eqp.endRequest'),
      )

      if (!payload.traceId) {
        throw new ApiError(
          createFailResponse({
            success: false,
            data: null,
            errorCode: 'INVALID_RESPONSE',
            errorMsg: i18n.t('error.eqp.endNoTraceId'),
          }, i18n.t('error.eqp.endNoTraceId')),
          response.status,
        )
      }

      return payload.traceId
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.endRequest'))
    }
  },

  /**
   * PLC 폴링 그룹 시작 명령(EQP_PLC_GROUP_START)을 요청하고 polling traceId를 반환합니다.
   * 백엔드는 PathVariable(eqpId/groupMessageName)만 받고 body가 없으므로 빈 body로 POST합니다.
   */
  startPollingGroup: async (eqpId: string, groupMessageName: string): Promise<string> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<AsyncAcceptResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/polling-group/${encodeURIComponent(groupMessageName)}/start`,
          null,
          {
            withCredentials: true,
            headers: {
              [CSRF_HEADER_NAME]: csrfToken,
            },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      const payload = resolveSuccessPayload<{ traceId: string }>(
        response.data,
        response.status,
        i18n.t('error.eqp.startPollingGroup'),
      )

      if (!payload.traceId) {
        throw new ApiError(
          createFailResponse({
            success: false,
            data: null,
            errorCode: 'INVALID_RESPONSE',
            errorMsg: i18n.t('error.eqp.pollingGroupNoTraceId'),
          }, i18n.t('error.eqp.pollingGroupNoTraceId')),
          response.status,
        )
      }

      return payload.traceId
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.startPollingGroup'))
    }
  },

  /**
   * PLC 폴링 그룹 중단 명령(EQP_PLC_GROUP_END)을 요청하고 polling traceId를 반환합니다.
   */
  endPollingGroup: async (eqpId: string, groupMessageName: string): Promise<string> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<AsyncAcceptResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/polling-group/${encodeURIComponent(groupMessageName)}/end`,
          null,
          {
            withCredentials: true,
            headers: {
              [CSRF_HEADER_NAME]: csrfToken,
            },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      const payload = resolveSuccessPayload<{ traceId: string }>(
        response.data,
        response.status,
        i18n.t('error.eqp.endPollingGroup'),
      )

      if (!payload.traceId) {
        throw new ApiError(
          createFailResponse({
            success: false,
            data: null,
            errorCode: 'INVALID_RESPONSE',
            errorMsg: i18n.t('error.eqp.pollingGroupNoTraceId'),
          }, i18n.t('error.eqp.pollingGroupNoTraceId')),
          response.status,
        )
      }

      return payload.traceId
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.eqp.endPollingGroup'))
    }
  },
}
