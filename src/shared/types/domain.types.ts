/**
 * 백엔드 ProtocolType enum 문자열 계약입니다.
 * 신규 관리 기능 기준으로 SECS/SOCKET/PLC 저장값을 사용합니다.
 */
export type ProtocolType = 'SECS' | 'SOCKET' | 'PLC' | (string & {})

/**
 * 백엔드 ModelStatus enum 문자열 계약입니다.
 * 신규 관리 기능 기준으로 DEVELOP/OPERATE/DEPRECATED 저장값을 사용합니다.
 */
export type ModelStatus = 'DEVELOP' | 'OPERATE' | 'DEPRECATED' | (string & {})
