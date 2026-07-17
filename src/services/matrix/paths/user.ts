export const USER = {
  /** @deprecated Use MatrixProfileService.getProfile() instead */
  PROFILE: (userId: string) => `/profile/${encodeURIComponent(userId)}`,
  /** @deprecated Use MatrixProfileService.setDisplayName() instead */
  DISPLAYNAME: (userId: string) => `/profile/${encodeURIComponent(userId)}/displayname`,
  /** @deprecated Use MatrixProfileService.setAvatarUrl() instead */
  AVATAR: (userId: string) => `/profile/${encodeURIComponent(userId)}/avatar_url`,
  EXTENDED_PROFILE: (userId: string) => `/uk.tcpip.msc4133/profile/${encodeURIComponent(userId)}`,
  EXTENDED_PROFILE_FIELD: (userId: string, keyName: string) =>
    `/uk.tcpip.msc4133/profile/${encodeURIComponent(userId)}/${encodeURIComponent(keyName)}`,
  /** @deprecated Use MatrixUserDirectoryService.search() instead */
  DIRECTORY_SEARCH: '/user_directory/search',
  /** @deprecated Use MatrixPresenceService methods instead */
  PRESENCE: (userId: string) => `/presence/${encodeURIComponent(userId)}/status`,
  /** @deprecated Use MatrixDeviceService methods instead */
  DEVICES: '/devices',
  /** @deprecated Use client.getTurnServers() instead */
  TURN_SERVER: '/voip/turnServer',
  /** @deprecated Use client.publicRooms() instead */
  PUBLIC_ROOMS: '/publicRooms'
} as const
