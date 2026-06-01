import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/i18n-context'

function ConfirmDialogRoot({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="confirm-dialog" {...props} />
}

function ConfirmDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="confirm-dialog-trigger" {...props} />
}

function ConfirmDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="confirm-dialog-portal" {...props} />
}

function ConfirmDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="confirm-dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out',
        className,
      )}
      {...props}
    />
  )
}

function ConfirmDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <ConfirmDialogPortal>
      <ConfirmDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="confirm-dialog-content"
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-popover p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out',
          className,
        )}
        {...props}
      />
    </ConfirmDialogPortal>
  )
}

function ConfirmDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="confirm-dialog-header"
      className={cn('flex flex-col gap-1.5 text-left', className)}
      {...props}
    />
  )
}

function ConfirmDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="confirm-dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function ConfirmDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="confirm-dialog-title"
      className={cn('text-lg leading-none font-semibold text-foreground', className)}
      {...props}
    />
  )
}

function ConfirmDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="confirm-dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

function ConfirmDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action data-slot="confirm-dialog-action" className={className} {...props} />
  )
}

function ConfirmDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel data-slot="confirm-dialog-cancel" className={className} {...props} />
  )
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string | null
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'default' | 'destructive'
  isConfirming?: boolean
  confirmDisabled?: boolean
  cancelDisabled?: boolean
  children?: React.ReactNode
  onConfirm: () => void | Promise<void>
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  confirmVariant = 'default',
  isConfirming = false,
  confirmDisabled = false,
  cancelDisabled = false,
  children,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useI18n()
  const resolvedConfirmText = confirmText ?? t('common.confirm')
  const resolvedCancelText = cancelText ?? t('common.cancel')
  return (
    <ConfirmDialogRoot open={open} onOpenChange={onOpenChange}>
      <ConfirmDialogContent>
        <ConfirmDialogHeader>
          <ConfirmDialogTitle>{title}</ConfirmDialogTitle>
          {description ? <ConfirmDialogDescription>{description}</ConfirmDialogDescription> : null}
        </ConfirmDialogHeader>
        {children}
        <ConfirmDialogFooter>
          <ConfirmDialogCancel asChild disabled={cancelDisabled || isConfirming}>
            <Button variant="outline">{resolvedCancelText}</Button>
          </ConfirmDialogCancel>
          <ConfirmDialogAction asChild>
            <Button
              variant={confirmVariant === 'destructive' ? 'destructive' : 'default'}
              disabled={confirmDisabled || isConfirming}
              onClick={onConfirm}
            >
              {isConfirming ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {resolvedConfirmText}
            </Button>
          </ConfirmDialogAction>
        </ConfirmDialogFooter>
      </ConfirmDialogContent>
    </ConfirmDialogRoot>
  )
}

export {
  ConfirmDialog,
  ConfirmDialogAction,
  ConfirmDialogCancel,
  ConfirmDialogContent,
  ConfirmDialogDescription,
  ConfirmDialogFooter,
  ConfirmDialogHeader,
  ConfirmDialogOverlay,
  ConfirmDialogPortal,
  ConfirmDialogRoot,
  ConfirmDialogTitle,
  ConfirmDialogTrigger,
}
