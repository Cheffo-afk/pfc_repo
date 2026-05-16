import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { getMe } from './api'
import type { AuthUser } from '../types'
import { authContext } from './authContextStore'

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

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

  const setAuthUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser)
    setLoading(false)
  }, [])

  const clearAuth = useCallback(() => {
    setUser(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  const value = useMemo(() => ({
    user,
    loading,
    refreshAuth,
    setAuthUser,
    clearAuth,
  }), [user, loading, refreshAuth, setAuthUser, clearAuth])

  return <authContext.Provider value={value}>{children}</authContext.Provider>
}
