import { isAxiosError } from 'axios'
import { apiClient } from '@/shared/lib/api-client'
import {
  type ApiResponse,
  createModelFailResponse,
  DEFAULT_MODEL_ERROR_MESSAGE,
  ModelApiError,
  type ModelBranchCreateRequest,
  type ModelDeleteBatchResult,
  type ModelDeleteBatchResponse,
  type ModelDeleteResponse,
  type ModelDetailResponse,
  type ModelDetailRowPayload,
  type ModelDetailNode,
  type ModelInfoUpdateRequest,
  type ModelInfo,
  type ModelListResponse,
  type ModelManagementResponse,
  type ModelMdfContentPayload,
  type ModelMdfContent,
  type ModelNodeDetailPayload,
  type ModelNodeDetailData,
  type ModelNodeDetailResponse,
  type ModelParentCommitRequest,
  type ModelParentCommitResponse,
  type ModelParentCommitResult,
  type ModelPageResponse,
  type ModelDetailRow,
  type ModelRootCreateRequest,
  type ModelUpsertRequest,
  isApiResponse,
  isRecord,
} from '../types/model.types'

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'
const MODEL_LIST_FALLBACK_MESSAGE = '모델 목록을 조회하지 못했습니다.'
const MODEL_DETAIL_NODE_FALLBACK_MESSAGE = '모델 상세 노드 데이터를 조회하지 못했습니다.'


/**
 * document.cookie에서 특정 쿠키 값을 추출합니다.
 */
const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  const encodedName = `${encodeURIComponent(name)}=`
  const matchedCookie = document.cookie
    .split('; ')
    .find((cookieEntry) => cookieEntry.startsWith(encodedName))

  if (!matchedCookie) {
    return null
  }

  return decodeURIComponent(matchedCookie.substring(encodedName.length))
}

/**
 * 상태 변경 요청 이전에 CSRF 토큰을 발급하고 헤더 값을 반환합니다.
 */
const issueCsrfToken = async (): Promise<string> => {
  await apiClient.get('/auth/csrf', {
    withCredentials: true,
  })

  const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
  if (!csrfToken) {
    throw new ModelApiError(
      createModelFailResponse({
        success: false,
        data: null,
        errorCode: 'CSRF_TOKEN_MISSING',
        errorMsg: 'CSRF 토큰을 확인할 수 없습니다. 페이지를 새로고침한 후 다시 시도해 주세요.',
      }),
    )
  }

  return csrfToken
}

/**
 * 알 수 없는 예외를 ModelApiError로 정규화합니다.
 */
const normalizeModelError = (
  error: unknown,
  fallbackMessage = DEFAULT_MODEL_ERROR_MESSAGE,
): ModelApiError => {
  if (error instanceof ModelApiError) {
    return error
  }

  if (isAxiosError(error)) {
    return new ModelApiError(
      createModelFailResponse(error.response?.data, fallbackMessage),
      error.response?.status,
    )
  }

  return new ModelApiError(createModelFailResponse(error, fallbackMessage))
}

/**
 * ApiResponse 계약을 검증하고 성공 payload(data)를 반환합니다.
 */
const resolveSuccessPayload = <TData>(
  payload: unknown,
  status: number,
  fallbackMessage: string,
  allowNullData = false,
): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true) {
    throw new ModelApiError(createModelFailResponse(payload, fallbackMessage), status)
  }

  if (payload.data === null && !allowNullData) {
    throw new ModelApiError(
      createModelFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: fallbackMessage,
        },
        fallbackMessage,
      ),
      status,
    )
  }

  return payload.data as TData
}

/**
 * 모델 목록 항목 최소 계약을 검사합니다.
 */
const isModelInfoItem = (value: unknown): value is ModelInfo =>
  isRecord(value) &&
  typeof value.modelVersionKey === 'number' &&
  typeof value.modelKey === 'number' &&
  typeof value.modelName === 'string' &&
  typeof value.modelVersion === 'string' &&
  typeof value.commInterface === 'string' &&
  typeof value.status === 'string' &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string' &&
  typeof value.createdBy === 'string' &&
  typeof value.updatedBy === 'string'

/**
 * 목록 payload를 페이지 형식으로 정규화합니다.
 * - 표준 계약: { items, offset, limit, count }
 * - 구계약 호환: data가 배열인 경우도 허용
 */
const normalizeModelListPayload = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): ModelPageResponse => {
  if (Array.isArray(payload)) {
    const normalizedItems = payload.filter(isModelInfoItem)
    return {
      items: normalizedItems,
      offset: requestedOffset,
      limit: requestedLimit,
      count: normalizedItems.length,
    }
  }

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new ModelApiError(
      createModelFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: MODEL_LIST_FALLBACK_MESSAGE,
        },
        MODEL_LIST_FALLBACK_MESSAGE,
      ),
    )
  }

  const normalizedItems = payload.items.filter(isModelInfoItem)
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

/**
 * 상세 row payload 최소 계약을 검사합니다.
 */
const isDetailRowPayload = (value: unknown): value is ModelDetailRowPayload =>
  isRecord(value) &&
  Array.isArray(value.values) &&
  value.values.every((cellValue) => typeof cellValue === 'string' || cellValue === null) &&
  (value.id === undefined || value.id === null || typeof value.id === 'string') &&
  (value.previewValues === undefined ||
    (Array.isArray(value.previewValues) &&
      value.previewValues.every(
        (cellValue) => typeof cellValue === 'string' || cellValue === null,
      )))

/**
 * MDF payload 최소 계약을 검사합니다.
 */
const isMdfContentPayload = (value: unknown): value is ModelMdfContentPayload =>
  isRecord(value) && typeof value.name === 'string' && typeof value.xml === 'string'

/**
 * 상세 노드 payload를 화면 모델로 정규화합니다.
 */
const normalizeModelNodeDetailPayload = (
  payload: unknown,
  node: ModelDetailNode,
): ModelNodeDetailData => {
  if (!isRecord(payload)) {
    throw new ModelApiError(
      createModelFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: MODEL_DETAIL_NODE_FALLBACK_MESSAGE,
        },
        MODEL_DETAIL_NODE_FALLBACK_MESSAGE,
      ),
    )
  }

  const columns = Array.isArray(payload.columns)
    ? payload.columns.filter((columnName): columnName is string => typeof columnName === 'string')
    : []
  const rawRows = Array.isArray(payload.rows) ? payload.rows.filter(isDetailRowPayload) : []
  const rawMdfContents = Array.isArray(payload.mdfContents)
    ? payload.mdfContents.filter(isMdfContentPayload)
    : []

  const rows: ModelDetailRow[] = rawRows.map((row, index) => ({
    id:
      typeof row.id === 'string' && row.id.trim().length > 0 ? row.id : `${node}-${index}`,
    values: row.values.map((cellValue) => cellValue ?? ''),
    previewValues:
      Array.isArray(row.previewValues) && row.previewValues.length === row.values.length
        ? row.previewValues.map((cellValue) => cellValue ?? '')
        : row.values.map((cellValue) => cellValue ?? ''),
  }))

  const mdfContents: ModelMdfContent[] = rawMdfContents.map((mdf, index) => ({
    id: `mdf-${index}`,
    name: mdf.name,
    xml: mdf.xml,
  }))

  return { columns, rows, mdfContents }
}

/**
 * CSRF 헤더가 필요한 요청을 공통 처리합니다.
 */
const withCsrfHeaders = async <TResponse>(
  requestFn: (csrfToken: string) => Promise<TResponse>,
): Promise<TResponse> => {
  const csrfToken = await issueCsrfToken()
  return requestFn(csrfToken)
}

export const modelApi = {
  /**
   * 모델 목록을 조회합니다.
   */
  getModelList: async (offset = 0, limit = 500): Promise<ModelPageResponse> => {
    try {
      const response = await apiClient.get<ModelListResponse>('/model', {
        params: { offset, limit },
        withCredentials: true,
      })

      const successPayload = resolveSuccessPayload<unknown>(
        response.data,
        response.status,
        MODEL_LIST_FALLBACK_MESSAGE,
      )

      return normalizeModelListPayload(successPayload, offset, limit)
    } catch (error) {
      throw normalizeModelError(error, MODEL_LIST_FALLBACK_MESSAGE)
    }
  },

  /**
   * 모델 단건 상세를 조회합니다.
   */
  getModelDetail: async (modelVersionKey: number): Promise<ModelInfo> => {
    try {
      const response = await apiClient.get<ModelDetailResponse>(`/model/${modelVersionKey}`, {
        withCredentials: true,
      })

      return resolveSuccessPayload<ModelInfo>(
        response.data,
        response.status,
        '모델 상세 정보를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeModelError(error, '모델 상세 정보를 조회하지 못했습니다.')
    }
  },

  /**
   * 모델 상세 노드 데이터를 조회합니다.
   */
  getModelNodeDetail: async (
    modelVersionKey: number,
    node: ModelDetailNode,
  ): Promise<ModelNodeDetailData> => {
    try {
      const response = await apiClient.get<ModelNodeDetailResponse>(
        `/model/${modelVersionKey}/details/${node}`,
        {
          withCredentials: true,
        },
      )

      const successPayload = resolveSuccessPayload<ModelNodeDetailPayload>(
        response.data,
        response.status,
        MODEL_DETAIL_NODE_FALLBACK_MESSAGE,
      )

      return normalizeModelNodeDetailPayload(successPayload, node)
    } catch (error) {
      throw normalizeModelError(error, MODEL_DETAIL_NODE_FALLBACK_MESSAGE)
    }
  },

  /**
   * branch version을 EDIT version으로 checkout합니다.
   */
  checkoutModelVersion: async (modelVersionKey: number): Promise<ModelInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ModelManagementResponse>(`/model/${modelVersionKey}/checkout`, null, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelInfo>(
        response.data,
        response.status,
        '모델 checkout에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeModelError(error, '모델 checkout에 실패했습니다.')
    }
  },

  /**
   * EDIT version을 새 branch version으로 checkin합니다.
   */
  checkinModelVersion: async (
    modelVersionKey: number,
    request: { newVersion: string; description: string },
  ): Promise<ModelInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ModelManagementResponse>(`/model/${modelVersionKey}/checkin`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelInfo>(
        response.data,
        response.status,
        '모델 checkin에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeModelError(error, '모델 checkin에 실패했습니다.')
    }
  },

  /**
   * 일반 상세 테이블 row를 저장합니다.
   */
  saveModelNodeDetailRows: async (
    modelVersionKey: number,
    node: ModelDetailNode,
    rows: ModelDetailRow[],
  ): Promise<ModelNodeDetailData> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<ModelNodeDetailResponse>(
          `/model/${modelVersionKey}/details/${node}`,
          {
            rows: rows.map((row) => ({
              id: row.id,
              values: row.values,
            })),
          },
          {
            withCredentials: true,
            headers: {
              [CSRF_HEADER_NAME]: csrfToken,
            },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      const successPayload = resolveSuccessPayload<ModelNodeDetailPayload>(
        response.data,
        response.status,
        '상세 데이터를 저장하지 못했습니다.',
      )

      return normalizeModelNodeDetailPayload(successPayload, node)
    } catch (error) {
      throw normalizeModelError(error, '상세 데이터를 저장하지 못했습니다.')
    }
  },

  /**
   * MDF XML 파일을 업로드합니다.
   */
  uploadModelMdf: async (
    modelVersionKey: number,
    file: File,
    mdfName?: string,
  ): Promise<ModelMdfContent> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (mdfName && mdfName.trim().length > 0) {
        formData.append('mdfName', mdfName.trim())
      }

      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<ApiResponse<ModelMdfContentPayload>>(
          `/model/${modelVersionKey}/details/mdf`,
          formData,
          {
            withCredentials: true,
            headers: {
              [CSRF_HEADER_NAME]: csrfToken,
              // apiClient 기본 헤더에 'Content-Type: application/json'이 설정되어 있어
              // FormData 업로드 시 axios의 자동 multipart/form-data 설정을 덮어쓰는 문제가 발생합니다.
              // undefined로 명시하면 axios가 FormData를 감지하여 boundary 포함 Content-Type을 자동 설정합니다.
              'Content-Type': undefined,
            },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      const successPayload = resolveSuccessPayload<ModelMdfContentPayload>(
        response.data,
        response.status,
        'MDF 업로드에 실패했습니다.',
      )

      return {
        id: 'mdf-0',
        name: successPayload.name,
        xml: successPayload.xml,
      }
    } catch (error) {
      throw normalizeModelError(error, 'MDF 업로드에 실패했습니다.')
    }
  },

  /**
   * root model을 생성합니다.
   */
  createRootModel: async (request: ModelRootCreateRequest): Promise<ModelInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ModelManagementResponse>('/model/roots', request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelInfo>(
        response.data,
        response.status,
        'root 모델 생성에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeModelError(error, 'root 모델 생성에 실패했습니다.')
    }
  },

  /**
   * root model의 공통 정보를 수정합니다.
   */
  updateRootModelInfo: async (
    modelKey: number,
    request: ModelInfoUpdateRequest,
  ): Promise<ModelInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<ModelManagementResponse>(`/model/${modelKey}/info`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelInfo>(
        response.data,
        response.status,
        'root 모델 정보를 수정하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeModelError(error, 'root 모델 정보를 수정하지 못했습니다.')
    }
  },

  /**
   * root model에서 branch model을 생성합니다.
   */
  createBranchModel: async (
    modelKey: number,
    request: ModelBranchCreateRequest,
  ): Promise<ModelInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ModelManagementResponse>(`/model/${modelKey}/branches`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelInfo>(
        response.data,
        response.status,
        'branch 모델 생성에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeModelError(error, 'branch 모델 생성에 실패했습니다.')
    }
  },

  /**
   * branch 최신 버전 기준 parent commit diff를 미리 조회합니다.
   */
  previewParentCommit: async (modelKey: number): Promise<ModelParentCommitResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ModelParentCommitResponse>(`/model/${modelKey}/commit-parent`, null, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelParentCommitResult>(
        response.data,
        response.status,
        'parent commit diff를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeModelError(error, 'parent commit diff를 조회하지 못했습니다.')
    }
  },

  /**
   * branch의 변경 내용을 parent 새 버전으로 commit합니다.
   */
  commitParentModel: async (
    modelKey: number,
    request: ModelParentCommitRequest,
  ): Promise<ModelParentCommitResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ModelParentCommitResponse>(`/model/${modelKey}/commit-parent`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelParentCommitResult>(
        response.data,
        response.status,
        'parent commit에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeModelError(error, 'parent commit에 실패했습니다.')
    }
  },

  /**
   * 특정 root model에 연결된 deprecated branch를 일괄 삭제합니다.
   */
  deleteDeprecatedBranches: async (modelKey: number): Promise<ModelDeleteBatchResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<ModelDeleteBatchResponse>(`/model/${modelKey}/branches/deprecated`, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelDeleteBatchResult>(
        response.data,
        response.status,
        'deprecated branch 삭제에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeModelError(error, 'deprecated branch 삭제에 실패했습니다.')
    }
  },

  /**
   * 모델을 등록합니다.
   */
  createModel: async (request: ModelUpsertRequest): Promise<ModelInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ModelDetailResponse>('/model', request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelInfo>(response.data, response.status, '모델 등록에 실패했습니다.')
    } catch (error) {
      throw normalizeModelError(error, '모델 등록에 실패했습니다.')
    }
  },

  /**
   * 모델을 수정합니다.
   */
  updateModel: async (modelVersionKey: number, request: ModelUpsertRequest): Promise<ModelInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<ModelDetailResponse>(`/model/${modelVersionKey}`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<ModelInfo>(response.data, response.status, '모델 수정에 실패했습니다.')
    } catch (error) {
      throw normalizeModelError(error, '모델 수정에 실패했습니다.')
    }
  },

  /**
   * 모델을 삭제합니다.
   */
  deleteModel: async (modelVersionKey: number): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<ModelDeleteResponse>(`/model/${modelVersionKey}`, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      resolveSuccessPayload<null>(response.data, response.status, '모델 삭제에 실패했습니다.', true)
    } catch (error) {
      throw normalizeModelError(error, '모델 삭제에 실패했습니다.')
    }
  },

  /**
   * model_key 기준으로 root/branch model 전체를 삭제합니다.
   */
  deleteModelByKey: async (modelKey: number): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<ModelDeleteResponse>(`/model/${modelKey}`, {
          params: {
            scope: 'model',
          },
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      resolveSuccessPayload<null>(response.data, response.status, '모델 삭제에 실패했습니다.', true)
    } catch (error) {
      throw normalizeModelError(error, '모델 삭제에 실패했습니다.')
    }
  },

  /**
   * branch model 삭제를 model 단위 삭제 API에 위임합니다.
   */
  deleteBranchModel: async (modelKey: number): Promise<void> => modelApi.deleteModelByKey(modelKey),
}
