import { useEffect, useMemo } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { parseEvMapDiag, logDiag } from './evMapDiag.js'

/** 진단용: 앱 divIcon과 유사하지만 인라인( import 순환 방지 ) */
const DIAG_CUSTOM_DIV = L.divIcon({
  className: 'ev-diag-leaflet-custom',
  html: '<div style="width:26px;height:26px;border-radius:50%;background:#1F45FF;border:2px solid #fff;box-sizing:border-box"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

function countMarkerIcons(map) {
  try {
    const pane = map.getPane?.('markerPane')
    return pane ? pane.querySelectorAll('.leaflet-marker-icon').length : 0
  } catch {
    return 0
  }
}

function countCircleLikeInOverlay(map) {
  try {
    const el = map.getPane?.('overlayPane')
    if (!el) return 0
    return el.querySelectorAll('path').length
  } catch {
    return 0
  }
}

/**
 * 순수 Leaflet으로 마커만 올려 React·데이터 파이프와 분리 측정
 */
export function MapLeafletExperiments() {
  const map = useMap()
  const diag = useMemo(() => parseEvMapDiag(), [])

  useEffect(() => {
    if (!diag.anyLeafletHarness) return undefined

    const t0 = performance.now()
    logDiag('leafletHarness map effect start', 0)

    const group = L.layerGroup().addTo(map)
    const c = map.getCenter()

    const milestones = new Set()
    const check = (tag) => {
      const icons = countMarkerIcons(map)
      const paths = countCircleLikeInOverlay(map)
      const dt = performance.now() - t0
      ;[1, 5, 10, 20].forEach((n) => {
        if (!milestones.has(`i${n}`) && icons >= n) {
          milestones.add(`i${n}`)
          logDiag(`${tag} first ${n} marker-icon DOM`, dt, { icons, paths })
        }
      })
    }

    if (diag.hard1) {
      L.marker(c, { title: 'evDiag-hard1' }).addTo(group)
    } else if (diag.hard10def) {
      for (let i = 0; i < 10; i += 1) {
        L.marker([c.lat + i * 0.00025, c.lng + i * 0.00025], { title: `d${i}` }).addTo(group)
      }
    } else if (diag.hard10custom) {
      for (let i = 0; i < 10; i += 1) {
        L.marker([c.lat + i * 0.00025, c.lng + i * 0.00025], { icon: DIAG_CUSTOM_DIV, title: `c${i}` }).addTo(
          group,
        )
      }
    } else if (diag.circle20) {
      for (let i = 0; i < 20; i += 1) {
        L.circleMarker([c.lat + i * 0.0002, c.lng + i * 0.0002], {
          radius: 5,
          color: '#1d4ed8',
          fillColor: '#3b82f6',
          fillOpacity: 0.85,
          weight: 1,
        }).addTo(group)
      }
    }

    let raf2Id = 0
    const raf1Id = requestAnimationFrame(() => {
      check('rAF1')
      raf2Id = requestAnimationFrame(() => check('rAF2'))
    })

    const poll = window.setInterval(() => check('poll'), 32)
    const stop = window.setTimeout(() => {
      window.clearInterval(poll)
      check('final3s')
    }, 3000)

    return () => {
      cancelAnimationFrame(raf1Id)
      if (raf2Id) cancelAnimationFrame(raf2Id)
      window.clearInterval(poll)
      window.clearTimeout(stop)
      try {
        map.removeLayer(group)
      } catch {
        /* noop */
      }
    }
  }, [map, diag])

  return null
}
