import type {
  LiveMapClusterItem,
  LiveMapDemoScenarioOption,
  LiveMapEquipmentNode,
  LiveMapEquipmentPortItem,
  LiveMapEqpProcessingType,
  LiveMapLineOption,
  LiveMapPortStatus,
  LiveMapStatusFilter,
} from '../types/live-map.types'

export const LIVE_MAP_BOARD_WIDTH = 1338
export const LIVE_MAP_BOARD_HEIGHT = 900

export const LIVE_MAP_LINE_OPTIONS: readonly LiveMapLineOption[] = [
  { value: 'ALL', label: '전체 라인' },
  { value: 'A_LINE', label: 'A Line' },
] as const

export const LIVE_MAP_STATE_OPTIONS: readonly { value: LiveMapStatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체 상태' },
  { value: 'RUN', label: 'RUN' },
  { value: 'IDLE', label: 'IDLE' },
  { value: 'ERROR', label: 'ERROR' },
  { value: 'DOWN', label: 'DOWN' },
] as const

export const LIVE_MAP_DEMO_SCENARIO_OPTIONS: readonly LiveMapDemoScenarioOption[] = [
  {
    id: 'smoke-run',
    label: 'Smoke Run',
    description: '기본 경로만 빠르게 확인하는 데모 시나리오입니다.',
    phaseLabels: ['준비', '조건 확인', '가상 실행', '결과 확인'],
    durationTicks: 8,
  },
  {
    id: 'alarm-recovery',
    label: 'Alarm Recovery',
    description: '알람 감지와 복구 흐름을 함께 살펴보는 시나리오입니다.',
    phaseLabels: ['준비', '알람 주입', '복구 확인', '최종 검증'],
    durationTicks: 10,
  },
  {
    id: 'batch-validation',
    label: 'Batch Validation',
    description: '선택 설비를 순차적으로 돌려 전체 흐름을 점검하는 시나리오입니다.',
    phaseLabels: ['준비', '배치 실행', '결과 수집', '리포트 정리'],
    durationTicks: 12,
  },
] as const

export const LIVE_MAP_CLUSTER_ITEMS: readonly LiveMapClusterItem[] = [
  {
    id: 'cvd',
    title: 'CVD',
    subtitle: 'Deposition',
    metricLabel: 'RUN',
    metricValue: '3',
    x: 34,
    y: 76,
    width: 232,
    height: 364,
    accentColor: '#5FD08D',
    panelColor: '#141D1A',
    borderColor: '#203229',
    badgeBg: '#122319',
    badgeBorderColor: '#254633',
    badgeTextColor: '#8FDEAA',
  },
  {
    id: 'cmp',
    title: 'CMP',
    subtitle: 'Polish',
    metricLabel: 'IDLE',
    metricValue: '1',
    x: 290,
    y: 76,
    width: 232,
    height: 364,
    accentColor: '#7FB8FF',
    panelColor: '#141A22',
    borderColor: '#233344',
    badgeBg: '#13212D',
    badgeBorderColor: '#2D4F67',
    badgeTextColor: '#9BD3FF',
  },
  {
    id: 'diff',
    title: 'DIFF',
    subtitle: 'Diffusion',
    metricLabel: 'RUN',
    metricValue: '3',
    x: 546,
    y: 76,
    width: 232,
    height: 364,
    accentColor: '#E4B95A',
    panelColor: '#201B12',
    borderColor: '#493D21',
    badgeBg: '#2A2415',
    badgeBorderColor: '#6A5323',
    badgeTextColor: '#F0D083',
  },
  {
    id: 'photo',
    title: 'PHOTO',
    subtitle: 'Lithography',
    metricLabel: 'RUN',
    metricValue: '3',
    x: 802,
    y: 76,
    width: 232,
    height: 364,
    accentColor: '#F08A6A',
    panelColor: '#211814',
    borderColor: '#4C3026',
    badgeBg: '#2C1D18',
    badgeBorderColor: '#704637',
    badgeTextColor: '#FFC5B4',
  },
  {
    id: 'metro',
    title: 'METRO',
    subtitle: 'Metrology',
    metricLabel: 'RUN',
    metricValue: '3',
    x: 1058,
    y: 76,
    width: 232,
    height: 364,
    accentColor: '#7AD7D0',
    panelColor: '#111D1E',
    borderColor: '#224144',
    badgeBg: '#132325',
    badgeBorderColor: '#2D676A',
    badgeTextColor: '#9FE8E2',
  },
  {
    id: 'metal',
    title: 'METAL',
    subtitle: 'Metal Line',
    metricLabel: 'ALERT',
    metricValue: '1',
    x: 34,
    y: 488,
    width: 232,
    height: 364,
    accentColor: '#F26D7D',
    panelColor: '#1A181D',
    borderColor: '#352A31',
    badgeBg: '#2A171C',
    badgeBorderColor: '#5A333D',
    badgeTextColor: '#F1A7B0',
  },
  {
    id: 'etch',
    title: 'ETCH',
    subtitle: 'Dry Etch',
    metricLabel: 'IDLE',
    metricValue: '1',
    x: 290,
    y: 488,
    width: 232,
    height: 364,
    accentColor: '#90A7FF',
    panelColor: '#171A24',
    borderColor: '#2D3450',
    badgeBg: '#191E2E',
    badgeBorderColor: '#3D4A78',
    badgeTextColor: '#C3CEFF',
  },
  {
    id: 'imp',
    title: 'IMP',
    subtitle: 'Implant',
    metricLabel: 'RUN',
    metricValue: '3',
    x: 546,
    y: 488,
    width: 232,
    height: 364,
    accentColor: '#B58DFF',
    panelColor: '#1B1825',
    borderColor: '#3A2F52',
    badgeBg: '#201B31',
    badgeBorderColor: '#534075',
    badgeTextColor: '#D8C2FF',
  },
  {
    id: 'wet',
    title: 'WET',
    subtitle: 'Wet Clean',
    metricLabel: 'IDLE',
    metricValue: '1',
    x: 802,
    y: 488,
    width: 232,
    height: 364,
    accentColor: '#63D5A9',
    panelColor: '#14201B',
    borderColor: '#274437',
    badgeBg: '#15271F',
    badgeBorderColor: '#2E5E48',
    badgeTextColor: '#A2E7C6',
  },
  {
    id: 'etc',
    title: 'ETC',
    subtitle: 'Auxiliary',
    metricLabel: 'IDLE',
    metricValue: '1',
    x: 1058,
    y: 488,
    width: 232,
    height: 364,
    accentColor: '#B9C1CC',
    panelColor: '#1A1D21',
    borderColor: '#353A41',
    badgeBg: '#21262C',
    badgeBorderColor: '#49515B',
    badgeTextColor: '#D7DDE4',
  },
] as const

const LIVE_MAP_PROCESS_NODE_OFFSETS: readonly [number, number][] = [
  [24, 86],  [76, 86],  [128, 86],  [180, 86],   // row 1
  [24, 134], [76, 134], [128, 134], [180, 134],   // row 2
  [24, 182], [76, 182], [128, 182], [180, 182],   // row 3
] as const

const LIVE_MAP_CLUSTER_INDEX = Object.fromEntries(
  LIVE_MAP_CLUSTER_ITEMS.map((cluster) => [cluster.id, cluster]),
)

const createPortItems = (
  statuses: readonly LiveMapPortStatus[],
): LiveMapEquipmentPortItem[] =>
  statuses.map((status, index) => ({
    id: `port-${index + 1}`,
    label: `PORT ${index + 1}`,
    status,
    statusLabel:
      status === 'RUN' ? 'RUN' : status === 'IDLE' ? 'IDLE' : 'DOWN',
  }))

const createEquipmentNode = (
  eqpId: string,
  clusterId: string,
  clusterName: string,
  processingType: LiveMapEqpProcessingType,
  status: LiveMapEquipmentNode['status'],
  slotIndex: number,
  portStatuses: readonly LiveMapPortStatus[],
  tooltipMeta: string,
  tooltipStep: string,
  alertMessage: string | null = null,
): LiveMapEquipmentNode => {
  const cluster = LIVE_MAP_CLUSTER_INDEX[clusterId]
  const positionOffset = LIVE_MAP_PROCESS_NODE_OFFSETS[slotIndex]

  if (!cluster || !positionOffset) {
    throw new Error(`LIVE_MAP_EQUIPMENT_NODES 위치 정보를 찾을 수 없습니다: ${clusterId}[${slotIndex}]`)
  }

  return {
    eqpId,
    eqpName: eqpId,
    lineValue: 'A_LINE',
    lineLabel: 'A Line',
    processingType,
    processingTypeLabel: processingType === 'SINGLE' ? 'Single' : 'Batch',
    clusterId,
    clusterName,
    sectorId: clusterId,
    sectorName: clusterName,
    status,
    statusLabel:
      status === 'RUN'
        ? 'RUN'
        : status === 'IDLE'
          ? 'IDLE'
          : status === 'ERROR'
            ? 'ERROR'
            : 'DOWN',
    x: cluster.x + positionOffset[0],
    y: cluster.y + positionOffset[1],
    portItems: createPortItems(portStatuses),
    tooltipMeta,
    tooltipStep,
    alertMessage,
  }
}

export const LIVE_MAP_EQUIPMENT_NODES: readonly LiveMapEquipmentNode[] = [
  createEquipmentNode('A-EQ01', 'cvd', 'CVD', 'BATCH', 'RUN', 0, ['RUN', 'RUN', 'IDLE', 'DOWN'], 'CVD · Chamber 01 Stable', '증착 편차 0.2%'),
  createEquipmentNode('A-EQ02', 'cvd', 'CVD', 'BATCH', 'RUN', 1, ['RUN', 'IDLE', 'RUN'], 'CVD · Chamber 02 Stable', '처리율 91%'),
  createEquipmentNode('A-EQ03', 'cvd', 'CVD', 'BATCH', 'RUN', 2, ['RUN', 'RUN', 'RUN', 'IDLE', 'DOWN'], 'CVD · Chamber 03 Stable', 'Queue 2 lots'),
  createEquipmentNode('A-EQ04', 'cmp', 'CMP', 'SINGLE', 'RUN', 0, ['RUN', 'IDLE'], 'CMP · Polish Head Normal', 'Slurry flow stable'),
  createEquipmentNode('A-EQ05', 'cmp', 'CMP', 'SINGLE', 'IDLE', 1, ['IDLE', 'DOWN'], 'CMP · Queue Wait', 'Next lot ETA 48s'),
  createEquipmentNode('A-EQ06', 'cmp', 'CMP', 'SINGLE', 'RUN', 2, ['RUN', 'RUN', 'IDLE'], 'CMP · Pad Condition OK', 'Duty 73%'),
  createEquipmentNode('A-EQ07', 'diff', 'DIFF', 'BATCH', 'RUN', 0, ['RUN', 'RUN', 'RUN', 'IDLE'], 'DIFF · Furnace Online', 'Temp stable'),
  createEquipmentNode('A-EQ08', 'diff', 'DIFF', 'BATCH', 'RUN', 1, ['RUN', 'RUN', 'DOWN'], 'DIFF · Furnace Online', 'Recipe locked'),
  createEquipmentNode('A-EQ09', 'diff', 'DIFF', 'BATCH', 'RUN', 2, ['RUN', 'IDLE', 'IDLE', 'DOWN'], 'DIFF · Loader Ready', 'Queue 1 lot'),
  createEquipmentNode('A-EQ10', 'photo', 'PHOTO', 'SINGLE', 'RUN', 0, ['RUN', 'RUN'], 'PHOTO · Stage Stable', 'Overlay OK'),
  createEquipmentNode('A-EQ11', 'photo', 'PHOTO', 'SINGLE', 'RUN', 1, ['RUN', 'IDLE', 'RUN'], 'PHOTO · Coater Ready', 'Viscosity stable'),
  createEquipmentNode('A-EQ12', 'photo', 'PHOTO', 'SINGLE', 'RUN', 2, ['RUN', 'RUN', 'IDLE'], 'PHOTO · Develop Ready', 'Track linked'),
  createEquipmentNode('A-EQ13', 'metro', 'METRO', 'SINGLE', 'RUN', 0, ['RUN', 'IDLE'], 'METRO · Inspection OK', 'Defect 0.2%'),
  createEquipmentNode('A-EQ14', 'metro', 'METRO', 'SINGLE', 'RUN', 1, ['RUN', 'RUN', 'IDLE'], 'METRO · Measurement Stable', 'Cycle 21s'),
  createEquipmentNode('A-EQ15', 'metro', 'METRO', 'SINGLE', 'RUN', 2, ['IDLE', 'RUN'], 'METRO · Review Ready', 'Queue 1 lot'),
  createEquipmentNode('A-EQ16', 'metal', 'METAL', 'BATCH', 'RUN', 0, ['RUN', 'RUN', 'IDLE', 'IDLE'], 'METAL · Plating Stable', 'Current stable'),
  createEquipmentNode('A-EQ17', 'metal', 'METAL', 'BATCH', 'ERROR', 1, ['RUN', 'DOWN', 'IDLE', 'DOWN'], 'METAL · Camera Drift Detected', 'MTTR est. 12m', '카메라 재보정이 필요합니다.'),
  createEquipmentNode('A-EQ18', 'metal', 'METAL', 'BATCH', 'RUN', 2, ['RUN', 'RUN', 'RUN'], 'METAL · Transfer Assist Ready', 'Carrier linked'),
  createEquipmentNode('A-EQ19', 'etch', 'ETCH', 'SINGLE', 'RUN', 0, ['RUN', 'RUN'], 'ETCH · Chamber A Stable', 'Pressure stable'),
  createEquipmentNode('A-EQ20', 'etch', 'ETCH', 'SINGLE', 'RUN', 1, ['RUN', 'IDLE', 'RUN'], 'ETCH · Chamber B Stable', 'Gas flow nominal'),
  createEquipmentNode('A-EQ21', 'etch', 'ETCH', 'SINGLE', 'IDLE', 2, ['IDLE', 'DOWN'], 'ETCH · Loader Waiting', 'Next wafer ETA 39s'),
  createEquipmentNode('A-EQ22', 'imp', 'IMP', 'SINGLE', 'RUN', 0, ['RUN', 'RUN'], 'IMP · Beam Stable', 'Dose 98%'),
  createEquipmentNode('A-EQ23', 'imp', 'IMP', 'SINGLE', 'RUN', 1, ['RUN', 'IDLE'], 'IMP · Beam Stable', 'Queue 2 lots'),
  createEquipmentNode('A-EQ24', 'imp', 'IMP', 'SINGLE', 'RUN', 2, ['RUN', 'RUN', 'DOWN'], 'IMP · Cooling OK', 'Thermal stable'),
  createEquipmentNode('A-EQ25', 'wet', 'WET', 'BATCH', 'RUN', 0, ['RUN', 'RUN', 'IDLE', 'RUN'], 'WET · Bath A Stable', 'Chemical mix nominal'),
  createEquipmentNode('A-EQ26', 'wet', 'WET', 'BATCH', 'RUN', 1, ['RUN', 'IDLE', 'IDLE'], 'WET · Bath B Stable', 'Queue 1 lot'),
  createEquipmentNode('A-EQ27', 'wet', 'WET', 'BATCH', 'IDLE', 2, ['IDLE', 'DOWN', 'IDLE', 'DOWN'], 'WET · Standby', 'Lot wait'),
  createEquipmentNode('A-EQ28', 'etc', 'ETC', 'SINGLE', 'RUN', 0, ['RUN', 'IDLE'], 'ETC · Utility Stable', 'Compressed air OK'),
  createEquipmentNode('A-EQ29', 'etc', 'ETC', 'SINGLE', 'RUN', 1, ['RUN', 'RUN', 'IDLE'], 'ETC · Spare Unit Online', 'Monitoring linked'),
  createEquipmentNode('A-EQ30', 'etc', 'ETC', 'SINGLE', 'IDLE', 2, ['IDLE', 'DOWN'], 'ETC · Reserve Station Waiting', 'Standby mode'),
] as const
