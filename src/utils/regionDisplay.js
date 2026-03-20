/**
 * 행정구역 코드(ctprvnCd, sggCd) → 사용자 표시용 지역명.
 * 필터 값(value)은 코드 유지, label만 사람이 읽는 형태로 쓴다.
 */

/** 행정안전부 법정동 코드 기준 시·도(앞 2자리와 대응되는 대표 코드) */
export const CTPRVN_CD_TO_NAME = {
  '11': '서울특별시',
  '26': '부산광역시',
  '27': '대구광역시',
  '28': '인천광역시',
  '29': '광주광역시',
  '30': '대전광역시',
  '31': '울산광역시',
  '36': '세종특별자치시',
  '41': '경기도',
  '42': '강원도',
  '43': '충청북도',
  '44': '충청남도',
  '45': '전북특별자치도',
  '46': '전라남도',
  '47': '경상북도',
  '48': '경상남도',
  '50': '제주특별자치도',
  '51': '강원특별자치도',
  '52': '전북특별자치도',
}

/** 서울시 5자리 시군구코드 → 구 이름 (데이터에 주소가 없을 때 보조) */
export const SGG_CODE_TO_SHORT_NAME = {
  '11110': '종로구',
  '11140': '중구',
  '11170': '용산구',
  '11200': '성동구',
  '11215': '광진구',
  '11230': '동대문구',
  '11260': '중랑구',
  '11290': '성북구',
  '11305': '강북구',
  '11320': '도봉구',
  '11350': '노원구',
  '11380': '은평구',
  '11410': '서대문구',
  '11440': '마포구',
  '11470': '양천구',
  '11500': '강서구',
  '11530': '구로구',
  '11545': '금천구',
  '11560': '영등포구',
  '11590': '동작구',
  '11620': '관악구',
  '11650': '서초구',
  '11680': '강남구',
  '11710': '송파구',
  '11740': '강동구',
}

/**
 * 지번/도로명 주소 앞단에서 시군구 토큰 추출 (시도명 다음 첫 구·시·군).
 * @param {string} adres
 * @param {string} ctprvnCd
 */
export function extractSigunguFromAddress(adres, ctprvnCd) {
  const raw = (adres || '').trim()
  if (!raw) return ''
  const sido = CTPRVN_CD_TO_NAME[ctprvnCd]
  if (sido) {
    const idx = raw.indexOf(sido)
    if (idx !== -1) {
      const rest = raw.slice(idx + sido.length).trim()
      const m = rest.match(/^([가-힣0-9]+(?:구|시|군))/)
      if (m) return m[1]
    }
  }
  const m2 = raw.match(
    /[가-힣]+(?:특별시|광역시|특별자치시|특별자치도|도)\s+([가-힣0-9]+(?:구|시|군))/
  )
  if (m2) return m2[1]
  return ''
}

function bumpVote(votes, label) {
  const t = (label || '').trim()
  if (t.length < 2) return
  if (/^\d+$/.test(t)) return
  votes[t] = (votes[t] || 0) + 1
}

function winnerFromVotes(votes) {
  let best = ''
  let n = 0
  for (const [label, c] of Object.entries(votes)) {
    if (c > n) {
      n = c
      best = label
    }
  }
  return best
}

/**
 * @param {Array<{ ctprvnCd?: string, sggCd?: string, adres?: string, rnAdres?: string, sggNm?: string, ctprvnNm?: string }>} items
 * @returns {(ctprvnCd: string, sggCd: string) => string}
 */
export function buildSggDisplayResolver(items) {
  /** @type {Map<string, Record<string, number>>} */
  const byPair = new Map()
  for (const s of items || []) {
    if (!s.ctprvnCd || !s.sggCd) continue
    const key = `${s.ctprvnCd}:${s.sggCd}`
    if (!byPair.has(key)) byPair.set(key, {})
    const votes = byPair.get(key)
    bumpVote(votes, s.sggNm)
    bumpVote(votes, extractSigunguFromAddress(s.adres, s.ctprvnCd))
    bumpVote(votes, extractSigunguFromAddress(s.rnAdres, s.ctprvnCd))
  }
  return (ctprvnCd, sggCd) => {
    const key = `${ctprvnCd}:${sggCd}`
    const votes = byPair.get(key)
    const fromData = votes ? winnerFromVotes(votes) : ''
    if (fromData) return fromData
    const staticName = SGG_CODE_TO_SHORT_NAME[sggCd]
    if (staticName) return staticName
    return ''
  }
}

/** 시도 코드 → 전체 명칭 (없으면 빈 문자열) */
export function labelForCtprvnCd(ctprvnCd) {
  const c = ctprvnCd != null ? String(ctprvnCd).trim() : ''
  return CTPRVN_CD_TO_NAME[c] || ''
}

/**
 * 시군구 표시명. 서울은 "서울 종로구" 형태, 그 외는 데이터/정적표에서 나온 이름 위주.
 * @param {string} ctprvnCd
 * @param {string} sggCd
 * @param {(a: string, b: string) => string} resolveSgg — buildSggDisplayResolver(items)
 */
export function formatSggUserLabel(ctprvnCd, sggCd, resolveSgg) {
  const sgg = sggCd != null ? String(sggCd).trim() : ''
  const short =
    typeof resolveSgg === 'function' ? resolveSgg(ctprvnCd, sgg) : SGG_CODE_TO_SHORT_NAME[sgg] || ''
  if (short) {
    if (String(ctprvnCd).trim() === '11') return `서울 ${short}`
    return short
  }
  const sido = labelForCtprvnCd(ctprvnCd)
  if (sido) return `${sido} 소재 지역`
  return '상세 지역'
}

/**
 * 필터용 옵션: value는 API·필터와 동일한 코드, label만 사용자 언어.
 * @param {Array<Record<string, unknown>>} items — 충전소(행) 목록
 */
export function buildRegionFilterOptions(items) {
  const list = items || []
  const resolveSgg = buildSggDisplayResolver(list)

  const ctprvnCds = [...new Set(list.map((s) => s.ctprvnCd).filter(Boolean))].sort()
  const sggByCtprvn = {}
  list.forEach((s) => {
    if (!s.ctprvnCd || !s.sggCd) return
    if (!sggByCtprvn[s.ctprvnCd]) sggByCtprvn[s.ctprvnCd] = new Set()
    sggByCtprvn[s.ctprvnCd].add(s.sggCd)
  })

  const ctprvnCdsOptions = ctprvnCds.map((v) => {
    const name = labelForCtprvnCd(v)
    return {
      value: v,
      label: name || '지역',
    }
  })

  const sggCdsByCtprvn = {}
  Object.keys(sggByCtprvn).forEach((k) => {
    const row = [...sggByCtprvn[k]].sort().map((sgg) => ({
      value: sgg,
      label: formatSggUserLabel(k, sgg, resolveSgg),
    }))
    const labelCount = {}
    for (const o of row) {
      labelCount[o.label] = (labelCount[o.label] || 0) + 1
    }
    for (const o of row) {
      if (labelCount[o.label] > 1) o.label = `${o.label} (${o.value})`
    }
    sggCdsByCtprvn[k] = row
  })

  return { ctprvnCds: ctprvnCdsOptions, sggCdsByCtprvn }
}
