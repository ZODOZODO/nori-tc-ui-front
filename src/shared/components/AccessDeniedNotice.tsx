import { ShieldAlert } from 'lucide-react'
import { useI18n } from '@/i18n/i18n-context'

interface AccessDeniedNoticeProps {
  /** 접근이 막힌 권한 코드. 운영자가 관리자에게 요청할 근거로 그대로 노출한다. */
  permissionCode?: string
}

/**
 * 권한 미보유 안내입니다(SPEC R11).
 *
 * <p>왜 막혔는지와 무엇이 필요한지를 알려준다. 로그인 화면으로 되돌리면 사용자는
 * 세션이 끊긴 것으로 오해한다.</p>
 */
export function AccessDeniedNotice({ permissionCode }: AccessDeniedNoticeProps) {
  const { t } = useI18n()

  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center p-6"
      data-testid="access-denied-notice"
    >
      <div className="flex max-w-120 flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-10 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-base font-semibold text-foreground">{t('accessDenied.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('accessDenied.description')}</p>
        {permissionCode ? (
          <p className="text-xs text-muted-foreground">
            {t('accessDenied.requiredPermission')}
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {permissionCode}
            </code>
          </p>
        ) : null}
      </div>
    </div>
  )
}
