import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { useState, type FormEvent } from 'react'
import { registerUser } from '../lib/api'

export default function RegisterPage() {
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')

  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setLoading(true)
      setFeedback(null)
      const result = await registerUser({ nome, cognome, username, email })
      setFeedback({ type: 'success', text: result.message })
      setNome('')
      setCognome('')
      setUsername('')
      setEmail('')
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Errore durante la registrazione',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 4, md: 8 }, pt: { xs: 10.125, md: 11.125 }, mb: '10px' }}>
      <Container maxWidth="sm">
        <Stack spacing={2.5}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={2}>
                <Typography variant="h4">Iscriviti</Typography>
                <Typography color="text.secondary">
                  Compila il form: il team amministrativo potra' completare l&apos;abilitazione del profilo.
                </Typography>

                <Box component="form" onSubmit={handleSubmit}>
                  <Stack spacing={1.5}>
                    <TextField
                      name="nome"
                      label="Nome"
                      required
                      fullWidth
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                    <TextField
                      name="cognome"
                      label="Cognome"
                      required
                      fullWidth
                      value={cognome}
                      onChange={(e) => setCognome(e.target.value)}
                    />
                    <TextField
                      name="username"
                      label="Username"
                      required
                      fullWidth
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <TextField
                      name="email"
                      type="email"
                      label="Email"
                      required
                      fullWidth
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />

                    <Button type="submit" variant="contained" endIcon={<SendIcon />} disabled={loading}>
                      {loading ? 'Invio in corso...' : 'Invia richiesta'}
                    </Button>
                  </Stack>
                </Box>

                <Alert severity="info" sx={{ mt: 2 }}>
                  <strong>Importante:</strong> Riceverete la vostra password temporanea al vostro indirizzo di posta. Ricordate di cambiarla dal vostro profilo.
                </Alert>

                {feedback && (
                  <Alert severity={feedback.type} sx={{ mt: 1 }}>
                    {feedback.text}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}
