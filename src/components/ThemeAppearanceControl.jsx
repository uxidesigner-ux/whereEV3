import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import { useEvTheme } from '../theme/ThemeModeProvider.jsx'

/**
 * 라이트 / 다크. 필터 시트·데스크톱 패널 등 설정 진입점.
 * 상단 원형 버튼은 App에서 togglePreference로 즉시 전환.
 */
export function ThemeAppearanceControl({ compact = false }) {
  const { preference, setPreference, tokens } = useEvTheme()

  return (
    <Box sx={{ mb: compact ? 1 : 2 }}>
      <Typography
        variant="subtitle2"
        sx={{ fontWeight: 700, color: tokens.text.primary, mb: 1, fontSize: compact ? '0.8125rem' : '0.875rem' }}
      >
        화면 모드
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={preference}
        onChange={(_, v) => v != null && setPreference(v)}
        aria-label="화면 밝기 모드"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 0.5,
          '& .MuiToggleButton-root': {
            flex: 1,
            minWidth: 0,
            px: 1,
            py: 0.75,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.8125rem',
            color: tokens.text.secondary,
            borderColor: `${tokens.border.default} !important`,
            '&.Mui-selected': {
              color: tokens.blue.main,
              bgcolor: tokens.blue.muted,
              borderColor: `${tokens.blue.borderSoft} !important`,
            },
          },
        }}
      >
        <ToggleButton value="light" aria-label="라이트 모드">
          <LightModeOutlined sx={{ fontSize: 18, mr: 0.5 }} />
          라이트
        </ToggleButton>
        <ToggleButton value="dark" aria-label="다크 모드">
          <DarkModeOutlined sx={{ fontSize: 18, mr: 0.5 }} />
          다크
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )
}
