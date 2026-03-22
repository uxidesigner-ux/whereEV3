import { useState, useEffect } from 'react'
import { Box, Fade } from '@mui/material'
import {
  EvUserGlyphBatteryBrick,
  EvUserGlyphBolt,
  EvUserGlyphMapPin,
  EvUserGlyphCarFront,
} from './EvUserProvidedIcons.jsx'

const FRAME_MS = 900

const bootIconSx = { color: 'rgba(255,255,255,0.94)' }

/** 사용자 제공 SVG 4종: 충전기 → 번개 → 핀 → 차 (무한 루프) */
const frames = [
  { key: 'battery', render: () => <EvUserGlyphBatteryBrick size={72} sx={bootIconSx} /> },
  { key: 'bolt', render: () => <EvUserGlyphBolt size={72} sx={bootIconSx} /> },
  { key: 'pin', render: () => <EvUserGlyphMapPin size={72} sx={bootIconSx} /> },
  { key: 'car', render: () => <EvUserGlyphCarFront size={72} sx={bootIconSx} /> },
]

/**
 * 부트 오버레이: 사용자 제공 일러스트 4종을 순차 루프.
 */
export function BootEvSvgSequence({ reduceMotion = false }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduceMotion) return undefined
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % frames.length)
    }, FRAME_MS)
    return () => clearInterval(id)
  }, [reduceMotion])

  const i = reduceMotion ? 0 : index
  const { key, render } = frames[i]

  return (
    <Box
      aria-hidden
      sx={{
        width: '100%',
        maxWidth: 176,
        height: 88,
        mx: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <Fade in timeout={reduceMotion ? 0 : 240} key={key}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {render()}
        </Box>
      </Fade>
    </Box>
  )
}
