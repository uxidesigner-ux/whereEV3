/**
 * DEV 전용: viewport summary 부트 / 이 지역 검색 / 칩 흐름 계측.
 * 프로덕션에서는 no-op.
 */

const origin = typeof performance !== 'undefined' ? performance.now() : 0

export const viewportSummaryMetrics = {
  fetchStarts: 0,
  fetchAbortsObserved: 0,
  staleResponsesDropped: 0,
  stateApplies: 0,
}

export function viewportSummaryTelemetryReset() {
  viewportSummaryMetrics.fetchStarts = 0
  viewportSummaryMetrics.fetchAbortsObserved = 0
  viewportSummaryMetrics.staleResponsesDropped = 0
  viewportSummaryMetrics.stateApplies = 0
}

/**
 * @param {string} reason
 * @param {string} phase
 * @param {Record<string, unknown>} [detail]
 */
export function viewportSummaryTelemetry(reason, phase, detail) {
  if (!import.meta.env.DEV) return
  const ms = (performance.now() - origin).toFixed(0)
  // eslint-disable-next-line no-console -- 개발 계측
  console.info(`[evViewportSummary] +${ms}ms`, reason, phase, detail ?? '')
}

export function viewportSummaryMarkFetchStart() {
  viewportSummaryMetrics.fetchStarts += 1
}

export function viewportSummaryMarkAbort() {
  viewportSummaryMetrics.fetchAbortsObserved += 1
}

export function viewportSummaryMarkStale() {
  viewportSummaryMetrics.staleResponsesDropped += 1
}

export function viewportSummaryMarkApplied() {
  viewportSummaryMetrics.stateApplies += 1
}
