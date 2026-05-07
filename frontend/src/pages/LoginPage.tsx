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
import LoginIcon from '@mui/icons-material/Login'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setLoading(true)
      setFeedback(null)
      const response = await login(email, password)
      navigate(response.user.role === 'admin' ? '/admin' : '/user')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Errore login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 4, md: 8 }, pt: { xs: 10.125, md: 11.125 } }}>
      <Container maxWidth="sm">
        <Stack spacing={2.5}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={2}>
                <Typography variant="h4">Accedi</Typography>
                <Typography color="text.secondary">
                  Inserisci le credenziali per entrare nel tuo profilo.
                </Typography>

                <Box component="form" onSubmit={handleSubmit}>
                  <Stack spacing={1.5}>
                    <TextField
                      type="email"
                      label="Email"
                      required
                      fullWidth
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                      type="password"
                      label="Password"
                      required
                      fullWidth
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />

                    <Button type="submit" variant="contained" endIcon={<LoginIcon />} disabled={loading}>
                      {loading ? 'Accesso in corso...' : 'Accedi'}
                    </Button>
                  </Stack>
                </Box>

                {feedback && <Alert severity="info">{feedback}</Alert>}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}
