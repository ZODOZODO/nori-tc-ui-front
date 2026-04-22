import type { EqpInfo, EqpRuntimeState } from '../types/eqp.types'

export type EquipmentVisualState = 'offline' | 'attention' | 'idle' | 'run'

export interface EqpLifecycleCommandVisibility {
  canStart: boolean
  canEnd: boolean
  canRestart: boolean
}

const OFFLINE_CONTROL_STATES = new Set(['DOWN', 'OFFLINE', 'DISCONNECTED'])
const ONLINE_CONTROL_STATES = new Set(['LOCAL', 'REMOTE'])

const normalizeState = (value: string | null | undefined): string => value?.trim().toUpperCase() ?? ''

/**
 * UI 색상은 gateway가 저장한 controlState + eqpState 조합만 기준으로 판단합니다.
 */
export const resolveEquipmentVisualState = (
  runtimeState: EqpRuntimeState | null,
): EquipmentVisualState => {
  const controlState = normalizeState(runtimeState?.controlState)
  const eqpState = normalizeState(runtimeState?.eqpState)

  if (!controlState || OFFLINE_CONTROL_STATES.has(controlState)) {
    return 'offline'
  }

  if (!ONLINE_CONTROL_STATES.has(controlState)) {
    return 'offline'
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
    }
  }

  const connected = isConnectedControlState(runtimeState)
  return {
    canStart: !connected,
    canEnd: connected,
    canRestart: connected,
  }
}
