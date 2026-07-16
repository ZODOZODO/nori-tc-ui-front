import type { EqpInfo, EqpRuntimeState } from '../types/eqp.types'

export type EquipmentVisualState = 'offline' | 'attention' | 'idle' | 'run'

export interface EqpLifecycleCommandVisibility {
  canStart: boolean
  canEnd: boolean
  canRestart: boolean
  canReconnect: boolean
}

const OFFLINE_CONTROL_STATES = new Set(['DOWN', 'OFFLINE', 'DISCONNECTED'])
const ONLINE_CONTROL_STATES = new Set(['LOCAL', 'REMOTE'])

const normalizeState = (value: string | null | undefined): string => value?.trim().toUpperCase() ?? ''

/**
 * UI 색상은 gateway가 저장한 controlState + eqpState 조합을 기준으로 판단하되,
 * 끊김 상태에서는 desiredState 를 함께 보아 stuck(STARTED+끊김)을 정상-off 와 구분합니다.
 */
export const resolveEquipmentVisualState = (
  runtimeState: EqpRuntimeState | null,
): EquipmentVisualState => {
  const controlState = normalizeState(runtimeState?.controlState)
  const eqpState = normalizeState(runtimeState?.eqpState)
  const desiredState = normalizeState(runtimeState?.desiredState)

  if (!controlState || OFFLINE_CONTROL_STATES.has(controlState) || !ONLINE_CONTROL_STATES.has(controlState)) {
    // 끊김: 운영자 의도가 STARTED 인데 실제로는 끊긴 stuck 은 정상-off(ENDED)와 구분해 '주의'로 렌더한다.
    return desiredState === 'STARTED' ? 'attention' : 'offline'
  }

  if (eqpState === 'RUN') {
    return 'run'
  }

  if (eqpState === 'IDLE') {
    return 'idle'
  }

  return 'attention'
}

export const isActiveEquipment = (eqp: EqpInfo): boolean =>
  normalizeState(eqp.commMode) === 'ACTIVE'

export const isConnectedControlState = (runtimeState: EqpRuntimeState | null): boolean =>
  ONLINE_CONTROL_STATES.has(normalizeState(runtimeState?.controlState))

export const resolveLifecycleCommandVisibility = (
  eqp: EqpInfo,
  runtimeState: EqpRuntimeState | null,
): EqpLifecycleCommandVisibility => {
  if (!isActiveEquipment(eqp)) {
    return {
      canStart: false,
      canEnd: false,
      canRestart: false,
      canReconnect: false,
    }
  }

  // desired_state 와 control_state 를 둘 다 본 matrix (control 단독 proxy 제거):
  // - 끊김 + ENDED  → start (신규 연결)
  // - 끊김 + STARTED(stuck) → reconnect (EQP_START 는 desired!=ENDED 거부라 start 불가)
  // - 연결됨 → end / restart
  const connected = isConnectedControlState(runtimeState)
  const started = normalizeState(runtimeState?.desiredState) === 'STARTED'
  return {
    canStart: !connected && !started,
    canEnd: connected || started,
    canRestart: connected,
    canReconnect: !connected && started,
  }
}
