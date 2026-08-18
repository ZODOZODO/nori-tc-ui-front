import { CheckCircle2, XCircle } from 'lucide-react'
import { Toast as ToastPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'
import { useToastStore } from '@/shared/stores/toast.store'

/** 토스트 자동 소멸 시간(ms). */
const TOAST_DURATION_MS = 3000

/**
 * 앱 전역 토스트 뷰포트입니다. {@code toast.success/error} 로 push 된 알림을 우하단에 쌓아 렌더하고
 * duration 경과(또는 스와이프) 시 스토어에서 제거합니다. 앱 루트(AppProvider)에서 한 번 마운트합니다.
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={TOAST_DURATION_MS}>
      {toasts.map((item) => {
        const isSuccess = item.variant === 'success'
        return (
          <ToastPrimitive.Root
            key={item.id}
            open
            onOpenChange={(open) => {
              if (!open) {
                dismiss(item.id)
              }
            }}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-md',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80',
              isSuccess
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-danger/40 bg-danger/10 text-danger',
            )}
          >
            {isSuccess ? (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 shrink-0" aria-hidden="true" />
            )}
            <ToastPrimitive.Title className="min-w-0 break-words">{item.message}</ToastPrimitive.Title>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  )
}
