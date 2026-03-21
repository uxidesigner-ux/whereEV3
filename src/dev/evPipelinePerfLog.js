/**
 * 부트 / 「이 지역 검색」 파이프라인 계측
 * - DEV에서는 항상 로그
 * - 프로덕션: ?evPipeline=1 (콘솔 + EvPipelineDebugPanel)
 * @see ../utils/evPipelineUrl.js — URL 플래그 단일 출처
 */

import { evPipelineUrlEnabled } from '../utils/evPipelineUrl.js'
import { mergeEvPipelineDebug } from './evPipelineDebugStore.js'

/** 번들·문서용: 프로덕 빌드에서 문자열이 제거되지 않도록 참조 가능 */
export const EV_PIPELINE_LOG_LABELS = Object.freeze({
  fetchDone: '[evPipeline] ① fetch-done',
  adapterSamples: '[evPipeline] adapter-samples',
  reactPipeline: '[evPipeline] ② react-pipeline',
  firstMarker: '[evPipeline] ③ first-marker-visible',
})

export function isEvPipelineLogEnabled() {
  if (import.meta.env.DEV) return true
  return evPipelineUrlEnabled()
}

/** ① API 페이지 스캔 종료 직후 (네트워크+서버 응답 구간) */
export function logEvPipelineFetchDone(payload) {
  if (!isEvPipelineLogEnabled()) return
  // eslint-disable-next-line no-console
  console.info(EV_PIPELINE_LOG_LABELS.fetchDone, payload)
  mergeEvPipelineDebug({
    evPhase: payload.phase,
    fetchMs: payload.fetchMs,
    rawRowsScanned: payload.rawRowsScanned,
    boundsInsideRows: payload.boundsInsideRows,
    normalizeOk: payload.normalizeOk,
    normalizeNull: payload.normalizeNull,
    pagesScanned: payload.pagesScanned,
    evNote: payload.note,
  })
}

/** 첫 페이지 raw 5건: 좌표 적응·한국·bounds 여부 (real API shape 확인용) */
export function logEvPipelineAdapterSamples(payload) {
  if (!isEvPipelineLogEnabled()) return
  // eslint-disable-next-line no-console
  console.info(EV_PIPELINE_LOG_LABELS.adapterSamples, payload)
  mergeEvPipelineDebug({
    adapterSamplesPhase: payload.phase,
    adapterSamples: payload.samples,
  })
}

/** ② setItems 이후 한 프레임의 파생 상태(그룹·캡·최종 레이어) */
export function logEvPipelineReactPipeline(payload) {
  if (!isEvPipelineLogEnabled()) return
  // eslint-disable-next-line no-console
  console.info(EV_PIPELINE_LOG_LABELS.reactPipeline, payload)
  mergeEvPipelineDebug({
    evPhase: payload.phase,
    fetchMs: payload.fetchMsSnapshot,
    rawRowsScanned: payload.rawRowsScanned,
    boundsInsideRows: payload.boundsInsideRows,
    adaptedValidCoords: payload.adaptedValidCoords,
    groupedPlaces: payload.groupedPlaces,
    renderableAfterCap: payload.renderableAfterCap,
    finalRenderedMarkers: payload.finalRenderedMarkers,
    msSinceFetchEnd: payload.msSinceFetchEnd,
  })
}

/** ③ 첫 마커(또는 부트 Circle) DOM 가시 시점 */
export function logEvPipelineFirstMarker(payload) {
  if (!isEvPipelineLogEnabled()) return
  // eslint-disable-next-line no-console
  console.info(EV_PIPELINE_LOG_LABELS.firstMarker, payload)
  mergeEvPipelineDebug({
    evPhase: payload.phase,
    fetchMs: payload.fetchMs,
    rawRowsScanned: payload.rawRowsScanned,
    boundsInsideRows: payload.boundsInsideRows,
    adaptedValidCoords: payload.adaptedValidCoords,
    groupedPlaces: payload.groupedPlaces,
    renderableAfterCap: payload.renderableAfterCap,
    finalRenderedMarkers: payload.finalRenderedMarkers,
    markerWaitMs: payload.markerWaitMs,
    fetchEndToFirstPaintMs: payload.fetchEndToFirstPaintMs,
    clickToFirstPaintMs: payload.clickToFirstPaintMs,
    slowHint: payload.slowHint,
  })
}

/**
 * fetchMs vs fetch 끝~첫 페인트 구간 비교용 한 줄 해석 (휴리스틱)
 */
export function evPipelineSlowHint(fetchMs, fetchEndToFirstPaintMs) {
  if (fetchEndToFirstPaintMs == null || fetchMs == null) return 'n/a'
  const renderSide = Math.max(0, fetchEndToFirstPaintMs)
  if (fetchMs >= renderSide * 1.35 && fetchMs > 400) return 'fetch(네트워크/API 스캔) 비중이 큼'
  if (renderSide >= fetchMs * 1.35 && renderSide > 400) return 'React 그룹/캡/Leaflet·클러스터 페인트 비중이 큼'
  if (fetchMs > 800 && renderSide > 800) return 'fetch와 렌더 둘 다 체감될 만큼 걸림'
  return '둘 다 짧거나 비슷함'
}
