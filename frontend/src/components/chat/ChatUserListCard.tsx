import {
  Box,
  Card,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { UserAvatar } from '../ui/UserAvatar'
import { statusLabel } from '../../lib/presenceUtils'
import type { PresenceStatus } from '../../types'

export type ChatUserListItem = {
  userId: number
  username: string
  status: PresenceStatus
  unreadCount?: number
  photoPath?: string | null
}

type ChatUserListCardProps = {
  title: string
  connected: boolean
  usersCollapsed: boolean
  onToggleCollapsed: () => void
  users: ChatUserListItem[]
  selectedUserId: number | null
  onSelectUser: (user: ChatUserListItem) => void
  emptyConnectedText: string
  emptyDisconnectedText: string
  fixedHeight?: number
}

export function ChatUserListCard({
  title,
  connected,
  usersCollapsed,
  onToggleCollapsed,
  users,
  selectedUserId,
  onSelectUser,
  emptyConnectedText,
  emptyDisconnectedText,
  fixedHeight = 600,
}: ChatUserListCardProps) {
  return (
    <Card sx={{ height: { xs: usersCollapsed ? 'auto' : fixedHeight, md: fixedHeight }, display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        sx={{ px: 2, py: 1.5, alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            size="small"
            label={connected ? 'Connesso' : 'Disconnesso'}
            color={connected ? 'success' : 'default'}
            variant="outlined"
          />
          <IconButton
            size="small"
            onClick={onToggleCollapsed}
            sx={{
              display: { xs: 'flex', md: 'none' },
              width: 28,
              height: 28,
              bgcolor: 'action.selected',
              borderRadius: '50%',
              fontSize: '0.75rem',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            {usersCollapsed ? '▲' : '▼'}
          </IconButton>
        </Stack>
      </Stack>
      <Divider sx={{ display: { xs: usersCollapsed ? 'none' : 'block', md: 'block' } }} />
      <List sx={{ flex: 1, overflow: 'auto', py: 0, display: { xs: usersCollapsed ? 'none' : 'block', md: 'block' } }}>
        {users.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {connected ? emptyConnectedText : emptyDisconnectedText}
            </Typography>
          </Box>
        ) : (
          users.map((user) => (
            <ListItemButton
              key={user.userId}
              selected={selectedUserId === user.userId}
              onClick={() => onSelectUser(user)}
              sx={{ py: 1.5 }}
            >
              <ListItemAvatar>
                <UserAvatar
                  username={user.username}
                  photoPath={user.photoPath}
                  status={user.status}
                  size={36}
                  badgeSize={12}
                />
              </ListItemAvatar>
              <ListItemText
                primary={(
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: selectedUserId === user.userId ? 700 : 400 }}>
                      {user.username}
                    </Typography>
                    {(user.unreadCount ?? 0) > 0 && (
                      <Chip
                        size="small"
                        label={user.unreadCount === 1 ? '1 non letto' : `${user.unreadCount} non letti`}
                        sx={{
                          bgcolor: '#1976d2',
                          color: '#fff',
                          fontWeight: 600,
                          '& .MuiChip-label': { px: 1 },
                        }}
                      />
                    )}
                  </Stack>
                )}
                secondary={statusLabel(user.status)}
              />
            </ListItemButton>
          ))
        )}
      </List>
    </Card>
  )
}