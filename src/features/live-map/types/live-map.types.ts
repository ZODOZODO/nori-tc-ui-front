export type LiveMapEqpStatus = 'RUN' | 'IDLE' | 'ERROR' | 'DOWN'
export type LiveMapStatusFilter = 'ALL' | LiveMapEqpStatus
export type LiveMapPortStatus = 'RUN' | 'IDLE' | 'DOWN'
export type LiveMapEqpProcessingType = 'SINGLE' | 'BATCH'
export type LiveMapDemoTestType = 'SOCKET_ONLY' | 'MES_ONLY' | 'E2E'

export interface LiveMapPoint {
  x: number
  y: number
}

export type LiveMapEquipmentPositionDrafts = Record<string, LiveMapPoint>
export type LiveMapClusterPositionDrafts = Record<string, LiveMapPoint>

export interface LiveMapLineOption {
  value: string
  label: string
}

export interface LiveMapClusterItem {
  id: string
  title: string
  subtitle: string
  metricLabel: string
  metricValue: string
  x: number
  y: number
  width: number
  height: number
  accentColor: string
  panelColor: string
  borderColor: string
  badgeBg: string
  badgeBorderColor: string
  badgeTextColor: string
}

export interface LiveMapEquipmentNode {
  eqpId: string
  eqpName: string
  lineValue: string
  lineLabel: string
  processingType: LiveMapEqpProcessingType
  processingTypeLabel: string
  clusterId: string
  clusterName: string
  sectorId: string
  sectorName: string
  status: LiveMapEqpStatus
  statusLabel: string
  x: number
  y: number
  portItems: LiveMapEquipmentPortItem[]
  tooltipMeta: string
  tooltipStep: string
  alertMessage: string | null
}

export interface LiveMapEquipmentPortItem {
  id: string
  label: string
  status: LiveMapPortStatus
  statusLabel: string
}

export type LiveMapDemoTreeNodeType = 'LINE' | 'PROCESS' | 'EQUIPMENT'

export interface LiveMapDemoTreeNode {
  id: string
  label: string
  type: LiveMapDemoTreeNodeType
  lineValue?: string
  clusterId?: string
  eqpId?: string
  eqpName?: string
  children: LiveMapDemoTreeNode[]
}

export interface LiveMapDemoScenarioOption {
  id: string
  label: string
  description: string
  phaseLabels: readonly string[]
  durationTicks: number
}

export interface LiveMapDemoTargetEquipment {
  eqpId: string
  eqpName: string
  lineLabel: string
  clusterId: string
  clusterName: string
  processingTypeLabel: string
  statusLabel: string
}

export interface LiveMapDemoRunRow extends LiveMapDemoTargetEquipment {
  statusText: string
  currentPhase: string
  progress: number
  elapsedTicks: number
}

export interface LiveMapSummary {
  total: number
  run: number
  idle: number
  error: number
  down: number
}

export type LiveMapClusterSummaryMap = Record<string, LiveMapSummary>
