import { Box } from '@mui/material'
import { EvUserGlyphBatteryBrick, EvUserGlyphBolt } from './EvUserProvidedIcons.jsx'

/** @param {string | number | null | undefined} code chger_ty */
export function chargerGlyphVariantFromTy(code) {
  const c = code != null ? String(code).trim() : ''
  switch (c) {
    case '2':
      return 'ac'
    case '7':
      return 'ac3'
    case '1':
      return 'chademo'
    case '4':
    case '8':
      return 'combo'
    case '9':
    case '10':
      return 'nacs'
    case '3':
    case '5':
    case '6':
      return 'multi'
    default:
      return 'bolt'
  }
}

const boltFill = 'currentColor'

function SvgShell({ size, children, sx }) {
  return (
    <Box
      component="svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 72 72"
      fill="none"
      aria-hidden
      sx={{
        display: 'block',
        width: size,
        height: size,
        flexShrink: 0,
        color: 'var(--ev-charger-glyph-fg, currentColor)',
        ...sx,
      }}
    >
      {children}
    </Box>
  )
}

/** DC 콤보 — 사용자 제공 급속기 실루엣 */
function GlyphCombo({ size, sx }) {
  return <EvUserGlyphBatteryBrick size={size} sx={{ color: 'var(--ev-charger-glyph-fg, currentColor)', ...sx }} />
}

/** AC 완속·단순 원형 포트 */
function GlyphAc({ size }) {
  return (
    <SvgShell size={size}>
      <circle cx="36" cy="36" r="22" stroke={boltFill} strokeWidth="3" fill="none" opacity={0.9} />
      <circle cx="36" cy="36" r="10" fill={boltFill} fillOpacity={0.35} />
      <path d="M36 14v8M36 50v8M14 36h8M50 36h8" stroke={boltFill} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
    </SvgShell>
  )
}

/** AC3상 — 삼각 배치 */
function GlyphAc3({ size }) {
  return (
    <SvgShell size={size}>
      <circle cx="36" cy="36" r="24" stroke={boltFill} strokeWidth="2.5" fill="none" opacity={0.88} />
      <circle cx="36" cy="24" r="5" fill={boltFill} fillOpacity={0.85} />
      <circle cx="26" cy="44" r="5" fill={boltFill} fillOpacity={0.85} />
      <circle cx="46" cy="44" r="5" fill={boltFill} fillOpacity={0.85} />
    </SvgShell>
  )
}

/** 복합 타입 — 급속기 실루엣 공유 */
function GlyphMulti({ size, sx }) {
  return <EvUserGlyphBatteryBrick size={size} sx={{ color: 'var(--ev-charger-glyph-fg, currentColor)', ...sx }} />
}

/** 급속/차데모/NACS 등 — 사용자 제공 번개 마크 */
function GlyphBolt({ size, sx }) {
  return <EvUserGlyphBolt size={size} sx={{ color: 'var(--ev-charger-glyph-fg, currentColor)', ...sx }} />
}

/**
 * 충전기 타입(chger_ty)에 맞는 글리프. 상세 시트·부트 시퀀스에서 공유.
 * @param {{ variant?: string, chgerTy?: string | number | null, size?: number, sx?: object }} props
 */
export function ChargerTypeGlyph({ variant: variantProp, chgerTy, size = 40, sx }) {
  const variant = variantProp || chargerGlyphVariantFromTy(chgerTy)
  switch (variant) {
    case 'ac':
      return <GlyphAc size={size} sx={sx} />
    case 'ac3':
      return <GlyphAc3 size={size} sx={sx} />
    case 'chademo':
      return <GlyphBolt size={size} sx={sx} />
    case 'combo':
      return <GlyphCombo size={size} sx={sx} />
    case 'nacs':
      return <GlyphBolt size={size} sx={sx} />
    case 'multi':
      return <GlyphMulti size={size} sx={sx} />
    default:
      return <GlyphBolt size={size} sx={sx} />
  }
}
