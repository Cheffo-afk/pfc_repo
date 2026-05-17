import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { getMe } from './api'
import type { AuthUser } from '../types'
import { authContext } from './authContextStore'

// ______ Provider globale autenticazione: espone utente corrente e azioni auth ______
export function AuthProvider({ children }: PropsWithChildren) {
  // ______ user: sessione corrente; loading: bootstrap iniziale / refresh in corso ______
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // ______ Ricarica la sessione dal backend (/auth/me) e sincronizza lo stato locale ______
  const refreshAuth = useCallback(async () => {
    try {
      const nextUser = await getMe()
      setUser(nextUser)
      return nextUser
    } catch {
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // ______ Permette di impostare manualmente l'utente (es. subito dopo login) ______
  const setAuthUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser)
    setLoading(false)
  }, [])

  // ______ Logout locale: svuota user e chiude lo stato di caricamento ______
  const clearAuth = useCallback(() => {
    setUser(null)
    setLoading(false)
  }, [])

  // ______ Bootstrap al mount: tenta ripristino sessione esistente da cookie ______
  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  // ______ Stabilizza il value del context per ridurre rerender inutili dei consumer ______
  const value = useMemo(() => ({
    user,
    loading,
    refreshAuth,
    setAuthUser,
    clearAuth,
  }), [user, loading, refreshAuth, setAuthUser, clearAuth])

  // ______ Espone lo stato auth a tutto il sotto-albero React ______
  return <authContext.Provider value={value}>{children}</authContext.Provider>
}
