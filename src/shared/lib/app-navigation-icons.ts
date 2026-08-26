import {
  Cable,
  Cpu,
  Factory,
  FileCode,
  MonitorDot,
  Rocket,
  Settings,
  TriangleAlert,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { AppNavigationGroupKey, AppNavigationItemKey } from './app-navigation'

/**
 * LNB 항목 아이콘입니다 — 펼친 LNB 의 항목 행, 접힘 rail 의 플라이아웃, 페이지 제목 블록이 같은 값을 쓴다.
 *
 * <p>고르는 기준은 세 가지다.
 * (1) <b>메뉴 이름을 직역</b>한다 — 아이콘을 보면 메뉴 이름이, 이름을 보면 아이콘이 떠올라야 한다.
 *     한 단계 더 해석해야 하는 은유는 쓰지 않는다. Live-Map=모니터, 처리실패=경고 삼각형,
 *     설비=공장, SECS=규격 문서, Socket=연결 케이블, PLC=제어 칩, 배포=발사, 사용자·그룹=사람들.
 * (2) 형태가 겹치지 않게 한다 — 같은 아이콘을 두 번 쓰는 자리는 아래 예외뿐이다.
 * (3) 실제 표시 크기 16px 에서 형태가 남는 것을 쓴다 — 내부 선이 겹쳐 뭉개지는 것은 버린다.</p>
 *
 * <p>형태 중복 허용 예외: 그룹 아이콘과 그 그룹의 대표 항목이 같은 것
 * (monitoring↔liveMap, equipment↔eqp, deploy↔deploy) — 펼침은 항목만, rail 은 그룹만 그리므로
 * 한 화면에 함께 나오지 않는다.</p>
 *
 * <p>`Record<AppNavigationItemKey, …>` 라 항목을 추가하면 아이콘 누락이 컴파일 에러가 된다.</p>
 */
export const APP_NAVIGATION_ITEM_ICONS: Readonly<Record<AppNavigationItemKey, LucideIcon>> = {
  liveMap: MonitorDot,
  dlq: TriangleAlert,
  eqp: Factory,
  modelSecs: FileCode,
  modelSocket: Cable,
  modelPlc: Cpu,
  deploy: Rocket,
  user: Users,
}

/**
 * LNB 그룹 아이콘입니다 — 접힘 rail 에서는 그룹당 이 아이콘 하나만 남고, 클릭·hover 시
 * 플라이아웃이 그 그룹의 항목을 펼친다.
 *
 * <p>rail 에서는 이 5개만 단서이므로 그룹 이름을 직역하고 서로 확실히 다른 형태를 쓴다:
 * 모니터(모니터링) / 공장(설비) / 흐름도(모델) / 로켓(적용) / 톱니(시스템).</p>
 *
 * <p>`Record<AppNavigationGroupKey, …>` 라 그룹을 추가하면 아이콘 누락이 컴파일 에러가 된다.</p>
 */
export const APP_NAVIGATION_GROUP_ICONS: Readonly<Record<AppNavigationGroupKey, LucideIcon>> = {
  monitoring: MonitorDot,
  equipment: Factory,
  model: Workflow,
  deploy: Rocket,
  system: Settings,
}
