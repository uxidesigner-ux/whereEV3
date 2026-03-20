import { aggregateStatCounts, formatStatSummary, getLatestStatUpdDt } from '../api/safemapEv.js'
import { placeKey, summarizeSpeedCategories, pickShortLocationHint, formatListSummary } from './geo.js'

/**
 * 충전기 행 배열을 장소(statNm+좌표) 단위로 묶어 지도/목록 공통 객체로 변환.
 * @param {Array<Record<string, unknown>>} items
 * @returns {Array<Record<string, unknown>>}
 */
export function groupChargerRowsByPlace(items) {
  const byKey = new Map()
  for (const row of items || []) {
    const key = placeKey(row)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(row)
  }
  return Array.from(byKey.entries()).map(([id, rows]) => {
    const first = rows[0]
    const statCounts = aggregateStatCounts(rows)
    let adres = ''
    let rnAdres = ''
    for (const r of rows) {
      if (!adres && (r.adres || '').trim()) adres = (r.adres || '').trim()
      if (!rnAdres && (r.rnAdres || '').trim()) rnAdres = (r.rnAdres || '').trim()
      if (adres && rnAdres) break
    }
    return {
      id,
      statNm: first.statNm,
      lat: first.lat,
      lng: first.lng,
      distanceKm: 0,
      totalChargers: rows.length,
      statCounts,
      statSummary: formatStatSummary(statCounts),
      latestStatUpdDt: getLatestStatUpdDt(rows),
      busiNm: formatListSummary(rows.map((r) => r.busiNm), 2),
      chgerTyLabel: formatListSummary(rows.map((r) => r.displayChgerLabel ?? r.chgerTyLabel), 2),
      speedBadge: summarizeSpeedCategories(rows),
      locationHint: pickShortLocationHint(rows, first),
      rows,
      adres: adres || (first.adres || '').trim(),
      rnAdres: rnAdres || (first.rnAdres || '').trim(),
      useTm: first.useTm,
      telno: first.telno,
    }
  })
}
