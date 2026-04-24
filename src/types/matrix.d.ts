// Matrix SDK 类型扩展声明

declare module 'matrix-js-sdk' {
  interface MatrixUserDirectoryResponse {
    results: Array<{
      user_id: string
      display_name?: string
      avatar_url?: string
    }>
    limited: boolean
  }

  interface MatrixPublicRoomsResponse {
    chunk: Array<{
      room_id: string
      name?: string
      avatar_url?: string
      num_joined_members: number
    }>
    next_batch?: string
    prev_batch?: string
    total_room_count_estimate?: number
  }

  interface MatrixClient {
    // Profile
    getProfile(userId: string): Promise<{ displayname?: string; avatar_url?: string }>

    // User Directory
    searchUserDirectory(opts: { term: string; limit?: number }): Promise<MatrixUserDirectoryResponse>

    // Report
    reportEvent(roomId: string, eventId: string, reason: string, explanation?: string): Promise<unknown>

    // Retention
    getServerRetention(): Promise<Record<string, unknown>>
    getRoomStateEvent(roomId: string, eventType: string, stateKey: string): Promise<Record<string, unknown>>

    // Upload
    uploadContent(
      file: Blob | File,
      opts?: {
        type?: string
        name?: string
        includeFilename?: boolean
        rawResponse?: boolean
        progressHandler?: (progress: { loaded: number; total: number }) => void
        abortController?: AbortController
      }
    ): Promise<{ content_uri: string }>

    // Sync
    sync(opts?: Record<string, unknown>): Promise<Record<string, unknown>>

    // Client
    getRooms(): Room[]
    getRoom(roomId: string): Room | null
    stopClient(): void

    // Manager accessors
    getDirectMessageManager?(): unknown
    dmManager?: unknown
    getMediaQuotaManager?(): unknown
    quotaManager?: unknown
    getWidgetManager?(): unknown
    widgetManager?: unknown
    getDeviceManager?(): unknown
    getKeyBackupManager?(): unknown
    getPushers?(): Promise<unknown>
  }

  interface Room {
    timeline: MatrixEvent[]
    getUnfilteredTimelineSet(): {
      getLiveTimeline(): {
        getEvents(): MatrixEvent[]
      }
    }
    getMyMembership?(): string
    getUnreadNotificationCount?(type?: unknown): number | undefined
    getRoomId?(): string
  }

  interface MatrixEvent {
    getContent(): Record<string, unknown>
    getWireContent(): Record<string, unknown>
  }
}

declare module 'matrix-js-sdk/dm' {
  export interface CreateDmOptions {
    userIds: string[]
    invite?: boolean
    name?: string
    topic?: string
    isEncrypted?: boolean
  }

  export interface DmRoomInfo {
    roomId: string
    inviter?: string
    invitees: string[]
    name?: string
    avatarUrl?: string
    lastMessage?: {
      content: string
      timestamp: number
      sender: string
    }
    unreadCount?: number
  }

  export interface DmPartnerResponse {
    room_id: string
    user_id: string
    display_name: string
    avatar_url: string
  }

  export interface IDirectRoomsMap {
    [userId: string]: string[]
  }

  export class DirectMessageManager {
    createDm(options: CreateDmOptions | string[]): Promise<string>
    getDMRooms(): Promise<DmRoomInfo[]>
    getDmForUser(userId: string): Promise<string | null>
    leaveDm(roomId: string): Promise<void>
    getDirectRoomsByUser(): Promise<IDirectRoomsMap>
    setDmRoom(roomId: string, userId: string): Promise<void>
    removeDmRoom(roomId: string, userId: string): Promise<void>
    getDmRoomInfo(roomId: string): Promise<DmRoomInfo | null>
    markDmAsRead(roomId: string): Promise<void>
    sendDmMessage(roomId: string, content: string | Record<string, unknown>): Promise<string>
    checkRoomIsDm(roomId: string): Promise<boolean>
    getDmPartner(roomId: string): Promise<string | null>
    getDirectRoomsFromServer(): Promise<IDirectRoomsMap>
    updateDirectRoom(roomId: string, userIds: string[]): Promise<void>
    isDmRoomFromServer(roomId: string, throwOnError?: boolean): Promise<boolean>
    getDmPartnerFromServer(roomId: string, throwOnError?: boolean): Promise<DmPartnerResponse | null>
    start(): Promise<void>
    stop(): void
  }
}

declare module 'matrix-js-sdk/friend' {
  export enum FriendEvent {
    Invited = 'Invited',
    Accepted = 'Accepted',
    Rejected = 'Rejected',
    Cancelled = 'Cancelled',
    Removed = 'Removed',
    RequestReceived = 'RequestReceived',
    ListUpdated = 'ListUpdated',
    SyncComplete = 'SyncComplete',
    FriendAdded = 'FriendAdded',
    FriendRemoved = 'FriendRemoved',
    FriendUpdated = 'FriendUpdated',
    RequestSent = 'RequestSent',
    RequestAccepted = 'RequestAccepted',
    RequestRejected = 'RequestRejected',
    RequestCancelled = 'RequestCancelled'
  }

  export interface Friend {
    user_id: string
    reason?: string
    since?: number
    display_name?: string
    avatar_url?: string
    note?: string
    status?: 'favorite' | 'normal' | 'blocked' | 'hidden' | string
    dm_room_id?: string
  }

  export interface FriendRequest {
    user_id: string
    reason?: string
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
    timestamp?: number
    display_name?: string
    avatar_url?: string
    message?: string
    direction?: 'incoming' | 'outgoing'
  }

  export class FriendManager {
    sendFriendRequest(userId: string, reason?: string): Promise<void>
    acceptFriendRequest(userId: string): Promise<void>
    rejectFriendRequest(userId: string): Promise<void>
    cancelFriendRequest(userId: string): Promise<void>
    removeFriend(userId: string): Promise<void>
    getFriends(): Promise<Friend[]>
    getIncomingRequests(): Promise<FriendRequest[]>
    getOutgoingRequests(): Promise<FriendRequest[]>
    getFriendSuggestions(limit?: number): Promise<Friend[]>
    isFriend(userId: string): Promise<boolean>
    checkFriendship(userId: string): Promise<boolean>
    getFriendGroups(): Promise<Record<string, { name: string; users: string[] }>>
    createFriendGroup(name: string): Promise<string>
    addToFriendGroup(groupId: string, userId: string): Promise<void>
    removeFromFriendGroup(groupId: string, userId: string): Promise<void>
    deleteFriendGroup(groupId: string): Promise<void>
    setFriendDisplayName(userId: string, displayName: string): Promise<void>
    updateFriendNote(userId: string, note: string): Promise<void>
    getFriendStatus(userId: string): Promise<string>
    updateFriendStatus(userId: string, status: string): Promise<void>
    getFriendInfo(userId: string, throwOnError?: boolean): Promise<Friend | null>
    getCachedFriends(): Friend[]
    on(event: string, handler: (...args: any[]) => void): void
    removeAllListeners(event?: string): void
    start(): Promise<void>
    stop(): void
  }
}

declare module 'matrix-js-sdk/src/telemetry' {
  export interface TelemetryEvent {
    event: string
    timestamp: number
    data?: Record<string, unknown>
  }

  export interface TelemetryConfig {
    enabled: boolean
    endpoint?: string
    sampleRate?: number
  }

  export interface UsageStats {
    messagesSent: number
    messagesReceived: number
    roomsJoined: number
    callsMade: number
    mediaUploaded: number
    lastActive: number
  }

  export class TelemetryManager {
    configure(config: Partial<TelemetryConfig>): void
    enable(): void
    disable(): void
    isEnabled(): boolean
    track(event: string, data?: Record<string, unknown>): void
    trackMessageSent(roomId: string, type: string): void
    trackMessageReceived(roomId: string, type: string): void
    trackRoomJoined(roomId: string): void
    trackCall(type: 'voice' | 'video'): void
    trackMediaUploaded(size: number, type: string): void
    trackError(error: Error, context?: Record<string, unknown>): void
    getUsageStats(): UsageStats
    getSessionDuration(): number
    flush(): void
    start(): void
    stop(): void
  }
}
