/**
 * Safemap EV 목록 API는 bbox 쿼리를 지원하지 않음.
 * 페이지 단위로 받은 뒤 클라이언트에서 viewport(bounds) 안만 누적하는 임시 summary 계층.
 * @see docs — 향후 서버에 bbox/summary 전용 API가 생기면 이 모듈만 교체하면 됨.
 */

import L from 'leaflet'
import {
  fetchEvChargersPage,
  normalizeCharger,
  extractListFromResponse,
} from './safemapEv.js'
import { isLatLngRoughlyKorea } from '../utils/coordTransform.js'
import { isEvPipelineLogEnabled } from '../dev/evPipelinePerfLog.js'

/**
 * 클라이언트 bbox 필터 전용이라 페이지를 많이 돌수록 느려짐.
 * 모바일 first paint·IF_0042 호출량 우선(뷰포트 밖·순서 뒤쪽 누락 가능 → docs/DATA-SOURCES.md).
 * stopWhenInBoundsGte: 지도 캡(~260)·그룹화 전제로 “첫 화면에 쓸 만큼” 모이면 다음 페이지 스캔 생략.
 */
export const VIEWPORT_SUMMARY_FETCH_PRESETS = {
  boot: {
    maxPages: 3,
    maxRowsInBounds: 400,
    numOfRows: 400,
    stopWhenInBoundsGte: 180,
  },
  interactive: {
    maxPages: 2,
    maxRowsInBounds: 280,
    numOfRows: 400,
    stopWhenInBoundsGte: 120,
  },
}

/**
 * @param {'boot' | 'refresh' | 'search-area' | 'suggestion-chip' | 'search'} reason
 */
export function summaryPresetForReason(reason) {
  if (reason === 'boot' || reason === 'refresh') return VIEWPORT_SUMMARY_FETCH_PRESETS.boot
  return VIEWPORT_SUMMARY_FETCH_PRESETS.interactive
}

/** @param {import('./safemapEv.js').BoundsLiteral | null | undefined} bounds */
export function literalBoundsContains(bounds, lat, lng) {
  if (!bounds?.southWest || !bounds?.northEast) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  try {
    return L.latLngBounds(
      [bounds.southWest.lat, bounds.southWest.lng],
      [bounds.northEast.lat, bounds.northEast.lng],
    ).contains([lat, lng])
  } catch {
    return false
  }
}

/**
 * @param {{ southWest: { lat: number, lng: number }, northEast: { lat: number, lng: number } }} boundsLiteral
 * @param {{
 *   numOfRows?: number
 *   maxPages?: number
 *   maxRowsInBounds?: number
 *   signal?: AbortSignal
 *   pipelineDebug?: boolean
 *   onFirstPageSample?: (p: { rawCount: number, sample: { raw: object, n: object | null }[] }) => void
 *   adapterProofVerbose?: boolean
 *   collectAdapterSamples?: boolean
 *   stopWhenInBoundsGte?: number
 * }} [opts]
 * @returns {Promise<{ rows: object[], pagesScanned: number, truncated: boolean, totalReported: number | null, pipelineCounts?: object, adapterSamples?: object[] }>}
 */
export async function fetchEvChargersSummaryForBounds(boundsLiteral, opts = {}) {
  const numOfRows = opts.numOfRows ?? 500
  const maxPages = opts.maxPages ?? 18
  const maxRowsInBounds = opts.maxRowsInBounds ?? 4000
  const stopWhenInBoundsGte =
    typeof opts.stopWhenInBoundsGte === 'number' && opts.stopWhenInBoundsGte > 0
      ? opts.stopWhenInBoundsGte
      : null
  const signal = opts.signal
  const pipelineDebug =
    opts.pipelineDebug === true && (import.meta.env.DEV || isEvPipelineLogEnabled())
  const adapterSamples = opts.collectAdapterSamples === true ? [] : null

  const inBounds = []
  const seenId = new Set()
  let pagesScanned = 0
  let truncated = false
  let totalReported = null
  let rawItemCount = 0
  let totalNormalized = 0
  let totalNormNull = 0

  for (let page = 1; page <= maxPages; page += 1) {
    if (signal?.aborted) {
      return {
        rows: inBounds,
        pagesScanned,
        truncated: true,
        totalReported,
        pipelineCounts: { rawItemCount, totalNormalized, totalNormNull, rowsInBounds: inBounds.length },
        ...(adapterSamples ? { adapterSamples } : {}),
      }
    }
    const data = await fetchEvChargersPage({ pageNo: page, numOfRows })
    if (signal?.aborted) {
      return {
        rows: inBounds,
        pagesScanned,
        truncated: true,
        totalReported,
        pipelineCounts: { rawItemCount, totalNormalized, totalNormNull, rowsInBounds: inBounds.length },
        ...(adapterSamples ? { adapterSamples } : {}),
      }
    }
    const totalCountFromApi = data.response?.body?.totalCount ?? data.body?.totalCount ?? data.totalCount
    if (totalCountFromApi != null) totalReported = Number(totalCountFromApi)

    const list = extractListFromResponse(data)
    pagesScanned = page

    let pageNormOk = 0
    let pageInBounds = 0
    let pageNormNull = 0

    const firstPageSampleBuf =
      page === 1 && typeof opts.onFirstPageSample === 'function' ? [] : null
    const adapterProofVerbose = opts.adapterProofVerbose === true && import.meta.env.DEV

    for (let i = 0; i < list.length; i += 1) {
      rawItemCount += 1
      const rawRow = list[i]
      const n = normalizeCharger(rawRow, inBounds.length + i)
      if (adapterSamples && page === 1 && adapterSamples.length < 5) {
        const rx = rawRow?.x ?? rawRow?.XPOINT ?? rawRow?.locationX
        const ry = rawRow?.y ?? rawRow?.YPOINT ?? rawRow?.locationY
        const valid = !!(n && Number.isFinite(n.lat) && Number.isFinite(n.lng))
        const lat = valid ? n.lat : null
        const lng = valid ? n.lng : null
        adapterSamples.push({
          rawX: rx,
          rawY: ry,
          adaptedLat: lat,
          adaptedLng: lng,
          valid,
          korea: valid ? isLatLngRoughlyKorea(lat, lng) : false,
          boundsInside: valid ? literalBoundsContains(boundsLiteral, lat, lng) : false,
        })
      }
      if (firstPageSampleBuf && firstPageSampleBuf.length < 20) {
        firstPageSampleBuf.push({ raw: rawRow, n })
      }
      if (adapterProofVerbose && page === 1 && i < 5) {
        const rx = rawRow?.x ?? rawRow?.XPOINT ?? rawRow?.locationX
        const ry = rawRow?.y ?? rawRow?.YPOINT ?? rawRow?.locationY
        // eslint-disable-next-line no-console -- 강제 증명용
        console.info('[adapterProof]', {
          stationId: n?.id ?? rawRow?.statId ?? rawRow?.STATID ?? i,
          rawX: rx,
          rawY: ry,
          adaptedLat: n?.lat,
          adaptedLng: n?.lng,
          latLngValid: !!(n && Number.isFinite(n.lat) && Number.isFinite(n.lng)),
          korea: n && Number.isFinite(n.lat) && Number.isFinite(n.lng) ? isLatLngRoughlyKorea(n.lat, n.lng) : false,
          finalRenderCoords: n && Number.isFinite(n.lat) && Number.isFinite(n.lng) ? [n.lat, n.lng] : null,
        })
      }
      if (!n) {
        pageNormNull += 1
        totalNormNull += 1
        continue
      }
      pageNormOk += 1
      totalNormalized += 1
      if (!literalBoundsContains(boundsLiteral, n.lat, n.lng)) continue
      if (seenId.has(n.id)) continue
      seenId.add(n.id)
      inBounds.push(n)
      pageInBounds += 1
      if (stopWhenInBoundsGte != null && inBounds.length >= stopWhenInBoundsGte) {
        truncated = true
        if (pipelineDebug) {
          // eslint-disable-next-line no-console -- 파이프라인 계측
          console.info('[evPipeline] early-stop-sufficient-in-bounds', {
            page,
            rowsInBounds: inBounds.length,
            stopWhenInBoundsGte,
            rawItemCount,
          })
        }
        return {
          rows: inBounds,
          pagesScanned,
          truncated,
          totalReported,
          pipelineCounts: { rawItemCount, totalNormalized, totalNormNull, rowsInBounds: inBounds.length },
          ...(adapterSamples ? { adapterSamples } : {}),
        }
      }
      if (inBounds.length >= maxRowsInBounds) {
        truncated = true
        if (pipelineDebug) {
          // eslint-disable-next-line no-console -- 파이프라인 계측
          console.info('[evPipeline] truncated', {
            page,
            rawItemCount,
            totalNormalized,
            totalNormNull,
            rowsInBounds: inBounds.length,
            sampleLatLng: { lat: n.lat, lng: n.lng },
          })
        }
        return {
          rows: inBounds,
          pagesScanned,
          truncated,
          totalReported,
          pipelineCounts: { rawItemCount, totalNormalized, totalNormNull, rowsInBounds: inBounds.length },
          ...(adapterSamples ? { adapterSamples } : {}),
        }
      }
    }

    if (page === 1 && typeof opts.onFirstPageSample === 'function' && firstPageSampleBuf) {
      opts.onFirstPageSample({ rawCount: list.length, sample: firstPageSampleBuf })
    }

    if (pipelineDebug) {
      // eslint-disable-next-line no-console -- 파이프라인 계측
      console.info('[evPipeline] page', {
        page,
        rawRows: list.length,
        normalizedOk: pageNormOk,
        normalizeNull: pageNormNull,
        addedInBoundsThisPage: pageInBounds,
        cumulativeInBounds: inBounds.length,
      })
    }

    const shortPage = list.length < numOfRows
    const reachedTotal = totalReported != null && page * numOfRows >= totalReported
    if (shortPage || reachedTotal) {
      truncated = false
      break
    }
  }

  if (pipelineDebug) {
    // eslint-disable-next-line no-console -- 파이프라인 계측
    console.info('[evPipeline] summary', {
      pagesScanned,
      rawItemCount,
      totalNormalized,
      totalNormNull,
      rowsInBounds: inBounds.length,
      totalReported,
      bounds: boundsLiteral,
    })
  }

  return {
    rows: inBounds,
    pagesScanned,
    truncated,
    totalReported,
    pipelineCounts: { rawItemCount, totalNormalized, totalNormNull, rowsInBounds: inBounds.length },
    ...(adapterSamples ? { adapterSamples } : {}),
  }
}

/**
 * dev mock: bounds 안 행만 (비어 있으면 일부 샘플 유지해 지도가 텅 비지 않게)
 * @param {object[]} mockRows
 * @param {object} boundsLiteral
 */
export function filterDevMockRowsToBounds(mockRows, boundsLiteral) {
  const hit = (mockRows || []).filter((r) =>
    literalBoundsContains(boundsLiteral, Number(r.lat), Number(r.lng)),
  )
  if (hit.length > 0) return hit
  return (mockRows || []).slice(0, Math.min(6, mockRows.length))
}
