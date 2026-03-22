import { literalBoundsContains, filterNormalizedRowsToBounds } from '../api/evViewportSummary.js'

/** ~31km(lat) — 뷰포트와 겹치는 셀만 스캔 후 `literalBoundsContains`로 정밀 필터 */
const CELL_DEG = 0.28

/** 그리드 유지 비용 대비 이하이면 선형 스캔 */
const LINEAR_MAX = 8000

/**
 * @param {object[]} rows
 * @returns {{ queryBounds: (b: import('../api/evViewportSummary.js').BoundsLiteral | null | undefined) => object[] }}
 */
export function buildEvCatalogSpatialIndex(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      queryBounds: (b) => filterNormalizedRowsToBounds(rows, b),
    }
  }
  if (rows.length <= LINEAR_MAX) {
    return {
      queryBounds: (b) => filterNormalizedRowsToBounds(rows, b),
    }
  }

  /** @type {Map<string, object[]>} */
  const grid = new Map()
  for (const r of rows) {
    const la = Number(r?.lat)
    const ln = Number(r?.lng)
    if (!Number.isFinite(la) || !Number.isFinite(ln)) continue
    const ki = Math.floor(la / CELL_DEG)
    const kj = Math.floor(ln / CELL_DEG)
    const key = `${ki},${kj}`
    let bucket = grid.get(key)
    if (!bucket) {
      bucket = []
      grid.set(key, bucket)
    }
    bucket.push(r)
  }

  return { queryBounds: makeQueryBoundsFromGrid(grid) }
}

/** @param {Map<string, object[]>} grid */
function makeQueryBoundsFromGrid(grid) {
  return (boundsLiteral) => {
    if (!boundsLiteral?.southWest || !boundsLiteral?.northEast) return []
    const sw = boundsLiteral.southWest
    const ne = boundsLiteral.northEast
    const minLat = Math.min(sw.lat, ne.lat)
    const maxLat = Math.max(sw.lat, ne.lat)
    const minLng = Math.min(sw.lng, ne.lng)
    const maxLng = Math.max(sw.lng, ne.lng)
    const i0 = Math.floor(minLat / CELL_DEG) - 1
    const i1 = Math.floor(maxLat / CELL_DEG) + 1
    const j0 = Math.floor(minLng / CELL_DEG) - 1
    const j1 = Math.floor(maxLng / CELL_DEG) + 1

    const out = []
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const bucket = grid.get(`${i},${j}`)
        if (!bucket) continue
        for (const r of bucket) {
          const la = Number(r?.lat)
          const ln = Number(r?.lng)
          if (!Number.isFinite(la) || !Number.isFinite(ln)) continue
          if (literalBoundsContains(boundsLiteral, la, ln)) out.push(r)
        }
      }
    }
    return out
  }
}

const DEFAULT_INDEX_YIELD_EVERY = 4000

/**
 * 대용량 카탈로그에서 그리드 구축만 청크로 나눠 메인 스레드 양보(모바일 크래시 완화).
 * @param {object[]} rows
 * @param {number} [yieldEvery]
 */
export async function buildEvCatalogSpatialIndexAsync(rows, yieldEvery = DEFAULT_INDEX_YIELD_EVERY) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return buildEvCatalogSpatialIndex(rows)
  }
  if (rows.length <= LINEAR_MAX) {
    return buildEvCatalogSpatialIndex(rows)
  }

  /** @type {Map<string, object[]>} */
  const grid = new Map()
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]
    const la = Number(r?.lat)
    const ln = Number(r?.lng)
    if (!Number.isFinite(la) || !Number.isFinite(ln)) continue
    const ki = Math.floor(la / CELL_DEG)
    const kj = Math.floor(ln / CELL_DEG)
    const key = `${ki},${kj}`
    let bucket = grid.get(key)
    if (!bucket) {
      bucket = []
      grid.set(key, bucket)
    }
    bucket.push(r)
    if (i > 0 && i % yieldEvery === 0) {
      await new Promise((res) => setTimeout(res, 0))
    }
  }

  return { queryBounds: makeQueryBoundsFromGrid(grid) }
}

/**
 * @param {{ current: object[] | null }} catalogRef
 * @param {{ current: ReturnType<typeof buildEvCatalogSpatialIndex> | null }} indexRef
 * @param {object[] | null} rows
 */
export function assignFullEvCatalogWithIndex(catalogRef, indexRef, rows) {
  catalogRef.current = rows
  if (rows == null) {
    indexRef.current = null
    return
  }
  indexRef.current = buildEvCatalogSpatialIndex(Array.isArray(rows) ? rows : [])
}

/**
 * 부트·대용량 refresh: 인덱스 구축 중 이벤트 루프 양보.
 * @param {{ current: object[] | null }} catalogRef
 * @param {{ current: ReturnType<typeof buildEvCatalogSpatialIndex> | null }} indexRef
 * @param {object[] | null} rows
 * @param {number} [yieldEvery]
 */
export async function assignFullEvCatalogWithIndexAsync(catalogRef, indexRef, rows, yieldEvery) {
  catalogRef.current = rows
  if (rows == null) {
    indexRef.current = null
    return
  }
  const arr = Array.isArray(rows) ? rows : []
  indexRef.current = await buildEvCatalogSpatialIndexAsync(arr, yieldEvery ?? DEFAULT_INDEX_YIELD_EVERY)
}
