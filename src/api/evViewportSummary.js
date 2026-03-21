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

/**
 * 클라이언트 bbox 필터 전용이라 페이지를 많이 돌수록 느려짐.
 * - boot/refresh: 조금 더 많이 스캔
 * - search-area / 칩 / 검색 fit 등 사용자 입력: 상한을 낮춰 체감 속도 우선(누락 가능성은 docs에 명시)
 */
export const VIEWPORT_SUMMARY_FETCH_PRESETS = {
  boot: { maxPages: 14, maxRowsInBounds: 3500, numOfRows: 500 },
  interactive: { maxPages: 8, maxRowsInBounds: 2200, numOfRows: 500 },
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
 * }} [opts]
 * @returns {Promise<{ rows: object[], pagesScanned: number, truncated: boolean, totalReported: number | null }>}
 */
export async function fetchEvChargersSummaryForBounds(boundsLiteral, opts = {}) {
  const numOfRows = opts.numOfRows ?? 500
  const maxPages = opts.maxPages ?? 18
  const maxRowsInBounds = opts.maxRowsInBounds ?? 4000
  const signal = opts.signal
  const pipelineDebug = opts.pipelineDebug === true && import.meta.env.DEV

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
      return { rows: inBounds, pagesScanned, truncated: true, totalReported }
    }
    const data = await fetchEvChargersPage({ pageNo: page, numOfRows })
    if (signal?.aborted) {
      return { rows: inBounds, pagesScanned, truncated: true, totalReported }
    }
    const totalCountFromApi = data.response?.body?.totalCount ?? data.body?.totalCount ?? data.totalCount
    if (totalCountFromApi != null) totalReported = Number(totalCountFromApi)

    const list = extractListFromResponse(data)
    pagesScanned = page

    let pageNormOk = 0
    let pageInBounds = 0
    let pageNormNull = 0

    for (let i = 0; i < list.length; i += 1) {
      rawItemCount += 1
      const n = normalizeCharger(list[i], inBounds.length + i)
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
        return { rows: inBounds, pagesScanned, truncated, totalReported }
      }
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

  return { rows: inBounds, pagesScanned, truncated, totalReported }
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
