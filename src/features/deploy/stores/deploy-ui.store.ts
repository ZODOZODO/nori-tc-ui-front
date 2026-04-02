import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  createDeployName,
  createDeployTargetSummary,
  isTerminalDeployStatus,
  resolveDeployStatusFromTargets,
} from '../lib/deploy-utils'
import type {
  CreateLocalDeployInput,
  DeployEventType,
  DeployHistoryItem,
  DeployMode,
  DeployMonitorFilters,
  DeployRegisterFilters,
  DeployRegisterTargetItem,
  DeploySummary,
  DeployTargetItem,
} from '../types/deploy.types'

interface DeployUiState {
  mode: DeployMode
  selectedEqpIds: string[]
  selectedEqpTargetsById: Record<string, DeployRegisterTargetItem>
  selectedEqpParamVersions: Record<string, string>
  selectedInterfaceType: DeployRegisterTargetItem['commInterface'] | null
  activeDeployKey: number | null
  deployListOffset: number
  historyListOffset: number
  serverBackedDeployKeys: number[]
  serverBridgeCreatedAtByDeployKey: Record<number, string>
  localHistory: DeployHistoryItem[]
  localTargetsByDeployKey: Record<number, DeployTargetItem[]>
  registerFilters: DeployRegisterFilters
  hasSubmittedRegisterSearch: boolean
  registerSearchRevision: number
  monitorFilters: DeployMonitorFilters
  selectedModelName: string | null
  selectedModelVersionKey: number | null
  selectedBusinessJarRef: number | null
  isProfileModalOpen: boolean
  setMode: (mode: DeployMode) => void
  submitRegisterSearch: (filters: DeployRegisterFilters) => void
  resetRegisterFilters: () => void
  setMonitorFilters: (filters: Partial<DeployMonitorFilters>) => void
  resetMonitorFilters: () => void
  setMonitorListOffset: (historyOnly: boolean, offset: number) => void
  resetMonitorListOffsets: () => void
  addSelectedEqps: (targets: DeployRegisterTargetItem[]) => void
  syncSelectedEqpTargets: (targets: DeployRegisterTargetItem[]) => void
  removeSelectedEqp: (eqpId: string) => void
  removeSelectedEqps: (eqpIds: string[]) => void
  clearSelectedEqps: () => void
  setSelectedEqpParamVersion: (eqpId: string, eqpParamVersion: string) => void
  setSelectedModelName: (modelName: string | null) => void
  setSelectedModelVersionKey: (modelVersionKey: number | null) => void
  setSelectedBusinessJarRef: (jarRef: number | null) => void
  setActiveDeployKey: (deployKey: number | null) => void
  createServerDeployBridge: (summary: {
    deployKey: number
    deployStatus: DeployHistoryItem['deployStatus']
    requestedBy: string
    selectedModelName?: string | null
    selectedModelVersion: string | null
    selectedBusinessJarName: string | null
    eventType?: DeployEventType
    interfaceType?: DeployRegisterTargetItem['commInterface'] | null
    targetCount?: number
    eqpIds?: string[]
    activateMode?: boolean
  }) => void
  markDeployStatus: (
    deployKey: number,
    deployStatus: DeployHistoryItem['deployStatus'],
    pauseRequested?: boolean,
  ) => void
  applyDeploySummary: (summary: DeploySummary) => void
  applyDeployTargets: (deployKey: number, targets: DeployTargetItem[]) => void
  createLocalDeploy: (input: CreateLocalDeployInput) => number | null
  redeployLocalHistoryItem: (deployKey: number) => number | null
  deleteLocalDeploy: (deployKey: number) => void
  reconcileServerHistory: (serverDeployKeys: number[]) => void
  clearRegisterState: () => void
  resetPageState: () => void
  setProfileModalOpen: (open: boolean) => void
}

const toDateInputValue = (date: Date): string => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

const EMPTY_REGISTER_FILTERS: DeployRegisterFilters = {
  modelName: '',
  modelVersionKey: null,
  eqpId: '',
}

export const createDefaultMonitorFilters = (): DeployMonitorFilters => {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(today.getDate() - 7)

  return {
    modelName: '',
    requestedBy: '',
    fromDate: toDateInputValue(weekAgo),
    toDate: toDateInputValue(today),
  }
}

const DEPLOY_UI_STORAGE_KEY = 'deploy-ui-state'
const createInitialDeployUiDataState = () => ({
  mode: 'register' as DeployMode,
  selectedEqpIds: [] as string[],
  selectedEqpTargetsById: {} as Record<string, DeployRegisterTargetItem>,
  selectedEqpParamVersions: {} as Record<string, string>,
  selectedInterfaceType: null as DeployRegisterTargetItem['commInterface'] | null,
  activeDeployKey: null as number | null,
  deployListOffset: 0,
  historyListOffset: 0,
  serverBackedDeployKeys: [] as number[],
  serverBridgeCreatedAtByDeployKey: {} as Record<number, string>,
  localHistory: [] as DeployHistoryItem[],
  localTargetsByDeployKey: {} as Record<number, DeployTargetItem[]>,
  registerFilters: EMPTY_REGISTER_FILTERS,
  hasSubmittedRegisterSearch: false,
  registerSearchRevision: 0,
  monitorFilters: createDefaultMonitorFilters(),
  selectedModelName: null as string | null,
  selectedModelVersionKey: null as number | null,
  selectedBusinessJarRef: null as number | null,
  isProfileModalOpen: false,
})
const resolveInterfaceType = (
  eqpIds: string[],
  selectedEqpTargetsById: Record<string, DeployRegisterTargetItem>,
): DeployRegisterTargetItem['commInterface'] | null => {
  if (eqpIds.length === 0) {
    return null
  }

  const interfaceTypes = [
    ...new Set(
      eqpIds
        .map((eqpId) => selectedEqpTargetsById[eqpId]?.commInterface)
        .filter(
          (commInterface): commInterface is DeployRegisterTargetItem['commInterface'] =>
            typeof commInterface === 'string',
        ),
    ),
  ]

  return interfaceTypes.length === 1 && interfaceTypes.length === eqpIds.length ? interfaceTypes[0] : null
}

const nextDeployKey = (history: DeployHistoryItem[]): number =>
  history.reduce((maxKey, item) => Math.max(maxKey, item.deployKey), 7100) + 1

const createBridgeTargets = (
  deployKey: number,
  eqpIds: string[],
  selectedEqpTargetsById: Record<string, DeployRegisterTargetItem>,
  deployStatus: DeployHistoryItem['deployStatus'],
): DeployTargetItem[] =>
  eqpIds.map((eqpId, index) => ({
    deployTargetKey: deployKey * 100 + index + 1,
    eqpId,
    modelName: selectedEqpTargetsById[eqpId]?.modelName ?? 'Unknown Model',
    targetStatus: deployStatus === 'RUNNING' && index === 0 ? 'RUNNING' : 'PENDING',
    currentStepOrder: deployStatus === 'RUNNING' && index === 0 ? 10 : 0,
    currentStepCode: deployStatus === 'RUNNING' && index === 0 ? 'PREPARE_REQUEST' : 'QUEUED',
    currentStepStatus: deployStatus === 'RUNNING' && index === 0 ? 'RUNNING' : 'PENDING',
    rollbackRequired: false,
    lastErrorMessage: null,
    updatedAt: new Date().toISOString(),
  }))

const createPlaceholderTargetSummary = (
  targetCount: number,
  deployStatus: DeployHistoryItem['deployStatus'],
) => {
  if (deployStatus === 'RUNNING') {
    return {
      total: targetCount,
      pending: Math.max(targetCount - 1, 0),
      noChange: 0,
      running: targetCount > 0 ? 1 : 0,
      completed: 0,
      failed: 0,
      rollingBack: 0,
      rolledBack: 0,
      compensationFailed: 0,
      canceled: 0,
    }
  }

  if (deployStatus === 'PLANNING' || deployStatus === 'READY') {
    return {
      total: targetCount,
      pending: targetCount,
      noChange: 0,
      running: 0,
      completed: 0,
      failed: 0,
      rollingBack: 0,
      rolledBack: 0,
      compensationFailed: 0,
      canceled: 0,
    }
  }

  if (deployStatus === 'CANCELED') {
    return {
      total: targetCount,
      pending: 0,
      noChange: 0,
      running: 0,
      completed: 0,
      failed: 0,
      rollingBack: 0,
      rolledBack: 0,
      compensationFailed: 0,
      canceled: targetCount,
    }
  }

  if (deployStatus === 'COMPLETED') {
    return {
      total: targetCount,
      pending: 0,
      noChange: 0,
      running: 0,
      completed: targetCount,
      failed: 0,
      rollingBack: 0,
      rolledBack: 0,
      compensationFailed: 0,
      canceled: 0,
    }
  }

  return {
    total: targetCount,
    pending: 0,
    noChange: 0,
    running: 0,
    completed: 0,
    failed: targetCount,
    rollingBack: 0,
    rolledBack: 0,
    compensationFailed: 0,
    canceled: 0,
  }
}

const createServerBridgeHistoryItem = (input: {
  deployKey: number
  deployStatus: DeployHistoryItem['deployStatus']
  requestedBy: string
  selectedModelName: string | null
  selectedModelVersion: string | null
  selectedBusinessJarName: string | null
  eventType: DeployEventType
  interfaceType: DeployRegisterTargetItem['commInterface'] | null
  targets: DeployTargetItem[]
  targetCount: number
}): DeployHistoryItem => {
  const createdAt = new Date().toISOString()

  return {
    deployKey: input.deployKey,
    deployName: createDeployName(input.selectedModelName, input.selectedModelVersion),
    eventType: input.eventType,
    deployStatus: input.deployStatus,
    pauseRequested: false,
    executionPolicy: 'BEST_EFFORT',
    requestedBy: input.requestedBy,
    createdAt,
    startedAt:
      input.deployStatus === 'READY' || input.deployStatus === 'PLANNING' ? null : createdAt,
    finishedAt: null,
    terminal: isTerminalDeployStatus(input.deployStatus),
    interfaceType: input.interfaceType,
    selectedModelName: input.selectedModelName,
    selectedModelVersion: input.selectedModelVersion,
    selectedBusinessJarName: input.selectedBusinessJarName,
    targetSummary:
      input.targets.length > 0
        ? createDeployTargetSummary(input.targets)
        : createPlaceholderTargetSummary(input.targetCount, input.deployStatus),
  }
}

const mergeHistoryItem = (
  history: DeployHistoryItem[],
  nextHistoryItem: DeployHistoryItem,
): DeployHistoryItem[] => {
  const hasExisting = history.some((item) => item.deployKey === nextHistoryItem.deployKey)

  if (!hasExisting) {
    return [nextHistoryItem, ...history]
  }

  return history.map((item) => (item.deployKey === nextHistoryItem.deployKey ? nextHistoryItem : item))
}

export const useDeployUiStore = create<DeployUiState>()(
  persist(
    (set, get) => ({
      ...createInitialDeployUiDataState(),
      setMode: (mode) => set({ mode }),
      submitRegisterSearch: (filters) =>
        set((state) => ({
          registerFilters: filters,
          hasSubmittedRegisterSearch: true,
          registerSearchRevision: state.registerSearchRevision + 1,
        })),
      resetRegisterFilters: () =>
        set({
          registerFilters: EMPTY_REGISTER_FILTERS,
          hasSubmittedRegisterSearch: false,
        }),
      setMonitorFilters: (filters) =>
        set((state) => ({
          monitorFilters: {
            ...state.monitorFilters,
            ...filters,
          },
        })),
      resetMonitorFilters: () => set({ monitorFilters: createDefaultMonitorFilters() }),
      setMonitorListOffset: (historyOnly, offset) =>
        set(historyOnly ? { historyListOffset: Math.max(0, offset) } : { deployListOffset: Math.max(0, offset) }),
      resetMonitorListOffsets: () => set({ deployListOffset: 0, historyListOffset: 0 }),
      addSelectedEqps: (targets) =>
        set((state) => {
          const currentSelectedEqpIdSet = new Set(state.selectedEqpIds)
          const nextSelectedEqpTargetsById = { ...state.selectedEqpTargetsById }

          for (const target of targets) {
            currentSelectedEqpIdSet.add(target.eqpId)
            nextSelectedEqpTargetsById[target.eqpId] = target
          }

          const nextSelectedEqpIds = [...currentSelectedEqpIdSet]

          return {
            selectedEqpIds: nextSelectedEqpIds,
            selectedEqpTargetsById: nextSelectedEqpTargetsById,
            selectedInterfaceType: resolveInterfaceType(
              nextSelectedEqpIds,
              nextSelectedEqpTargetsById,
            ),
          }
        }),
      syncSelectedEqpTargets: (targets) =>
        set((state) => {
          if (targets.length === 0) {
            return state
          }

          const nextSelectedEqpTargetsById = { ...state.selectedEqpTargetsById }

          for (const target of targets) {
            if (state.selectedEqpIds.includes(target.eqpId)) {
              nextSelectedEqpTargetsById[target.eqpId] = target
            }
          }

          return {
            selectedEqpTargetsById: nextSelectedEqpTargetsById,
            selectedInterfaceType: resolveInterfaceType(
              state.selectedEqpIds,
              nextSelectedEqpTargetsById,
            ),
          }
        }),
      removeSelectedEqp: (eqpId) =>
        set((state) => {
          const nextSelectedEqpIds = state.selectedEqpIds.filter((item) => item !== eqpId)
          const nextSelectedEqpTargetsById = { ...state.selectedEqpTargetsById }
          const nextSelectedEqpParamVersions = { ...state.selectedEqpParamVersions }
          delete nextSelectedEqpTargetsById[eqpId]
          delete nextSelectedEqpParamVersions[eqpId]

          return {
            selectedEqpIds: nextSelectedEqpIds,
            selectedEqpTargetsById: nextSelectedEqpTargetsById,
            selectedEqpParamVersions: nextSelectedEqpParamVersions,
            selectedInterfaceType: resolveInterfaceType(
              nextSelectedEqpIds,
              nextSelectedEqpTargetsById,
            ),
          }
        }),
      removeSelectedEqps: (eqpIds) =>
        set((state) => {
          if (eqpIds.length === 0) {
            return state
          }

          const removeSet = new Set(eqpIds)
          const nextSelectedEqpIds = state.selectedEqpIds.filter((eqpId) => !removeSet.has(eqpId))
          const nextSelectedEqpTargetsById = { ...state.selectedEqpTargetsById }
          const nextSelectedEqpParamVersions = { ...state.selectedEqpParamVersions }

          for (const eqpId of removeSet) {
            delete nextSelectedEqpTargetsById[eqpId]
            delete nextSelectedEqpParamVersions[eqpId]
          }

          return {
            selectedEqpIds: nextSelectedEqpIds,
            selectedEqpTargetsById: nextSelectedEqpTargetsById,
            selectedEqpParamVersions: nextSelectedEqpParamVersions,
            selectedInterfaceType: resolveInterfaceType(
              nextSelectedEqpIds,
              nextSelectedEqpTargetsById,
            ),
          }
        }),
      clearSelectedEqps: () =>
        set({
          selectedEqpIds: [],
          selectedEqpTargetsById: {},
          selectedEqpParamVersions: {},
          selectedInterfaceType: null,
        }),
      setSelectedEqpParamVersion: (eqpId, eqpParamVersion) =>
        set((state) => ({
          selectedEqpParamVersions: {
            ...state.selectedEqpParamVersions,
            [eqpId]: eqpParamVersion,
          },
        })),
      setSelectedModelName: (modelName) => set({ selectedModelName: modelName }),
      setSelectedModelVersionKey: (modelVersionKey) => set({ selectedModelVersionKey: modelVersionKey }),
      setSelectedBusinessJarRef: (jarRef) => set({ selectedBusinessJarRef: jarRef }),
      setActiveDeployKey: (deployKey) => set({ activeDeployKey: deployKey }),
      createServerDeployBridge: ({
        deployKey,
        deployStatus,
        requestedBy,
        selectedModelName,
        selectedModelVersion,
        selectedBusinessJarName,
        eventType,
        interfaceType,
        targetCount,
        eqpIds,
        activateMode = true,
      }) => {
        const state = get()
        const resolvedEqpIds = eqpIds ?? state.selectedEqpIds
        const targets = createBridgeTargets(
          deployKey,
          resolvedEqpIds,
          state.selectedEqpTargetsById,
          deployStatus,
        )
        const historyItem = createServerBridgeHistoryItem({
          deployKey,
          deployStatus,
          requestedBy,
          selectedModelName: selectedModelName ?? state.selectedModelName,
          selectedModelVersion,
          selectedBusinessJarName,
          eventType: eventType ?? 'EQP_REGISTER_DEPLOY',
          interfaceType: interfaceType ?? state.selectedInterfaceType,
          targets,
          targetCount: targetCount ?? resolvedEqpIds.length,
        })

        set({
          mode: activateMode
            ? isTerminalDeployStatus(deployStatus)
              ? 'history'
              : 'deploy'
            : state.mode,
          activeDeployKey: deployKey,
          deployListOffset: 0,
          historyListOffset: isTerminalDeployStatus(deployStatus) ? 0 : state.historyListOffset,
          serverBackedDeployKeys: [...new Set([...state.serverBackedDeployKeys, deployKey])],
          serverBridgeCreatedAtByDeployKey: {
            ...state.serverBridgeCreatedAtByDeployKey,
            [deployKey]: new Date().toISOString(),
          },
          localHistory: mergeHistoryItem(state.localHistory, historyItem),
          localTargetsByDeployKey: {
            ...state.localTargetsByDeployKey,
            [deployKey]: targets,
          },
        })
      },
      markDeployStatus: (deployKey, deployStatus, pauseRequested) =>
        set((state) => ({
          localHistory: state.localHistory.map((item) =>
            item.deployKey === deployKey
              ? {
                  ...item,
                  deployStatus,
                  pauseRequested:
                    typeof pauseRequested === 'boolean'
                      ? pauseRequested
                      : isTerminalDeployStatus(deployStatus)
                        ? false
                        : item.pauseRequested,
                  startedAt:
                    deployStatus === 'RUNNING' && !item.startedAt
                      ? new Date().toISOString()
                      : item.startedAt,
                  terminal: isTerminalDeployStatus(deployStatus),
                  finishedAt: isTerminalDeployStatus(deployStatus)
                    ? new Date().toISOString()
                    : item.finishedAt,
                }
              : item,
          ),
        })),
      applyDeploySummary: (summary) =>
        set((state) => ({
          localHistory: state.localHistory.map((item) =>
            item.deployKey === summary.deployKey
              ? {
                  ...item,
                  deployKey: summary.deployKey,
                  deployName: summary.deployName,
                  eventType: summary.eventType,
                  deployStatus: summary.deployStatus,
                  pauseRequested: summary.pauseRequested,
                  executionPolicy: summary.executionPolicy,
                  createdAt: summary.createdAt,
                  startedAt: summary.startedAt,
                  finishedAt: summary.finishedAt,
                  terminal: summary.terminal,
                  targetSummary: summary.targetSummary,
                }
              : item,
          ),
        })),
      applyDeployTargets: (deployKey, targets) =>
        set((state) => {
          const previousTargets = state.localTargetsByDeployKey[deployKey] ?? []
          const previousTargetMap = new Map(previousTargets.map((item) => [item.deployTargetKey, item]))

          return {
            localTargetsByDeployKey: {
              ...state.localTargetsByDeployKey,
              [deployKey]: targets.map((target) => {
                const previousTarget = previousTargetMap.get(target.deployTargetKey)
                return {
                  ...previousTarget,
                  ...target,
                  modelName: target.modelName ?? previousTarget?.modelName,
                  lastErrorCode: target.lastErrorCode ?? previousTarget?.lastErrorCode ?? null,
                  lastErrorMessage: target.lastErrorMessage ?? previousTarget?.lastErrorMessage ?? null,
                }
              }),
            },
          }
        }),
      createLocalDeploy: ({ requestedBy, selectedModelVersion, selectedBusinessJarName }) => {
        const state = get()

        if (
          state.selectedEqpIds.length === 0 ||
          state.selectedModelVersionKey === null ||
          state.selectedBusinessJarRef === null
        ) {
          return null
        }

        const deployKey = nextDeployKey(state.localHistory)
        const targets: DeployTargetItem[] = state.selectedEqpIds.map((eqpId, index) => ({
          deployTargetKey: deployKey * 100 + index + 1,
          eqpId,
          modelName: state.selectedEqpTargetsById[eqpId]?.modelName ?? 'Unknown Model',
          targetStatus: 'PENDING',
          currentStepOrder: 0,
          currentStepCode: 'QUEUED',
          currentStepStatus: 'PENDING',
          rollbackRequired: false,
          lastErrorMessage: null,
          updatedAt: '2026-03-31T10:00:00Z',
        }))
        const deployStatus = resolveDeployStatusFromTargets(targets)
        const historyItem: DeployHistoryItem = {
          deployKey,
          deployName: createDeployName(state.selectedModelName, selectedModelVersion),
          eventType: 'EQP_BUSINESS_JARFILE_UPDATE',
          deployStatus,
          pauseRequested: false,
          executionPolicy: 'BEST_EFFORT',
          requestedBy,
          createdAt: '2026-03-31T10:00:00Z',
          startedAt: null,
          finishedAt: isTerminalDeployStatus(deployStatus) ? '2026-03-31T10:00:40Z' : null,
          terminal: isTerminalDeployStatus(deployStatus),
          interfaceType: state.selectedInterfaceType,
          selectedModelName: state.selectedModelName,
          selectedModelVersion,
          selectedBusinessJarName,
          targetSummary: createDeployTargetSummary(targets),
        }

        set({
          mode: 'deploy',
          activeDeployKey: deployKey,
          deployListOffset: 0,
          localHistory: [historyItem, ...state.localHistory],
          localTargetsByDeployKey: {
            ...state.localTargetsByDeployKey,
            [deployKey]: targets,
          },
        })

        return deployKey
      },
      redeployLocalHistoryItem: (deployKey) => {
        const state = get()
        const sourceHistoryItem = state.localHistory.find((item) => item.deployKey === deployKey)
        const sourceTargets = state.localTargetsByDeployKey[deployKey] ?? []

        if (!sourceHistoryItem || sourceTargets.length === 0) {
          return null
        }

        const nextDeployKeyValue = nextDeployKey(state.localHistory)
        const clonedTargets: DeployTargetItem[] = sourceTargets.map((target, index) => ({
          ...target,
          deployTargetKey: nextDeployKeyValue * 100 + index + 1,
          targetStatus: 'PENDING',
          currentStepOrder: 0,
          currentStepCode: 'QUEUED',
          currentStepStatus: 'PENDING',
          rollbackRequired: false,
          lastErrorMessage: null,
          updatedAt: '2026-03-31T10:30:00Z',
        }))

        const pendingCount = clonedTargets.filter((item) => item.targetStatus === 'PENDING').length

        const nextHistoryItem: DeployHistoryItem = {
          ...sourceHistoryItem,
          deployKey: nextDeployKeyValue,
          deployStatus: 'READY',
          pauseRequested: false,
          createdAt: '2026-03-31T10:30:00Z',
          startedAt: null,
          finishedAt: null,
          terminal: false,
          targetSummary: {
            total: clonedTargets.length,
            pending: pendingCount,
            noChange: 0,
            running: 0,
            completed: 0,
            failed: 0,
            rollingBack: 0,
            rolledBack: 0,
            compensationFailed: 0,
            canceled: 0,
          },
        }

        set({
          mode: 'deploy',
          activeDeployKey: nextDeployKeyValue,
          deployListOffset: 0,
          localHistory: [nextHistoryItem, ...state.localHistory],
          localTargetsByDeployKey: {
            ...state.localTargetsByDeployKey,
            [nextDeployKeyValue]: clonedTargets,
          },
        })

        return nextDeployKeyValue
      },
      deleteLocalDeploy: (deployKey) =>
        set((state) => {
          const nextHistory = state.localHistory.filter((item) => item.deployKey !== deployKey)
          const nextTargetsByDeployKey = { ...state.localTargetsByDeployKey }
          delete nextTargetsByDeployKey[deployKey]

          return {
            localHistory: nextHistory,
            localTargetsByDeployKey: nextTargetsByDeployKey,
            serverBackedDeployKeys: state.serverBackedDeployKeys.filter((item) => item !== deployKey),
            serverBridgeCreatedAtByDeployKey: Object.fromEntries(
              Object.entries(state.serverBridgeCreatedAtByDeployKey).filter(
                ([storedDeployKey]) => Number(storedDeployKey) !== deployKey,
              ),
            ),
            activeDeployKey:
              state.activeDeployKey === deployKey ? (nextHistory[0]?.deployKey ?? null) : state.activeDeployKey,
          }
        }),
      reconcileServerHistory: (serverDeployKeys) =>
        set((state) => {
          const serverDeployKeySet = new Set(serverDeployKeys)
          const nextServerBridgeCreatedAtByDeployKey = Object.fromEntries(
            Object.entries(state.serverBridgeCreatedAtByDeployKey).filter(([storedDeployKey]) => {
              const deployKey = Number(storedDeployKey)
              return !serverDeployKeySet.has(deployKey)
            }),
          )

          if (
            Object.keys(nextServerBridgeCreatedAtByDeployKey).length ===
            Object.keys(state.serverBridgeCreatedAtByDeployKey).length
          ) {
            return state
          }

          return {
            serverBridgeCreatedAtByDeployKey: nextServerBridgeCreatedAtByDeployKey,
            serverBackedDeployKeys: state.serverBackedDeployKeys,
            localHistory: state.localHistory,
            localTargetsByDeployKey: state.localTargetsByDeployKey,
            activeDeployKey: state.activeDeployKey,
          }
        }),
      clearRegisterState: () =>
        set({
          selectedEqpIds: [],
          selectedEqpTargetsById: {},
          selectedEqpParamVersions: {},
          selectedInterfaceType: null,
          registerFilters: EMPTY_REGISTER_FILTERS,
          hasSubmittedRegisterSearch: false,
          selectedModelName: null,
          selectedModelVersionKey: null,
          selectedBusinessJarRef: null,
        }),
      resetPageState: () => set(createInitialDeployUiDataState()),
      setProfileModalOpen: (open) => set({ isProfileModalOpen: open }),
    }),
    {
      name: DEPLOY_UI_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => {
        const {
          hasSubmittedRegisterSearch,
          registerSearchRevision,
          ...persistedState
        } = state

        void hasSubmittedRegisterSearch
        void registerSearchRevision
        return persistedState
      },
      merge: (persistedState, currentState) => {
        const typedPersistedState = (persistedState ?? {}) as Partial<DeployUiState>
        const defaultMonitorFilters = createDefaultMonitorFilters()
        const persistedMonitorFilters = typedPersistedState.monitorFilters
        const persistedServerBackedDeployKeys = Array.isArray(typedPersistedState.serverBackedDeployKeys)
          ? typedPersistedState.serverBackedDeployKeys.filter((deployKey): deployKey is number => typeof deployKey === 'number')
          : []
        const persistedServerBridgeCreatedAtByDeployKey = Object.fromEntries(
          Object.entries(typedPersistedState.serverBridgeCreatedAtByDeployKey ?? {}).filter(
            ([storedDeployKey, createdAt]) =>
              persistedServerBackedDeployKeys.includes(Number(storedDeployKey)) &&
              typeof createdAt === 'string' &&
              createdAt.length > 0,
          ),
        )
        const persistedLocalHistory = Array.isArray(typedPersistedState.localHistory)
          ? typedPersistedState.localHistory.filter(
              (item) => item && persistedServerBackedDeployKeys.includes(item.deployKey),
            )
          : []
        const persistedLocalTargetsByDeployKey = Object.fromEntries(
          Object.entries(typedPersistedState.localTargetsByDeployKey ?? {}).filter(([storedDeployKey]) =>
            persistedServerBackedDeployKeys.includes(Number(storedDeployKey)),
          ),
        )
        const persistedSelectedEqpTargetsById = typedPersistedState.selectedEqpTargetsById ?? {}
        const hasPersistedSelectedTargets = Object.keys(persistedSelectedEqpTargetsById).length > 0
        const persistedSelectedEqpIds = hasPersistedSelectedTargets
          ? (typedPersistedState.selectedEqpIds ?? []).filter((eqpId) => persistedSelectedEqpTargetsById[eqpId])
          : []
        const persistedSelectedEqpParamVersions = hasPersistedSelectedTargets
          ? Object.fromEntries(
              Object.entries(typedPersistedState.selectedEqpParamVersions ?? {}).filter(([eqpId]) =>
                persistedSelectedEqpIds.includes(eqpId),
              ),
            )
          : {}

        return {
          ...currentState,
          ...typedPersistedState,
          selectedEqpIds: persistedSelectedEqpIds,
          selectedEqpTargetsById: hasPersistedSelectedTargets ? persistedSelectedEqpTargetsById : {},
          selectedEqpParamVersions: persistedSelectedEqpParamVersions,
          localHistory: persistedLocalHistory,
          localTargetsByDeployKey: persistedLocalTargetsByDeployKey,
          serverBackedDeployKeys: [...new Set(persistedServerBackedDeployKeys)],
          serverBridgeCreatedAtByDeployKey: persistedServerBridgeCreatedAtByDeployKey,
          selectedInterfaceType: resolveInterfaceType(
            persistedSelectedEqpIds,
            hasPersistedSelectedTargets ? persistedSelectedEqpTargetsById : {},
          ),
          monitorFilters: {
            ...defaultMonitorFilters,
            ...persistedMonitorFilters,
            fromDate: persistedMonitorFilters?.fromDate || defaultMonitorFilters.fromDate,
            toDate: persistedMonitorFilters?.toDate || defaultMonitorFilters.toDate,
          },
        }
      },
    },
  ),
)

export const clearDeployUiSessionState = () => {
  useDeployUiStore.getState().resetPageState()

  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(DEPLOY_UI_STORAGE_KEY)
  }
}
