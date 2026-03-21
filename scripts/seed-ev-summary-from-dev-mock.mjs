#!/usr/bin/env node
/**
 * API 키 없이 public/data/ev-stations-summary.json 을 채울 때 사용.
 * dev mock 충전소와 동일한 geometry·스키마로 place 단위 summary 생성(실서비스 전국 데이터는 build-ev-stations-summary.mjs).
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { getDevMockEvChargers } from '../src/dev/mockEvChargers.js'
import {
  aggregateStatCounts,
  formatStatSummary,
  getLatestStatUpdDt,
  pickPrimaryAddress,
} from '../src/api/safemapEv.js'
import { placeKey, formatListSummary, pickShortLocationHint, summarizeSpeedCategories } from '../src/utils/geo.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'data', 'ev-stations-summary.json')

/** overlay 제거: 스냅샷에는 API(stat) 원본만 둠 */
function toStaticRow(r) {
  const api = r.apiStat != null && String(r.apiStat).trim() !== '' ? String(r.apiStat).trim() : null
  const { apiStat: _a, ...rest } = r
  return { ...rest, stat: api ?? rest.stat, dataSource: 'safemap' }
}

function buildPlaceRecord(placeId, rows, generatedAt) {
  const first = rows[0]
  const statCounts = aggregateStatCounts(rows)
  const stationIds = [...new Set(rows.map((x) => String(x.statId ?? '').trim()).filter(Boolean))]
  const parts = [first.statNm, first.busiNm, first.adres, first.rnAdres, first.ctprvnNm, first.sggNm, stationIds.join(' ')]
  const searchableText = parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800)
  const regionSummary = [first.ctprvnNm, first.sggNm].filter(Boolean).join(' ').trim()
  return {
    placeId,
    stationIds,
    stationName: first.statNm,
    lat: first.lat,
    lng: first.lng,
    addressSummary: pickPrimaryAddress({ rows }),
    regionSummary: regionSummary || undefined,
    chargerCount: rows.length,
    chargerTypesSummary: formatListSummary(
      rows.map((x) => x.displayChgerLabel ?? x.chgerTyLabel),
      3,
    ),
    operatorSummary: formatListSummary(
      rows.map((x) => x.busiNm),
      2,
    ),
    statSummary: formatStatSummary(statCounts),
    latestStatUpdDt: getLatestStatUpdDt(rows),
    speedBadge: summarizeSpeedCategories(rows),
    locationHint: pickShortLocationHint(rows, first),
    searchableText,
    dataSource: 'dev-mock-seed',
    updatedAt: generatedAt,
    rows,
  }
}

const generatedAt = new Date().toISOString()
const staticRows = getDevMockEvChargers().map(toStaticRow)
const placeMap = new Map()
for (const row of staticRows) {
  const k = placeKey(row)
  if (!placeMap.has(k)) placeMap.set(k, [])
  placeMap.get(k).push(row)
}
const places = Array.from(placeMap.entries()).map(([pid, rows]) => buildPlaceRecord(pid, rows, generatedAt))

const payload = {
  schemaVersion: 1,
  generatedAt,
  meta: {
    generatedAt,
    totalRawRows: staticRows.length,
    totalNormalizedRows: staticRows.length,
    totalPlaces: places.length,
    schemaVersion: 1,
    dataSource: 'dev-mock-seed',
    note: 'API 키 없이 생성된 시드 파일. 전국 실데이터는 npm run build:ev-summary',
  },
  places,
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(payload, null, 0)}\n`, 'utf8')
console.info('[seed-ev-summary] wrote', OUT, 'places=', places.length, 'chargers=', staticRows.length)
