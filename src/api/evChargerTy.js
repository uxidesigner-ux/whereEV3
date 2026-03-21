/** chger_ty 코드 → 한글 라벨 (기술 용어) */
export const CHGER_TY_LABELS = {
  1: 'DC차데모',
  2: 'AC완속',
  3: 'DC차데모+AC3상',
  4: 'DC콤보',
  5: 'DC차데모+DC콤보',
  6: 'DC차데모+AC3상+DC콤보',
  7: 'AC3상',
  8: 'DC콤보(완속)',
  9: 'NACS',
  10: 'DC콤보+NACS',
}

/** chger_ty 코드 → 사용자 용어 (급속/완속). */
export const CHGER_TY_TO_SPEED = {
  1: '급속',
  2: '완속',
  3: '급속',
  4: '급속',
  5: '급속',
  6: '급속',
  7: '완속',
  8: '완속',
  9: '급속',
  10: '급속',
}

export function getChgerTyLabel(code) {
  const c = code != null ? String(code).trim() : ''
  return CHGER_TY_LABELS[c] ?? `타입${c || '?'}`
}

export function getSpeedCategory(code) {
  const c = code != null ? String(code).trim() : ''
  return CHGER_TY_TO_SPEED[c] ?? '급속'
}

export function getDisplayChgerLabel(code) {
  const label = getChgerTyLabel(code)
  const speed = getSpeedCategory(code)
  return `${speed} (${label})`
}
