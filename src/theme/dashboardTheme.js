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
  /** 앱형 필터 등 큰 상단 라운드 */
  sheetApp: 24,
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
    /** 상세 Drawer 등 오버레이 진입 — 목록 시트와 리듬 맞춤 */
    detailEnter: 280,
    detailExit: 200,
    enter: 220,
    exit: 180,
    /** 좌측 데스크톱 패널 슬라이드 */
    panelSlide: 260,
    /** FAB 등 오버레이 해제 후 짧은 대기 */
    fabReveal: 64,
  },
}

/**
 * 모바일 앱형 타이포 스케일 (1rem = 16px).
 * 상세 메인 20~22px, 섹션 16~18px, 본문 14~15px, 보조 13~14px, 칩 12~13px, 캡션 11~12px.
 * 공유 컴포넌트는 xs(모바일) / md(데스크톱 패널)로 위계만 모바일에서 벌림.
 */
export const appMobileType = {
  detailSheetTitle: {
    fontSize: { xs: '1.3125rem', md: '1.125rem' },
    lineHeight: { xs: 1.3, md: 1.35 },
    fontWeight: 700,
  },
  detailSheetSubtitle: {
    fontSize: { xs: '0.75rem', md: '0.7rem' },
    lineHeight: { xs: 1.4, md: 1.35 },
    fontWeight: 500,
  },
  listSheetTitle: {
    fontSize: '1.0625rem',
    lineHeight: 1.35,
    fontWeight: 700,
  },
  filterSheetTitle: {
    fontSize: '1.125rem',
    lineHeight: 1.35,
    fontWeight: 700,
  },
  filterSheetHint: {
    fontSize: '0.8125rem',
    lineHeight: 1.45,
    fontWeight: 500,
  },
  /** 블록 섹션 제목(장소 정보, 이동·문의) */
  sectionBlock: {
    fontSize: { xs: '1.0625rem', md: '0.9375rem' },
    lineHeight: { xs: 1.35, md: 1.35 },
    fontWeight: 700,
  },
  /** 필드 라벨(주소, 이용시간) */
  metaFieldLabel: {
    fontSize: { xs: '0.8125rem', md: '0.7rem' },
    lineHeight: 1.35,
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  body: {
    fontSize: { xs: '0.875rem', md: '0.8125rem' },
    lineHeight: { xs: 1.45, md: 1.5 },
    fontWeight: 400,
  },
  bodyStrong: {
    fontSize: { xs: '0.9375rem', md: '0.875rem' },
    lineHeight: { xs: 1.45, md: 1.45 },
    fontWeight: 600,
  },
  secondary: {
    fontSize: { xs: '0.8125rem', md: '0.75rem' },
    lineHeight: { xs: 1.4, md: 1.4 },
    fontWeight: 500,
  },
  chargerCardTitle: {
    fontSize: { xs: '1rem', md: '0.75rem' },
    lineHeight: { xs: 1.3, md: 1.35 },
    fontWeight: 800,
  },
  railHeading: {
    fontSize: { xs: '0.8125rem', md: '0.72rem' },
    lineHeight: 1.4,
    fontWeight: 500,
  },
  chipRail: {
    height: 40,
    fontSize: '0.8125rem',
  },
  statusChip: {
    height: 28,
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  caption: {
    fontSize: { xs: '0.75rem', md: '0.65rem' },
    lineHeight: 1.35,
    fontWeight: 500,
  },
  captionDense: {
    fontSize: { xs: '0.6875rem', md: '0.62rem' },
    lineHeight: 1.35,
    fontWeight: 500,
  },
  searchField: {
    fontSize: '0.9375rem',
    lineHeight: 1.4,
  },
  filterSectionLabel: {
    fontSize: '0.9375rem',
    lineHeight: 1.35,
    fontWeight: 700,
  },
  filterChip: {
    fontSize: '0.8125rem',
    height: 34,
  },
  filterListItem: {
    fontSize: '0.875rem',
  },
  buttonPrimary: {
    fontSize: { xs: '0.9375rem', md: '0.875rem' },
  },
  listMeta: {
    fontSize: { xs: '0.8125rem', md: '0.68rem' },
    lineHeight: { xs: 1.4, md: 1.35 },
    fontWeight: 500,
  },
  listEyebrow: {
    fontSize: { xs: '0.75rem', md: '0.65rem' },
    lineHeight: 1.35,
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  detailTabLabel: {
    fontSize: '0.75rem',
    lineHeight: 1.2,
    fontWeight: 700,
  },
}

/** 모바일 플로팅 검색·FAB 행 (지도 위 오버레이) */
export const mobileMapChrome = {
  searchPillH: 52,
  fabSize: 48,
  fabGap: 8,
  rowGap: 10,
  /**
   * safe-area-inset-top 아래 추가 여백(px).
   * 상단 래퍼: padding-top = calc(env(safe-area-inset-top) + safeAreaInnerTopPad)
   */
  safeAreaInnerTopPad: 8,
  /** 행 아래쪽만(위는 safeAreaInnerTopPad) */
  padY: 10,
  padX: 14,
  /** 그림자 톤 — 검색 pill·원형 FAB 공통 */
  floatShadow: '0 4px 24px rgba(15, 23, 42, 0.12), 0 2px 10px rgba(15, 23, 42, 0.08)',
}

/** 바텀 시트 스냅(뷰포트 대비 비율은 MobileBottomSheet props로 조정) */
export const sheetLayout = {
  /** 목록 시트 접힘 높이 — 헤더(핸들+타이틀 블록+얇은 정리선) min 높이와 맞춤 */
  collapsedPx: 98,
  halfVhRatio: 0.42,
  /** @deprecated 플로팅 크롬 — 호환용 */
  topChromePx: 56,
  mobileTopBarInsetPx: mobileMapChrome.padY,
  mobileTopBarControlPx: mobileMapChrome.searchPillH,
  /**
   * Leaflet/목록 시트·토스트 top 보정용(픽셀): safe-area는 CSS에서 별도 합산.
   * = safeAreaInnerTopPad + max(pill, FAB열) + 하단 padY (FAB열 = fabSize*2 + fabGap)
   */
  mobileTopBarStackPx:
    mobileMapChrome.safeAreaInnerTopPad +
    Math.max(mobileMapChrome.searchPillH, mobileMapChrome.fabSize * 2 + mobileMapChrome.fabGap) +
    mobileMapChrome.padY,
}

export const chartBlueScale = [
  colors.blue.primary,
  colors.blue.light,
  colors.blue.lighter,
  colors.blue.pale,
  colors.blue.deep,
  '#1e40af',
]
