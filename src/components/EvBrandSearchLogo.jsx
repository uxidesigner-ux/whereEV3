import { useId } from 'react'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

const SIZE_PX = 22

/**
 * 모바일 검색바 leading 브랜드 마크. 그라데이션 핀 + 번개 실루엣.
 * 다크 모드에서는 검은 번개를 밝은 톤으로 바꿔 search 필드 배경과 대비 확보.
 */
export function EvBrandSearchLogo({ size = SIZE_PX }) {
  const { resolvedMode, tokens } = useEvTheme()
  const rawId = useId()
  const gid = rawId.replace(/:/g, '')
  const gradId = `ev-logo-grad-${gid}`
  const lightningFill = resolvedMode === 'dark' ? tokens.text.primary : '#111827'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        d="M60 10C82.0914 10 100 27.9086 100 50C100 60.8802 95.6559 70.7454 88.6075 77.9563C80.0897 86.6706 69.3819 93.7496 63.2892 104.303L60 110L56.7096 104.301C50.617 93.7489 39.9101 86.6705 31.3929 77.957C24.3443 70.746 20 60.8805 20 50C20 27.9086 37.9086 10 60 10Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M60 10C66.5078 10 72.6521 11.5552 78.083 14.3125L65.9629 38.7998H82L48.1436 82L55.2705 51.4004H41L47.8164 11.8906C51.6579 10.6635 55.7514 10 60 10Z"
        fill={lightningFill}
      />
      <defs>
        <linearGradient id={gradId} x1="60" y1="10" x2="60" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00BFFF" />
          <stop offset="1" stopColor="#0015FF" />
        </linearGradient>
      </defs>
    </svg>
  )
}
