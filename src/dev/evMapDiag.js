/**
 * URL `?evDiag=flag1,flag2` 로 A/B·격리 진단 (개발·스테이징용)
 *
 * 예:
 * - hard1              : 데이터 파이프 우회, Leaflet 기본 마커 1개 + DOM 시각 측정
 * - hard10def          : 기본 아이콘 마커 10개
 * - hard10custom       : 앱과 동일 divIcon 10개 (순수 Leaflet)
 * - circle20           : CircleMarker 20개 (SVG path, marker 아이콘 아님)
 * - freeze1500         : 첫 비어있지 않은 mapLayer 24개를 1.5초 동안 고정 (소스 churn 격리)
 * - light              : EvStationMapLayer 최소 원형 divIcon (브랜드 SVG 제거)
 * - nobounds1500       : MapBoundsTracker가 마운트 후 1.5초간 setState 생략
 * - track              : 그룹핑·레이어 ref churn 로그
 * - noDefer            : useDeferredValue(지도용 items) 비활성화 (대조군)
 */

export function parseEvMapDiag() {
  if (typeof window === 'undefined') {
    return {
      flags: new Set(),
      hard1: false,
      hard10def: false,
      hard10custom: false,
      circle20: false,
      freeze1500: false,
      light: false,
      nobounds1500: false,
      track: false,
      noDefer: false,
      anyLeafletHarness: false,
    }
  }
  const raw = new URLSearchParams(window.location.search).get('evDiag') || ''
  const parts = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
  const flags = new Set(parts)
  const anyLeafletHarness =
    flags.has('hard1') || flags.has('hard10def') || flags.has('hard10custom') || flags.has('circle20')
  return {
    raw,
    flags,
    hard1: flags.has('hard1'),
    hard10def: flags.has('hard10def'),
    hard10custom: flags.has('hard10custom'),
    circle20: flags.has('circle20'),
    freeze1500: flags.has('freeze1500'),
    light: flags.has('light'),
    nobounds1500: flags.has('nobounds1500'),
    track: flags.has('track'),
    noDefer: flags.has('noDefer'),
    anyLeafletHarness,
  }
}

/** @type {{ current: number }} */
export const diagGroupedBaseComputeCount = { current: 0 }
/** @type {{ current: number }} */
export const diagMapLayerRefChanges = { current: 0 }
/** @type {{ current: number }} */
export const diagEvLayerMountCount = { current: 0 }
/** @type {{ current: number }} */
export const diagIconResolveCountRef = { current: 0 }

export function logDiag(label, msOrMsg, extra) {
  if (!import.meta.env.DEV) return
  if (typeof msOrMsg === 'number') {
    console.info(`[evDiag] ${label} +${msOrMsg.toFixed(1)}ms`, extra ?? '')
  } else {
    console.info(`[evDiag] ${label}`, msOrMsg, extra ?? '')
  }
}
