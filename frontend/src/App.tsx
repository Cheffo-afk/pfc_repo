import {
  AppBar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useThemeMode } from './theme/useThemeMode'
import { getAdminUsers } from './lib/api'
import { RouteGuard } from './lib/RouteGuard'
import { useAuth } from './lib/useAuth'

// ─── Lazy pages ───────────────────────────────────────────────────────────────
// ______ Tutte le pagine sono caricate in lazy per ridurre il bundle iniziale ______
const LoginPage = lazy(() => import('./pages/LoginPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const SubscribersManagementPage = lazy(() => import('./pages/SubscribersManagementPage'))
const RequestsPage = lazy(() => import('./pages/RequestsPage'))
const UserPage = lazy(() => import('./pages/UserPage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))

// ______ Spinner mostrato durante il lazy-load di ogni pagina ______
function PageLoader() {
  return (
    <Box
      sx={{
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
        <CircularProgress size={28} />
        <Typography variant="body2" color="text.secondary">
          Caricamento pagina...
        </Typography>
      </Stack>
    </Box>
  )
}

// ─── Stato navbar e ruolo ─────────────────────────────────────────────────────
// ______ La navbar globale e' visibile solo sulle pagine pubbliche, appare quando il cursore ______
// ______ e' nella zona alta (entro 100px) — /user e /admin usano le proprie AppBar ______
function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, toggleMode } = useThemeMode()
  const { user } = useAuth()
  const [showNavbar, setShowNavbar] = useState(false)
  const [pendingRegistrations, setPendingRegistrations] = useState(0)

  // ______ Mostra/nasconde la navbar quando il cursore e' nella zona alta (entro 100px) ______
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setShowNavbar(e.clientY < 100)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const isAdmin = user?.role === 'admin'

  const isPublicPath = ['/', '/login', '/register'].includes(location.pathname)

  // ______ Polling ogni 15 secondi per aggiornare il badge con le iscrizioni in attesa ______
  // ______ Attivo solo quando l'utente e' admin ______
  useEffect(() => {
    if (!isAdmin) {
      return
    }

    let mounted = true

    const loadPending = async () => {
      try {
        const users = await getAdminUsers()
        if (!mounted) return
        const pending = users.filter(
          (u) => u.subscribed === 'inactive' && u.mustChangePassword,
        ).length
        setPendingRegistrations(pending)
      } catch {
        if (!mounted) return
        setPendingRegistrations(0)
      }
    }

    void loadPending()
    const timer = window.setInterval(() => {
      void loadPending()
    }, 15000)

    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [isAdmin])

  const isSpecialPage = location.pathname.startsWith('/user') || location.pathname.startsWith('/admin')

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          transform: (!isSpecialPage && showNavbar) ? 'translateY(0)' : 'translateY(-100%)',
          pointerEvents: (!isSpecialPage && showNavbar) ? 'auto' : 'none',
          transition: 'transform 0.3s ease-in-out',
          width: '100%',
          top: 0,
          left: 0,
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', py: 0.8 }}>
            <Typography
              variant="h6"
              onClick={() => navigate('/')}
              sx={{ fontWeight: 800, cursor: 'pointer', transition: 'opacity 0.2s', '&:hover': { opacity: 0.7 } }}
            >
              PFCWB-Chat
            </Typography>

            <Stack direction="row" spacing={1.2}>
              <Button variant="outlined" onClick={() => navigate('/login')}>
                Accedi
              </Button>

              {isAdmin && !isPublicPath && (
                <Button variant="outlined" onClick={() => navigate('/admin')}>
                  Admin
                </Button>
              )}

              {isAdmin && !isPublicPath && (
                <Badge color="warning" badgeContent={pendingRegistrations}>
                  <Button variant="outlined" onClick={() => navigate('/admin/gestione-iscritti')}>
                    Gestione Iscritti
                  </Button>
                </Badge>
              )}

              <Button
                variant="contained"
                color="primary"
                onClick={toggleMode}
                startIcon={mode === 'light' ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
              >
                {mode === 'light' ? 'DM' : 'LM'}
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Box sx={{ flex: 1 }}>
          {/* ── Rotte applicazione ──────────────────────────────────────── */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={(
                <RouteGuard requiredRole="admin">
                  <AdminPage />
                </RouteGuard>
              )}
            />
            <Route
              path="/admin/gestione-iscritti"
              element={(
                <RouteGuard requiredRole="admin">
                  <SubscribersManagementPage />
                </RouteGuard>
              )}
            />
            <Route
              path="/admin/richieste"
              element={(
                <RouteGuard requiredRole="admin">
                  <RequestsPage />
                </RouteGuard>
              )}
            />
            <Route
              path="/user"
              element={(
                <RouteGuard>
                  <UserPage />
                </RouteGuard>
              )}
            />
            <Route
              path="/user/profile"
              element={(
                <RouteGuard>
                  <UserProfilePage />
                </RouteGuard>
              )}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Box>

      {/* ── Footer globale ──────────────────────────────────────────────── */}
      <Box
        component="footer"
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.25, sm: 2 },
          textAlign: 'center',
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, fontSize: { xs: '0.8rem', sm: '0.875rem' }, lineHeight: 1.2 }}
        >
          PFCWD Chat -- 2026
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.74rem', sm: '0.875rem' }, lineHeight: 1.2, mt: 0.25 }}
        >
          WD: Daniele Capodivento
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: 0.35,
            fontSize: { xs: '0.65rem', sm: '0.75rem' },
            lineHeight: 1.3,
            px: { xs: 0.5, sm: 0 },
          }}
        >
          I dati personali sono trattati nel rispetto dei principi di minimizzazione, sicurezza e riservatezza. Utilizzando la piattaforma dichiari di aver preso visione delle informative privacy applicabili.
        </Typography>
      </Box>
    </Box>
  )
}

export default App
