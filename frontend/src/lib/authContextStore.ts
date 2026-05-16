import { createContext } from 'react'
import type { AuthUser } from '../types'

export type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  refreshAuth: () => Promise<AuthUser | null>
  setAuthUser: (nextUser: AuthUser | null) => void
  clearAuth: () => void
}

export const authContext = createContext<AuthContextValue | null>(null)
