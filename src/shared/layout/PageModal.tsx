import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface PageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 모달 제목 (header). */
  title: string
  /** 제목 아래 보조 설명. */
  description?: string
  /** 모달 본문. */
  children: ReactNode
  /** footer 의 CTA (우측 정렬). 생략 시 footer 미표시. */
  footer?: ReactNode
  /** DialogContent 폭 등 추가 클래스. */
  className?: string
  footerClassName?: string
}

/**
 * nori-client `components/common_page_modal.jsx` (reactstrap Modal — centered + Header(close)
 * + Body + Footer(CTA 우측)) 의 시각 패턴을 ui-front 의 [dialog.tsx](../../components/ui/dialog.tsx)
 * 를 **확장(compose)** 하여 구현 (대체 금지 — confirm-dialog 등 기존 사용처 영향 차단).
 *
 * 2026 재해석 (D10): 단일 큰 그림자 → `shadow-soft-lg` 다단 soft shadow. close button / overlay /
 * radix aria 는 dialog.tsx 의 것을 그대로 승계 (a11y).
 */
export function PageModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  footerClassName,
}: PageModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('shadow-soft-lg', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 overflow-hidden text-sm leading-body text-foreground">{children}</div>
        {footer ? <DialogFooter className={footerClassName}>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}
