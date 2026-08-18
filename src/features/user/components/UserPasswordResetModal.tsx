import { useEffect, useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n/i18n-context'
import { useResetPassword } from '../hooks/useUserMutations'
import { generateTemporaryPassword } from '../lib/password-generator'
import { notifyFailure } from '@/shared/lib/notify'

interface UserPasswordResetModalProps {
  open: boolean
  targetUserPk: number | null
  targetUserId: string | null
  onClose: () => void
}

type CopyState = 'idle' | 'success' | 'error'

/**
 * 비밀번호 초기화 모달입니다.
 * - 열릴 때 12자 랜덤 비밀번호를 생성하여 평문 1회 표시
 * - 클립보드 복사 버튼 제공
 * - 닫히면 본문 컴포넌트가 언마운트되어 비밀번호 state가 사라짐 — 다시 표시되지 않음
 */
export function UserPasswordResetModal({
  open,
  targetUserPk,
  targetUserId,
  onClose,
}: UserPasswordResetModalProps) {
  const isOpen = open && targetUserPk !== null

  return (
    <Dialog open={isOpen} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      {isOpen ? (
        <PasswordResetDialogBody
          targetUserPk={targetUserPk}
          targetUserId={targetUserId}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  )
}

interface PasswordResetDialogBodyProps {
  targetUserPk: number
  targetUserId: string | null
  onClose: () => void
}

/**
 * 모달이 열린 동안에만 마운트되는 본문입니다.
 * 비밀번호 생성/초기화 요청 상태를 마운트 수명과 일치시켜, 닫힘 시 별도 reset 로직 없이
 * 언마운트로 state가 정리됩니다.
 */
function PasswordResetDialogBody({
  targetUserPk,
  targetUserId,
  onClose,
}: PasswordResetDialogBodyProps) {
  const { t } = useI18n()
  const resetPasswordMutation = useResetPassword()
  const [generatedPassword] = useState(() => generateTemporaryPassword())
  const [resetStatus, setResetStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const submit = async () => {
      try {
        await resetPasswordMutation.mutateAsync({
          userPk: targetUserPk,
          request: { newPassword: generatedPassword },
        })
        if (!cancelled) {
          setResetStatus('success')
        }
      } catch (error) {
        if (cancelled) {
          return
        }
        setResetStatus('error')
        setErrorMessage(notifyFailure(error, t('user.passwordReset.error')))
      }
    }

    void submit()

    return () => {
      cancelled = true
    }
    // resetPasswordMutation 은 안정적이지 않은 참조라 의도적으로 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserPk, generatedPassword])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword)
      setCopyState('success')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <DialogContent className="max-w-120">
      <DialogHeader>
        <DialogTitle>{t('user.passwordReset.title')}</DialogTitle>
        <DialogDescription>
          {targetUserId
            ? t('user.passwordReset.doneWithId', { userId: targetUserId })
            : t('user.passwordReset.done')}
          <br />
          {t('user.passwordReset.warning')}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2">
        <input
          data-testid="user-password-reset-value"
          readOnly
          value={generatedPassword}
          className="h-11 w-full rounded-md border border-input bg-muted px-3 font-mono text-base text-foreground"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleCopy()}
          data-testid="user-password-reset-copy"
          aria-label={t('user.passwordReset.copyAria')}
        >
          <Copy className="size-4" aria-hidden="true" />
          {t('user.passwordReset.copy')}
        </Button>
      </div>

      {resetStatus === 'pending' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('user.passwordReset.applying')}
        </p>
      ) : null}

      {resetStatus === 'error' && errorMessage ? (
        <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      {copyState === 'success' ? (
        <p className="text-xs text-success">{t('user.passwordReset.copied')}</p>
      ) : null}
      {copyState === 'error' ? (
        <p className="text-xs text-danger">{t('user.passwordReset.copyFailed')}</p>
      ) : null}

      <DialogFooter>
        <Button type="button" onClick={onClose} disabled={resetStatus === 'pending'}>
          {t('common.close')}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
