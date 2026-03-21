/**
 * Safemap IF_0042 row → 앱용 정규화 (MVP overlay 제외). 빌드 스크립트·스냅샷 로드에서 동일 스키마 유지.
 */
import { safemapApiRowToLatLng } from '../utils/coordTransform.js'
import { getChgerTyLabel, getSpeedCategory, getDisplayChgerLabel } from './evChargerTy.js'

function get(obj, ...keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k]
  }
  return ''
}

/**
 * 목록 API에서 `chger_id`만 있고 충전소마다 1,2…로 겹치는 경우가 많아,
 * 전역 중복 제거·스냅샷 빌드 시 충돌하지 않도록 안정 id를 만든다.
 * @param {object} item
 * @param {number} index
 * @param {{ lat: number, lng: number }} ll
 */
function deriveStableChargerRowId(item, index, ll) {
  const objt = get(item, 'objt_id', 'objtId')
  if (objt) return String(objt).trim()

  const sid = String(get(item, 'stat_id', 'statId') ?? '').trim()
  const cidRaw = get(item, 'chger_id', 'chgerId')
  const cid = cidRaw !== '' && cidRaw != null ? String(cidRaw).trim() : ''
  if (sid && cid) return `${sid}|${cid}`

  const nm = String(get(item, 'stat_nm', 'statNm') || '').trim()
  const la = Number(ll.lat).toFixed(5)
  const ln = Number(ll.lng).toFixed(5)
  if (nm && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
    return `nm|${nm}|${la}|${ln}|${cid || String(index)}`
  }

  if (cid) return `cid|${cid}|${index}`
  return `ev-${index}`
}

/**
 * @param {object} item
 * @param {number} index
 * @returns {object | null}
 */
export function normalizeChargerCore(item, index) {
  if (!item || typeof item !== 'object') return null
  const converted = safemapApiRowToLatLng(item)
  if (!converted) {
    const rawX = item.x ?? item.X
    const rawY = item.y ?? item.Y
    const dev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
    console.warn(
      '[Safemap EV] 좌표 변환 실패, 마커 제외:',
      get(item, 'stat_nm', 'statNm', 'stat_id', 'statId') || index,
      { x: rawX, y: rawY, keys: dev ? Object.keys(item).slice(0, 24) : undefined },
    )
    return null
  }
  const chgerTyCode = get(item, 'chger_ty', 'chgerTy') || ''
  const chgerTyLabel = getChgerTyLabel(chgerTyCode)
  const id = deriveStableChargerRowId(item, index, converted)
  return {
    dataSource: 'safemap',
    id,
    statId: get(item, 'stat_id', 'statId'),
    statNm: get(item, 'stat_nm', 'statNm') || '이름 없음',
    chgerId: get(item, 'chger_id', 'chgerId'),
    stat: get(item, 'stat'),
    statUpdDt: get(item, 'stat_upd_dt', 'statUpdDt'),
    chgerTy: chgerTyCode,
    chgerTyLabel,
    speedCategory: getSpeedCategory(chgerTyCode),
    displayChgerLabel: getDisplayChgerLabel(chgerTyCode),
    useTm: get(item, 'use_tm', 'useTm'),
    busiId: get(item, 'busi_id', 'busiId'),
    busiNm: get(item, 'busi_nm', 'busiNm') || '-',
    telno: get(item, 'telno'),
    adres: get(
      item,
      'adres',
      'addr',
      'address',
      'stat_addr',
      'statAddr',
      'jibun_addr',
      'jibunAddr',
      'lot_addr',
      'lotAddr',
      'location',
      'daddr',
      'detail_addr',
      'detailAddr',
    ),
    rnAdres: get(
      item,
      'rn_adres',
      'rnAdres',
      'road_addr',
      'roadAddr',
      'road_address',
      'roadAddress',
      'new_addr',
      'newAddr',
    ),
    chgerNm: get(item, 'chger_nm', 'chgerNm', 'chger_name', 'chgerName'),
    outputKw: get(
      item,
      'output',
      'output_kw',
      'outputKw',
      'chger_kw',
      'chgerKw',
      'chg_kw',
      'chgKw',
      'power',
      'eltv_spd',
      'eltvSpd',
      'chger_out_put',
      'chgerOutPut',
      'delng',
    ),
    ctprvnCd: get(item, 'ctprvn_cd', 'ctprvnCd'),
    sggCd: get(item, 'sgg_cd', 'sggCd'),
    ctprvnNm: get(item, 'ctprvn_nm', 'ctprvnNm'),
    sggNm: get(item, 'sgg_nm', 'sggNm'),
    emdCd: get(item, 'emd_cd', 'emdCd'),
    lat: converted.lat,
    lng: converted.lng,
  }
}
