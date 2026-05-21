export const USER = {
  PROFILE: (userId: string) => `/_matrix/client/v3/profile/${encodeURIComponent(userId)}`,
  DISPLAYNAME: (userId: string) => `/_matrix/client/v3/profile/${encodeURIComponent(userId)}/displayname`,
  AVATAR: (userId: string) => `/_matrix/client/v3/profile/${encodeURIComponent(userId)}/avatar_url`,
  DIRECTORY_SEARCH: '/_matrix/client/v3/user_directory/search',
  PRESENCE: (userId: string) => `/_matrix/client/v3/presence/${encodeURIComponent(userId)}/status`,
  DEVICES: '/_matrix/client/v3/devices',
  TURN_SERVER: '/_matrix/client/v3/voip/turnServer',
  PUBLIC_ROOMS: '/_matrix/client/v3/publicRooms'
} as const
