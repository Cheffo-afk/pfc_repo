// ─── Imports ─────────────────────────────────────────────────────────────────
import axios from 'axios'
import type {
  HealthResponse,
  AuthUser,
  AuthResponse,
  AdminUser,
  AdminToggleSubscriptionResponse,
  AdminCreateUserInput,
  AdminCreateUserResponse,
  RegisterRequestInput,
  RegisterRequestResponse,
  UpdateMyProfileInput,
  ActivateUserResponse,
  SetInitialPasswordResponse,
  ProfilePictureUploadResponse,
  PublicUser,
} from '../types'

// ─── Config Axios ─────────────────────────────────────────────────────────────
// ______ Unica istanza condivisa per tutte le chiamate API ______
// ______ withCredentials=true garantisce l'invio del cookie di sessione ______
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Gestione errori ──────────────────────────────────────────────────────────
// ______ Normalizza qualsiasi tipo di errore Axios o generico in una stringa leggibile ______
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

// ______ Lancia sempre un Error con messaggio normalizzato per uniformare i catch nelle pagine ______
function throwApiError(error: unknown): never {
  throw new Error(normalizeErrorMessage(error), {
    cause: error,
  })
}

// ─── Health ───────────────────────────────────────────────────────────────────
// ______ GET /health — controlla che il backend sia raggiungibile (usato da LandingPage) ______
export async function getHealth(): Promise<HealthResponse> {
  try {
    const { data } = await apiClient.get<HealthResponse>('/health')
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
// ______ POST /users — richiesta di iscrizione pubblica (senza sessione) ______
export async function registerUser(input: RegisterRequestInput) {
  try {
    const { data } = await apiClient.post<RegisterRequestResponse>('/users', input)
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ______ POST /auth/login — autentica l'utente e scrive la sessione ______
export async function login(email: string, password: string) {
  try {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', {
      email,
      password,
    })
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ______ POST /auth/logout — distrugge la sessione server-side ______
export async function logout() {
  try {
    await apiClient.post('/auth/logout')
  } catch (error) {
    throwApiError(error)
  }
}

// ______ GET /auth/me — restituisce il profilo completo dell'utente loggato ______
export async function getMe() {
  try {
    const { data } = await apiClient.get<AuthUser>('/auth/me')
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ______ POST /auth/change-password — cambia password verificando quella attuale ______
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
// ______ PATCH /users/me/profile — aggiorna username, telefono e indirizzo ______
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
// ______ GET /admin/users — lista tutti gli utenti con stato presenza e anagrafica ______
export async function getAdminUsers() {
  try {
    const { data } = await apiClient.get<AdminUser[]>('/admin/users')
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ______ POST /admin/users — crea utente direttamente con password iniziale ______
export async function createAdminUser(input: AdminCreateUserInput) {
  try {
    const { data } = await apiClient.post<AdminCreateUserResponse>('/admin/users', input)
    return data
  } catch (error) {
    throwApiError(error)
  }
}

// ______ PATCH /admin/users/:userId/subscription — attiva o disattiva la subscription ______
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

// ______ POST /admin/users/:userId/activate — attiva un utente in attesa ______
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

// ______ PATCH /admin/users/:userId/initial-password — imposta password iniziale per l'utente ______
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
// ______ POST /users/:userId/profile-picture — carica la foto profilo (multipart/form-data) ______
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

// ______ GET /users — lista gli utenti attivi con contatore messaggi non letti ______
export async function getUsers(): Promise<PublicUser[]> {
    try {
      const { data } = await apiClient.get<PublicUser[]>('/users')
      return data
    } catch (error) {
      throwApiError(error)
    }
  }
