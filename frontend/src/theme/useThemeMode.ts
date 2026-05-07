import { useContext } from 'react'
import { ThemeModeContext } from './ThemeModeContext'

export function useThemeMode() {
  const context = useContext(ThemeModeContext)

  if (!context) {
    throw new Error('useThemeMode deve essere usato dentro AppThemeProvider')
  }

  return context
}
