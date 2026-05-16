import {
  Alert,
  Box,
  Card,
  Container,
  IconButton,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import { useMediaQuery, useTheme } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUsers, logout } from '../lib/api'
import { ChatUserListCard, PageAppBar, UserAvatar } from '../components'
import { useThemeMode } from '../theme/useThemeMode'
import { useWebSocket } from '../lib/useWebSocket'
import { statusLabel, formatTime } from '../lib/presenceUtils'
import type { PublicUser, PresenceStatus, ChatMessage } from '../types'
import { useAuth } from '../lib/useAuth'

const HISTORY_MAX_MESSAGES = 30

// ─── Componente ──────────────────────────────────────────────────────────────────

export default function RequestsPage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const {
    connected,
    wsError,
    presences,
    sendChatMessage,
    requestHistory,
    setOnMessage,
    setOnHistory,
  } = useWebSocket()

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
  const selectedUserRef = useRef<{ userId: number; username: string } | null>(null)

  useEffect(() => {
    setUsersCollapsed(isMobile)
  }, [isMobile])

  useEffect(() => {
    selectedUserRef.current = selectedUser
  }, [selectedUser])

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

  // Filtra solo utenti con richieste non lette
  const usersWithRequests = useMemo(() => {
    return users
      .filter(u => (unreadCountByUserId[u.userId] ?? 0) > 0)
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

  async function handleLogout() {
    await logout()
    clearAuth()
    navigate('/login')
  }

  function handleSelectUser(u: { userId: number; username: string }) {
    if (selectedUser?.userId === u.userId) return
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
        onTitleClick={() => navigate('/admin')}
        links={[
          { label: 'Admin', onClick: () => navigate('/admin') },
          { label: 'Gestione Iscritti', onClick: () => navigate('/admin/gestione-iscritti') },
        ]}
        mode={mode}
        onToggleMode={toggleMode}
        onLogout={() => void handleLogout()}
      />

      <Box sx={{ pt: { xs: 14, md: 15 } }}>
        {wsError && (
          <Container maxWidth="xl" sx={{ pt: 2 }}>
            <Alert severity="warning">WebSocket: {wsError}</Alert>
          </Container>
        )}

        <Container
          maxWidth="xl"
          sx={{ px: { xs: 1, md: 2 }, height: { xs: 'auto', md: 'calc(100vh - 90px)' }, mb: '15px' }}
        >
          <Grid container spacing={2} sx={{ height: '100%' }}>

            {/* Left: User list with requests */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ChatUserListCard
                title="Richieste"
                connected={connected}
                usersCollapsed={usersCollapsed}
                onToggleCollapsed={() => setUsersCollapsed((v) => !v)}
                users={usersWithRequests.map((u) => ({
                  userId: u.userId,
                  username: u.username,
                  status: u.status,
                  unreadCount: u.unreadCount,
                  photoPath: u.anagraphicsRef?.fotoProfilo,
                }))}
                selectedUserId={selectedUser?.userId ?? null}
                onSelectUser={handleSelectUser}
                emptyConnectedText="Nessuna richiesta in sospeso"
                emptyDisconnectedText="Connessione in corso..."
              />
            </Grid>

            {/* Right: Chat */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ height: 600, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {!selectedUser ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
                    <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
                        Seleziona una richiesta per leggere e rispondere
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Le richieste con messaggi non letti appaiono nella lista a sinistra
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
                      {messages.length === 0 && !historyLoading && (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Nessun messaggio da {selectedUser.username}
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
                          placeholder={connected ? 'Scrivi una risposta...' : 'Connessione in corso...'}
                          value={messageInput}
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
    </Box>
  )
}
