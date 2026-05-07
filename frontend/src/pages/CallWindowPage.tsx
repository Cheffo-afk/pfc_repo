import {
  // NOTE: questa pagina è la finestra di chiamata standalone (vecchio approccio popup).
  // La rotta /call è stata rimossa da App.tsx con l'introduzione dell'overlay in UserPage.
  // Il file è mantenuto come riferimento ma non è più raggiungibile dall'applicazione.
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Container,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material'
import CallEndRoundedIcon from '@mui/icons-material/CallEndRounded'
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded'
import MicRoundedIcon from '@mui/icons-material/MicRounded'
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded'
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getMe } from '../lib/api'
import { useWebSocket } from '../lib/useWebSocket'
import { type IncomingCallInfo, useWebRTC } from '../lib/useWebRTC'

const PENDING_CALL_STORAGE_KEY = 'pfcwb.pendingCall'
const CALL_TIMEOUT_MS = 30_000

type PendingCallPayload = IncomingCallInfo & {
  fromUsername?: string
}

function parseUserId(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export default function CallWindowPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const mode = searchParams.get('mode')
  const toUserId = parseUserId(searchParams.get('toUserId'))
  const toUsername = searchParams.get('toUsername') ?? 'Utente'
  const autoAccept = searchParams.get('autoAccept') === '1'

  const incomingBoot = useMemo(() => {
    if (mode !== 'incoming') {
      return { call: null as IncomingCallInfo | null, callerName: 'Utente', error: null as string | null }
    }

    try {
      const raw = window.localStorage.getItem(PENDING_CALL_STORAGE_KEY)
      if (!raw) {
        return { call: null as IncomingCallInfo | null, callerName: 'Utente', error: 'Nessuna richiesta di chiamata trovata.' }
      }

      const payload = JSON.parse(raw) as PendingCallPayload
      if (!payload || !payload.callId || !payload.fromUserId || !payload.description) {
        return { call: null as IncomingCallInfo | null, callerName: 'Utente', error: 'Dati chiamata non validi. Riprova.' }
      }

      return {
        call: {
          callId: payload.callId,
          fromUserId: payload.fromUserId,
          description: payload.description,
        },
        callerName: payload.fromUsername ?? `Utente #${payload.fromUserId}`,
        error: null as string | null,
      }
    } catch {
      return { call: null as IncomingCallInfo | null, callerName: 'Utente', error: 'Dati chiamata non validi. Riprova.' }
    }
  }, [mode])

  const {
    connected,
    wsError,
    sendSignaling,
    setOnSignaling,
  } = useWebSocket()

  const {
    callState,
    incomingCall,
    localVideoRef,
    remoteVideoRef,
    isMicEnabled,
    isCameraEnabled,
    remoteVolume,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleMic,
    toggleCamera,
    setCallVolume,
    toggleFullscreen,
    handleSignaling,
  } = useWebRTC(sendSignaling, { initialIncomingCall: incomingBoot.call })

  const [timeoutMessage, setTimeoutMessage] = useState<string | null>(null)
  const hasStartedCallLifecycleRef = useRef(false)

  useEffect(() => {
    async function verifySession() {
      try {
        await getMe()
      } catch {
        navigate('/login', { replace: true })
      }
    }
    void verifySession()
  }, [navigate])

  useEffect(() => {
    setOnSignaling(handleSignaling)
  }, [setOnSignaling, handleSignaling])

  useEffect(() => {
    if (mode === 'outgoing' && toUserId && connected) {
      void startCall(toUserId)
    }
  }, [mode, toUserId, connected, startCall])

  useEffect(() => {
    if (callState !== 'calling' || mode !== 'outgoing' || !toUserId) {
      return
    }

    const timer = window.setTimeout(() => {
      setTimeoutMessage('Nessuna risposta entro 30 secondi. Chiamata terminata.')
      hangup()
    }, CALL_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [callState, mode, toUserId, hangup])

  useEffect(() => {
    if (callState !== 'incoming' || mode !== 'incoming') {
      return
    }

    const timer = window.setTimeout(() => {
      rejectCall('timeout')
      setTimeoutMessage('La chiamata in arrivo è scaduta dopo 30 secondi.')
    }, CALL_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [callState, mode, rejectCall])

  useEffect(() => {
    if (mode === 'incoming') {
      window.localStorage.removeItem(PENDING_CALL_STORAGE_KEY)
    }
  }, [mode])

  useEffect(() => {
    if (mode === 'incoming' && autoAccept && incomingCall) {
      void acceptCall()
    }
  }, [mode, autoAccept, incomingCall, acceptCall])

  useEffect(() => {
    if (callState !== 'idle') {
      hasStartedCallLifecycleRef.current = true
    }
  }, [callState])

  useEffect(() => {
    const closeIfIdle = () => {
      if (
        hasStartedCallLifecycleRef.current &&
        callState === 'idle' &&
        (mode === 'incoming' || mode === 'outgoing')
      ) {
        window.close()
      }
    }
    const timer = window.setTimeout(closeIfIdle, 300)
    return () => window.clearTimeout(timer)
  }, [callState, mode])

  const peerLabel = useMemo(() => {
    if (mode === 'incoming') {
      return incomingBoot.callerName
    }
    return toUsername
  }, [mode, incomingBoot.callerName, toUsername])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A1018', color: '#E8EFFA', py: 2 }}>
      <Container maxWidth="lg">
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Videochiamata</Typography>
            <Chip
              label={connected ? 'WebSocket online' : 'WebSocket offline'}
              color={connected ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>

          {wsError && <Alert severity="warning">{wsError}</Alert>}
          {incomingBoot.error && <Alert severity="error">{incomingBoot.error}</Alert>}
          {timeoutMessage && <Alert severity="info">{timeoutMessage}</Alert>}

          {callState === 'incoming' && incomingCall && (
            <Alert
              severity="info"
              action={(
                <Stack direction="row" spacing={1}>
                  <Button size="small" color="success" variant="contained" onClick={() => void acceptCall()}>
                    Accetta
                  </Button>
                  <Button size="small" color="error" variant="outlined" onClick={() => rejectCall()}>
                    Rifiuta
                  </Button>
                </Stack>
              )}
            >
              Chiamata in arrivo da <strong>{peerLabel}</strong>
            </Alert>
          )}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Card sx={{ flex: 1, p: 1, bgcolor: '#111824', position: 'relative' }}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, background: '#1E2735' }}
              />
              <Typography variant="caption" sx={{ position: 'absolute', left: 14, bottom: 10, bgcolor: 'rgba(0,0,0,0.6)', px: 1, borderRadius: 1 }}>
                Tu
              </Typography>
              <IconButton
                size="small"
                onClick={() => void toggleFullscreen('local')}
                sx={{ position: 'absolute', right: 12, bottom: 6, color: '#fff' }}
              >
                <FullscreenRoundedIcon />
              </IconButton>
            </Card>

            <Card sx={{ flex: 1, p: 1, bgcolor: '#111824', position: 'relative' }}>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, background: '#1E2735' }}
              />
              <Typography variant="caption" sx={{ position: 'absolute', left: 14, bottom: 10, bgcolor: 'rgba(0,0,0,0.6)', px: 1, borderRadius: 1 }}>
                {peerLabel}
              </Typography>
              <IconButton
                size="small"
                onClick={() => void toggleFullscreen('remote')}
                sx={{ position: 'absolute', right: 12, bottom: 6, color: '#fff' }}
              >
                <FullscreenRoundedIcon />
              </IconButton>
            </Card>
          </Stack>

          <Card sx={{ p: 1.2, bgcolor: '#121A27' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
              <Stack direction="row" spacing={1}>
                <Button
                  variant={isMicEnabled ? 'contained' : 'outlined'}
                  color={isMicEnabled ? 'success' : 'warning'}
                  startIcon={isMicEnabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
                  onClick={toggleMic}
                >
                  {isMicEnabled ? 'Microfono ON' : 'Microfono OFF'}
                </Button>
                <Button
                  variant={isCameraEnabled ? 'contained' : 'outlined'}
                  color={isCameraEnabled ? 'success' : 'warning'}
                  startIcon={isCameraEnabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
                  onClick={toggleCamera}
                >
                  {isCameraEnabled ? 'Camera ON' : 'Camera OFF'}
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: 1, px: { md: 1 } }}>
                {remoteVolume === 0 ? <VolumeOffRoundedIcon /> : <VolumeUpRoundedIcon />}
                <Slider
                  min={0}
                  max={100}
                  value={Math.round(remoteVolume * 100)}
                  onChange={(_, value) => {
                    const next = (Array.isArray(value) ? value[0] : value) / 100
                    setCallVolume(next)
                  }}
                />
              </Stack>

              <Button
                variant="contained"
                color="error"
                startIcon={<CallEndRoundedIcon />}
                onClick={hangup}
              >
                Chiudi chiamata
              </Button>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}
