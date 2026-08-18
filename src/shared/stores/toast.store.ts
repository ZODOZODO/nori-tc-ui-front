import { create } from 'zustand'

export type ToastVariant = 'success' | 'error'

/** 화면 우하단에 잠깐 떴다 사라지는 알림 1건입니다. */
export interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (variant: ToastVariant, message: string) => void
  dismiss: (id: string) => void
}

// 모듈 스코프 단조 증가 카운터 — id 충돌 방지(Date/random 불필요).
let sequence = 0

/**
 * 앱 전역 토스트 알림 저장소입니다. 저장 성공/실패처럼 일시적으로 알릴 내용을 push 하면
 * {@code Toaster} 가 렌더하고 duration 경과 후 dismiss 합니다.
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (variant, message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: `toast-${(sequence += 1)}`, variant, message }],
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toastItem) => toastItem.id !== id) })),
}))

/** 컴포넌트 밖(훅 콜백 등)에서 토스트를 띄우는 헬퍼입니다. */
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
}
