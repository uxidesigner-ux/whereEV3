/**
 * EV 대시보드 디자인 시스템
 * Gray + White 기반, Single Blue 포인트 컬러
 */
export const colors = {
  // Blue scale (primary accent)
  blue: {
    primary: '#2563eb',
    light: '#3b82f6',
    lighter: '#60a5fa',
    pale: '#93c5fd',
    deep: '#1d4ed8',
    muted: 'rgba(37, 99, 235, 0.12)',
  },
  // Gray scale
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  white: '#ffffff',
  black: '#0a0a0a',
}

/** liquid glass: 배경 투명도 20% */
export const glass = {
  panel: {
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  },
  panelHover: {
    background: 'rgba(255, 255, 255, 0.28)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
  },
}

export const spacing = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 24,
  /** liquid glass 컴포넌트 내부 패딩 고정 */
  glass: 24,
  panel: 24,
  card: 12,
  control: 10,
}

export const radius = {
  xs: 3,
  sm: 5,
  md: 8,
  lg: 10,
  xl: 12,
  /** liquid glass 컴포넌트 border-radius 고정 */
  glass: 20,
  panel: 20,
  card: 12,
  /** 모바일 시트·다이얼로그 상단 */
  sheet: 12,
  control: 6,
  full: 9999,
}

/** 모바일 앱 느낌: 시트·페이퍼 전환 (미세 튜닝: 조금 짧게·감속 끝을 부드럽게) */
export const motion = {
  easing: {
    standard: 'cubic-bezier(0.33, 0.72, 0.02, 1)',
    emphasized: 'cubic-bezier(0.22, 0.82, 0.24, 1)',
    /** 패널 슬라이드 등 단순 이동 */
    panel: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  duration: {
    sheet: 300,
    enter: 220,
    exit: 180,
    /** 좌측 데스크톱 패널 슬라이드 */
    panelSlide: 260,
    /** FAB 등 오버레이 해제 후 짧은 대기 */
    fabReveal: 64,
  },
}

/** 바텀 시트 스냅(뷰포트 대비 비율은 MobileBottomSheet props로 조정) */
export const sheetLayout = {
  /** 목록 시트 접힘 높이 — 헤더(핸들+타이틀 행+divider) min 높이와 맞춤 */
  collapsedPx: 90,
  halfVhRatio: 0.42,
  /** 모바일 상단 바: 검색·내 위치·필터 행 높이 */
  topChromePx: 56,
  /** 상단 바 콘텐츠 박스 인셋(상하좌우 시각 균일). safe-area는 App에서 별도 가산 */
  mobileTopBarInsetPx: 12,
  /** topChromePx와 동일 권장 — 컨트롤 세트 높이 */
  mobileTopBarControlPx: 56,
  /** 인셋 + 컨트롤행 + 인셋 + border(1) → Leaflet/시트 오프셋. iOS 노치 높이는 CSS env(safe-area-inset-top)로 가산 */
  mobileTopBarStackPx: 12 + 56 + 12 + 1,
}

export const chartBlueScale = [
  colors.blue.primary,
  colors.blue.light,
  colors.blue.lighter,
  colors.blue.pale,
  colors.blue.deep,
  '#1e40af',
]
