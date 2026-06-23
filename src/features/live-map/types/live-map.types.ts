export type LiveMapEqpStatus = 'RUN' | 'IDLE' | 'ERROR' | 'DOWN'
export type LiveMapStatusFilter = 'ALL' | LiveMapEqpStatus
export type LiveMapPortStatus = 'RUN' | 'IDLE' | 'DOWN'
export type LiveMapEqpProcessingType = 'SINGLE' | 'BATCH'
export type LiveMapDemoTestType = 'SOCKET_ONLY' | 'MES_ONLY' | 'E2E'

export interface LiveMapPoint {
  x: number
  y: number
}

export interface LiveMapLineOption {
  value: string
  label: string
}

export interface LiveMapEquipmentNode {
  eqpKey: number
  eqpId: string
  eqpName: string
  lineValue: string
  lineLabel: string
  processingTypeLabel: string
  clusterId: string
  clusterName: string
  status: LiveMapEqpStatus
  statusLabel: string
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

export interface LiveMapDemoTargetEquipment {
  eqpId: string
  eqpName: string
  lineLabel: string
  clusterId: string
  clusterName: string
  processingTypeLabel: string
  statusLabel: string
}

export interface LiveMapSummary {
  total: number
  run: number
  idle: number
  error: number
  down: number
}

