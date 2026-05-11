// ─── API / Domain types ──────────────────────────────────────────────────────

export type HealthResponse = {
  ok: boolean
  now: string
}

export type AuthUser = {
  userId: number
  email: string
  username: string
  role: 'admin' | 'user'
  mustChangePassword: boolean
  anagraphicsRef?: {
    nome: string
    cognome: string
    telefono: string | null
    indirizzo: string | null
    fotoProfilo: string
  } | null
}

export type AuthResponse = {
  user: AuthUser
}

export type AdminUser = {
  userId: number
  email: string
  username: string
  role: 'user'
  subscribed: 'active' | 'inactive'
  mustChangePassword: boolean
  createdAt: string
  anagraphicsRef: {
    nome: string
    cognome: string
    telefono: string | null
    indirizzo: string | null
    fotoProfilo: string
  } | null
  userStateRef: {
    status: 'online' | 'offline' | 'nonAlComputer'
    lastOnline: string
  } | null
}

export type AdminToggleSubscriptionResponse = {
  ok: boolean
  subscribed: 'active' | 'inactive'
  message: string
}

export type AdminCreateUserInput = {
  nome: string
  cognome: string
  username: string
  email: string
  initialPassword: string
}

export type AdminCreateUserResponse = {
  userId: number
  email: string
  username: string
  role: 'user'
  mustChangePassword: boolean
}

export type RegisterRequestInput = {
  nome: string
  cognome: string
  username: string
  email: string
}

export type RegisterRequestResponse = {
  ok: boolean
  message: string
}

export type UpdateMyProfileInput = {
  username: string
  telefono?: string | null
  indirizzo?: string | null
}

export type ActivateUserResponse = {
  ok: boolean
  message: string
}

export type SetInitialPasswordResponse = {
  ok: boolean
  message: string
}

export type ProfilePictureUploadResponse = {
  ok: boolean
  path: string
  message: string
}

export type PublicUser = {
  userId: number
  username: string
  email: string
  mustChangePassword: boolean
  createdAt: string
  unreadCount: number
  anagraphicsRef: {
    nome: string
    cognome: string
    fotoProfilo: string
  } | null
}

// ─── WebSocket types ─────────────────────────────────────────────────────────

export type PresenceStatus = 'online' | 'nonAlComputer' | 'offline'

export type ChatMessage = {
  messageId: number
  roomId: number
  fromUsername: string
  toUsername: string
  content: string
  at: string
  readAt?: string | null
}

export type HistoryResult = {
  withUsername: string
  limit: number
  hasMore: boolean
  beforeMessageId: number | null
  messages: ChatMessage[]
}

// ─── WebRTC types ─────────────────────────────────────────────────────────────

export type CallState = 'idle' | 'calling' | 'incoming' | 'connected'

export type IncomingCallInfo = {
  callId: string
  fromUserId: number
  description: RTCSessionDescriptionInit
}
