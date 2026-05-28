import {
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { GripVertical } from 'lucide-react'

interface SidebarResizeHandleProps {
  onDrag: (deltaX: number) => void
}

/**
 * 좌우 사이드바 폭 조절에 사용하는 공통 드래그 핸들입니다.
 */
export function SidebarResizeHandle({ onDrag }: SidebarResizeHandleProps) {
  const dragStartXRef = useRef<number | null>(null)

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (dragStartXRef.current === null) {
        return
      }

      const deltaX = event.clientX - dragStartXRef.current
      onDrag(deltaX)
    },
    [onDrag],
  )

  const handleMouseUp = useCallback(() => {
    dragStartXRef.current = null
    document.removeEventListener('mousemove', handleMouseMove)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [handleMouseMove])

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      dragStartXRef.current = event.clientX
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp, { once: true })
    },
    [handleMouseMove, handleMouseUp],
  )

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (dragStartXRef.current === null) {
        return
      }

      const touch = event.touches[0]
      if (!touch) {
        return
      }

      const deltaX = touch.clientX - dragStartXRef.current
      onDrag(deltaX)
    },
    [onDrag],
  )

  const handleTouchEnd = useCallback(() => {
    dragStartXRef.current = null
    document.removeEventListener('touchmove', handleTouchMove)
    document.body.style.userSelect = ''
  }, [handleTouchMove])

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent) => {
      const touch = event.touches[0]
      if (!touch) {
        return
      }

      dragStartXRef.current = touch.clientX
      document.body.style.userSelect = 'none'
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd, { once: true })
    },
    [handleTouchMove, handleTouchEnd],
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="사이드바 크기 조절 핸들"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className="flex h-full w-3 cursor-col-resize items-center justify-center border-r border-border bg-background hover:bg-muted active:bg-accent"
    >
      <GripVertical className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}
