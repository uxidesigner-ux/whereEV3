/**
 * MVP: 공공 API 실데이터(충전소·충전기 정적 정보)와 표시용 목업(상태·세션) 분리.
 *
 * - 실데이터: normalizeCharger가 채우는 statNm, 주소, 운영기관, 타입, 출력, 좌표 등 — 여기서 수정하지 않음.
 * - 목업: `applyMvpChargerOverlay`가 `apiStat`에 API 원본 stat을 보관하고, UI용 `stat`만 시드 기반으로 덮어씀.
 * - 세션(충전율·남은 시간): 사용 중(stat=3)일 때만 `getChargerSessionForUi`가 동일 charger 키로 결정적 생성.
 *
 * 시드: `statId|chgerId` 우선, 없으면 `row.id` 기반 — 새로고침·재렌더와 무관하게 동일.
 */

/** @typedef {{ currentChargePercent?: string|number, targetChargePercent?: string|number, remainingMinutesRaw?: string|number, expectedEndAt?: string }} MvpChargerSessionPayload */

/**
 * @type {Record<string, MvpChargerSessionPayload>}
 * 특정 충전기만 수동 튜닥할 때(테스트). 일반 경로는 시드 생성.
 */
const MVP_MOCK_SESSIONS_BY_KEY = {}

/** djb2 → 부호 없는 32bit */
function djb2(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 33 + str.charCodeAt(i)) >>> 0
  }
  return hash >>> 0
}

/** 결정적 [0,1) 난수 스트림 */
function splitmix32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x9e3779b9) >>> 0
    let z = a
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 목업·세션 공통 키 (공공데이터 `statId` + `chgerId`).
 * @param {object} row
 * @returns {string}
 */
export function chargerSessionLookupKey(row) {
  if (!row || typeof row !== 'object') return ''
  const sid = String(row.statId ?? '').trim()
  const cid = String(row.chgerId ?? '').trim()
  if (sid && cid) return `${sid}|${cid}`
  return String(row.id ?? '').trim()
}

function effectiveMvpKey(row) {
  return chargerSessionLookupKey(row) || `id|${String(row?.id ?? '').trim() || 'unknown'}`
}

/**
 * 분포: 사용 가능 50%, 사용 중 35%, 점검중 15%
 * @param {string} key
 * @returns {'2'|'3'|'5'}
 */
function deriveMvpDisplayStatForKey(key) {
  const rnd = splitmix32(djb2(`stat|${key}`))
  const u = rnd()
  if (u < 0.5) return '2'
  if (u < 0.85) return '3'
  return '5'
}

/**
 * 사용 중 전용. 목표 80 또는 90, 진행률 바는 target을 100%로.
 * @param {string} key
 * @returns {MvpChargerSessionPayload}
 */
function deriveMvpSessionPayloadForKey(key) {
  const rnd = splitmix32(djb2(`session|${key}`))
  const target = rnd() < 0.5 ? 80 : 90
  const tmin = 5
  const tmax = Math.max(tmin, target - 5)
  const span = tmax - tmin + 1
  const current = tmin + Math.floor(rnd() * span)
  const remaining = 15 + Math.floor(rnd() * (120 - 15 + 1))
  return {
    currentChargePercent: String(current),
    targetChargePercent: String(target),
    remainingMinutesRaw: String(remaining),
    expectedEndAt: '',
  }
}

/**
 * 정규화 직후 행에 MVP 표시층 적용. `apiStat` = API stat 원본, `stat` = MVP 표시용.
 * @param {object} row
 * @returns {object}
 */
export function applyMvpChargerOverlay(row) {
  if (!row || typeof row !== 'object') return row
  const apiStat = String(row.stat ?? '').trim()
  const key = effectiveMvpKey(row)
  const stat = deriveMvpDisplayStatForKey(key)
  return {
    ...row,
    apiStat,
    stat,
  }
}

/**
 * 사용 중 충전기에만 세션 UI. 수동 맵 → 시드 생성 순.
 *
 * @param {object} row — `applyMvpChargerOverlay` 적용 후 행
 * @returns {MvpChargerSessionPayload | null}
 */
export function getChargerSessionForUi(row) {
  if (!row || String(row.stat ?? '').trim() !== '3') return null

  const key = chargerSessionLookupKey(row)
  const effectiveKey = key || `id|${String(row.id ?? '').trim() || 'unknown'}`

  const manual = MVP_MOCK_SESSIONS_BY_KEY[effectiveKey]
  if (manual) return { ...manual }

  return deriveMvpSessionPayloadForKey(effectiveKey)
}

/**
 * 목록 카드「지금 충전 가능」배지 전용.
 * `applyMvpChargerOverlay` 적용 후 행의 표시용 `stat`만 보며, 총 대수(`rows.length` 등)와 분리.
 * @param {object[]|undefined|null} rows
 */
export function groupHasMvpAvailableCharger(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false
  return rows.some((r) => String(r?.stat ?? '').trim() === '2')
}
