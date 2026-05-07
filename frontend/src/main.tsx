import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AppThemeProvider } from './theme/ThemeModeContext.tsx'

// Punto di ingresso React. AppThemeProvider gestisce il tema MUI (light/dark)
// e BrowserRouter fornisce il contesto di navigazione client-side.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppThemeProvider>
        <App />
      </AppThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
