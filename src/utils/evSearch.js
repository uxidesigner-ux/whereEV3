/**
 * EV 충전소 행(정규화 + MVP overlay 이후) 기준 탐색 검색.
 * 실데이터 필드만 사용 — API에 없는 키워드(무료·공영주차장 등)는 억지 매칭하지 않음.
 */

/**
 * @param {Record<string, unknown>} s
 * @returns {string} 소문자·공백 연결 문자열
 */
export function buildEvSearchHaystack(s) {
  if (!s || typeof s !== 'object') return ''
  const parts = [
    s.statNm,
    s.adres,
    s.rnAdres,
    s.busiNm,
    s.chgerNm,
    s.outputKw,
    s.displayChgerLabel,
    s.chgerTyLabel,
    s.chgerTy,
    s.speedCategory,
    s.useTm,
    s.ctprvnNm,
    s.sggNm,
  ]
  return parts
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).toLowerCase())
    .join(' ')
}

/**
 * @param {Record<string, unknown>} s
 * @param {string} qRaw
 */
export function itemMatchesEvSearchQuery(s, qRaw) {
  const q = (qRaw || '').trim().toLowerCase()
  if (!q) return true
  const hay = buildEvSearchHaystack(s)
  return hay.includes(q)
}
