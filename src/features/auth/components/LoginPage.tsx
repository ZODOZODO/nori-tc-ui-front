import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLogin } from '../hooks/useLogin'

type RecoveryModalType = 'forgotId' | 'forgotPassword' | null

interface RecoveryModalField {
  id: string
  label: string
  placeholder: string
  type?: 'text' | 'email'
}

interface RecoveryModalContent {
  icon: string
  title: string
  subtitle: string
  fields: RecoveryModalField[]
}

const RECOVERY_MODAL_CONTENTS: Record<Exclude<RecoveryModalType, null>, RecoveryModalContent> = {
  forgotPassword: {
    icon: '!',
    title: 'Reset Password',
    subtitle: 'Enter your ID and email to receive a password reset link.',
    fields: [
      { id: 'forgot-password-id', label: 'ID', placeholder: 'Enter your ID' },
      { id: 'forgot-password-email', label: 'Email', placeholder: 'Enter your email', type: 'email' },
    ],
  },
  forgotId: {
    icon: '?',
    title: 'Find Your ID',
    subtitle: 'Enter your details below and we will send your ID to your email.',
    fields: [
      { id: 'forgot-id-company', label: 'Company', placeholder: 'Enter your company' },
      { id: 'forgot-id-name', label: 'Full Name', placeholder: 'Enter your full name' },
      { id: 'forgot-id-email', label: 'Email', placeholder: 'Enter your email', type: 'email' },
    ],
  },
}

interface RecoveryModalProps {
  type: Exclude<RecoveryModalType, null>
  onClose: () => void
}

/**
 * Login Frame의 Forgot ID / Forgot Password 모달 UI를 그대로 반영한 컴포넌트입니다.
 * 현재 API 스펙이 제공되지 않아 입력값 제출 없이 닫기 동작만 제공합니다.
 */
function RecoveryModal({ type, onClose }: RecoveryModalProps) {
  const content = RECOVERY_MODAL_CONTENTS[type]

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 px-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${type}-title`}
        className="w-full max-w-[520px] rounded-2xl border border-border bg-card p-6 shadow-soft-lg"
      >
        <div className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-3">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[17px] bg-brand-primary/10">
              <span className="text-[18px] leading-none font-bold text-brand-primary">{content.icon}</span>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <h2 id={`${type}-title`} className="text-[22px] leading-tight font-bold text-foreground">
                {content.title}
              </h2>
              <p className="text-xs text-muted-foreground">{content.subtitle}</p>
            </div>
          </div>

          <form className="flex flex-col gap-3" onSubmit={(event) => event.preventDefault()}>
            {content.fields.map((field) => (
              <div key={field.id} className="flex flex-col gap-1.5">
                <label htmlFor={field.id} className="text-xs font-semibold text-foreground">
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type={field.type ?? 'text'}
                  className="h-11 w-full rounded-[10px] border border-border bg-muted px-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] border border-border bg-muted px-[10px] py-2 text-[13px] font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] bg-brand-primary px-[10px] py-2 text-[13px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                OK
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const {
    form: {
      register,
      formState: { errors },
    },
    onSubmit,
    isPending,
    serverErrorMessage,
    resetServerError,
  } = useLogin()
  const [activeModal, setActiveModal] = useState<RecoveryModalType>(null)

  /**
   * 모달이 열린 상태에서 ESC를 누르면 닫히도록 처리합니다.
   */
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

  const userIdField = register('userId', {
    onChange: () => {
      resetServerError()
    },
  })

  const passwordField = register('password', {
    onChange: () => {
      resetServerError()
    },
  })

  const openForgotIdModal = () => {
    console.info('[LoginPage] Open forgot ID modal')
    setActiveModal('forgotId')
  }

  const openForgotPasswordModal = () => {
    console.info('[LoginPage] Open forgot password modal')
    setActiveModal('forgotPassword')
  }

  const closeModal = () => {
    console.info('[LoginPage] Close recovery modal')
    setActiveModal(null)
  }

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-muted px-4 py-8 sm:px-6">
      <div className="absolute left-7 top-7 flex items-center gap-2.5 md:left-20 md:top-[38px]">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-brand-primary">
          <span className="font-fraunces text-xs text-brand-primary">N</span>
        </div>
        <span className="font-fraunces text-lg tracking-[3px] text-foreground">Nori-TC</span>
      </div>

      <section className="w-full md:w-[480px] lg:w-[400px]">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg md:p-12">
          <form className="flex flex-col gap-7" onSubmit={onSubmit} noValidate>
            <h1 className="text-center font-fraunces text-[32px] tracking-[-1px] text-foreground">
              Nori-TC
            </h1>

            <div className="flex flex-col gap-2">
              <label htmlFor="userId" className="text-[13px] font-medium text-muted-foreground">
                ID
              </label>
              <input
                id="userId"
                type="text"
                autoComplete="username"
                placeholder="Enter your ID"
                aria-invalid={Boolean(errors.userId)}
                className="h-12 w-full rounded-xl border border-border bg-muted px-4 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-danger"
                {...userIdField}
              />
              {errors.userId && (
                <p role="alert" className="text-xs text-danger">
                  {errors.userId.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-[13px] font-medium text-muted-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={Boolean(errors.password)}
                className="h-12 w-full rounded-xl border border-border bg-muted px-4 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-danger"
                {...passwordField}
              />
              {errors.password && (
                <p role="alert" className="text-xs text-danger">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="h-12 w-full rounded-pill bg-brand-primary text-[13px] font-medium text-white hover:bg-brand-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Log In
            </Button>

            <div className="min-h-5 text-center" aria-live="polite">
              {serverErrorMessage ? (
                <p role="alert" className="text-sm text-danger">
                  {serverErrorMessage}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={openForgotIdModal}
                className={`text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeModal === 'forgotId'
                    ? 'font-bold text-brand-primary'
                    : 'font-semibold text-muted-foreground'
                }`}
              >
                Forgot ID?
              </button>
              <span className="text-xs text-muted-foreground/60" aria-hidden="true">
                •
              </span>
              <button
                type="button"
                onClick={openForgotPasswordModal}
                className={`text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeModal === 'forgotPassword'
                    ? 'font-bold text-brand-primary'
                    : 'font-semibold text-muted-foreground'
                }`}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </section>

      {activeModal ? <RecoveryModal type={activeModal} onClose={closeModal} /> : null}
    </div>
  )
}
