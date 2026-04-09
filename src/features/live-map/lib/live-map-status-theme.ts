import type { LiveMapEqpStatus, LiveMapPortStatus } from '../types/live-map.types'

export const LIVE_MAP_STATUS_THEME: Record<
  LiveMapEqpStatus,
  {
    summaryBackground: string
    summaryBorder: string
    summaryLabel: string
    summaryValue: string
    legendDot: string
    legendBackground: string
    legendBorder: string
    legendText: string
    badgeBackground: string
    badgeBorder: string
    badgeText: string
    panelBackground: string
    panelBorder: string
    panelText: string
    nodeTop: string
    nodeLower: string
    nodeLamp: string
    nodeLampBorder: string
  }
> = {
  RUN: {
    summaryBackground: '#F4FCF7',
    summaryBorder: '#CBEBD5',
    summaryLabel: '#3B8B56',
    summaryValue: '#256B3D',
    legendDot: '#43B865',
    legendBackground: '#152319',
    legendBorder: '#284130',
    legendText: '#8ED3A3',
    badgeBackground: '#122319',
    badgeBorder: '#254633',
    badgeText: '#8FDEAA',
    panelBackground: '#17211B',
    panelBorder: '#28412E',
    panelText: '#97D4AB',
    nodeTop: '#46B96A',
    nodeLower: '#D9F2E1',
    nodeLamp: '#43B865',
    nodeLampBorder: '#1C5A31',
  },
  IDLE: {
    summaryBackground: '#F4F8FF',
    summaryBorder: '#CFDDF6',
    summaryLabel: '#4C79BA',
    summaryValue: '#315B9A',
    legendDot: '#5A8DFF',
    legendBackground: '#151C28',
    legendBorder: '#2E4062',
    legendText: '#A9C2FF',
    badgeBackground: '#16233A',
    badgeBorder: '#35537E',
    badgeText: '#A8C1FF',
    panelBackground: '#182233',
    panelBorder: '#304867',
    panelText: '#A8C1FF',
    nodeTop: '#5A8DFF',
    nodeLower: '#DCE7FF',
    nodeLamp: '#5A8DFF',
    nodeLampBorder: '#274B98',
  },
  ERROR: {
    summaryBackground: '#FFF7F7',
    summaryBorder: '#F0D7D5',
    summaryLabel: '#B06262',
    summaryValue: '#8B4747',
    legendDot: '#E06363',
    legendBackground: '#2A1B1F',
    legendBorder: '#6B424A',
    legendText: '#F2AAB3',
    badgeBackground: '#2A171C',
    badgeBorder: '#5A333D',
    badgeText: '#F1A7B0',
    panelBackground: '#2A1B1F',
    panelBorder: '#65404A',
    panelText: '#F1A9B3',
    nodeTop: '#E06363',
    nodeLower: '#F7D9D9',
    nodeLamp: '#E06363',
    nodeLampBorder: '#7A2727',
  },
  DOWN: {
    summaryBackground: '#F4F5F7',
    summaryBorder: '#D7DBE0',
    summaryLabel: '#6E7782',
    summaryValue: '#505862',
    legendDot: '#8C96A2',
    legendBackground: '#1C2126',
    legendBorder: '#37414A',
    legendText: '#B6BEC7',
    badgeBackground: '#1B2026',
    badgeBorder: '#46525F',
    badgeText: '#C9D3DB',
    panelBackground: '#1B2026',
    panelBorder: '#46525F',
    panelText: '#C9D3DB',
    nodeTop: '#7B8591',
    nodeLower: '#D8DEE5',
    nodeLamp: '#8C96A2',
    nodeLampBorder: '#48515B',
  },
}

export const LIVE_MAP_PORT_STATUS_THEME: Record<
  LiveMapPortStatus,
  {
    background: string
    border: string
    text: string
  }
> = {
  RUN: {
    background: '#152319',
    border: '#284130',
    text: '#8ED3A3',
  },
  IDLE: {
    background: '#151C28',
    border: '#2E4062',
    text: '#A9C2FF',
  },
  DOWN: {
    background: '#1C2126',
    border: '#37414A',
    text: '#B6BEC7',
  },
}
