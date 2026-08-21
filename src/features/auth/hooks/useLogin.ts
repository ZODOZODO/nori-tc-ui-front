import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { profileApi } from '@/features/profile/api/profile.api'
import { useI18n } from '@/i18n/i18n-context'
import { authApi } from '../api/auth.api'
import { type LoginRequest, type LoginSuccessResponse } from '../types/auth.types'
import { ApiError } from '@/shared/lib/api-error'
import { resolveLoginLandingRoute } from '@/shared/lib/app-navigation'

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

export function useLogin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useI18n()

  const loginSchema = useMemo(() => buildLoginSchema(t), [t])

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      userId: '',
      password: '',
    },
  })

  const loginMutation = useMutation<LoginSuccessResponse, ApiError, LoginRequest>({
    mutationFn: (credentials) => authApi.login(credentials),
    onSuccess: async (result) => {
      console.info('[useLogin] login flow completed', {
        userPk: result.data.userPk,
      })

      // 진입 경로는 보유 권한이 정한다 — 고정 경로(`/live-map`)는 그 권한이 없는 사용자를
      // 로그인 직후 권한없음 화면에 떨어뜨렸다.
      //
      // 키를 `useMe`(useProfile.ts)와 맞춰 결과를 캐시에 심으므로, 직후 라우트 가드가 같은
      // 요청을 다시 보내지 않는다. `staleTime: 0` 은 방어가 아니라 신선도 요구다 — 기본값이
      // 5분(AppProvider)이라 명시하지 않으면 메모리에 남은 이전 사용자의 me 를 네트워크 없이
      // 돌려받아 그 사람 권한으로 랜딩할 수 있다.
      let permissionCodes: readonly string[] | null = null
      try {
        const me = await queryClient.fetchQuery({
          queryKey: ['auth', 'me'],
          queryFn: () => profileApi.getMe(),
          staleTime: 0,
        })
        permissionCodes = me.permissionCodes
      } catch (error) {
        console.error('[useLogin] failed to resolve landing route from /auth/me', error)
      }

      navigate(resolveLoginLandingRoute(permissionCodes), { replace: true })
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
