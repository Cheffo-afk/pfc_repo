import { Alert, Box, CircularProgress, Container } from '@mui/material'
import { useEffect, useState, type PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe } from './api'
import type { AuthUser } from '../types'

// ______ RouteGuard: verifica la sessione ad ogni cambio di pathname ______
// ______ Se la sessione non e' valida → redirect /login ______
// ______ Se il ruolo non corrisponde a requiredRole → errore 403 ______
type RouteGuardProps = PropsWithChildren<{
  // ______ Se non specificato, basta che l'utente sia autenticato ______
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
