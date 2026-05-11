import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined'
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { getHealth } from '../lib/api'

type HealthState =
  | { status: 'loading'; message: string }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string }

export default function LandingPage() {
  const [healthState, setHealthState] = useState<HealthState>({
    status: 'loading',
    message: 'Controllo connessione backend in corso...',
  })

  useEffect(() => {
    let mounted = true

    void getHealth()
      .then((payload) => {
        if (!mounted) return
        setHealthState({
          status: 'ok',
          message: `Backend online: ${new Date(payload.now).toLocaleString()}`,
        })
      })
      .catch((error) => {
        if (!mounted) return
        setHealthState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Backend non raggiungibile',
        })
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 10% 10%, rgba(255,211,119,0.35), transparent 35%), radial-gradient(circle at 90% 20%, rgba(134,220,142,0.35), transparent 35%), radial-gradient(circle at 40% 90%, rgba(255,156,156,0.25), transparent 40%)',
        py: { xs: 6, md: 8 },
        pt: { xs: 10.25, md: 12.25 },
        mb: '10px',
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={4}>
          <Stack spacing={2}>
            <Chip
              color={healthState.status === 'ok' ? 'success' : healthState.status === 'error' ? 'warning' : 'default'}
              label={healthState.message}
              sx={{ width: 'fit-content', fontWeight: 700 }}
            />

            <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, lineHeight: 1.05 }}>
              Benvenuto su PFCWB-Chat
            </Typography>

            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 780 }}>
              Crea il tuo profilo personale, ingaggia in stimolanti chat 1-to-1 e avvia videochiamate
              con un&apos;esperienza semplice e moderna.
            </Typography>
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%', background: 'linear-gradient(135deg, rgba(255,182,210,0.18) 0%, rgba(255,100,160,0.08) 100%)' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <PersonAddAltOutlinedIcon color="primary" />
                    <Typography variant="h6">Crea il tuo profilo personale</Typography>
                    <Typography color="text.secondary">
                      Configura i tuoi dati in pochi passaggi e costruisci il tuo spazio personale.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%', background: 'linear-gradient(135deg, rgba(230,130,210,0.18) 0%, rgba(200,80,180,0.08) 100%)' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <ChatOutlinedIcon color="primary" />
                    <Typography variant="h6">Chat 1-to-1 stimolanti</Typography>
                    <Typography color="text.secondary">
                      Conversazioni dirette, storico paginato e focus totale sulle persone.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%', background: 'linear-gradient(135deg, rgba(255,150,200,0.18) 0%, rgba(220,80,150,0.08) 100%)' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <VideocamOutlinedIcon color="primary" />
                    <Typography variant="h6">Videochiamate immediate</Typography>
                    <Typography color="text.secondary">
                      Passa dalla chat alla chiamata in tempo reale con signaling tecnico sicuro.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ border: '2px dashed', borderColor: 'secondary.main' }}>
            <CardActionArea component={RouterLink} to="/register" sx={{ p: { xs: 2.5, md: 3 } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2,
                  alignItems: { sm: 'center' },
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5">Registrati in pochi passaggi per iniziare a chattare</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Vai alla pagina di iscrizione e crea subito il tuo account.
                  </Typography>
                </Box>
                <Button variant="contained" color="secondary" endIcon={<ArrowForwardIcon />}>
                  Apri il form
                </Button>
              </Box>
            </CardActionArea>
          </Card>
        </Stack>
      </Container>
    </Box>
  )
}
