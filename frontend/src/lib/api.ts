// ─── Imports ─────────────────────────────────────────────────────────────────
import axios from 'axios'
import type {
  HealthResponse,
  AuthUser,
  AuthResponse,
  AdminUser,
  AdminToggleSubscriptionResponse,
  RegisterRequestInput,
  RegisterRequestResponse,
  UpdateMyProfileInput,
  ActivateUserResponse,
  SetInitialPasswordResponse,
  ProfilePictureUploadResponse,
  PublicUser,
} from '../types'

// Re-esporta tutti i tipi di dominio in modo che i consumer possano importarli
// direttamente da questo modulo senza conoscere la cartella types/.
export type {
  HealthResponse,
  AuthUser,
  AuthResponse,
  AdminUser,
  AdminToggleSubscriptionResponse,
  RegisterRequestInput,
  RegisterRequestResponse,
  UpdateMyProfileInput,
  ActivateUserResponse,
  SetInitialPasswordResponse,
  ProfilePictureUploadResponse,
  PublicUser,
} from '../types'

// ─── Config Axios ─────────────────────────────────────────────────────────────
// apiClient: per richieste autenticate (sessione attiva richiesta).
// authClient: per le operazioni di autenticazione (login, register) che non
// richiedono un header custom ma inviano comunque il cookie di sessione.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

const authClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Gestione errori ──────────────────────────────────────────────────────────
// Normalizza qualsiasi tipo di errore Axios o generico in una stringa leggibile.
function normalizeErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data
    if (
      message &&
      typeof message === 'object' &&
      'error' in message &&
      typeof message.error === 'string'
    ) {
      return message.error
    }

    if (error.message) {
      return error.message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Errore API sconosciuto'
}

// Lancia sempre un Error con messaggio normalizzato per uniformare i catch nelle pagine.
function throwApiError(error: unknown): never {
  throw new Error(normalizeErrorMessage(error), {
    cause: error,
  })
}

// ─── Health ───────────────────────────────────────────────────────────────────
export async function getHealth(): Promise<HealthResponse> {
  try {
    const { data } = await apiClient.get<HealthResponse>('/health')
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function registerUser(input: RegisterRequestInput) {
  try {
    const { data } = await authClient.post<RegisterRequestResponse>('/users', input)
    return data
  } catch (error) {
    throwApiError(error)
  }
}

export async function login(email: string, password: string) {
  try {
    const { data } = await authClient.post<AuthResponse>('/auth/login', {
      email,
      password,
    })
    return data
  } catch (error) {
    throwApiError(error)
  }
}

export async function logout() {
  try {
    await authClient.post('/auth/logout')
  } catch (error) {
    throwApiError(error)
  }
}

export async function getMe() {
  try {
    const { data } = await apiClient.get<AuthUser>('/auth/me')
    return data
  } catch (error) {
    throwApiError(error)
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  try {
    const { data } = await apiClient.post<AuthResponse>('/auth/change-password', {
      currentPassword,
      newPassword,
    })
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ─── Profilo utente ───────────────────────────────────────────────────────────
export async function updateMyProfile(input: UpdateMyProfileInput) {
  try {
    const { data } = await apiClient.patch<{ ok: boolean; message: string }>(
      '/users/me/profile',
      input,
    )
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export async function getAdminUsers() {
  try {
    const { data } = await apiClient.get<AdminUser[]>('/admin/users')
    return data
  } catch (error) {
    throwApiError(error)
  }
}

export async function toggleAdminUserSubscription(
  userId: number,
  adminPassword: string,
) {
  try {
    const { data } = await apiClient.patch<AdminToggleSubscriptionResponse>(
      `/admin/users/${userId}/subscription`,
      { adminPassword },
    )
    return data
  } catch (error) {
    throwApiError(error)
  }
}

export async function activateUser(userId: number) {
  try {
    const { data } = await apiClient.post<ActivateUserResponse>(
      `/admin/users/${userId}/activate`,
    )
    return data
  } catch (error) {
    throwApiError(error)
  }
}

export async function setInitialPassword(
  userId: number,
  initialPassword: string,
) {
  try {
    const { data } = await apiClient.patch<SetInitialPasswordResponse>(
      `/admin/users/${userId}/initial-password`,
      { initialPassword },
    )
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ─── Utenti pubblici ──────────────────────────────────────────────────────────
export async function uploadProfilePicture(
  userId: number,
  file: File,
) {
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post<ProfilePictureUploadResponse>(
      `/users/${userId}/profile-picture`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return data
  } catch (error) {
    throwApiError(error)
  }
}

export async function getUsers(): Promise<PublicUser[]> {
    try {
      const { data } = await apiClient.get<PublicUser[]>('/users')
      return data
    } catch (error) {
      throwApiError(error)
    }
  }
