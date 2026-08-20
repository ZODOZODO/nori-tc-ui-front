import { resolveDateLocale } from '@/shared/lib/date-locale'
import type { DeployStatus } from '../types/deploy.types'

export const resolveStatusVariant = (status: DeployStatus) => {
  switch (status) {
    case 'FAILED':
    case 'PARTIAL_FAILED':
      return 'warning'
    case 'RUNNING':
      return 'info'
    case 'READY':
    case 'PLANNING':
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
