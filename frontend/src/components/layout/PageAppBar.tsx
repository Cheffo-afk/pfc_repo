import {
  AppBar,
  Button,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'

export type PageAppBarLink = {
  label: string
  onClick: () => void
}

type PageAppBarProps = {
  title: string
  onTitleClick: () => void
  links?: PageAppBarLink[]
  mode: 'light' | 'dark'
  onToggleMode: () => void
  onLogout: () => void
  logoutLabel?: string
}

export function PageAppBar({
  title,
  onTitleClick,
  links = [],
  mode,
  onToggleMode,
  onLogout,
  logoutLabel = 'Esci',
}: PageAppBarProps) {
  return (
    <AppBar
      position="fixed"
      color="transparent"
      elevation={0}
      sx={{ backdropFilter: 'blur(10px)', borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', py: 0.8 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Typography
              variant="h6"
              onClick={onTitleClick}
              sx={{ fontWeight: 800, cursor: 'pointer', transition: 'opacity 0.2s', '&:hover': { opacity: 0.7 } }}
            >
              {title}
            </Typography>
            {links.map((link) => (
              <Typography
                key={link.label}
                variant="body2"
                onClick={link.onClick}
                sx={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: 'text.primary',
                  textAlign: 'left',
                  transition: 'opacity 0.2s',
                  '&:hover': { opacity: 0.7 },
                }}
              >
                {link.label}
              </Typography>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Tooltip title={mode === 'light' ? 'Modalità scura' : 'Modalità chiara'}>
              <IconButton onClick={onToggleMode} size="small" color="inherit">
                {mode === 'light' ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={onLogout}
            >
              {logoutLabel}
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  )
}
