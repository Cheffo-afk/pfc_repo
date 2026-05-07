import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  IconButton,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword, getMe, logout, updateMyProfile, uploadProfilePicture, type AuthUser } from '../lib/api'
import { useThemeMode } from '../theme/useThemeMode'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

// Chiave localStorage per la descrizione utente: isolata per userId
// per evitare collisioni tra utenti diversi sullo stesso browser.
function descriptionStorageKey(userId: number) {
  return `pfcwd.profile.description.${userId}`
}

// ─── Componente ───────────────────────────────────────────────────────────────
// Pagina dedicata alla gestione del profilo: anagrafica, foto, cambio password.
// Accessibile solo ad utenti autenticati via RouteGuard (/user/profile).
export default function UserProfilePage() {
  const navigate = useNavigate()
  const { mode, toggleMode } = useThemeMode()

  const [user, setUser] = useState<AuthUser | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwFeedback, setPwFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // ─── Form profilo ─────────────────────────────────────────────────────────
  // descrizione è salvata solo in localStorage (non nel DB) per evitare
  // la migrazione schema. La chiave è isolata per userId.
  const [profileForm, setProfileForm] = useState({
    username: '',
    telefono: '',
    indirizzo: '',
    descrizione: '',
  })

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const me = await getMe()
        if (!mounted) return
        const localDescription = window.localStorage.getItem(descriptionStorageKey(me.userId)) ?? ''
        setUser(me)
        setProfileForm({
          username: me.username,
          telefono: me.anagraphicsRef?.telefono ?? '',
          indirizzo: me.anagraphicsRef?.indirizzo ?? '',
          descrizione: localDescription,
        })
      } catch {
        if (!mounted) return
        setLoadError('Sessione scaduta. Effettua di nuovo il login.')
        setTimeout(() => navigate('/login'), 2000)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [navigate])

  // ─── Azioni ───────────────────────────────────────────────────────────────
  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  function handleStartProfileEdit() {
    if (!user) return

    setProfileFeedback(null)
    const localDescription = window.localStorage.getItem(descriptionStorageKey(user.userId)) ?? ''
    setProfileForm({
      username: user.username,
      telefono: user.anagraphicsRef?.telefono ?? '',
      indirizzo: user.anagraphicsRef?.indirizzo ?? '',
      descrizione: localDescription,
    })
    setIsEditingProfile(true)
  }

  function handleCancelProfileEdit() {
    if (!user) return

    setProfileFeedback(null)
    const localDescription = window.localStorage.getItem(descriptionStorageKey(user.userId)) ?? ''
    setProfileForm({
      username: user.username,
      telefono: user.anagraphicsRef?.telefono ?? '',
      indirizzo: user.anagraphicsRef?.indirizzo ?? '',
      descrizione: localDescription,
    })
    setIsEditingProfile(false)
  }

  async function handleSaveProfile() {
    if (!user) return

    const nextUsername = profileForm.username.trim()
    if (!nextUsername) {
      setProfileFeedback({ type: 'error', text: 'Lo username non puo essere vuoto.' })
      return
    }

    try {
      setProfileLoading(true)
      setProfileFeedback(null)
      await updateMyProfile({
        username: nextUsername,
        telefono: profileForm.telefono,
        indirizzo: profileForm.indirizzo,
      })

      window.localStorage.setItem(descriptionStorageKey(user.userId), profileForm.descrizione.trim())

      const me = await getMe()
      const localDescription = window.localStorage.getItem(descriptionStorageKey(me.userId)) ?? ''
      setUser(me)
      setProfileForm({
        username: me.username,
        telefono: me.anagraphicsRef?.telefono ?? '',
        indirizzo: me.anagraphicsRef?.indirizzo ?? '',
        descrizione: localDescription,
      })

      setIsEditingProfile(false)
      setProfileFeedback({ type: 'success', text: 'Profilo aggiornato con successo.' })
    } catch (error) {
      setProfileFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Errore durante il salvataggio del profilo.',
      })
    } finally {
      setProfileLoading(false)
    }
  }

  // Risolve il path foto profilo in un URL completo.
  // 'default-profile.png' → undefined (usa le iniziali dell'Avatar MUI).
  function resolveAvatarSrc(path: string | null | undefined) {
    if (!path || path === 'default-profile.png') {
      return undefined
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }

    return path.startsWith('/') ? path : `/uploads/profiles/${path}`
  }

  // Upload diretto: il file viene validato lato client prima dell'invio.
  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setProfileFeedback({ type: 'error', text: 'Seleziona un file immagine valido.' })
      event.target.value = ''
      return
    }

    try {
      setAvatarUploading(true)
      setProfileFeedback(null)
      await uploadProfilePicture(user.userId, file)
      const me = await getMe()
      setUser(me)
      setProfileFeedback({ type: 'success', text: 'Immagine profilo aggiornata con successo.' })
    } catch (error) {
      setProfileFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Errore durante upload immagine profilo.',
      })
    } finally {
      setAvatarUploading(false)
      event.target.value = ''
    }
  }

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPwFeedback({ type: 'error', text: 'Le nuove password non coincidono.' })
      return
    }

    try {
      setPwLoading(true)
      setPwFeedback(null)
      await changePassword(currentPassword, newPassword)
      setPwFeedback({ type: 'success', text: 'Password aggiornata con successo.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      const me = await getMe()
      setUser(me)
    } catch (error) {
      setPwFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Errore durante il cambio password.',
      })
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="transparent"
        elevation={0}
        sx={{ backdropFilter: 'blur(10px)', borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', py: 0.8 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Typography
                variant="h6"
                onClick={() => navigate('/')}
                sx={{ fontWeight: 800, cursor: 'pointer', transition: 'opacity 0.2s', '&:hover': { opacity: 0.7 } }}
              >
                PFCWB-Chat
              </Typography>
              <Typography
                variant="body2"
                onClick={() => navigate('/user')}
                sx={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: 'text.primary',
                  textAlign: 'left',
                  transition: 'opacity 0.2s',
                  '&:hover': { opacity: 0.7 },
                }}
              >
                Chat
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Tooltip title={mode === 'light' ? 'Modalità scura' : 'Modalità chiara'}>
                <IconButton onClick={toggleMode} size="small" color="inherit">
                  {mode === 'light' ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
                </IconButton>
              </Tooltip>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<LogoutRoundedIcon />}
                onClick={() => void handleLogout()}
              >
                Esci
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="md" sx={{ pt: { xs: 11, md: 12 }, pb: 4 }}>
        <Stack spacing={3}>
          {loadError && <Alert severity="error">{loadError}</Alert>}

          {user?.mustChangePassword && (
            <Alert severity="warning">Per la tua sicurezza, imposta una nuova password prima di continuare.</Alert>
          )}

          {user && (
            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                <Stack spacing={3}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'center' }}>
                      <Box sx={{ position: 'relative', width: 72, height: 72 }}>
                        <Avatar
                          src={resolveAvatarSrc(user.anagraphicsRef?.fotoProfilo)}
                          sx={{ width: 72, height: 72, fontSize: '1.5rem', fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}
                          slotProps={{ img: { style: { objectFit: 'cover', objectPosition: 'center center' } } }}
                        >
                          {getInitials(user.username)}
                        </Avatar>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          sx={{
                            minWidth: 0,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            p: 0,
                            position: 'absolute',
                            right: -4,
                            bottom: -4,
                            fontSize: '1rem',
                            lineHeight: 1,
                          }}
                        >
                          +
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleAvatarFileChange}
                        />
                      </Box>
                      <Stack spacing={0.5}>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>{user.username}</Typography>
                        <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                        <Chip
                          label={user.role === 'admin' ? 'Amministratore' : 'Utente'}
                          color={user.role === 'admin' ? 'secondary' : 'default'}
                          size="small"
                          sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                        />
                      </Stack>
                    </Stack>
                    {!isEditingProfile ? (
                      <Button variant="outlined" onClick={handleStartProfileEdit}>Modifica profilo</Button>
                    ) : (
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" color="inherit" onClick={handleCancelProfileEdit} disabled={profileLoading}>
                          Annulla
                        </Button>
                        <Button variant="contained" onClick={() => void handleSaveProfile()} disabled={profileLoading}>
                          {profileLoading ? 'Salvataggio...' : 'Salva'}
                        </Button>
                      </Stack>
                    )}
                  </Stack>

                  <Divider />

                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      INFORMAZIONI ACCOUNT
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">Username</Typography>
                        {isEditingProfile ? (
                          <TextField
                            fullWidth
                            size="small"
                            value={profileForm.username}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, username: e.target.value }))}
                          />
                        ) : (
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>{user.username}</Typography>
                        )}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">Email</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{user.email}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">ID Utente</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>#{user.userId}</Typography>
                      </Box>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">Nome</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{user.anagraphicsRef?.nome ?? '-'}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">Cognome</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{user.anagraphicsRef?.cognome ?? '-'}</Typography>
                      </Box>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">Telefono</Typography>
                        {isEditingProfile ? (
                          <TextField
                            fullWidth
                            size="small"
                            value={profileForm.telefono}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, telefono: e.target.value }))}
                          />
                        ) : (
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>{user.anagraphicsRef?.telefono ?? '-'}</Typography>
                        )}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">Indirizzo</Typography>
                        {isEditingProfile ? (
                          <TextField
                            fullWidth
                            size="small"
                            value={profileForm.indirizzo}
                            onChange={(e) => setProfileForm((prev) => ({ ...prev, indirizzo: e.target.value }))}
                          />
                        ) : (
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>{user.anagraphicsRef?.indirizzo ?? '-'}</Typography>
                        )}
                      </Box>
                    </Stack>

                    <Box>
                      <Typography variant="caption" color="text.secondary">Descrizione</Typography>
                      {isEditingProfile ? (
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          minRows={3}
                          placeholder="raccontaci qualcosa di te"
                          value={profileForm.descrizione}
                          onChange={(e) => setProfileForm((prev) => ({ ...prev, descrizione: e.target.value }))}
                        />
                      ) : (
                        <Typography variant="body1" sx={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                          {profileForm.descrizione.trim() ? profileForm.descrizione : '-'}
                        </Typography>
                      )}
                    </Box>
                  </Stack>

                  {profileFeedback && <Alert severity={profileFeedback.type}>{profileFeedback.text}</Alert>}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={2.5}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <LockRoundedIcon color="action" />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Cambia password</Typography>
                </Stack>
                <Box component="form" onSubmit={handleChangePassword}>
                  <Stack spacing={1.5}>
                    <TextField
                      type="password"
                      label="Password attuale"
                      required
                      fullWidth
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <TextField
                      type="password"
                      label="Nuova password"
                      required
                      fullWidth
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      helperText="Minimo 8 caratteri"
                      autoComplete="new-password"
                    />
                    <TextField
                      type="password"
                      label="Conferma nuova password"
                      required
                      fullWidth
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <Button type="submit" variant="contained" disabled={pwLoading} sx={{ alignSelf: 'flex-start' }}>
                      {pwLoading ? 'Aggiornamento...' : 'Aggiorna password'}
                    </Button>
                  </Stack>
                </Box>
                {pwFeedback && <Alert severity={pwFeedback.type}>{pwFeedback.text}</Alert>}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}
