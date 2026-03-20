/**
 * MVP 충전「세션」데이터 — 공공데이터 충전기 행(row)과 분리 관리.
 *
 * - 기본 정보(stat, chgerTy, 주소 등)는 항상 `normalizeCharger` 결과(row)만 사용.
 * - 사용 중(stat=3)일 때만 진행률·잔여시간 등을 여기서 조회해 UI에 합성한다.
 * - 실시간 세션 API가 생기면 `getChargerSessionForUi` 내부에서 목업 분기만 실 API로 교체하면 된다.
 *
 * 키: `statId|chgerId` (둘 다 있을 때). 없으면 `row.id` 문자열 fallback.
 */

/** @typedef {{ currentChargePercent?: string|number, targetChargePercent?: string|number, remainingMinutesRaw?: string|number, expectedEndAt?: string }} MvpChargerSessionPayload */

/**
 * @type {Record<string, MvpChargerSessionPayload>}
 * 실데이터 충전소에 데모를 붙이려면 동일 형식으로 키를 추가한다.
 */
const MVP_MOCK_SESSIONS_BY_KEY = {
  'dev-place-seoul-station|02': {
    currentChargePercent: '40',
    targetChargePercent: '80',
    remainingMinutesRaw: '25',
    expectedEndAt: '',
  },
}

/**
 * 목업 세션 매핑용 키 (공공데이터 `statId` + `chgerId`).
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

/**
 * 사용 중 충전기에만 세션 UI를 붙인다. 없으면 null → 진행 바·잔여시간 미표시.
 *
 * @param {object} row — normalizeCharger 행
 * @returns {MvpChargerSessionPayload | null}
 */
export function getChargerSessionForUi(row) {
  if (!row || String(row.stat ?? '').trim() !== '3') return null

  // 실 세션 API 연동 시: 여기서 우선 반환 (row에 주입하지 말고 fetch/캐시 결과만 사용)
  // if (row.liveChargerSession && row.liveChargerSession.source === 'api') return row.liveChargerSession.payload

  const key = chargerSessionLookupKey(row)
  const mock = MVP_MOCK_SESSIONS_BY_KEY[key]
  return mock ? { ...mock } : null
}
