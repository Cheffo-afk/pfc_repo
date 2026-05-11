// ______ Utility condivise per presenza utente e avatar ______
// ______ Usate da UserPage e RequestsPage per evitare duplicazione ______
import type { PresenceStatus } from '../types'

// ______ Etichetta leggibile per ogni stato presenza ______
export function statusLabel(status: PresenceStatus | undefined): string {
  if (status === 'online') return 'Online'
  if (status === 'nonAlComputer') return 'Non al computer'
  return 'Offline'
}

// ______ Colore del dot di stato presenza (verde/arancio/grigio) ______
export function statusDotColor(status: PresenceStatus | undefined): string {
  if (status === 'online') return '#4CAF50'
  if (status === 'nonAlComputer') return '#EFA928'
  return '#9e9e9e'
}

// ______ Formatta timestamp ISO in ora italiana HH:MM ______
export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

// ______ Restituisce le iniziali (2 caratteri) di un username per l'Avatar MUI ______
export function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

// ______ Risolve il percorso assoluto della foto profilo ______
// ______ Gestisce: path relativo (uploads/), path assoluto, URL esterno, default ______
export function resolveAvatarSrc(path: string | null | undefined): string | undefined {
  if (!path || path === 'default-profile.png') {
    return undefined
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  return path.startsWith('/') ? path : `/uploads/profiles/${path}`
}
