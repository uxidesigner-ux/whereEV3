#!/usr/bin/env node
/**
 * public/data/ev-stations-summary.json 크기·파싱 시간·meta·행 수 점검.
 * 사용: node scripts/inspect-ev-summary.mjs [path]
 */
import { readFileSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT = join(__dirname, '..', 'public', 'data', 'ev-stations-summary.json')

const path = process.argv[2] || DEFAULT
const WARN_MB = 8
const WARN_PARSE_MS = 800

let st
try {
  st = statSync(path)
} catch (e) {
  console.error('[inspect-ev-summary] 파일 없음:', path, e.message)
  process.exit(1)
}

const t0 = performance.now()
const raw = readFileSync(path, 'utf8')
const parsed = JSON.parse(raw)
const parseMs = Math.round(performance.now() - t0)

const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}
const places = Array.isArray(parsed.places) ? parsed.places : []
let rowCount = 0
for (const p of places) {
  rowCount += Array.isArray(p.rows) ? p.rows.length : 0
}

const gz = gzipSync(raw)
const gzipRatio = raw.length ? ((1 - gz.length / raw.length) * 100).toFixed(1) : '0'

const out = {
  path,
  fileSizeBytes: st.size,
  fileSizeMb: Number((st.size / (1024 * 1024)).toFixed(3)),
  parseMs,
  gzipBytes: gz.length,
  gzipSavingsPercent: Number(gzipRatio),
  schemaVersion: parsed.schemaVersion ?? meta.schemaVersion,
  generatedAt: parsed.generatedAt ?? meta.generatedAt,
  metaTotalRawRows: meta.totalRawRows,
  metaTotalNormalizedRows: meta.totalNormalizedRows,
  metaTotalPlaces: meta.totalPlaces,
  metaCoordRejectCount: meta.coordRejectCount,
  metaKoreaFilteredCount: meta.koreaFilteredCount,
  actualPlaces: places.length,
  actualRowsInPlaces: rowCount,
  dataSource: meta.dataSource,
}

console.info(JSON.stringify(out, null, 2))

if (out.fileSizeMb >= WARN_MB) {
  console.warn(
    `[inspect-ev-summary] 경고: 파일이 ${WARN_MB}MB 이상입니다. rows 분리·필드 축소·압축 전송(brotli/gzip)을 검토하세요.`,
  )
}
if (parseMs >= WARN_PARSE_MS) {
  console.warn(`[inspect-ev-summary] 경고: JSON.parse가 ${WARN_PARSE_MS}ms 이상 걸렸습니다(환경 의존).`)
}

if (rowCount > 0 && meta.totalNormalizedRows != null && rowCount !== meta.totalNormalizedRows) {
  console.warn(
    '[inspect-ev-summary] 경고: meta.totalNormalizedRows와 places 내 rows 합이 일치하지 않습니다.',
    { metaTotalNormalizedRows: meta.totalNormalizedRows, actualRowsInPlaces: rowCount },
  )
}
