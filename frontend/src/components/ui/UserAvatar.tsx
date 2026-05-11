import { Avatar, Badge, Box } from '@mui/material'
import { getInitials, resolveAvatarSrc, statusDotColor } from '../../lib/presenceUtils'
import type { PresenceStatus } from '../../types'

type UserAvatarProps = {
  username: string
  photoPath?: string | null
  status?: PresenceStatus
  size?: number
  badgeSize?: number
}

export function UserAvatar({
  username,
  photoPath,
  status,
  size = 36,
  badgeSize = 10,
}: UserAvatarProps) {
  const avatar = (
    <Avatar
      src={resolveAvatarSrc(photoPath)}
      sx={{
        width: size,
        height: size,
        fontWeight: 700,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
      }}
      slotProps={{ img: { style: { objectFit: 'cover', objectPosition: 'center center' } } }}
    >
      {getInitials(username)}
    </Avatar>
  )

  if (!status) {
    return avatar
  }

  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      badgeContent={
        <Box
          sx={{
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            bgcolor: statusDotColor(status),
            border: '2px solid',
            borderColor: 'background.paper',
          }}
        />
      }
    >
      {avatar}
    </Badge>
  )
}
