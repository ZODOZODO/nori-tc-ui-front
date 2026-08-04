import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { useI18n } from '@/i18n/i18n-context'
import { authApi } from '../api/auth.api'
import { AuthApiError, type LoginRequest, type LoginSuccessResponse } from '../types/auth.types'

/**
 * 로그인 폼 유효성 스키마를 만든다.
 * - userId: 필수, 최소 2자 / password: 필수, 최소 8자
 *
 * zod 의 message 는 스키마 정의 시점에 고정되므로, 모듈 top-level 에 t 를 박으면
 * (1) i18n 초기화 전 평가 위험 (2) 언어 전환 비반응 문제가 생긴다. 따라서 t 를 받는
 * 팩토리로 두고 훅 안에서 t 변화에 맞춰 useMemo 로 재빌드해 호출 시점 평가 + 언어 반응을 보장한다.
 */
const buildLoginSchema = (t: (key: string) => string) =>
  z.object({
    userId: z
      .string()
      .trim()
      .min(1, t('login.validation.idRequired'))
      .min(2, t('login.validation.idMin')),
    password: z
      .string()
      .min(1, t('login.validation.pwRequired'))
      .min(8, t('login.validation.pwMin')),
  })

export type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>

/**
 * 로그인 성공 후 이동할 기본 진입 경로입니다 — live-map(설비 라이브맵)을 첫 화면으로 둡니다.
 */
const LOGIN_ENTRY_ROUTE = '/eqp/live-map'

export function useLogin() {
  const navigate = useNavigate()
  const { t } = useI18n()

  const loginSchema = useMemo(() => buildLoginSchema(t), [t])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      userId: '',
      password: '',
    },
  })

  const loginMutation = useMutation<LoginSuccessResponse, AuthApiError, LoginRequest>({
    mutationFn: (credentials) => authApi.login(credentials),
    onSuccess: (result) => {
      console.info('[useLogin] login flow completed', {
        userPk: result.data.userPk,
      })
      navigate(LOGIN_ENTRY_ROUTE, { replace: true })
    },
    onError: (error) => {
      console.error('[useLogin] login flow failed', {
        status: error.status,
        errorCode: error.payload.errorCode,
      })
    },
  })

  /**
   * submit 시 직전 서버 에러 상태를 초기화하고 최신 요청만 반영합니다.
   */
  const onSubmit = form.handleSubmit(async (formValues) => {
    loginMutation.reset()
    await loginMutation.mutateAsync(formValues)
  })

  /**
   * 사용자가 입력을 수정할 때 서버 에러 메시지를 정리합니다.
   */
  const resetServerError = () => {
    if (loginMutation.isError) {
      loginMutation.reset()
    }
  }

  return {
    form,
    onSubmit,
    mutate: loginMutation.mutate,
    mutateAsync: loginMutation.mutateAsync,
    isPending: loginMutation.isPending,
    error: loginMutation.error,
    serverErrorMessage: loginMutation.error?.payload.errorMsg ?? null,
    resetServerError,
  }
}
