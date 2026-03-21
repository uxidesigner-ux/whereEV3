/**
 * DEV: 「이 지역 검색」 클릭~오버레이~fetch~렌더 단계 시각화
 */

export const searchAreaTimingMetrics = {
  buttonClicks: 0,
  fetchesStarted: 0,
  duplicateClickIgnored: 0,
  aborts: 0,
  staleDrops: 0,
  renderSourceChanges: 0,
}

export function searchAreaTimingResetSession() {
  return { t0: performance.now(), marks: [] }
}

export function searchAreaTimingLog(session, label, extra = {}) {
  if (!import.meta.env.DEV || !session) return
  const ms = Math.round(performance.now() - session.t0)
  // eslint-disable-next-line no-console
  console.info('[searchAreaTiming]', label, { ms, ...extra })
}
