/* eslint-disable react-refresh/only-export-components -- useEvTheme는 Provider와 함께 두는 편이 단순함 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material'
import { lightTokens, darkTokens, applyEvCssVariables, tokensToLegacyColors } from './semanticTokens.js'
import { radius, motion } from './dashboardTheme.js'

/** 모바일 상단 토글·앱 기본 persistence (light / dark) */
export const THEME_STORAGE_KEY = 'whereev-theme'
const LEGACY_STORAGE_KEY = 'whereev-theme-preference'

const ThemeModeContext = createContext(null)

/** @returns {{ tokens: import('./semanticTokens.js').lightTokens, preference: 'light'|'dark', setPreference: (p: 'light'|'dark') => void, togglePreference: () => void, resolvedMode: 'light'|'dark' }} */
export function useEvTheme() {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) throw new Error('useEvTheme must be used within ThemeModeProvider')
  return ctx
}

function readStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy === 'light' || legacy === 'dark') {
      localStorage.setItem(THEME_STORAGE_KEY, legacy)
      return legacy
    }
  } catch {
    /* noop */
  }
  return 'light'
}

export function ThemeModeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readStoredTheme)

  const resolvedMode = preference
  const tokens = resolvedMode === 'dark' ? darkTokens : lightTokens

  useEffect(() => {
    applyEvCssVariables(tokens, resolvedMode)
  }, [tokens, resolvedMode])

  const setPreference = useCallback((p) => {
    if (p !== 'light' && p !== 'dark') return
    setPreferenceState(p)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, p)
    } catch {
      /* noop */
    }
  }, [])

  const togglePreference = useCallback(() => {
    setPreference(resolvedMode === 'dark' ? 'light' : 'dark')
  }, [resolvedMode, setPreference])

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode === 'dark' ? 'dark' : 'light',
          primary: { main: tokens.blue.main, dark: tokens.blue.deep, light: tokens.blue.light },
          secondary: { main: tokens.blue.deep },
          background: { default: tokens.bg.app, paper: tokens.bg.paper },
          text: { primary: tokens.text.primary, secondary: tokens.text.secondary, disabled: tokens.text.muted },
          divider: tokens.border.default,
        },
        typography: {
          fontFamily: '"Inter", "Noto Sans KR", system-ui, sans-serif',
          h6: { fontWeight: 600, color: tokens.text.primary },
          body2: { color: tokens.text.secondary },
          caption: { color: tokens.text.muted },
        },
        shape: { borderRadius: radius.control },
        transitions: {
          easing: { easeOut: motion.easing.standard, sharp: motion.easing.emphasized },
          duration: {
            enteringScreen: motion.duration.enter,
            leavingScreen: motion.duration.exit,
            standard: motion.duration.sheet,
          },
        },
        components: {
          MuiDrawer: {
            styleOverrides: {
              paper: {
                borderTopLeftRadius: radius.sheet,
                borderTopRightRadius: radius.sheet,
                backgroundImage: 'none',
              },
            },
          },
          MuiDialog: {
            defaultProps: { scroll: 'paper' },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
              },
            },
          },
        },
      }),
    [resolvedMode, tokens],
  )

  const colors = useMemo(() => tokensToLegacyColors(tokens), [tokens])

  const value = useMemo(
    () => ({ tokens, colors, preference, setPreference, togglePreference, resolvedMode }),
    [tokens, colors, preference, setPreference, togglePreference, resolvedMode],
  )

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}
