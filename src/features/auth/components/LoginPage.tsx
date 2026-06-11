import { type FormEvent, useEffect, useState } from 'react'
import { Eye, EyeOff, LogIn, Lock, Loader2, User } from 'lucide-react'
import { useI18n } from '@/i18n/i18n-context'
import { LanguageToggle } from '@/i18n/LanguageToggle'
import { useLogin } from '../hooks/useLogin'

type RecoveryModalType = 'forgotId' | 'forgotPassword' | null

interface RecoveryModalProps {
  type: Exclude<RecoveryModalType, null>
  onClose: () => void
}

/** nori tc 브랜드 로고. public/nori-tc-logo.png (사용자 제공 원본). */
function BrandMark() {
  return <img src="/nori-tc-logo.png" alt="nori-tc" className="h-16 w-auto" />
}

/** 아이디 / 비밀번호 찾기 모달. 현재 API 스펙 미제공이라 닫기 동작만 제공합니다. */
function RecoveryModal({ type, onClose }: RecoveryModalProps) {
  const { t } = useI18n()
  const isPassword = type === 'forgotPassword'

  const title = isPassword ? t('login.findPwTitle') : t('login.findIdTitle')
  const subtitle = isPassword ? t('login.findPwSubtitle') : t('login.findIdSubtitle')
  const fields = isPassword
    ? [
        { id: 'recovery-id', label: t('login.idLabel'), type: 'text' as const },
        { id: 'recovery-email', label: t('login.fieldEmail'), type: 'email' as const },
      ]
    : [
        { id: 'recovery-company', label: t('login.fieldCompany'), type: 'text' as const },
        { id: 'recovery-name', label: t('login.fieldName'), type: 'text' as const },
        { id: 'recovery-email', label: t('login.fieldEmail'), type: 'email' as const },
      ]

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-foreground/20 px-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${type}-title`}
        className="w-full max-w-110 rounded-2xl border border-border bg-card p-7 shadow-soft-lg"
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h2 id={`${type}-title`} className="text-lg font-semibold leading-tight text-foreground">
              {title}
            </h2>
            <p className="text-[13px] leading-body text-muted-foreground">{subtitle}</p>
          </div>

          <form className="flex flex-col gap-3.5" onSubmit={(event) => event.preventDefault()}>
            {fields.map((field) => (
              <div key={field.id} className="flex flex-col gap-1.5">
                <label htmlFor={field.id} className="text-[13px] font-medium text-muted-foreground">
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type={field.type}
                  placeholder={field.label}
                  className="h-11 w-full rounded-[10px] border border-border bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-primary/15"
                />
              </div>
            ))}

            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('login.cancel')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('login.confirm')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/** 아이디 저장 localStorage 키. 체크 시 마지막 시도 아이디를 기억한다. */
const SAVED_USER_ID_KEY = 'nori-tc:savedUserId'

export function LoginPage() {
  const { t } = useI18n()
  const { form, onSubmit, isPending, serverErrorMessage, resetServerError } = useLogin()
  const {
    register,
    setValue,
    getValues,
    formState: { errors },
  } = form

  const [showPassword, setShowPassword] = useState(false)
  const [rememberId, setRememberId] = useState(
    () => Boolean(window.localStorage.getItem(SAVED_USER_ID_KEY)),
  )
  const [activeModal, setActiveModal] = useState<RecoveryModalType>(null)

  /** 마운트 시 저장된 아이디를 폼에 채운다 (RHF 외부 상태 갱신). */
  useEffect(() => {
    const savedUserId = window.localStorage.getItem(SAVED_USER_ID_KEY)
    if (savedUserId) {
      setValue('userId', savedUserId)
    }
  }, [setValue])

  /** 모달 열린 상태에서 ESC 로 닫기. */
  useEffect(() => {
    if (!activeModal) {
      return
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveModal(null)
      }
    }

    window.addEventListener('keydown', handleEscapeKey)
    return () => {
      window.removeEventListener('keydown', handleEscapeKey)
    }
  }, [activeModal])

  const userIdField = register('userId', { onChange: () => resetServerError() })
  const passwordField = register('password', { onChange: () => resetServerError() })

  /** submit 직전 '아이디 저장' 상태를 localStorage 에 반영. */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (rememberId) {
      const currentUserId = getValues('userId').trim()
      if (currentUserId) {
        window.localStorage.setItem(SAVED_USER_ID_KEY, currentUserId)
      }
    } else {
      window.localStorage.removeItem(SAVED_USER_ID_KEY)
    }
    void onSubmit(event)
  }

  const forgotLinkClass =
    'text-[13px] font-medium text-muted-foreground transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm'

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-muted px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,color-mix(in_oklch,var(--color-brand-primary)7%,transparent),transparent_45%),radial-gradient(circle_at_85%_85%,color-mix(in_oklch,var(--color-brand-primary)4%,transparent),transparent_45%)]"
      />

      <section className="relative w-full max-w-125 rounded-[20px] border border-border bg-card px-12 pb-12 pt-14 shadow-soft-lg">
        <div className="mb-8">
          <BrandMark />
        </div>

        <h1 className="mb-7 text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          {t('login.title')}
        </h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="userId" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('login.idLabel')}
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden="true"
              />
              <input
                id="userId"
                type="text"
                autoComplete="username"
                placeholder={t('login.idPlaceholder')}
                aria-invalid={Boolean(errors.userId)}
                className="h-13 w-full rounded-[10px] border border-border bg-card pl-11 pr-3.5 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground/60 focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-primary/15 aria-invalid:border-danger"
                {...userIdField}
              />
            </div>
            {errors.userId && (
              <p role="alert" className="mt-1.5 text-xs text-danger">
                {errors.userId.message}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-muted-foreground">
              {t('login.pwLabel')}
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground/70"
                aria-hidden="true"
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('login.pwPlaceholder')}
                aria-invalid={Boolean(errors.password)}
                className="h-13 w-full rounded-[10px] border border-border bg-card pl-11 pr-12 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground/60 focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-primary/15 aria-invalid:border-danger"
                {...passwordField}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t('login.pwHide') : t('login.pwShow')}
                className="absolute right-2 top-1/2 flex size-7.5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
              </button>
            </div>
            {errors.password && (
              <p role="alert" className="mt-1.5 text-xs text-danger">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="mb-7 mt-5 flex items-center justify-between">
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberId}
                onChange={(event) => setRememberId(event.target.checked)}
                className="size-4 rounded accent-brand-primary"
              />
              <span>{t('login.rememberId')}</span>
            </label>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => setActiveModal('forgotId')} className={forgotLinkClass}>
                {t('login.findId')}
              </button>
              <span className="text-xs text-muted-foreground/40" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                onClick={() => setActiveModal('forgotPassword')}
                className={forgotLinkClass}
              >
                {t('login.findPw')}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? (
              <Loader2 className="size-4.5 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="size-4.5" aria-hidden="true" />
            )}
            <span>{t('login.submit')}</span>
          </button>

          <div className="text-center" aria-live="polite">
            {serverErrorMessage ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {serverErrorMessage}
              </p>
            ) : null}
          </div>
        </form>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground">
          <span>{t('login.copyright')}</span>
          <LanguageToggle placement="up" />
        </div>
      </section>

      {activeModal ? <RecoveryModal type={activeModal} onClose={() => setActiveModal(null)} /> : null}
    </div>
  )
}
