import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type PointerEvent as ReactPointerEvent, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword, logout, updateMyProfile, uploadProfilePicture } from '../lib/api'
import { PageAppBar, UserAvatar } from '../components'
import { disconnectWebSocket } from '../lib/useWebSocket'
import { useThemeMode } from '../theme/useThemeMode'
import { useAuth } from '../lib/useAuth'

// ─── Costanti ────────────────────────────────────────────────────────────────
// ______ Dimensioni del cropper avatar: stage, foro circolare, esportazione finale ______

const AVATAR_CROP_STAGE_SIZE = 360
const AVATAR_CROP_HOLE_SIZE = 220
const AVATAR_EXPORT_SIZE = 512

// Chiave localStorage per la descrizione utente: isolata per userId
// ______ per evitare collisioni tra utenti diversi sullo stesso browser ______
function descriptionStorageKey(userId: number) {
  return `pfcwd.profile.description.${userId}`
}

// ─── Componente ───────────────────────────────────────────────────────────────
// ______ Pagina dedicata alla gestione del profilo: anagrafica, foto, cambio password ______
// ______ Accessibile solo ad utenti autenticati via RouteGuard (/user/profile) ______
export default function UserProfilePage() {
  const navigate = useNavigate()
  const { mode, toggleMode } = useThemeMode()
  const { user, refreshAuth, clearAuth } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwFeedback, setPwFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [cropOverlayOpen, setCropOverlayOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropImageNatural, setCropImageNatural] = useState<{ width: number; height: number } | null>(null)
  const [cropBaseScale, setCropBaseScale] = useState(1)
  const [cropZoom, setCropZoom] = useState(1)
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 })
  const [isCropDragging, setIsCropDragging] = useState(false)
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null)
  const cropPointerTargetRef = useRef<HTMLDivElement | null>(null)
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
    if (!user) {
      return
    }

    const localDescription = window.localStorage.getItem(descriptionStorageKey(user.userId)) ?? ''
    setProfileForm({
      username: user.username,
      telefono: user.anagraphicsRef?.telefono ?? '',
      indirizzo: user.anagraphicsRef?.indirizzo ?? '',
      descrizione: localDescription,
    })
  }, [user])

  // ─── Azioni ───────────────────────────────────────────────────────────────
  async function handleLogout() {
    disconnectWebSocket()
    await logout()
    clearAuth()
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

      const me = await refreshAuth()
      if (!me) {
        navigate('/login')
        return
      }
      const localDescription = window.localStorage.getItem(descriptionStorageKey(me.userId)) ?? ''
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

  // ______ Clamp del crop offset per mantenere il foro circolare sempre dentro l'immagine ______
  function clampCropOffset(x: number, y: number, natural: { width: number; height: number }, scale: number) {
    const scaledWidth = natural.width * scale
    const scaledHeight = natural.height * scale
    const maxX = Math.max(0, (scaledWidth - AVATAR_CROP_HOLE_SIZE) / 2)
    const maxY = Math.max(0, (scaledHeight - AVATAR_CROP_HOLE_SIZE) / 2)

    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    }
  }

  function resetCropState() {
    setCropOverlayOpen(false)
    setCropImageSrc(null)
    setCropImageNatural(null)
    setCropBaseScale(1)
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })
    setIsCropDragging(false)
    dragStateRef.current = null
  }

  // Selezione file: apre l'overlay di ritaglio prima dell'upload.
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
      setProfileFeedback(null)
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          setProfileFeedback({ type: 'error', text: 'Impossibile leggere il file selezionato.' })
          return
        }

        setCropImageSrc(reader.result)
        setCropImageNatural(null)
        setCropBaseScale(1)
        setCropZoom(1)
        setCropOffset({ x: 0, y: 0 })
        setCropOverlayOpen(true)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      setProfileFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Errore durante la selezione immagine.',
      })
    } finally {
      event.target.value = ''
    }
  }

  function handleCropImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget
    const natural = { width: img.naturalWidth, height: img.naturalHeight }
    const nextScale = Math.max(
      AVATAR_CROP_HOLE_SIZE / natural.width,
      AVATAR_CROP_HOLE_SIZE / natural.height,
    )

    setCropImageNatural(natural)
    setCropBaseScale(nextScale)
    setCropZoom(1)
    setCropOffset({ x: 0, y: 0 })
  }

  function handleCropZoomChange(_event: Event, value: number | number[]) {
    if (!cropImageNatural) {
      return
    }

    const nextZoom = Array.isArray(value) ? value[0] : value
    const nextScale = cropBaseScale * nextZoom
    const nextOffset = clampCropOffset(cropOffset.x, cropOffset.y, cropImageNatural, nextScale)

    setCropZoom(nextZoom)
    setCropOffset(nextOffset)
  }

  function handleCropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!cropImageNatural) {
      return
    }

    event.preventDefault()
    cropPointerTargetRef.current = event.currentTarget
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: cropOffset.x,
      startOffsetY: cropOffset.y,
    }
    setIsCropDragging(true)
  }

  function handleCropPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId || !cropImageNatural) {
      return
    }

    const currentScale = cropBaseScale * cropZoom

    const next = clampCropOffset(
      drag.startOffsetX + (event.clientX - drag.startX),
      drag.startOffsetY + (event.clientY - drag.startY),
      cropImageNatural,
      currentScale,
    )

    setCropOffset(next)
  }

  function handleCropPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    if (cropPointerTargetRef.current?.hasPointerCapture(event.pointerId)) {
      cropPointerTargetRef.current.releasePointerCapture(event.pointerId)
    }

    dragStateRef.current = null
    setIsCropDragging(false)
  }

  async function handleSaveCroppedAvatar() {
    if (!user || !cropImageSrc || !cropImageNatural) {
      return
    }

    try {
      setAvatarUploading(true)
      setProfileFeedback(null)

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Impossibile caricare l\'immagine selezionata.'))
        img.src = cropImageSrc
      })

      const currentScale = cropBaseScale * cropZoom

      const scaledWidth = cropImageNatural.width * currentScale
      const scaledHeight = cropImageNatural.height * currentScale
      const imgLeft = (AVATAR_CROP_STAGE_SIZE - scaledWidth) / 2 + cropOffset.x
      const imgTop = (AVATAR_CROP_STAGE_SIZE - scaledHeight) / 2 + cropOffset.y
      const holeLeft = (AVATAR_CROP_STAGE_SIZE - AVATAR_CROP_HOLE_SIZE) / 2
      const holeTop = (AVATAR_CROP_STAGE_SIZE - AVATAR_CROP_HOLE_SIZE) / 2

      const sourceX = Math.max(0, (holeLeft - imgLeft) / currentScale)
      const sourceY = Math.max(0, (holeTop - imgTop) / currentScale)
      const sourceSize = AVATAR_CROP_HOLE_SIZE / currentScale

      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_EXPORT_SIZE
      canvas.height = AVATAR_EXPORT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Canvas non disponibile per il ritaglio immagine.')
      }

      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        AVATAR_EXPORT_SIZE,
        AVATAR_EXPORT_SIZE,
      )

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
      })

      if (!blob) {
        throw new Error('Impossibile generare il file immagine ritagliato.')
      }

      const croppedFile = new File([blob], `avatar_${Date.now()}.jpg`, { type: 'image/jpeg' })
      await uploadProfilePicture(user.userId, croppedFile)

      const me = await refreshAuth()
      if (!me) {
        navigate('/login')
        return
      }
      setProfileFeedback({ type: 'success', text: 'Immagine profilo aggiornata con successo.' })
      resetCropState()
    } catch (error) {
      setProfileFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Errore durante il salvataggio della foto profilo.',
      })
    } finally {
      setAvatarUploading(false)
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

      const me = await refreshAuth()
      if (!me) {
        navigate('/login')
        return
      }
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
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', mb: '10px' }}>
      <PageAppBar
        title="PFCWB-Chat"
        onTitleClick={() => navigate('/')}
        links={[{ label: 'Chat', onClick: () => navigate('/user') }]}
        mode={mode}
        onToggleMode={toggleMode}
        onLogout={() => void handleLogout()}
      />

      <Container maxWidth="md" sx={{ pt: { xs: 11, md: 12 }, pb: 4 }}>
        <Stack spacing={3}>
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
                        <UserAvatar username={user.username} photoPath={user.anagraphicsRef?.fotoProfilo} size={72} />
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

      {cropOverlayOpen && cropImageSrc && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1700,
            bgcolor: 'rgba(0, 0, 0, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
          }}
        >
          <Box sx={{ width: 'min(92vw, 520px)', position: 'relative' }}>
            <Typography
              role="button"
              onClick={resetCropState}
              sx={{
                position: 'absolute',
                top: -8,
                right: 0,
                color: '#fff',
                cursor: 'pointer',
                fontSize: '1.35rem',
                fontWeight: 700,
                px: 1,
                zIndex: 2,
              }}
            >
              x
            </Typography>

            <Box
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
              sx={{
                mt: 4,
                width: AVATAR_CROP_STAGE_SIZE,
                height: AVATAR_CROP_STAGE_SIZE,
                maxWidth: '90vw',
                maxHeight: '90vw',
                mx: 'auto',
                position: 'relative',
                overflow: 'hidden',
                bgcolor: '#111',
                borderRadius: 2,
                touchAction: 'none',
                cursor: isCropDragging ? 'grabbing' : 'grab',
              }}
            >
              <Box
                component="img"
                src={cropImageSrc}
                alt="Anteprima ritaglio avatar"
                onLoad={handleCropImageLoad}
                draggable={false}
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropBaseScale * cropZoom})`,
                  transformOrigin: 'center center',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                  pointerEvents: 'none',
                }}
              />

              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: AVATAR_CROP_HOLE_SIZE,
                  height: AVATAR_CROP_HOLE_SIZE,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.58)',
                  border: '2px solid rgba(255,255,255,0.92)',
                  pointerEvents: 'none',
                }}
              />
            </Box>

            <Box sx={{ width: AVATAR_CROP_STAGE_SIZE, maxWidth: '90vw', mx: 'auto', mt: 1.5, px: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.92)' }}>Zoom</Typography>
              <Slider
                size="small"
                min={1}
                max={3}
                step={0.05}
                value={cropZoom}
                onChange={handleCropZoomChange}
                valueLabelDisplay="auto"
                disabled={!cropImageNatural || avatarUploading}
                sx={{
                  color: '#fff',
                  '& .MuiSlider-valueLabel': { bgcolor: 'rgba(0,0,0,0.75)' },
                }}
              />
            </Box>

            <Typography
              role="button"
              onClick={() => void handleSaveCroppedAvatar()}
              sx={{
                mt: 1.5,
                mr: 0.5,
                textAlign: 'right',
                color: '#fff',
                cursor: avatarUploading ? 'default' : 'pointer',
                textDecoration: 'underline',
                fontWeight: 600,
                opacity: avatarUploading ? 0.65 : 1,
                pointerEvents: avatarUploading ? 'none' : 'auto',
              }}
            >
              {avatarUploading ? 'Salvataggio...' : 'Salva foto profilo'}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}
