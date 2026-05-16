import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  activateUser,
  getAdminUsers,
  logout,
  toggleAdminUserSubscription,
} from '../lib/api'
import { PageAppBar } from '../components'
import { useThemeMode } from '../theme/useThemeMode'
import { disconnectWebSocket, useWebSocket } from '../lib/useWebSocket'
import type { AdminUser } from '../types'
import { useAuth } from '../lib/useAuth'

type SortMode = 'status' | 'userId'
type SortDirection = 'asc' | 'desc'
type SubscriptionFilter = 'all' | 'active' | 'inactive'

function getStatusLabel(status: AdminUser['userStateRef'] extends null ? never : 'online' | 'offline' | 'nonAlComputer') {
  if (status === 'nonAlComputer') {
    return 'non al computer'
  }
  return status
}

function getStatusRank(status: 'online' | 'offline' | 'nonAlComputer') {
  if (status === 'online') return 0
  if (status === 'nonAlComputer') return 1
  return 2
}

function getStatusChipColor(status: 'online' | 'offline' | 'nonAlComputer') {
  if (status === 'online') return 'success'
  if (status === 'nonAlComputer') return 'warning'
  return 'default'
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { clearAuth } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const { presences } = useWebSocket()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('status')
  const [sortDirection] = useState<SortDirection>('asc')
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionFilter>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activatingId, setActivatingId] = useState<number | null>(null)

  async function handleLogout() {
    disconnectWebSocket()
    await logout()
    clearAuth()
    navigate('/login')
  }

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      try {
        setLoading(true)
        const list = await getAdminUsers()
        if (!mounted) return

        setUsers(list)
        if (list.length > 0) {
          setSelectedUserId(list[0].userId)
        }
      } catch (error) {
        if (!mounted) return
        setAuthError(error instanceof Error ? error.message : 'Accesso non autorizzato')
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [])

  // ─── Merge presence realtime sui dati admin ───────────────────────────────
  // Mantiene i dati principali da API, sovrascrivendo solo lo stato live ricevuto via WS.
  const usersWithPresence = useMemo(() => {
    return users.map((user) => {
      const liveStatus = presences[user.username]
      if (!liveStatus) {
        return user
      }

      return {
        ...user,
        userStateRef: user.userStateRef
          ? { ...user.userStateRef, status: liveStatus }
          : { status: liveStatus, lastOnline: new Date().toISOString() },
      }
    })
  }, [users, presences])

  const filteredAndSortedUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    const filtered = usersWithPresence.filter((u) => {
      // Filtra per stato di abbonamento
      if (subscriptionFilter !== 'all' && u.subscribed !== subscriptionFilter) {
        return false
      }
      
      if (!normalizedQuery) return true
      const byUsername = u.username.toLowerCase().includes(normalizedQuery)
      const byUserId = String(u.userId).includes(normalizedQuery)
      return byUsername || byUserId
    })

    const sorted = [...filtered].sort((a, b) => {
      if (sortMode === 'userId') {
        return sortDirection === 'asc' ? a.userId - b.userId : b.userId - a.userId
      }

      const aStatus = a.userStateRef?.status ?? 'offline'
      const bStatus = b.userStateRef?.status ?? 'offline'
      const statusCompare = getStatusRank(aStatus) - getStatusRank(bStatus)
      if (statusCompare !== 0) {
        return statusCompare
      }

      return a.userId - b.userId
    })

    return sorted
  }, [usersWithPresence, query, sortMode, sortDirection, subscriptionFilter])

  const selectedUser = useMemo(
    () => usersWithPresence.find((u) => u.userId === selectedUserId) ?? null,
    [usersWithPresence, selectedUserId],
  )

  const summary = useMemo(() => {
    const online = usersWithPresence.filter((u) => u.userStateRef?.status === 'online').length
    const away = usersWithPresence.filter((u) => u.userStateRef?.status === 'nonAlComputer').length
    const offline = usersWithPresence.filter((u) => (u.userStateRef?.status ?? 'offline') === 'offline').length
    const active = usersWithPresence.filter((u) => u.subscribed === 'active').length
    const inactive = usersWithPresence.filter((u) => u.subscribed === 'inactive').length

    return {
      total: usersWithPresence.length,
      online,
      away,
      offline,
      active,
      inactive,
    }
  }, [usersWithPresence])

  async function handleConfirmToggle() {
    if (!selectedUser || !adminPassword) {
      return
    }

    try {
      setSubmitting(true)
      setFeedback(null)
      const result = await toggleAdminUserSubscription(selectedUser.userId, adminPassword)

      setUsers((prev) =>
        prev.map((u) =>
          u.userId === selectedUser.userId
            ? {
                ...u,
                subscribed: result.subscribed,
              }
            : u,
        ),
      )

      setFeedback(result.message)
      setConfirmOpen(false)
      setAdminPassword('')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Operazione non riuscita')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', py: { xs: 4, md: 8 }, pt: { xs: 10.25, md: 12.25 } }}>
        <Container maxWidth="lg">
          <Alert severity="info">Caricamento pannello amministratore in corso...</Alert>
        </Container>
      </Box>
    )
  }

  if (authError) {
    return (
      <Box sx={{ minHeight: '100vh', py: { xs: 4, md: 8 }, pt: { xs: 10.25, md: 12.25 } }}>
        <Container maxWidth="sm">
          <Stack spacing={2}>
            <Alert severity="error">{authError}</Alert>
            <Button variant="contained" onClick={() => navigate('/login')}>
              Vai al login
            </Button>
          </Stack>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <PageAppBar
        title="PFCWB-Chat"
        onTitleClick={() => navigate('/')}
        links={[
          { label: 'Gestione Iscritti', onClick: () => navigate('/admin/gestione-iscritti') },
          { label: 'Richieste', onClick: () => navigate('/admin/richieste') },
        ]}
        mode={mode}
        onToggleMode={toggleMode}
        onLogout={() => void handleLogout()}
      />

      <Box sx={{ pt: { xs: 3.5, md: 3.5 } }}>
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 }, mb: '10px' }}>
        <Stack spacing={2.5}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Riepilogo utenti
                </Typography>

                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <Chip label={`Totale: ${summary.total}`} />
                  <Chip label={`Online: ${summary.online}`} color="success" />
                  <Chip label={`Non al computer: ${summary.away}`} color="warning" />
                  <Chip label={`Offline: ${summary.offline}`} />
                  <Chip label={`Attivi: ${summary.active}`} color="primary" />
                  <Chip label={`Disattivati: ${summary.inactive}`} />
                </Stack>

                <ToggleButtonGroup
                  value={subscriptionFilter}
                  exclusive
                  onChange={(_, val) => val && setSubscriptionFilter(val)}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="all">Tutti</ToggleButton>
                  <ToggleButton value="active">Attivi</ToggleButton>
                  <ToggleButton value="inactive">Richieste in sospeso</ToggleButton>
                </ToggleButtonGroup>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Cerca per username o userId"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <TextField
                    select
                    size="small"
                    label="Ordina per"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    sx={{ minWidth: { xs: '100%', md: 220 } }}
                  >
                    <MenuItem value="status">Stato (online/offline/non al computer)</MenuItem>
                    <MenuItem value="userId">userId</MenuItem>
                  </TextField>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {feedback && <Alert severity="info">{feedback}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h6">Lista utenti</Typography>

                    <List sx={{ maxHeight: 500, overflow: 'auto', py: 0 }}>
                      {filteredAndSortedUsers.map((u) => {
                        const status = u.userStateRef?.status ?? 'offline'
                        return (
                          <ListItemButton
                            key={u.userId}
                            selected={u.userId === selectedUserId}
                            onClick={() => setSelectedUserId(u.userId)}
                            sx={{ borderRadius: 1.5, mb: 0.5 }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                              <ListItemText
                                primary={`${u.username} (#${u.userId})`}
                                secondary={`Iscrizione: ${u.subscribed === 'active' ? 'attivo' : 'disattivato'}`}
                              />
                              <Chip
                                size="small"
                                label={getStatusLabel(status)}
                                color={getStatusChipColor(status)}
                                variant="filled"
                              />
                            </Stack>
                          </ListItemButton>
                        )
                      })}

                      {filteredAndSortedUsers.length === 0 && (
                        <Typography color="text.secondary" sx={{ p: 1.5 }}>
                          Nessun utente trovato con i filtri correnti.
                        </Typography>
                      )}
                    </List>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  {!selectedUser && (
                    <Typography color="text.secondary">
                      Seleziona un utente dalla lista per visualizzarne il profilo.
                    </Typography>
                  )}

                  {selectedUser && (
                    <Stack spacing={1.25}>
                      <Typography variant="h6">Profilo utente</Typography>
                      <Typography>
                        <strong>Username:</strong> {selectedUser.username}
                      </Typography>
                      <Typography>
                        <strong>UserId:</strong> {selectedUser.userId}
                      </Typography>
                      <Typography>
                        <strong>Email:</strong> {selectedUser.email}
                      </Typography>
                      <Typography>
                        <strong>Stato:</strong>{' '}
                        {getStatusLabel(selectedUser.userStateRef?.status ?? 'offline')}
                      </Typography>
                      <Typography>
                        <strong>Iscrizione:</strong>{' '}
                        {selectedUser.subscribed === 'active' ? 'attivo' : 'disattivato'}
                      </Typography>
                      <Typography>
                        <strong>Nome completo:</strong>{' '}
                        {selectedUser.anagraphicsRef
                          ? `${selectedUser.anagraphicsRef.nome} ${selectedUser.anagraphicsRef.cognome}`
                          : 'n/d'}
                      </Typography>
                      <Typography>
                        <strong>Telefono:</strong> {selectedUser.anagraphicsRef?.telefono ?? 'n/d'}
                      </Typography>
                      <Typography>
                        <strong>Indirizzo:</strong> {selectedUser.anagraphicsRef?.indirizzo ?? 'n/d'}
                      </Typography>

                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        {selectedUser.subscribed === 'inactive' && (
                          <Button
                            color="success"
                            variant="contained"
                            onClick={async () => {
                              try {
                                setActivatingId(selectedUser.userId)
                                setFeedback(null)
                                await activateUser(selectedUser.userId)
                                setUsers((prev) =>
                                  prev.map((u) =>
                                    u.userId === selectedUser.userId
                                      ? { ...u, subscribed: 'active' }
                                      : u,
                                  ),
                                )
                                setFeedback('Utente attivato con successo')
                                setSelectedUserId(null)
                              } catch (error) {
                                setFeedback(error instanceof Error ? error.message : 'Errore attivazione')
                              } finally {
                                setActivatingId(null)
                              }
                            }}
                            disabled={activatingId !== null}
                          >
                            {activatingId === selectedUser.userId ? 'Attivazione...' : 'Attiva utente'}
                          </Button>
                        )}
                        <Button
                          color={selectedUser.subscribed === 'active' ? 'error' : 'success'}
                          variant="outlined"
                          sx={{ mt: 0 }}
                          onClick={() => {
                            setFeedback(null)
                            setConfirmOpen(true)
                          }}
                        >
                          {selectedUser.subscribed === 'active' ? 'Disattiva' : 'Riattiva'}
                        </Button>
                      </Stack>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Stack>
        </Container>
      </Box>

      <Dialog open={confirmOpen} onClose={() => (submitting ? undefined : setConfirmOpen(false))} fullWidth>
        <DialogTitle>Conferma operazione amministrativa</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Typography color="text.secondary">
              Per confermare la modifica dello stato utente, inserisci nuovamente la password amministratore.
            </Typography>
            <TextField
              label="Password amministratore"
              type="password"
              autoFocus
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              disabled={submitting}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Annulla
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!adminPassword || submitting}
            onClick={handleConfirmToggle}
          >
            Conferma
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
