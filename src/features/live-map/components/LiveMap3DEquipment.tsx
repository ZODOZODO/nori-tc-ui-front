import { RoundedBox } from '@react-three/drei'
import type { LiveMapEquipmentResponse, LiveMapPortResponse } from '../api/live-map.api'
import { LIVE_MAP_PORT_COLOR } from '../lib/live-map-3d.model'

/**
 * 3D 설비 모델 — 반도체 클러스터 공정 장비를 절차적으로 렌더한다.
 *
 * <p>구성: 메인프레임(후방 본체) + 상단 챔버 클러스터(트랜스퍼 허브 + 프로세스 모듈) + EFEM(전면 모듈, 글래스 패널)
 * + 로드 포트(전면 도크 + FOUP 캐리어) + 시그널 타워. 포트(`portItems`)는 상태 LED 가 아니라
 * <b>웨이퍼가 들어가는 로드 포트 입구</b>(FOUP 도킹)로 그린다 — 캐리어 도어 밴드 색이 포트 상태,
 * 설비 status 는 시그널 타워 안돈으로 표현한다.</p>
 */

const TOOL = { width: 2.0, mainframeH: 1.72, mainframeD: 1.05, efemH: 1.04, efemD: 0.66 }
const PLINTH_H = 0.1
const TOTAL_D = TOOL.mainframeD + TOOL.efemD
const FRONT_Z = TOTAL_D / 2
const MAINFRAME_Z = FRONT_Z - TOOL.efemD - TOOL.mainframeD / 2
const EFEM_Z = FRONT_Z - TOOL.efemD / 2
const MAINFRAME_TOP_Y = PLINTH_H + TOOL.mainframeH
const FOUP = { width: 0.4, height: 0.48, depth: 0.42 }
const DOCK = { height: 0.08, protrude: 0.16 }
const DOCK_Y = PLINTH_H + 0.3

const COLOR = {
  body: '#e3e7eb',
  efem: '#d2d7dd',
  trim: '#2a3340',
  glass: '#0c1622',
  chamber: '#4a525f',
  chamberLid: '#69727f',
  hub: '#59626f',
  dock: '#39414e',
  foup: '#aab3c0',
  foupDoor: '#c4ccd6',
}

/** 시그널 타워 점등(반도체 안돈): RUN→녹 / IDLE→황 / ERROR→적 / DOWN→소등. */
const towerLit = (status: LiveMapEquipmentResponse['status']) => ({
  red: status === 'ERROR',
  amber: status === 'IDLE',
  green: status === 'RUN',
})

interface PortSlot {
  port: LiveMapPortResponse
  x: number
}
/** 로드 포트를 EFEM 전면 가로로 균등 배치. 개수 많으면 슬롯 폭에 맞춰 좁힌다. */
function placePorts(ports: LiveMapPortResponse[]): { slots: PortSlot[]; foupWidth: number } {
  if (ports.length === 0) {
    return { slots: [], foupWidth: FOUP.width }
  }
  const usableWidth = TOOL.width * 0.9
  const slotWidth = usableWidth / ports.length
  const foupWidth = Math.min(FOUP.width, slotWidth * 0.74)
  const startX = -usableWidth / 2 + slotWidth / 2
  return { slots: ports.map((port, index) => ({ port, x: startX + index * slotWidth })), foupWidth }
}

/** 상단 챔버 클러스터(트랜스퍼 허브 + 프로세스 모듈 3) — 클러스터 툴 실루엣. */
function ChamberCluster() {
  const modules: Array<[number, number]> = [
    [0, -0.34],
    [-0.5, 0.06],
    [0.5, 0.06],
  ]
  return (
    <group position={[0, MAINFRAME_TOP_Y, MAINFRAME_Z]}>
      {/* 트랜스퍼 허브 (작은 파트는 그림자 캐스트 생략 — 렌더 부하↓) */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.34, 0.36, 0.3, 6]} />
        <meshStandardMaterial color={COLOR.hub} metalness={0.5} roughness={0.4} />
      </mesh>
      {modules.map(([x, z], index) => (
        <group key={index} position={[x, 0, z]}>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.21, 0.22, 0.34, 24]} />
            <meshStandardMaterial color={COLOR.chamber} metalness={0.45} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.16, 0.21, 0.06, 24]} />
            <meshStandardMaterial color={COLOR.chamberLid} metalness={0.55} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function SignalTower({ status }: { status: LiveMapEquipmentResponse['status'] }) {
  const lit = towerLit(status)
  const segments: Array<{ key: 'red' | 'amber' | 'green'; color: string; on: boolean }> = [
    { key: 'red', color: '#ef4444', on: lit.red },
    { key: 'amber', color: '#f59e0b', on: lit.amber },
    { key: 'green', color: '#22c55e', on: lit.green },
  ]
  const baseY = MAINFRAME_TOP_Y + 0.02
  return (
    <group position={[TOOL.width / 2 - 0.16, 0, MAINFRAME_Z + TOOL.mainframeD / 2 - 0.14]}>
      <mesh position={[0, baseY + 0.08, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.16, 16]} />
        <meshStandardMaterial color={COLOR.trim} metalness={0.6} roughness={0.35} />
      </mesh>
      {segments.map((segment, index) => (
        <mesh key={segment.key} position={[0, baseY + 0.21 + index * 0.15, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.14, 20]} />
          <meshStandardMaterial
            color={segment.on ? segment.color : '#1b2026'}
            emissive={segment.color}
            emissiveIntensity={segment.on ? 1.4 : 0.04}
            toneMapped={false}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  )
}

function LoadPort({ port, x, foupWidth }: { port: LiveMapPortResponse; x: number; foupWidth: number }) {
  const foupBaseY = DOCK_Y + DOCK.height / 2
  const foupCenterY = foupBaseY + FOUP.height / 2
  const foupZ = FRONT_Z + DOCK.protrude - 0.04
  return (
    <group position={[x, 0, 0]}>
      {/* 도크 플랫폼(전면 돌출) */}
      <mesh position={[0, DOCK_Y, FRONT_Z + DOCK.protrude / 2]} receiveShadow>
        <boxGeometry args={[foupWidth + 0.1, DOCK.height, DOCK.protrude + 0.18]} />
        <meshStandardMaterial color={COLOR.dock} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* FOUP 캐리어 본체 */}
      <RoundedBox args={[foupWidth, FOUP.height, FOUP.depth]} radius={0.03} smoothness={3} position={[0, foupCenterY, foupZ]}>
        <meshStandardMaterial color={COLOR.foup} metalness={0.2} roughness={0.5} />
      </RoundedBox>
      {/* 전면 도어 패널(살짝 돌출) */}
      <RoundedBox args={[foupWidth * 0.78, FOUP.height * 0.74, 0.04]} radius={0.02} smoothness={3} position={[0, foupCenterY - 0.02, foupZ + FOUP.depth / 2]}>
        <meshStandardMaterial color={COLOR.foupDoor} metalness={0.25} roughness={0.45} />
      </RoundedBox>
      {/* 상단 핸들 */}
      <mesh position={[0, foupCenterY + FOUP.height / 2 + 0.03, foupZ]}>
        <boxGeometry args={[foupWidth * 0.5, 0.06, 0.08]} />
        <meshStandardMaterial color={COLOR.trim} metalness={0.45} roughness={0.45} />
      </mesh>
      {/* 도어 상태 밴드 */}
      <mesh position={[0, foupCenterY + FOUP.height * 0.22, foupZ + FOUP.depth / 2 + 0.025]}>
        <boxGeometry args={[foupWidth * 0.62, 0.07, 0.02]} />
        <meshStandardMaterial color="#0a0e15" emissive={LIVE_MAP_PORT_COLOR[port.status]} emissiveIntensity={1.15} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function LiveMap3DEquipment({ equipment }: { equipment: LiveMapEquipmentResponse | null }) {
  const status = equipment?.status ?? 'DOWN'
  const { slots, foupWidth } = placePorts(equipment?.portItems ?? [])

  return (
    <group>
      {/* 베이스 플린스 */}
      <mesh position={[0, PLINTH_H / 2, 0]} receiveShadow>
        <boxGeometry args={[TOOL.width + 0.12, PLINTH_H, TOTAL_D + 0.12]} />
        <meshStandardMaterial color={COLOR.trim} metalness={0.4} roughness={0.55} />
      </mesh>

      {/* 메인프레임(후방 본체) */}
      <RoundedBox
        args={[TOOL.width, TOOL.mainframeH, TOOL.mainframeD]}
        radius={0.05}
        smoothness={4}
        position={[0, PLINTH_H + TOOL.mainframeH / 2, MAINFRAME_Z]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={COLOR.body} metalness={0.2} roughness={0.42} />
      </RoundedBox>

      {/* 메인프레임 전면 유지보수 패널(어두운 인셋) */}
      <mesh position={[0, PLINTH_H + TOOL.mainframeH * 0.55, MAINFRAME_Z + TOOL.mainframeD / 2 + 0.005]}>
        <boxGeometry args={[TOOL.width * 0.72, TOOL.mainframeH * 0.6, 0.02]} />
        <meshStandardMaterial color="#c0c6cd" metalness={0.2} roughness={0.5} />
      </mesh>
      {/* 상태 액센트 스트립 */}
      <mesh position={[0, PLINTH_H + TOOL.mainframeH - 0.16, MAINFRAME_Z + TOOL.mainframeD / 2 + 0.02]}>
        <boxGeometry args={[TOOL.width * 0.72, 0.06, 0.02]} />
        <meshStandardMaterial color="#0a0e15" emissive={LIVE_MAP_PORT_COLOR.RUN} emissiveIntensity={status === 'RUN' ? 0.9 : 0.05} toneMapped={false} />
      </mesh>

      <ChamberCluster />

      {/* EFEM(전면 모듈) */}
      <RoundedBox
        args={[TOOL.width, TOOL.efemH, TOOL.efemD]}
        radius={0.04}
        smoothness={4}
        position={[0, PLINTH_H + TOOL.efemH / 2, EFEM_Z]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={COLOR.efem} metalness={0.22} roughness={0.44} />
      </RoundedBox>

      {/* EFEM 상단 글래스 패널(미니환경 윈도우) */}
      <mesh position={[0, PLINTH_H + TOOL.efemH - 0.16, FRONT_Z + 0.005]}>
        <boxGeometry args={[TOOL.width * 0.84, 0.3, 0.03]} />
        <meshStandardMaterial color={COLOR.glass} emissive="#1f7a8c" emissiveIntensity={0.4} toneMapped={false} metalness={0.1} roughness={0.3} />
      </mesh>

      {/* 로드 포트(입구) */}
      {slots.map(({ port, x }) => (
        <LoadPort key={port.id} port={port} x={x} foupWidth={foupWidth} />
      ))}

      <SignalTower status={status} />
    </group>
  )
}
