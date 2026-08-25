import i18n from '@/i18n'
import { resolveDateLocale } from '@/shared/lib/date-locale'
import { UNKNOWN_SERVER_STATUS, type DeployStatus } from '../types/deploy.types'

/**
 * 배포 상태를 화면 라벨로 바꿉니다.
 *
 * <p>지원하지 않는 protocol status 는 "알 수 없는 서버 상태" 로 드러냅니다 — 성공·실패를
 * 추정하지 않습니다(§14.3).</p>
 */
export const resolveDeployStatusLabel = (status: string): string =>
  status === UNKNOWN_SERVER_STATUS ? i18n.t('deploy.status.unknown') : status

export const resolveStatusVariant = (status: DeployStatus) => {
  switch (status) {
    case 'FAILED':
    case 'PARTIAL_FAILED':
    case 'REPAIR_REQUIRED':
      return 'warning'
    case 'RUNNING':
    case 'RECONCILING':
    case 'FINALIZING':
      return 'info'
    case 'READY':
    case 'PLANNING':
      return 'secondary'
    // 모르는 서버 상태는 성공(default)으로 보이면 안 된다 — 중립 표기로 남긴다(§14.3).
    case UNKNOWN_SERVER_STATUS:
      return 'secondary'
    default:
      return 'default'
  }
}

export const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat(resolveDateLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
