import { createTheme, type PaletteMode } from '@mui/material/styles'

export function createSpringTheme(mode: PaletteMode) {
  const isLight = mode === 'light'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? '#3B8F3E' : '#8FD682',
      },
      secondary: {
        main: isLight ? '#F28C45' : '#FFB980',
      },
      background: {
        default: isLight ? '#FDF4F7' : '#2B2B2B',
        paper: isLight ? '#FFF8FA' : '#383838',
      },
      text: {
        primary: isLight ? '#2E1F27' : '#F3F0F0',
        secondary: isLight ? '#7A4F62' : '#D4C8CC',
      },
      success: {
        main: isLight ? '#4CAF50' : '#7CD97F',
      },
      warning: {
        main: isLight ? '#EFA928' : '#F9C95A',
      },
    },
    shape: {
      borderRadius: 16,
    },
    typography: {
      fontFamily: `'Quicksand', 'Nunito', 'Trebuchet MS', sans-serif`,
      h1: {
        fontWeight: 700,
      },
      h2: {
        fontWeight: 700,
      },
      h3: {
        fontWeight: 700,
      },
      button: {
        textTransform: 'none',
        fontWeight: 700,
      },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            paddingInline: 18,
          },
        },
      },
    },
  })
}
