import { Alert, Box, CircularProgress, Container } from '@mui/material'
import { useEffect, type PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
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
  const { user, loading, refreshAuth } = useAuth()

  useEffect(() => {
    void refreshAuth()
  }, [location.pathname, refreshAuth])

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <Container maxWidth="sm" sx={{ pt: { xs: 10.25, md: 12.25 } }}>
        <Alert severity="error">Privilegi insufficienti per accedere a questa pagina.</Alert>
      </Container>
    )
  }

  return <>{children}</>
}
