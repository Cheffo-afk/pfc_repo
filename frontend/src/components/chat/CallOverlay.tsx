import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded'
import { useEffect, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import type { CallState } from '../../types'

type OverlayRect = {
  x: number
  y: number
  width: number
  height: number
}

type CallOverlayProps = {
  callState: CallState
  activePeerName: string
  overlayRect: OverlayRect
  localVideoRef: RefObject<HTMLVideoElement | null>
  remoteVideoRef: RefObject<HTMLVideoElement | null>
  isMicEnabled: boolean
  isCameraEnabled: boolean
  remoteVolume: number
  onOverlayDragStart: (event: ReactMouseEvent<HTMLDivElement>) => void
  onOverlayResizeStart: (event: ReactMouseEvent<HTMLDivElement>) => void
  onToggleMic: () => void
  onToggleCamera: () => void
  onSetCallVolume: (volume: number) => void
  onToggleFullscreen: (target: 'local' | 'remote') => Promise<void>
  onReconnectCall: () => Promise<void>
  onHangup: () => void
}

export function CallOverlay({
  callState,
  activePeerName,
  overlayRect,
  localVideoRef,
  remoteVideoRef,
  isMicEnabled,
  isCameraEnabled,
  remoteVolume,
  onOverlayDragStart,
  onOverlayResizeStart,
  onToggleMic,
  onToggleCamera,
  onSetCallVolume,
  onToggleFullscreen,
  onReconnectCall,
  onHangup,
}: CallOverlayProps) {
  const [isHangupConfirmOpen, setIsHangupConfirmOpen] = useState(false)

  const isVisible = callState === 'incoming' || callState === 'calling' || callState === 'connected' || callState === 'reconnecting'

  useEffect(() => {
    if (isVisible) {
      return
    }

    setIsHangupConfirmOpen(false)
  }, [isVisible])

  if (!isVisible) {
    return null
  }

  return (
    <>
      <Card
        sx={{
          position: 'fixed',
          left: overlayRect.x,
          top: overlayRect.y,
          zIndex: 1400,
          width: overlayRect.width,
          height: overlayRect.height,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 12,
          borderRadius: 1,
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        <Stack direction="row" onMouseDown={onOverlayDragStart} sx={{ px: 1.5, py: 1, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider', cursor: 'move' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Chiamata con {activePeerName}
          </Typography>
          <Button size="small" color="error" variant="contained" startIcon={<CallEndRoundedIcon />} onClick={() => setIsHangupConfirmOpen(true)}>
            Chiudi
          </Button>
        </Stack>

        {callState === 'reconnecting' && (
          <Alert
            severity="warning"
            variant="outlined"
            action={
              <Button color="inherit" size="small" onClick={() => void onReconnectCall()}>
                Riprova ora
              </Button>
            }
            sx={{ mx: 1, mt: 1, mb: 0 }}
          >
            Connessione persa. Sto tentando di riconnettere la chiamata.
          </Alert>
        )}

        <Box sx={{ p: 1, bgcolor: '#111', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, flex: 1, minHeight: 0 }}>
          <Box sx={{ position: 'relative', minHeight: 0 }}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block', background: '#222' }}
            />
            <Typography variant="caption" sx={{ position: 'absolute', bottom: 6, left: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.55)', px: 0.75, borderRadius: 1 }}>
              Tu
            </Typography>
            <IconButton size="small" onClick={() => void onToggleFullscreen('local')} sx={{ position: 'absolute', top: 6, right: 6, color: '#fff' }}>
              <FullscreenRoundedIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ position: 'relative', minHeight: 0 }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, display: 'block', background: '#222' }}
            />
            <Typography variant="caption" sx={{ position: 'absolute', bottom: 6, left: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.55)', px: 0.75, borderRadius: 1 }}>
              {activePeerName}
            </Typography>
            <IconButton size="small" onClick={() => void onToggleFullscreen('remote')} sx={{ position: 'absolute', top: 6, right: 6, color: '#fff' }}>
              <FullscreenRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ p: 1.25, alignItems: { sm: 'center' } }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant={isMicEnabled ? 'contained' : 'outlined'}
              color={isMicEnabled ? 'success' : 'warning'}
              startIcon={isMicEnabled ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
              onClick={onToggleMic}
            >
              Mic
            </Button>
            <Button
              size="small"
              variant={isCameraEnabled ? 'contained' : 'outlined'}
              color={isCameraEnabled ? 'success' : 'warning'}
              startIcon={isCameraEnabled ? <VideocamRoundedIcon /> : <VideocamOffRoundedIcon />}
              onClick={onToggleCamera}
            >
              Cam
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 140, flex: 1 }}>
            {remoteVolume === 0 ? <VolumeOffRoundedIcon fontSize="small" /> : <VolumeUpRoundedIcon fontSize="small" />}
            <Slider
              size="small"
              min={0}
              max={100}
              value={Math.round(remoteVolume * 100)}
              onChange={(_, value) => {
                const next = (Array.isArray(value) ? value[0] : value) / 100
                onSetCallVolume(next)
              }}
            />
          </Stack>
        </Stack>

        <Box
          onMouseDown={onOverlayResizeStart}
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 18,
            height: 18,
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.55) 46%, rgba(255,255,255,0.55) 54%, transparent 55%)',
          }}
        />
      </Card>

      <Dialog
        open={isHangupConfirmOpen}
        onClose={() => setIsHangupConfirmOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle>Chiudere la chiamata?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vuoi davvero terminare la chiamata in corso? Se chiudi, dovrai avviare una nuova chiamata per ricontattare {activePeerName}.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsHangupConfirmOpen(false)} variant="outlined">
            Annulla
          </Button>
          <Button
            onClick={() => {
              setIsHangupConfirmOpen(false)
              onHangup()
            }}
            color="error"
            variant="contained"
            autoFocus
          >
            Chiudi chiamata
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
