/* eslint-disable react-refresh/only-export-components -- useEvTheme는 Provider와 함께 두는 편이 단순함 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material'
import { lightTokens, darkTokens, applyEvCssVariables, tokensToLegacyColors } from './semanticTokens.js'
import { radius, motion } from './dashboardTheme.js'

const STORAGE_KEY = 'whereev-theme-preference'

const ThemeModeContext = createContext(null)

/** @returns {{ tokens: import('./semanticTokens.js').lightTokens, preference: 'light'|'dark'|'system', setPreference: (p: 'light'|'dark'|'system') => void, resolvedMode: 'light'|'dark' }} */
export function useEvTheme() {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) throw new Error('useEvTheme must be used within ThemeModeProvider')
  return ctx
}

function readStoredPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* noop */
  }
  return 'system'
}

export function ThemeModeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readStoredPreference)
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = () => setSystemDark(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  const resolvedMode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  const tokens = resolvedMode === 'dark' ? darkTokens : lightTokens

  useEffect(() => {
    applyEvCssVariables(tokens, resolvedMode)
  }, [tokens, resolvedMode])

  const setPreference = useCallback((p) => {
    setPreferenceState(p)
    try {
      localStorage.setItem(STORAGE_KEY, p)
    } catch {
      /* noop */
    }
  }, [])

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
    () => ({ tokens, colors, preference, setPreference, resolvedMode }),
    [tokens, colors, preference, setPreference, resolvedMode],
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
