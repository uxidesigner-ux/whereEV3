import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { getExactRegionBounds } from '../utils/searchRegionBounds.js'

const FIT_PADDING_TL = [48, 24]
const FIT_PADDING_BR = [24, 120]
const FIT_MAX_ZOOM = 16
const SINGLE_RESULT_ZOOM = 15

function boundsFromLiteral(b) {
  return L.latLngBounds(
    [b.southWest.lat, b.southWest.lng],
    [b.northEast.lat, b.northEast.lng]
  )
}

function boundsLiteralFromLeaflet(b) {
  const sw = b.getSouthWest()
  const ne = b.getNorthEast()
  return {
    southWest: { lat: sw.lat, lng: sw.lng },
    northEast: { lat: ne.lat, lng: ne.lng },
  }
}

/**
 * 모바일 검색: 부모가 fitNonce를 올릴 때만 호출.
 * ignoreRegionKeywordBounds: 내 위치 기준 반경 검색 등 — 사전 지역 bounds 없이 결과 좌표만 사용.
 */
export function MapMobileSearchViewportFitter({
  enabled,
  fitNonce,
  searchQuery,
  filteredItems,
  setAppliedMapBounds,
  ignoreRegionKeywordBounds = false,
  /** moveend 후 적용 bounds가 반영된 직후 (검색 뷰포트 summary fetch 등) */
  onBoundsAppliedFromSearch,
}) {
  const map = useMap()
  const lastProcessedNonceRef = useRef(0)
  const searchQueryRef = useRef(searchQuery)
  const filteredItemsRef = useRef(filteredItems)
  const ignoreRegionRef = useRef(ignoreRegionKeywordBounds)

  useEffect(() => {
    searchQueryRef.current = searchQuery
    filteredItemsRef.current = filteredItems
    ignoreRegionRef.current = ignoreRegionKeywordBounds
  }, [searchQuery, filteredItems, ignoreRegionKeywordBounds])

  useEffect(() => {
    if (!enabled || fitNonce < 1) return
    if (fitNonce === lastProcessedNonceRef.current) return
    lastProcessedNonceRef.current = fitNonce

    const q = (searchQueryRef.current || '').trim().toLowerCase()
    if (!q) return

    const region = ignoreRegionRef.current ? null : getExactRegionBounds(q)
    let bounds = null
    let single = null

    if (region && boundsFromLiteral(region).isValid()) {
      bounds = boundsFromLiteral(region)
    } else {
      const pts = (filteredItemsRef.current || []).filter(
        (s) => s != null && Number.isFinite(s.lat) && Number.isFinite(s.lng)
      )
      if (pts.length === 0) return
      if (pts.length === 1) {
        single = pts[0]
      } else {
        bounds = L.latLngBounds(pts.map((s) => [s.lat, s.lng]))
      }
    }

    const applyAppliedFromMap = () => {
      const b = map.getBounds()
      if (!b || !b.isValid()) return
      const lit = boundsLiteralFromLeaflet(b)
      setAppliedMapBounds(lit)
      if (typeof onBoundsAppliedFromSearch === 'function') {
        onBoundsAppliedFromSearch(lit)
      }
    }

    map.once('moveend', applyAppliedFromMap)

    if (single) {
      map.flyTo([single.lat, single.lng], SINGLE_RESULT_ZOOM, { duration: 0.45 })
      return () => {
        map.off('moveend', applyAppliedFromMap)
      }
    }

    if (bounds && bounds.isValid()) {
      map.flyToBounds(bounds, {
        paddingTopLeft: L.point(FIT_PADDING_TL[0], FIT_PADDING_TL[1]),
        paddingBottomRight: L.point(FIT_PADDING_BR[0], FIT_PADDING_BR[1]),
        maxZoom: FIT_MAX_ZOOM,
        duration: 0.45,
      })
    }

    return () => {
      map.off('moveend', applyAppliedFromMap)
    }
  }, [enabled, fitNonce, map, setAppliedMapBounds, onBoundsAppliedFromSearch])

  return null
}
