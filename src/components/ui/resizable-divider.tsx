import { useCallback, useRef } from 'react'
import { GripHorizontal } from 'lucide-react'

interface ResizableDividerProps {
  /**
   * 드래그 시 Y축 이동량(px)을 전달하는 콜백입니다.
   * 양수 = 아래로 이동 (상단 패널 확대), 음수 = 위로 이동 (상단 패널 축소)
   */
  onDrag: (deltaY: number) => void
}

/**
 * 위아래 패널 사이의 드래그 핸들 컴포넌트입니다.
 *
 * mousedown 이벤트로 드래그를 시작하고, document의 mousemove로 deltaY를 계산해
 * onDrag 콜백으로 전달합니다. touchmove도 지원합니다.
 * 컴포넌트 언마운트 또는 드래그 종료 시 document 이벤트 리스너를 반드시 정리합니다.
 */
export function ResizableDivider({ onDrag }: ResizableDividerProps) {
  // 드래그 시작 Y 좌표를 ref로 추적 (리렌더링 없이 유지)
  const dragStartYRef = useRef<number | null>(null)

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (dragStartYRef.current === null) {
        return
      }
      const deltaY = event.clientY - dragStartYRef.current
      dragStartYRef.current = event.clientY
      onDrag(deltaY)
    },
    [onDrag],
  )

  const handleMouseUp = useCallback(() => {
    dragStartYRef.current = null
    document.removeEventListener('mousemove', handleMouseMove)
    // 드래그 중 텍스트 선택 방지 해제
    document.body.style.userSelect = ''
  }, [handleMouseMove])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      dragStartYRef.current = event.clientY
      // 드래그 중 텍스트 선택 방지
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp, { once: true })
    },
    [handleMouseMove, handleMouseUp],
  )

  // 터치 이벤트 지원
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (dragStartYRef.current === null) {
        return
      }
      const touch = event.touches[0]
      if (!touch) {
        return
      }
      const deltaY = touch.clientY - dragStartYRef.current
      dragStartYRef.current = touch.clientY
      onDrag(deltaY)
    },
    [onDrag],
  )

  const handleTouchEnd = useCallback(() => {
    dragStartYRef.current = null
    document.removeEventListener('touchmove', handleTouchMove)
    document.body.style.userSelect = ''
  }, [handleTouchMove])

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) {
        return
      }
      dragStartYRef.current = touch.clientY
      document.body.style.userSelect = 'none'
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd, { once: true })
    },
    [handleTouchMove, handleTouchEnd],
  )

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="패널 크기 조절 핸들"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className="flex h-3 w-full cursor-row-resize items-center justify-center border-y border-border bg-muted hover:bg-accent active:bg-accent"
    >
      <GripHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}
