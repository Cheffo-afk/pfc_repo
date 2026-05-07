import { Alert, Box, CircularProgress, Container } from '@mui/material'
import { useEffect, useState, type PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe, type AuthUser } from './api'

// RouteGuard verifica la sessione ad ogni cambio di pathname.
// Se la sessione non è valida → redirect /login.
// Se il ruolo non corrisponde a requiredRole → mostra errore 403.
type RouteGuardProps = PropsWithChildren<{
  // Se non specificato, basta che l'utente sia autenticato.
  requiredRole?: AuthUser['role']
}>

export function RouteGuard({ children, requiredRole }: RouteGuardProps) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<AuthUser | null>(null)

  useEffect(() => {
    let mounted = true

    const loadMe = async () => {
      try {
        const user = await getMe()
        if (!mounted) return
        setMe(user)
      } catch {
        if (!mounted) return
        setMe(null)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadMe()

    return () => {
      mounted = false
    }
  }, [location.pathname])

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!me) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && me.role !== requiredRole) {
    return (
      <Container maxWidth="sm" sx={{ pt: { xs: 10.25, md: 12.25 } }}>
        <Alert severity="error">Privilegi insufficienti per accedere a questa pagina.</Alert>
      </Container>
    )
  }

  return <>{children}</>
}
