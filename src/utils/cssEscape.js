/** CSS 속성 선택자용 이스케이프 (querySelector 등) */
export function cssEscapeAttr(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(String(value))
  }
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
