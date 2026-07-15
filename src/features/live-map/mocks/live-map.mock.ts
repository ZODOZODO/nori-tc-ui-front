import type {
  LiveMapEquipmentNode,
  LiveMapEquipmentPortItem,
  LiveMapEqpProcessingType,
  LiveMapPortStatus,
} from '../types/live-map.types'

export const LIVE_MAP_BOARD_WIDTH = 1350
export const LIVE_MAP_BOARD_HEIGHT = 710

// 라인 옵션은 GET /api/line 실데이터(useLineList)로 대체되어 상단바 LineScopeSelector 가 채운다.
// 상태 필터 옵션은 LiveMapPage 가 i18n 라벨('livemap.state.all')로 직접 구성한다.

const createPortItems = (
  statuses: readonly LiveMapPortStatus[],
): LiveMapEquipmentPortItem[] =>
  statuses.map((status, index) => ({
    id: `port-${index + 1}`,
    label: `PORT ${index + 1}`,
    carrierId: null,
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
  portStatuses: readonly LiveMapPortStatus[],
  tooltipMeta: string,
  tooltipStep: string,
  alertMessage: string | null = null,
): LiveMapEquipmentNode => ({
  // mock eqpKey — eqpId 숫자부(A-EQ07 → 7). 실데이터 eqpKey(tc_eqp PK)에 대응하는 테스트용 안정 키.
  eqpKey: Number.parseInt(eqpId.replace(/\D+/g, ''), 10),
  eqpId,
  eqpName: eqpId,
  lineValue: 'A_LINE',
  lineLabel: 'A Line',
  processingTypeLabel: processingType === 'SINGLE' ? 'Single' : 'Batch',
  clusterId,
  clusterName,
  status,
  statusLabel:
    status === 'RUN'
      ? 'RUN'
      : status === 'IDLE'
        ? 'IDLE'
        : status === 'ERROR'
          ? 'ERROR'
          : 'DOWN',
  portItems: createPortItems(portStatuses),
  tooltipMeta,
  tooltipStep,
  alertMessage,
})

export const LIVE_MAP_EQUIPMENT_NODES: readonly LiveMapEquipmentNode[] = [
  createEquipmentNode('A-EQ01', 'cvd', 'CVD', 'BATCH', 'RUN', ['RUN', 'RUN', 'IDLE', 'DOWN'], 'CVD · Chamber 01 Stable', '증착 편차 0.2%'),
  createEquipmentNode('A-EQ02', 'cvd', 'CVD', 'BATCH', 'RUN', ['RUN', 'IDLE', 'RUN'], 'CVD · Chamber 02 Stable', '처리율 91%'),
  createEquipmentNode('A-EQ03', 'cvd', 'CVD', 'BATCH', 'RUN', ['RUN', 'RUN', 'RUN', 'IDLE', 'DOWN'], 'CVD · Chamber 03 Stable', 'Queue 2 lots'),
  createEquipmentNode('A-EQ04', 'cmp', 'CMP', 'SINGLE', 'RUN', ['RUN', 'IDLE'], 'CMP · Polish Head Normal', 'Slurry flow stable'),
  createEquipmentNode('A-EQ05', 'cmp', 'CMP', 'SINGLE', 'IDLE', ['IDLE', 'DOWN'], 'CMP · Queue Wait', 'Next lot ETA 48s'),
  createEquipmentNode('A-EQ06', 'cmp', 'CMP', 'SINGLE', 'RUN', ['RUN', 'RUN', 'IDLE'], 'CMP · Pad Condition OK', 'Duty 73%'),
  createEquipmentNode('A-EQ07', 'diff', 'DIFF', 'BATCH', 'RUN', ['RUN', 'RUN', 'RUN', 'IDLE'], 'DIFF · Furnace Online', 'Temp stable'),
  createEquipmentNode('A-EQ08', 'diff', 'DIFF', 'BATCH', 'RUN', ['RUN', 'RUN', 'DOWN'], 'DIFF · Furnace Online', 'Recipe locked'),
  createEquipmentNode('A-EQ09', 'diff', 'DIFF', 'BATCH', 'RUN', ['RUN', 'IDLE', 'IDLE', 'DOWN'], 'DIFF · Loader Ready', 'Queue 1 lot'),
  createEquipmentNode('A-EQ10', 'photo', 'PHOTO', 'SINGLE', 'RUN', ['RUN', 'RUN'], 'PHOTO · Stage Stable', 'Overlay OK'),
  createEquipmentNode('A-EQ11', 'photo', 'PHOTO', 'SINGLE', 'RUN', ['RUN', 'IDLE', 'RUN'], 'PHOTO · Coater Ready', 'Viscosity stable'),
  createEquipmentNode('A-EQ12', 'photo', 'PHOTO', 'SINGLE', 'RUN', ['RUN', 'RUN', 'IDLE'], 'PHOTO · Develop Ready', 'Track linked'),
  createEquipmentNode('A-EQ13', 'metro', 'METRO', 'SINGLE', 'RUN', ['RUN', 'IDLE'], 'METRO · Inspection OK', 'Defect 0.2%'),
  createEquipmentNode('A-EQ14', 'metro', 'METRO', 'SINGLE', 'RUN', ['RUN', 'RUN', 'IDLE'], 'METRO · Measurement Stable', 'Cycle 21s'),
  createEquipmentNode('A-EQ15', 'metro', 'METRO', 'SINGLE', 'RUN', ['IDLE', 'RUN'], 'METRO · Review Ready', 'Queue 1 lot'),
  createEquipmentNode('A-EQ16', 'metal', 'METAL', 'BATCH', 'RUN', ['RUN', 'RUN', 'IDLE', 'IDLE'], 'METAL · Plating Stable', 'Current stable'),
  createEquipmentNode('A-EQ17', 'metal', 'METAL', 'BATCH', 'ERROR', ['RUN', 'DOWN', 'IDLE', 'DOWN'], 'METAL · Camera Drift Detected', 'MTTR est. 12m', '카메라 재보정이 필요합니다.'),
  createEquipmentNode('A-EQ18', 'metal', 'METAL', 'BATCH', 'RUN', ['RUN', 'RUN', 'RUN'], 'METAL · Transfer Assist Ready', 'Carrier linked'),
  createEquipmentNode('A-EQ19', 'etch', 'ETCH', 'SINGLE', 'RUN', ['RUN', 'RUN'], 'ETCH · Chamber A Stable', 'Pressure stable'),
  createEquipmentNode('A-EQ20', 'etch', 'ETCH', 'SINGLE', 'RUN', ['RUN', 'IDLE', 'RUN'], 'ETCH · Chamber B Stable', 'Gas flow nominal'),
  createEquipmentNode('A-EQ21', 'etch', 'ETCH', 'SINGLE', 'IDLE', ['IDLE', 'DOWN'], 'ETCH · Loader Waiting', 'Next wafer ETA 39s'),
  createEquipmentNode('A-EQ22', 'imp', 'IMP', 'SINGLE', 'RUN', ['RUN', 'RUN'], 'IMP · Beam Stable', 'Dose 98%'),
  createEquipmentNode('A-EQ23', 'imp', 'IMP', 'SINGLE', 'RUN', ['RUN', 'IDLE'], 'IMP · Beam Stable', 'Queue 2 lots'),
  createEquipmentNode('A-EQ24', 'imp', 'IMP', 'SINGLE', 'RUN', ['RUN', 'RUN', 'DOWN'], 'IMP · Cooling OK', 'Thermal stable'),
  createEquipmentNode('A-EQ25', 'wet', 'WET', 'BATCH', 'RUN', ['RUN', 'RUN', 'IDLE', 'RUN'], 'WET · Bath A Stable', 'Chemical mix nominal'),
  createEquipmentNode('A-EQ26', 'wet', 'WET', 'BATCH', 'RUN', ['RUN', 'IDLE', 'IDLE'], 'WET · Bath B Stable', 'Queue 1 lot'),
  createEquipmentNode('A-EQ27', 'wet', 'WET', 'BATCH', 'IDLE', ['IDLE', 'DOWN', 'IDLE', 'DOWN'], 'WET · Standby', 'Lot wait'),
  createEquipmentNode('A-EQ28', 'etc', 'ETC', 'SINGLE', 'RUN', ['RUN', 'IDLE'], 'ETC · Utility Stable', 'Compressed air OK'),
  createEquipmentNode('A-EQ29', 'etc', 'ETC', 'SINGLE', 'RUN', ['RUN', 'RUN', 'IDLE'], 'ETC · Spare Unit Online', 'Monitoring linked'),
  createEquipmentNode('A-EQ30', 'etc', 'ETC', 'SINGLE', 'IDLE', ['IDLE', 'DOWN'], 'ETC · Reserve Station Waiting', 'Standby mode'),
] as const
