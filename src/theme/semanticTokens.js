/**
 * 라이트 / 다크 독립 설계 semantic 토큰 (단순 반전 아님).
 * 컴포넌트는 useEvTheme().tokens 로만 참조하는 것을 권장.
 */

/** @typedef {typeof lightTokens} EvSemanticTokens */

export const lightTokens = {
  bg: {
    app: '#f3f4f6',
    paper: '#ffffff',
    raised: '#ffffff',
    subtle: '#f9fafb',
    header: '#f9fafb',
    muted: '#f3f4f6',
    chipIdle: '#f3f4f6',
    listRowSelected: 'rgba(31, 69, 255, 0.06)',
  },
  border: {
    default: '#e5e7eb',
    subtle: '#f3f4f6',
    strong: '#d1d5db',
    dashed: '#e5e7eb',
  },
  text: {
    primary: '#1f2937',
    secondary: '#4b5563',
    tertiary: '#6b7280',
    muted: '#9ca3af',
    inverse: '#ffffff',
    onPrimary: '#ffffff',
  },
  blue: {
    main: '#1F45FF',
    deep: '#152EC9',
    light: '#4D6AFF',
    lighter: '#6B82FF',
    pale: 'rgba(31, 69, 255, 0.28)',
    /** 칩·토글 active 배경 */
    muted: 'rgba(31, 69, 255, 0.12)',
    mutedStrong: 'rgba(31, 69, 255, 0.15)',
    borderSoft: 'rgba(31, 69, 255, 0.38)',
    glowSoft: 'rgba(31, 69, 255, 0.26)',
  },
  status: {
    avail: { chipBg: 'rgba(22, 163, 74, 0.22)', rowBg: 'rgba(22, 163, 74, 0.03)', fg: '#166534', border: 'rgba(22, 163, 74, 0.35)' },
    use: { chipBg: 'rgba(245, 158, 11, 0.28)', rowBg: 'rgba(245, 158, 11, 0.04)', fg: '#b45309', border: 'rgba(245, 158, 11, 0.4)' },
    maint: { chipBg: '#e5e7eb', rowBg: '#f9fafb', fg: '#4b5563', border: '#d1d5db' },
    unknown: { chipBg: '#f3f4f6', fg: '#1f2937', border: '#e5e7eb' },
  },
  map: {
    /** light_all 대비 한 단계 눌린 뉴트럴 톤(Voyager) */
    tileUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    tileAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    fenceFill: '#434a58',
    fenceFillOpacity: 0.19,
    fenceStroke: '#5a6274',
    fenceWeight: 1.5,
    fenceStrokeOpacity: 0.58,
    markerDot: '#1F45FF',
    markerStroke: '#ffffff',
    markerRing: 'rgba(31, 69, 255, 0.4)',
    /** 브랜드 마커 내부 번개 */
    markerBolt: '#FCFC07',
    pinGradientStart: '#4D6AFF',
    pinGradientMid: '#1F45FF',
    pinGradientEnd: '#152EC9',
    pinTip: '#121FA3',
    userCircle: '#1F45FF',
    userFillOpacity: 0.25,
  },
  glass: {
    panelBg: 'rgba(255, 255, 255, 0.2)',
    panelBorder: 'rgba(255, 255, 255, 0.25)',
    panelShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    panelHoverBg: 'rgba(255, 255, 255, 0.28)',
    panelHoverShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
  },
  shadow: {
    float: '0 4px 24px rgba(15, 23, 42, 0.12), 0 2px 10px rgba(15, 23, 42, 0.08)',
    sheet: '0 -2px 20px rgba(0,0,0,0.07)',
    card: '0 1px 4px rgba(15, 23, 42, 0.08)',
    searchFocused: '0 6px 28px rgba(15, 23, 42, 0.16), 0 0 0 2px rgba(31, 69, 255, 0.28)',
    selectedRing: '0 0 0 2px #ffffff, 0 0 0 4px #1F45FF',
  },
  chartBlue: ['#1F45FF', '#4D6AFF', '#6B82FF', '#8FA3FF', '#152EC9', '#121FA3'],
  control: {
    fabBg: '#ffffff',
    fabBorder: 'rgba(15,23,42,0.06)',
    searchBg: '#ffffff',
    searchBorder: '#e5e7eb',
  },
  overlay: {
    scrim: 'rgba(15, 23, 42, 0.38)',
  },
}

export const darkTokens = {
  bg: {
    app: '#0E1116',
    paper: '#151A20',
    raised: '#1B2128',
    subtle: '#151A20',
    header: '#151A20',
    muted: '#1B2128',
    chipIdle: '#1B2128',
    listRowSelected: 'rgba(109, 136, 255, 0.1)',
  },
  border: {
    default: '#2A313A',
    subtle: '#222830',
    strong: '#3D4754',
    dashed: '#2A313A',
  },
  text: {
    primary: '#F3F5F7',
    secondary: '#A7B0BA',
    tertiary: '#8B95A1',
    muted: '#7C8693',
    inverse: '#0E1116',
    onPrimary: '#0E1116',
  },
  blue: {
    main: '#6D88FF',
    deep: '#5574FF',
    light: '#879CFF',
    lighter: '#A3B0FF',
    pale: 'rgba(109, 136, 255, 0.38)',
    muted: 'rgba(109, 136, 255, 0.14)',
    mutedStrong: 'rgba(109, 136, 255, 0.2)',
    borderSoft: 'rgba(109, 136, 255, 0.4)',
    glowSoft: 'rgba(109, 136, 255, 0.3)',
  },
  status: {
    avail: { chipBg: 'rgba(52, 211, 153, 0.2)', rowBg: 'rgba(52, 211, 153, 0.06)', fg: '#6EE7B7', border: 'rgba(52, 211, 153, 0.35)' },
    use: { chipBg: 'rgba(251, 191, 36, 0.18)', rowBg: 'rgba(251, 191, 36, 0.06)', fg: '#FCD34D', border: 'rgba(251, 191, 36, 0.35)' },
    maint: { chipBg: '#2A313A', rowBg: '#1B2128', fg: '#A7B0BA', border: '#3D4754' },
    unknown: { chipBg: '#1B2128', fg: '#F3F5F7', border: '#2A313A' },
  },
  map: {
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    tileAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    /** 다크: 짙은 채우기 대신 살짝 띄운 블루그레이 */
    fenceFill: 'rgba(120, 165, 220, 0.14)',
    fenceFillOpacity: 1,
    fenceStroke: 'rgba(109, 136, 255, 0.45)',
    fenceWeight: 1.5,
    fenceStrokeOpacity: 0.85,
    markerDot: '#6D88FF',
    markerStroke: '#000000',
    markerRing: 'rgba(109, 136, 255, 0.55)',
    markerBolt: '#FCFC07',
    pinGradientStart: '#879CFF',
    pinGradientMid: '#6D88FF',
    pinGradientEnd: '#5574FF',
    pinTip: '#3A4DB8',
    userCircle: '#6D88FF',
    userFillOpacity: 0.22,
  },
  glass: {
    panelBg: 'rgba(21, 26, 32, 0.72)',
    panelBorder: 'rgba(109, 136, 255, 0.14)',
    panelShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(42, 49, 58, 0.8)',
    panelHoverBg: 'rgba(27, 33, 40, 0.88)',
    panelHoverShadow:
      '0 12px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(109, 136, 255, 0.16), 0 0 24px rgba(109, 136, 255, 0.08)',
  },
  shadow: {
    float: '0 4px 24px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(42, 49, 58, 0.6)',
    sheet: '0 -4px 28px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(42, 49, 58, 0.5)',
    card: '0 0 0 1px rgba(42, 49, 58, 0.9), 0 2px 12px rgba(0, 0, 0, 0.35)',
    searchFocused: '0 6px 28px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(109, 136, 255, 0.4)',
    selectedRing: '0 0 0 2px #151A20, 0 0 0 4px #6D88FF, 0 0 20px rgba(109,136,255,0.28)',
  },
  chartBlue: ['#6D88FF', '#5574FF', '#879CFF', '#A3B0FF', '#4D62E8', '#3A4DB8'],
  control: {
    fabBg: '#1B2128',
    fabBorder: 'rgba(109, 136, 255, 0.22)',
    searchBg: '#151A20',
    searchBorder: '#2A313A',
  },
  overlay: {
    scrim: 'rgba(4, 6, 10, 0.62)',
  },
}

/**
 * document.documentElement 에 지도·마커용 CSS 변수 주입
 * @param {EvSemanticTokens} t
 * @param {'light' | 'dark'} mode
 */
/**
 * 기존 `colors.gray[n]` / `colors.blue.*` 패턴과 호환되는 뷰 (컴포넌트 단계적 이관용).
 * @param {EvSemanticTokens} t
 */
export function tokensToLegacyColors(t) {
  return {
    gray: {
      50: t.bg.subtle,
      100: t.bg.muted,
      200: t.border.default,
      250: t.border.default,
      300: t.border.strong,
      400: t.text.muted,
      500: t.text.tertiary,
      600: t.text.secondary,
      700: t.text.secondary,
      800: t.text.primary,
      900: t.text.primary,
    },
    blue: {
      primary: t.blue.main,
      deep: t.blue.deep,
      light: t.blue.light,
      lighter: t.blue.lighter,
      pale: t.blue.pale,
      muted: t.blue.muted,
    },
    white: t.bg.paper,
    black: '#0a0a0a',
  }
}

export function applyEvCssVariables(t, mode) {
  const root = document.documentElement
  root.setAttribute('data-ev-color-mode', mode)
  const m = t.map
  root.style.setProperty('--ev-bg-app', t.bg.app)
  root.style.setProperty('--ev-body-bg', t.bg.app)
  root.style.setProperty('--ev-map-marker-dot', m.markerDot)
  root.style.setProperty('--ev-map-marker-fill', t.blue.main)
  root.style.setProperty('--ev-map-marker-bolt', m.markerBolt)
  root.style.setProperty('--ev-map-marker-stroke', m.markerStroke)
  root.style.setProperty('--ev-map-marker-ring', t.blue.borderSoft)
  root.style.setProperty('--ev-map-marker-shadow', mode === 'dark' ? '0 2px 12px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0, 0, 0, 0.22)')
  root.style.setProperty('--ev-map-pin-start', m.pinGradientStart)
  root.style.setProperty('--ev-map-pin-mid', m.pinGradientMid)
  root.style.setProperty('--ev-map-pin-end', m.pinGradientEnd)
  root.style.setProperty('--ev-map-pin-tip', m.pinTip)
  root.style.setProperty('--ev-map-pin-ring', t.blue.borderSoft)
  root.style.setProperty('--ev-map-ripple', m.markerDot)
  root.style.setProperty('--ev-leaflet-popup-bg', mode === 'dark' ? t.bg.raised : 'rgba(255,255,255,0.96)')
  root.style.setProperty('--ev-leaflet-popup-text', t.text.primary)
  root.style.setProperty('--ev-leaflet-popup-muted', t.text.tertiary)
  root.style.setProperty('--ev-leaflet-popup-border', t.border.default)
}
