import {
  createContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { CssBaseline, ThemeProvider, type PaletteMode } from '@mui/material'
import { createSpringTheme } from './springTheme'

// ─── ThemeModeContext ─────────────────────────────────────────────────────────
// Fornisce il tema MUI corrente (light/dark) e la funzione di toggle a tutti i
// componenti figli tramite Context. Usato via hook useThemeMode (theme/useThemeMode.ts).
type ThemeModeContextValue = {
  mode: PaletteMode
  toggleMode: () => void
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null)

export { ThemeModeContext }

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<PaletteMode>('light')

  const theme = useMemo(() => createSpringTheme(mode), [mode])

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () => {
        setMode((prev) => (prev === 'light' ? 'dark' : 'light'))
      },
    }),
    [mode],
  )

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}
