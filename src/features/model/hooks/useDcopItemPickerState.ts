import { useCallback, useState } from 'react'

/**
 * {@link DcopItemPickerModal} 의 좌/우 선택 상태를 관리하는 pure logic hook 입니다.
 *
 * 좌측은 모달 안에서만 의미를 갖는 "체크된 후보" 집합 (Set<number>) 으로,
 * 우측은 "현재 Flow 에 binding 된 dcop_item_key 목록" 의 mutable 작업 사본
 * (number[]) 으로 보관합니다. PUT 시 우측 array 가 그대로 송신됩니다.
 *
 * State 변환 로직은 별도 pure 함수 ({@link toggleSelection} / {@link moveSelectionToRight}
 * / {@link removeFromRightArray}) 로 분리되어 hook 외부에서도 단위 테스트가 가능합니다.
 */
export interface DcopItemPickerState {
  /** 좌측에서 현재 체크된 dcop_item_key 집합. */
  leftSelection: ReadonlySet<number>
  /** 우측 (= 저장 시 송신될) dcop_item_key 누적 array. */
  rightItems: readonly number[]
  /** 좌측 체크 토글. 이미 우측에 있는 dcop_item 은 disabled 라 외부에서 호출되지 않음. */
  toggleLeftSelection: (dcopItemKey: number) => void
  /** 좌측 체크된 항목들을 우측 array 에 append 하고, 좌측 선택을 비웁니다. */
  moveSelectedToRight: () => void
  /** 우측 array 에서 1 행 제거 (Trash 클릭). */
  removeFromRight: (dcopItemKey: number) => void
  /** 외부에서 다시 모달을 열 때 초기 우측 array 로 리셋 (좌측 선택은 항상 비움). */
  reset: (initialRight: readonly number[]) => void
}

/**
 * leftSelection Set 에 키를 toggle 합니다 (있으면 제거, 없으면 추가).
 *
 * Pure 함수 — 입력 Set 을 수정하지 않고 새 Set 을 반환.
 */
export const toggleSelection = (
  previous: ReadonlySet<number>,
  dcopItemKey: number,
): ReadonlySet<number> => {
  const next = new Set(previous)
  if (next.has(dcopItemKey)) {
    next.delete(dcopItemKey)
  } else {
    next.add(dcopItemKey)
  }
  return next
}

/**
 * 좌측 체크된 항목들을 우측 array 에 append 합니다. 중복은 회피.
 *
 * Pure 함수 — 좌측이 변하지 않으면 우측 참조도 변하지 않음 (memo / Object.is 친화).
 */
export const moveSelectionToRight = (
  previousRight: readonly number[],
  leftSelection: ReadonlySet<number>,
): readonly number[] => {
  if (leftSelection.size === 0) {
    return previousRight
  }
  const existing = new Set(previousRight)
  const appended: number[] = []
  // Set 순회는 insertion order — 사용자가 체크한 순서대로 우측에 누적.
  for (const key of leftSelection) {
    if (!existing.has(key)) {
      appended.push(key)
      existing.add(key)
    }
  }
  if (appended.length === 0) {
    return previousRight
  }
  return [...previousRight, ...appended]
}

/**
 * 우측 array 에서 키 1 개를 제거합니다.
 *
 * Pure 함수 — 키가 없으면 입력 참조 그대로 반환.
 */
export const removeFromRightArray = (
  previousRight: readonly number[],
  dcopItemKey: number,
): readonly number[] => {
  const next = previousRight.filter((key) => key !== dcopItemKey)
  return next.length === previousRight.length ? previousRight : next
}

/**
 * 모달 안의 좌/우 선택 상태를 관리합니다.
 *
 * @param initialRight 모달 첫 mount 시점의 우측 array (= 현재 Flow 의 dcopItemKeys)
 */
export const useDcopItemPickerState = (
  initialRight: readonly number[],
): DcopItemPickerState => {
  const [leftSelection, setLeftSelection] = useState<ReadonlySet<number>>(() => new Set<number>())
  const [rightItems, setRightItems] = useState<readonly number[]>(() => [...initialRight])

  const toggleLeftSelection = useCallback((dcopItemKey: number) => {
    setLeftSelection((previous) => toggleSelection(previous, dcopItemKey))
  }, [])

  const moveSelectedToRight = useCallback(() => {
    setRightItems((previousRight) => moveSelectionToRight(previousRight, leftSelection))
    setLeftSelection(new Set<number>())
  }, [leftSelection])

  const removeFromRight = useCallback((dcopItemKey: number) => {
    setRightItems((previous) => removeFromRightArray(previous, dcopItemKey))
  }, [])

  const reset = useCallback((nextRight: readonly number[]) => {
    setRightItems([...nextRight])
    setLeftSelection(new Set<number>())
  }, [])

  return {
    leftSelection,
    rightItems,
    toggleLeftSelection,
    moveSelectedToRight,
    removeFromRight,
    reset,
  }
}
