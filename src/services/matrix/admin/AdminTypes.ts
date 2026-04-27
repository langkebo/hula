export interface ServerStats {
  roomCount: number
  userCount: number
  dailyActiveUsers: number
  monthlyActiveUsers: number
  messageCount: number
  startServerTime: number
}

export interface ServerStatus {
  status: string
  uptime?: number
}

export interface ServerHealth {
  healthy: boolean
  checks?: Record<string, unknown>
}

export interface ServerInfo {
  serverName?: string
  version?: string
  federationEnabled?: boolean
}

export interface ServerVersion {
  serverVersion: string
  pythonVersion?: string
}

export interface UserInfo {
  userId: string
  name?: string
  avatarUrl?: string
  admin?: boolean
  deactivated?: boolean
  displayname?: string
  lastSeenTs?: number
}

export interface UserDevice {
  deviceId: string
  displayName?: string
  lastSeenIp?: string
  lastSeenTs?: number
  userAgent?: string
}

export interface RateLimit {
  messagesPerSecond?: number
  burstCount?: number
}

export interface ShadowBanStatus {
  banned: boolean
  bannedAt?: number
}

export interface RoomInfo {
  roomId: string
  name?: string
  topic?: string
  joinedMembers: number
  joinedLocalMembers: number
  invitedMembers: number
  invitedLocalMembers: number
  createTime?: number
  creator?: string
  public?: boolean
}

export interface RoomState {
  state: Array<{ type: string; stateKey: string; content: Record<string, unknown> }>
}

export interface ShutdownRoomResult {
  kickedUsers: string[]
  failedToKickUsers: string[]
  localAliases: string[]
}

export interface FederationDestination {
  destination: string
  retryLastTs?: number
  retryInterval?: number
  failureTs?: number
  lastSuccessfulStreamOrdering?: number
}

export interface FederationBlacklistEntry {
  serverName: string
  reason?: string
}

export interface ServerNoticeResult {
  eventId?: string
}

export interface ServerNoticeInfo {
  userId: string
  sentTs?: number
  content?: Record<string, unknown>
}

export interface RegistrationToken {
  token: string
  usesAllowed?: number
  pending: number
  completed: number
  expiryTime?: number
}
