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
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAdminUsers,
  getMe,
  setInitialPassword,
  toggleAdminUserSubscription,
  type AdminUser,
} from '../lib/api'

function toSubscriptionLabel(subscribed: AdminUser['subscribed']) {
  return subscribed === 'active' ? 'subscribed' : 'unsubscribed'
}

export default function SubscribersManagementPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const temporaryPasswordTrimmed = temporaryPassword.trim()
  const isTemporaryPasswordValid = temporaryPasswordTrimmed.length >= 8

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      try {
        setLoading(true)
        const me = await getMe()
        if (me.role !== 'admin') {
          if (!mounted) return
          setAuthError('Questa pagina e disponibile solo per amministratori.')
          return
        }

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

  const selectedUser = useMemo(
    () => users.find((u) => u.userId === selectedUserId) ?? null,
    [users, selectedUserId],
  )

  const pendingRequests = useMemo(
    () => users.filter((u) => u.subscribed === 'inactive' && u.mustChangePassword).length,
    [users],
  )

  async function handleToggleSubscription() {
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

  async function handleSetTemporaryPassword() {
    if (!selectedUser || !isTemporaryPasswordValid) {
      setFeedback('La password temporanea deve avere almeno 8 caratteri')
      return
    }

    try {
      setSettingPassword(true)
      setFeedback(null)

      const result = await setInitialPassword(selectedUser.userId, temporaryPasswordTrimmed)
      setUsers((prev) =>
        prev.map((u) =>
          u.userId === selectedUser.userId
            ? {
                ...u,
                subscribed: 'active',
                mustChangePassword: true,
              }
            : u,
        ),
      )
      setFeedback(result.message)
      setTemporaryPassword('')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Impostazione password non riuscita')
    } finally {
      setSettingPassword(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', py: { xs: 4, md: 8 }, pt: { xs: 10.25, md: 12.25 } }}>
        <Container maxWidth="lg">
          <Alert severity="info">Caricamento Gestione Iscritti in corso...</Alert>
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
    <Box sx={{ minHeight: '100vh', py: { xs: 4, md: 8 }, pt: { xs: 10.25, md: 12.25 } }}>
      <Container maxWidth="lg">
        <Stack spacing={2.5}>
          <Card>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Gestione Iscritti
                </Typography>
                <Typography color="text.secondary">
                  Quando un utente si iscrive, compare qui con stato unsubscribed. L'amministratore imposta
                  la password temporanea e la comunica separatamente.
                </Typography>
                {pendingRequests > 0 && (
                  <Alert severity="warning">
                    Nuove richieste iscrizione: {pendingRequests}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>

          {feedback && <Alert severity="info">{feedback}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h6">Elenco iscritti</Typography>
                    <List sx={{ maxHeight: 500, overflow: 'auto', py: 0 }}>
                      {users.map((u) => (
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
                              secondary={u.email}
                            />
                            <Chip
                              size="small"
                              label={toSubscriptionLabel(u.subscribed)}
                              color={u.subscribed === 'active' ? 'success' : 'default'}
                            />
                          </Stack>
                        </ListItemButton>
                      ))}
                    </List>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  {!selectedUser && (
                    <Typography color="text.secondary">
                      Seleziona un iscritto per gestire stato e password temporanea.
                    </Typography>
                  )}

                  {selectedUser && (
                    <Stack spacing={1.25}>
                      <Typography variant="h6">Dettaglio iscritto</Typography>
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
                        <strong>Stato iscrizione:</strong> {toSubscriptionLabel(selectedUser.subscribed)}
                      </Typography>
                      <Typography>
                        <strong>mustChangePassword:</strong>{' '}
                        {selectedUser.mustChangePassword ? 'true' : 'false'}
                      </Typography>

                      {selectedUser.mustChangePassword && (
                        <Card variant="outlined" sx={{ mt: 1 }}>
                          <CardContent>
                            <Stack spacing={1.25}>
                              <Typography sx={{ fontWeight: 600 }}>
                                Imposta prima password
                              </Typography>
                              <TextField
                                type="password"
                                placeholder="inserire password temporanea"
                                value={temporaryPassword}
                                onChange={(e) => setTemporaryPassword(e.target.value)}
                                error={temporaryPassword.length > 0 && !isTemporaryPasswordValid}
                                helperText={
                                  temporaryPassword.length > 0 && !isTemporaryPasswordValid
                                    ? 'Minimo 8 caratteri (come backend)'
                                    : 'Inserisci una password temporanea da comunicare all\'utente'
                                }
                                fullWidth
                              />
                              <Button
                                variant="contained"
                                onClick={handleSetTemporaryPassword}
                                disabled={!isTemporaryPasswordValid || settingPassword}
                              >
                                {settingPassword ? 'Salvataggio...' : 'Salva password temporanea'}
                              </Button>
                            </Stack>
                          </CardContent>
                        </Card>
                      )}

                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button
                          color={selectedUser.subscribed === 'active' ? 'error' : 'success'}
                          variant="outlined"
                          onClick={() => {
                            setFeedback(null)
                            setConfirmOpen(true)
                          }}
                        >
                          {selectedUser.subscribed === 'active' ? 'Imposta unsubscribed' : 'Imposta subscribed'}
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

      <Dialog open={confirmOpen} onClose={() => (submitting ? undefined : setConfirmOpen(false))} fullWidth>
        <DialogTitle>Conferma modifica stato</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Typography color="text.secondary">
              Inserisci la password amministratore per aggiornare lo stato subscribed/unsubscribed.
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
            onClick={handleToggleSubscription}
          >
            Conferma
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
