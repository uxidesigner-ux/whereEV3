/**
 * 전국 정규화 충전 행 캐시 (IndexedDB, 청크 저장)
 * — 스키마/빌드 id 불일치 시 무효화. stale-while-revalidate는 App에서 판단.
 */

import packageJson from '../../package.json'

const DB_NAME = 'whereev3-ev-catalog'
const DB_VERSION = 1
const STORE = 'catalog'

/** 스키마·직렬화 방식 변경 시 증가 */
export const EV_CATALOG_SCHEMA_VERSION = 2

/** 배포 시 package.json version이 바뀌면 캐시 무효화 */
export function evCatalogBuildId() {
  return `${packageJson.name}@${packageJson.version}`
}

/** SWR: 이 시간 지난 캐시는 보여준 뒤 백그라운드 갱신 권장 */
export const EV_CATALOG_STALE_AFTER_MS = 4 * 60 * 60 * 1000

/** 이 시간이 지나면 콜드처럼 전체 재수집(여전히 읽기 실패 시에만) */
export const EV_CATALOG_HARD_EXPIRE_MS = 36 * 60 * 60 * 1000

const CHUNK_SIZE = 2500

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
  })
}

/**
 * @returns {Promise<{ meta: object | null }>}
 */
export async function evCatalogReadMeta() {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const st = tx.objectStore(STORE)
      const r = st.get('__meta__')
      r.onsuccess = () => resolve({ meta: r.result ?? null })
      r.onerror = () => reject(r.error)
    })
  } catch {
    return { meta: null }
  }
}

function metaValid(meta) {
  if (!meta || typeof meta !== 'object') return false
  if (meta.schemaVersion !== EV_CATALOG_SCHEMA_VERSION) return false
  if (meta.buildId !== evCatalogBuildId()) return false
  if (typeof meta.fetchedAt !== 'number') return false
  if (typeof meta.chunkCount !== 'number' || meta.chunkCount < 1) return false
  return true
}

/**
 * @returns {Promise<{ rows: object[], meta: object } | null>}
 */
export async function evCatalogReadAll() {
  const { meta } = await evCatalogReadMeta()
  if (!metaValid(meta)) return null

  try {
    const db = await openDb()
    const rows = []
    for (let i = 0; i < meta.chunkCount; i += 1) {
      const chunk = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const st = tx.objectStore(STORE)
        const r = st.get(i)
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
      if (!Array.isArray(chunk)) return null
      rows.push(...chunk)
      await new Promise((r) => requestAnimationFrame(() => r()))
    }
    return { rows, meta }
  } catch {
    return null
  }
}

/** @param {object[]} rows */
export async function evCatalogWrite(rows, extraMeta = {}) {
  const chunks = []
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + CHUNK_SIZE))
  }

  const meta = {
    schemaVersion: EV_CATALOG_SCHEMA_VERSION,
    buildId: evCatalogBuildId(),
    fetchedAt: Date.now(),
    rowCount: rows.length,
    chunkCount: chunks.length,
    ...extraMeta,
  }

  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const st = tx.objectStore(STORE)
    st.clear()
    st.put(meta, '__meta__')
    for (let i = 0; i < chunks.length; i += 1) {
      st.put(chunks[i], i)
    }
    tx.oncomplete = () => resolve(meta)
    tx.onerror = () => reject(tx.error)
  })
}

export async function evCatalogClear() {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* noop */
  }
}

/**
 * @param {object} meta
 * @returns {'fresh' | 'stale' | 'expired'}
 */
export function evCatalogFreshness(meta) {
  if (!meta?.fetchedAt) return 'expired'
  const age = Date.now() - meta.fetchedAt
  if (age >= EV_CATALOG_HARD_EXPIRE_MS) return 'expired'
  if (age >= EV_CATALOG_STALE_AFTER_MS) return 'stale'
  return 'fresh'
}
