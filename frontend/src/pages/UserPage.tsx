import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMediaQuery, useTheme } from '@mui/material'
import { getUsers, logout } from '../lib/api'
import { CallOverlay, ChatUserListCard, PageAppBar, UserAvatar } from '../components'
import { useThemeMode } from '../theme/useThemeMode'
import { useWebSocket } from '../lib/useWebSocket'
import { statusLabel, formatTime } from '../lib/presenceUtils'
import type { PublicUser, PresenceStatus, ChatMessage } from '../types'
import { useWebRTC } from '../lib/useWebRTC'
import { useAuth } from '../lib/useAuth'

const CALL_TIMEOUT_MS = 30_000
const CALL_RECOVERY_REFRESH_DELAY_MS = 1_500
const OVERLAY_MIN_WIDTH = 340
const OVERLAY_MIN_HEIGHT = 260
const HISTORY_MAX_MESSAGES = 30

// ─── Componente ───────────────────────────────────────────────────────────────
export default function UserPage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isXs = useMediaQuery(theme.breakpoints.only('xs'))

  // ─── WebSocket e WebRTC ───────────────────────────────────────────────────
  const {
    connected,
    wsError,
    presences,
    sendChatMessage,
    requestHistory,
    sendSignaling,
    setOnMessage,
    setOnHistory,
    setOnSignaling,
    setPresenceStatus,
    disconnect,
  } = useWebSocket()

  const {
    callState,
    incomingCall,
    activeCallTargetUserId,
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
    reconnectCall,
    handleSignaling,
  } = useWebRTC(sendSignaling)

  const [users, setUsers] = useState<PublicUser[]>([])

  const [selectedUser, setSelectedUser] = useState<{ userId: number; username: string } | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [hasMoreHistory, setHasMoreHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [usersCollapsed, setUsersCollapsed] = useState(false)
  const [unreadCountByUserId, setUnreadCountByUserId] = useState<Record<number, number>>({})
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const historyRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null)
  const userListRef = useRef<HTMLUListElement | null>(null)

  // Collassa la lista utenti passando a mobile, riaprila su desktop
  useEffect(() => {
    setUsersCollapsed(isMobile)
  }, [isMobile])
  const selectedUserRef = useRef<{ userId: number; username: string } | null>(null)
  const [timeoutMessage, setTimeoutMessage] = useState<string | null>(null)
  const refreshTimerRef = useRef<number | null>(null)
  // ─── Overlay videochiamata ────────────────────────────────────────────────
  // Posizione e dimensioni iniziali calcolate dal viewport per posizionare
  // l'overlay in basso a destra. Rimane nei limiti del viewport via clampOverlayRect.
  const [overlayRect, setOverlayRect] = useState(() => {
    if (typeof window === 'undefined') {
      return { x: 24, y: 24, width: 460, height: 340 }
    }

    const width = 460
    const height = 340
    return {
      x: Math.max(8, window.innerWidth - width - 16),
      y: Math.max(8, window.innerHeight - height - 16),
      width,
      height,
    }
  })

  // ─── Drag & resize dell'overlay ───────────────────────────────────────────
  const dragStateRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null)
  const resizeStateRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null)

  // ─── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    selectedUserRef.current = selectedUser
  }, [selectedUser])

  const scheduleRecoveryRefresh = useCallback(() => {
    if (refreshTimerRef.current != null) {
      window.clearTimeout(refreshTimerRef.current)
    }

    refreshTimerRef.current = window.setTimeout(() => {
      window.location.reload()
    }, CALL_RECOVERY_REFRESH_DELAY_MS)
  }, [])

  const clampOverlayRect = useCallback((next: { x: number; y: number; width: number; height: number }) => {
    const margin = 8
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const maxWidth = Math.max(OVERLAY_MIN_WIDTH, viewportWidth - margin * 2)
    const maxHeight = Math.max(OVERLAY_MIN_HEIGHT, viewportHeight - margin * 2)

    const width = Math.min(Math.max(next.width, OVERLAY_MIN_WIDTH), maxWidth)
    const height = Math.min(Math.max(next.height, OVERLAY_MIN_HEIGHT), maxHeight)

    const maxX = Math.max(margin, viewportWidth - width - margin)
    const maxY = Math.max(margin, viewportHeight - height - margin)
    const x = Math.min(Math.max(next.x, margin), maxX)
    const y = Math.min(Math.max(next.y, margin), maxY)

    return { x, y, width, height }
  }, [])

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (dragStateRef.current) {
        const deltaX = event.clientX - dragStateRef.current.startX
        const deltaY = event.clientY - dragStateRef.current.startY
        setOverlayRect(prev => clampOverlayRect({
          ...prev,
          x: dragStateRef.current!.startLeft + deltaX,
          y: dragStateRef.current!.startTop + deltaY,
        }))
      }

      if (resizeStateRef.current) {
        const deltaX = event.clientX - resizeStateRef.current.startX
        const deltaY = event.clientY - resizeStateRef.current.startY
        setOverlayRect(prev => clampOverlayRect({
          ...prev,
          width: resizeStateRef.current!.startWidth + deltaX,
          height: resizeStateRef.current!.startHeight + deltaY,
        }))
      }
    }

    const handleUp = () => {
      dragStateRef.current = null
      resizeStateRef.current = null
    }

    const handleViewportResize = () => {
      setOverlayRect(prev => clampOverlayRect(prev))
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('resize', handleViewportResize)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('resize', handleViewportResize)
    }
  }, [clampOverlayRect])

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const list = await getUsers()
        const visibleList = list.filter(u => u.userId !== user!.userId)
        setUsers(visibleList)
        setUnreadCountByUserId(
          Object.fromEntries(
            visibleList.map((u) => [u.userId, u.unreadCount ?? 0]),
          ),
        )
      } catch {
        // non bloccante
      }
    }
    void load()
  }, [user])

  useEffect(() => {
    setOnSignaling(handleSignaling)
  }, [setOnSignaling, handleSignaling])

  useEffect(() => {
    if (callState !== 'calling' || activeCallTargetUserId == null) {
      return
    }

    const timer = window.setTimeout(() => {
      setTimeoutMessage('Nessuna risposta entro 30 secondi. Ricarico la pagina per ripristinare la sessione chiamata.')
      hangup()
      scheduleRecoveryRefresh()
    }, CALL_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [callState, activeCallTargetUserId, hangup, scheduleRecoveryRefresh])

  useEffect(() => {
    if (callState !== 'incoming') {
      return
    }

    const timer = window.setTimeout(() => {
      rejectCall('timeout')
      setTimeoutMessage('La chiamata in arrivo è scaduta dopo 30 secondi. Ricarico la pagina per ripristinare la sessione chiamata.')
      scheduleRecoveryRefresh()
    }, CALL_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [callState, rejectCall, scheduleRecoveryRefresh])

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current != null) {
        window.clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setOnHistory((payload) => {
      setMessages(prev => {
        const knownMessageIds = new Set(prev.map(message => message.messageId))
        const nextMessages = payload.messages.filter(message => !knownMessageIds.has(message.messageId))
        const merged = [...nextMessages, ...prev]
        const bounded = merged.length > HISTORY_MAX_MESSAGES
          ? merged.slice(merged.length - HISTORY_MAX_MESSAGES)
          : merged

        setHasMoreHistory(payload.hasMore && bounded.length < HISTORY_MAX_MESSAGES)
        setHistoryLoading(false)
        return bounded
      })
    })
  }, [setOnHistory])

  useEffect(() => {
    setOnMessage((msg) => {
      const currentSelectedUser = selectedUserRef.current
      const currentUsername = user?.username
      const sender = users.find((u) => u.username === msg.fromUsername)

      const isIncomingForCurrentUser = Boolean(currentUsername && msg.toUsername === currentUsername)

      if (sender && isIncomingForCurrentUser && sender.userId !== currentSelectedUser?.userId) {
        setUnreadCountByUserId((prev) => ({
          ...prev,
          [sender.userId]: (prev[sender.userId] ?? 0) + 1,
        }))
      }

      if (!currentSelectedUser) {
        return
      }

      const isCurrentThreadMessage = Boolean(
        currentUsername && (
          (msg.fromUsername === currentSelectedUser.username && msg.toUsername === currentUsername) ||
          (msg.toUsername === currentSelectedUser.username && msg.fromUsername === currentUsername)
        ),
      )

      if (!isCurrentThreadMessage) {
        return
      }

      setMessages(prev => {
        if (prev.some(message => message.messageId === msg.messageId)) {
          return prev
        }

        const next = [...prev, msg]
        return next.length > HISTORY_MAX_MESSAGES
          ? next.slice(next.length - HISTORY_MAX_MESSAGES)
          : next
      })
    })
  }, [setOnMessage, users, user?.username])

  useEffect(() => {
    const container = messagesScrollRef.current
    if (!container) {
      return
    }

    const restore = historyRestoreRef.current
    if (restore) {
      const nextDelta = container.scrollHeight - restore.scrollHeight
      container.scrollTop = restore.scrollTop + nextDelta
      historyRestoreRef.current = null
      return
    }

    container.scrollTop = container.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!selectedUser) {
      return
    }

    // handleSelectUser collassa già la lista.
    // Al momento in cui questo effect gira dopo il batch, usersCollapsed è già true:
    // si può mettere il focus sul text box in sicurezza.
    messageInputRef.current?.focus()
  }, [selectedUser])

  useEffect(() => {
    if (!isXs || usersCollapsed) {
      return
    }

    const firstItem = userListRef.current?.querySelector<HTMLElement>('[role="button"]')
    firstItem?.focus()
  }, [isXs, usersCollapsed])

  // ─── Messaggi ─────────────────────────────────────────────────────────────
  const visibleUsers = useMemo(() => {
    return users
      .map(u => ({
        ...u,
        status: presences[u.username] ?? ('offline' as PresenceStatus),
        unreadCount: unreadCountByUserId[u.userId] ?? 0,
      }))
      .sort((a, b) => {
        const rank: Record<PresenceStatus, number> = { online: 0, nonAlComputer: 1, offline: 2 }
        const statusCompare = rank[a.status] - rank[b.status]
        if (statusCompare !== 0) {
          return statusCompare
        }

        return a.username.localeCompare(b.username, 'it-IT', { sensitivity: 'base' })
      })
  }, [users, presences, unreadCountByUserId])

  const selectedUserData = useMemo(() => {
    if (!selectedUser) return null
    return users.find((u) => u.userId === selectedUser.userId) ?? null
  }, [users, selectedUser])

  const selectedPresence = selectedUser ? presences[selectedUser.username] : undefined

  const incomingCallerName = useMemo(() => {
    if (!incomingCall) return ''
    const found = users.find(u => u.userId === incomingCall.fromUserId)
    return found?.username ?? `Utente #${incomingCall.fromUserId}`
  }, [incomingCall, users])

  const activePeerName = useMemo(() => {
    if (callState === 'incoming' && incomingCall) {
      return incomingCallerName
    }
    if (activeCallTargetUserId != null) {
      const found = users.find(u => u.userId === activeCallTargetUserId)
      if (found) return found.username
    }
    if (selectedUser) return selectedUser.username
    return 'Utente'
  }, [callState, incomingCall, incomingCallerName, activeCallTargetUserId, users, selectedUser])

  // ─── Azioni ───────────────────────────────────────────────────────────────
  const handleOverlayDragStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button')) {
      return
    }

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: overlayRect.x,
      startTop: overlayRect.y,
    }
  }, [overlayRect.x, overlayRect.y])

  const handleOverlayResizeStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    resizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: overlayRect.width,
      startHeight: overlayRect.height,
    }
  }, [overlayRect.height, overlayRect.width])

  async function handleLogout() {
    disconnect()
    await logout()
    clearAuth()
    navigate('/login')
  }

  function handleSelectUser(u: { userId: number; username: string }) {
    if (selectedUser?.userId === u.userId) return

    setUsersCollapsed(true)
    setSelectedUser(u)
    historyRestoreRef.current = null
    setUnreadCountByUserId((prev) => {
      if ((prev[u.userId] ?? 0) === 0) return prev
      const next = { ...prev }
      next[u.userId] = 0
      return next
    })
    setMessages([])
    setHasMoreHistory(false)
    setHistoryLoading(true)
    requestHistory(u.userId)
  }

  const handleLoadMoreHistory = useCallback(() => {
    if (!selectedUser || messages.length === 0 || historyLoading || !hasMoreHistory) return

    const container = messagesScrollRef.current
    if (container) {
      historyRestoreRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      }
    }

    setHistoryLoading(true)
    requestHistory(selectedUser.userId, messages[0].messageId)
  }, [selectedUser, messages, historyLoading, hasMoreHistory, requestHistory])

  const handleMessagesScroll = useCallback(() => {
    const container = messagesScrollRef.current
    if (!container || historyLoading || !hasMoreHistory || !selectedUser) {
      return
    }

    if (container.scrollTop <= 24) {
      handleLoadMoreHistory()
    }
  }, [historyLoading, hasMoreHistory, selectedUser, handleLoadMoreHistory])

  const handleSendMessage = useCallback(() => {
    const content = messageInput.trim()
    if (!content || !selectedUser || !connected) return
    sendChatMessage(selectedUser.userId, content)
    setMessageInput('')
  }, [messageInput, selectedUser, connected, sendChatMessage])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <PageAppBar
        title="PFCWB-Chat"
        onTitleClick={() => navigate('/')}
        links={[{ label: 'Gestione Profilo', onClick: () => navigate('/user/profile') }]}
        mode={mode}
        onToggleMode={toggleMode}
        onLogout={() => void handleLogout()}
      />

      {/* Greeting bar */}
      {user && (
        <Box
          sx={{
            position: 'fixed',
            top: { xs: 56, md: 64 },
            left: 0,
            right: 0,
            zIndex: 1100,
            px: 3,
            py: 0.75,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Ciao {user.username}!
          </Typography>
          <ToggleButtonGroup
            value={presences[user.username] === 'nonAlComputer' ? 'nonAlComputer' : 'online'}
            exclusive
            size="small"
            onChange={(_, v: 'online' | 'nonAlComputer' | null) => {
              if (v) setPresenceStatus(v)
            }}
          >
            <ToggleButton value="online" color="success">Online</ToggleButton>
            <ToggleButton value="nonAlComputer" color="warning">Non al computer</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      <Box sx={{ pt: { xs: 14, md: 15 } }}>
        {wsError && (
          <Container maxWidth="xl" sx={{ pt: 2 }}>
            <Alert severity="warning">WebSocket: {wsError}</Alert>
          </Container>
        )}

        {/* Two-card section */}
        <Container
          maxWidth="xl"
          sx={{ px: { xs: 1, md: 2 }, height: { xs: 'auto', md: 'calc(100vh - 90px)' }, mb: '15px' }}
        >
          <Grid container spacing={2} sx={{ height: '100%' }}>

            {/* Left: User list */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ChatUserListCard
                title="Utenti"
                connected={connected}
                usersCollapsed={usersCollapsed}
                onToggleCollapsed={() => setUsersCollapsed((v) => !v)}
                listRef={userListRef}
                users={visibleUsers.map((u) => ({
                  userId: u.userId,
                  username: u.username,
                  status: u.status,
                  unreadCount: u.unreadCount,
                  photoPath: u.anagraphicsRef?.fotoProfilo,
                }))}
                selectedUserId={selectedUser?.userId ?? null}
                onSelectUser={handleSelectUser}
                emptyConnectedText="Nessun altro utente disponibile al momento"
                emptyDisconnectedText="Connessione in corso..."
              />
            </Grid>

            {/* Right: Chat + Video */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ height: { xs: 500, md: 600 }, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {!selectedUser ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                    <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
                        Seleziona un utente per chattare
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Gli utenti online appaiono nella lista a sinistra
                      </Typography>
                    </Stack>
                  </Box>
                ) : (
                  <Stack sx={{ height: '100%', overflow: 'hidden' }}>
                    {/* Header */}
                    <Stack
                      direction="row"
                      sx={{
                        px: 2, py: 1.5, alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0,
                      }}
                    >
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <UserAvatar
                          username={selectedUser.username}
                          photoPath={selectedUserData?.anagraphicsRef?.fotoProfilo}
                          status={selectedPresence}
                          size={36}
                          badgeSize={10}
                        />
                        <Stack>
                          <Typography sx={{ fontWeight: 700 }}>{selectedUser.username}</Typography>
                          <Typography variant="caption" color="text.secondary">{statusLabel(selectedPresence)}</Typography>
                        </Stack>
                      </Stack>
                      <Tooltip title="Avvia videochiamata">
                        <span>
                          <IconButton
                            color="primary"
                            onClick={() => void startCall(selectedUser.userId)}
                            disabled={!connected || !selectedPresence || selectedPresence === 'offline' || callState !== 'idle'}
                          >
                            <VideocamRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>

                    {/* Messages */}
                    <Box
                      ref={messagesScrollRef}
                      onScroll={handleMessagesScroll}
                      sx={{
                        flex: 1,
                        minHeight: 0,
                        overflow: 'auto',
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      {historyLoading && hasMoreHistory && (
                        <Box sx={{ textAlign: 'center', mb: 1 }}>
                          <CircularProgress size={18} />
                        </Box>
                      )}
                      {messages.length === 0 && !historyLoading && (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Nessun messaggio. Di&apos; ciao a {selectedUser.username}!
                          </Typography>
                        </Box>
                      )}
                      {messages.map(msg => {
                        const isMe = user != null && msg.fromUsername === user.username
                        return (
                          <Box key={msg.messageId} sx={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                            <Box sx={{
                              maxWidth: '72%', px: 1.5, py: 1, borderRadius: 2.5,
                              bgcolor: isMe ? 'primary.main' : 'background.paper',
                              color: isMe ? 'primary.contrastText' : 'text.primary',
                              boxShadow: 1,
                            }}>
                              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{msg.content}</Typography>
                              <Typography variant="caption" sx={{ opacity: 0.65, display: 'block', textAlign: 'right', mt: 0.25 }}>
                                {formatTime(msg.at)}
                              </Typography>
                            </Box>
                          </Box>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </Box>

                    {/* Input */}
                    <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
                        <TextField
                          fullWidth multiline maxRows={4} size="small"
                          inputRef={messageInputRef}
                          placeholder={connected ? 'Scrivi un messaggio...' : 'Connessione in corso...'}
                          value={messageInput}
                          onFocus={() => { if (isXs) setUsersCollapsed(true) }}
                          onChange={e => setMessageInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() }
                          }}
                          disabled={!connected}
                        />
                        <IconButton
                          color="primary" onClick={handleSendMessage}
                          disabled={!connected || !messageInput.trim()}
                          sx={{ mb: 0.25 }}
                        >
                          <SendRoundedIcon />
                        </IconButton>
                      </Stack>
                    </Box>
                  </Stack>
                )}
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Snackbar
        open={callState === 'incoming' && incomingCall != null}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => rejectCall()}
      >
        <Alert
          severity="info"
          sx={{ width: '100%' }}
          action={(
            <Stack direction="row" spacing={1}>
              <Button color="success" size="small" variant="contained" onClick={() => void acceptCall()}>
                Accetta
              </Button>
              <Button color="error" size="small" variant="outlined" onClick={() => rejectCall()}>
                Rifiuta
              </Button>
            </Stack>
          )}
        >
          Chiamata in arrivo da <strong>{incomingCallerName}</strong>.
        </Alert>
      </Snackbar>

      <CallOverlay
        callState={callState}
        activePeerName={activePeerName}
        overlayRect={overlayRect}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        isMicEnabled={isMicEnabled}
        isCameraEnabled={isCameraEnabled}
        remoteVolume={remoteVolume}
        onOverlayDragStart={handleOverlayDragStart}
        onOverlayResizeStart={handleOverlayResizeStart}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onSetCallVolume={setCallVolume}
        onToggleFullscreen={toggleFullscreen}
        onReconnectCall={reconnectCall}
        onHangup={hangup}
      />

      <Snackbar
        open={timeoutMessage != null}
        autoHideDuration={4000}
        onClose={() => setTimeoutMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setTimeoutMessage(null)}>
          {timeoutMessage}
        </Alert>
      </Snackbar>

    </Box>
  )
}
