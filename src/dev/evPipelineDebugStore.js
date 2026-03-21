/**
 * ?evPipeline=1 일 때 하단 패널·외부 구독용 스냅샷 (프로덕션 포함)
 */

/** @type {Set<() => void>} */
const listeners = new Set()

/** @type {Record<string, unknown>} */
let snapshot = {}

export function subscribeEvPipelineDebug(onStoreChange) {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

export function getEvPipelineDebugSnapshot() {
  return snapshot
}

function notify() {
  listeners.forEach((l) => l())
}

/** @param {Record<string, unknown>} partial */
export function mergeEvPipelineDebug(partial) {
  if (!partial || typeof partial !== 'object') return
  const next = { ...snapshot }
  for (const [k, v] of Object.entries(partial)) {
    if (v !== undefined) next[k] = v
  }
  next._updatedAt = Date.now()
  snapshot = next
  notify()
}
