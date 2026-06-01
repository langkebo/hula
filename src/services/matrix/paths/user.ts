export const USER = {
  /** @deprecated Use MatrixProfileService.getProfile() instead */
  PROFILE: (userId: string) => `/_matrix/client/v3/profile/${encodeURIComponent(userId)}`,
  /** @deprecated Use MatrixProfileService.setDisplayName() instead */
  DISPLAYNAME: (userId: string) => `/_matrix/client/v3/profile/${encodeURIComponent(userId)}/displayname`,
  /** @deprecated Use MatrixProfileService.setAvatarUrl() instead */
  AVATAR: (userId: string) => `/_matrix/client/v3/profile/${encodeURIComponent(userId)}/avatar_url`,
  EXTENDED_PROFILE: (userId: string) =>
    `/_matrix/client/unstable/uk.tcpip.msc4133/profile/${encodeURIComponent(userId)}`,
  EXTENDED_PROFILE_FIELD: (userId: string, keyName: string) =>
    `/_matrix/client/unstable/uk.tcpip.msc4133/profile/${encodeURIComponent(userId)}/${encodeURIComponent(keyName)}`,
  /** @deprecated Use MatrixUserDirectoryService.search() instead */
  DIRECTORY_SEARCH: '/_matrix/client/v3/user_directory/search',
  /** @deprecated Use MatrixPresenceService methods instead */
  PRESENCE: (userId: string) => `/_matrix/client/v3/presence/${encodeURIComponent(userId)}/status`,
  /** @deprecated Use MatrixDeviceService methods instead */
  DEVICES: '/_matrix/client/v3/devices',
  /** @deprecated Use client.getTurnServers() instead */
  TURN_SERVER: '/_matrix/client/v3/voip/turnServer',
  /** @deprecated Use client.publicRooms() instead */
  PUBLIC_ROOMS: '/_matrix/client/v3/publicRooms'
} as const
