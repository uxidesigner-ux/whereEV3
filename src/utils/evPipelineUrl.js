/**
 * 프로덕션 계측: ?evPipeline=1 일 때만 true (DEV는 별도 처리)
 */
export function evPipelineUrlEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('evPipeline') === '1'
  } catch {
    return false
  }
}
