/**
 * matrix-js-sdk 类型扩展
 * 提供官方 SDK 缺失的类型定义
 */
/// <reference types="vite/client" />

import type { Body, IHttpOpts, IRequestOpts, QueryDict } from 'matrix-js-sdk'

declare module 'matrix-js-sdk' {
  // ==================== MatrixHttpApi 方法重载 ====================
  // SDK 的 authedRequest/request 签名使用 Method enum（nominal 类型，不接受字符串字面量）。
  // 此处添加 method: string 的方法重载，让 tjg 代码可以用 'GET'/'POST' 等字符串字面量调用。
  // Declaration merging 对方法是追加重载，与 SDK 已有的 Method 签名并存。
  interface MatrixHttpApi<O extends IHttpOpts> {
    authedRequest<T = unknown>(
      method: string,
      path: string,
      queryParams?: QueryDict,
      body?: Body,
      paramOpts?: IRequestOpts
    ): Promise<T>
    request<T = unknown>(
      method: string,
      path: string,
      queryParams?: QueryDict,
      body?: Body,
      opts?: IRequestOpts
    ): Promise<T>
  }

  // ==================== MSC3575RoomData 扩展 ====================
  // tjg 的 MatrixSlidingSyncService 期望 roomData 有 state/summary 字段（tjg 自定义扩展）。
  // SDK 的 MSC3575RoomData 没有这两个字段，此处通过 interface augmentation 添加。
  interface MSC3575RoomData {
    state?: Record<string, unknown>
    summary?: Record<string, unknown>
  }

  // ==================== SlidingSync 方法扩展 ====================
  // tjg 的 MatrixSlidingSyncService 使用 getList/subscribeToRoom/unsubscribeFromRoom/getSyncToken
  // 等方法，这些是 tjg 自定义的 SlidingSync 扩展（SDK 的 SlidingSync class 没有这些方法）。
  // setInitialPos 是 SDK 源码中存在的 public 方法（sliding-sync.ts:334），但部分 SDK 构建的
  // .d.ts 未导出该方法，此处补充类型声明以支持 MatrixSyncManager 的增量 sync pos 持久化。
  interface SlidingSync {
    getList(listName: string):
      | {
          rooms: string[]
          setSort: (sort: string[]) => void
          setFilters: (filters: Record<string, unknown>) => void
        }
      | undefined
    subscribeToRoom(roomId: string, opts?: { timelineLimit?: number; invite?: boolean }): void
    unsubscribeFromRoom(roomId: string): void
    getSyncToken(): string | null
    /** 设置初始 pos，用于重启后增量 sync。必须在 start() 之前调用。SDK: sliding-sync.ts:334 */
    setInitialPos(pos: string): void
  }

  // ==================== Room 属性扩展 ====================
  // tjg 代码直接访问 room.topic（SDK 的 Room class 没有此属性，需通过 currentState 获取）。
  // 此处添加 topic 属性扩展，避免大量代码重构。
  interface Room {
    topic?: string
  }

  // ==================== 补充 SDK 缺失的类型 ====================

  // Note: These types exist in matrix-js-sdk/@types/partials.ts but are not exported from main index
  // We re-export them here for convenience

  // ==================== 接口补充 ====================
  // Note: ICreateRoomOpts exists in matrix-js-sdk/@types/requests.ts but is not exported from main index
  // We re-export it here for convenience

  export interface IPublicRoomsOpts {
    limit?: number
    since?: string
    server?: string
    filter?: {
      generic_search_term?: string
      room_types?: string[]
    }
    include_all_networks?: boolean
    third_party_instance_id?: string
  }

  export interface SlidingSyncList {
    ranges: number[][]
    sort: string[]
    timeline_limit: number
    required_state: Array<[string, string]>
  }

  export interface SlidingSyncRoomSubscription {
    timeline_limit: number
    required_state: Array<[string, string]>
  }

  // Note: ISendEventResponse exists in matrix-js-sdk/@types/requests.ts but is not exported from main index
  // We re-export it here for convenience

  export interface ILoginRequest {
    type: string
    user?: string
    password?: string
    device_id?: string
    initial_device_display_name?: string
    token?: string
    [key: string]: unknown
  }

  export interface IRegisterRequest {
    username?: string
    password?: string
    device_id?: string
    initial_device_display_name?: string
    inhibit_login?: boolean
    auth?: Record<string, unknown>
    [key: string]: unknown
  }

  export interface VoIPHandler {
    calls: Record<string, MatrixCall>
  }

  export interface IMemberEvent {
    membership?: string
    avatar_url?: string
    displayname?: string
  }

  // ==================== OIDC ====================

  // ==================== Push ====================
  // 这些类型在 SDK `@types/PushRules` 中已有规范定义，此处显式重声明以
  // 保证在本 augmentation 场景下（declare module 'matrix-js-sdk' 覆盖了
  // 主入口 export * 的部分解析）能被 `import { IPushRule } from 'matrix-js-sdk'`
  // 找到。字段形状与 SDK canonical（`default: boolean` required）保持一致。

  // Note: Push types exist in matrix-js-sdk/@types/PushRules.ts but are not exported from main index
  // We re-export them here for convenience

  // Note: ICreatePushRuleRequest 定义在 SDK `push/index.ts`（子路径导出），未上浮到顶层 index。
  // 此处显式重声明，使服务层可从顶层 matrix-js-sdk 导入，避免 SDK 边界策略的裸子路径导入违规。
  export interface ICreatePushRuleRequest {
    actions: PushRuleAction[]
    conditions?: PushRuleCondition[]
    pattern?: string
    before?: string
    after?: string
  }

  // ==================== Event 和 Timeline 类型 ====================
  // 这些类型已在 SDK 中正确定义，此处提供补充

  // synapse-rust 特有：输入状态管理器扩展
  // 官方 matrix-js-sdk 不包含此管理器接口

  // synapse-rust 特有：已读回执管理器扩展
  // 官方 matrix-js-sdk 不包含此管理器接口

  // ==================== 错误和存储 ====================
  // MatrixClient 接口扩展
  interface MatrixClient {
    readonly deviceId: string | null
    readonly baseUrl: string
    loginRequest(opts: ILoginRequest): Promise<LoginResponse>
    registerRequest(opts: IRegisterRequest): Promise<RegisterResponse>
    requestRegisterEmailToken(
      email: string,
      clientSecret: string,
      sendAttempt: number,
      nextLink?: string
    ): Promise<IRequestTokenResponse>
    loginFlows(): Promise<{ flows: Array<Record<string, unknown>> }>
    loginFlows(): Promise<{ flows: Array<{ type: string }> }>
    getSsoLoginUrl(redirectUrl: string, deviceName?: string, identityProviderId?: string): string
    getSsoLoginUrl(redirectUrl: string, deviceName?: string, idpId?: string): string
    voipHandler?: VoIPHandler
    getCallHandler(): VoIPHandler | undefined
    createCall(roomId: string, threadId?: string, opts?: { audio: boolean; video: boolean }): MatrixCall | null
    isCryptoEnabled(): boolean
    getCrypto(): CryptoApi | null
    crypto: CryptoApi
    isRoomEncrypted(roomId: string): boolean
    getCrossSigningInfo(userId: string): unknown
    getStoredDevice(userId: string, deviceId: string): unknown
    getUserDevices(userId: string): Promise<unknown[]>
    getKeyBackupEnabled(): Promise<boolean>
    createFilter(filter: unknown): Promise<unknown>
    getRoom(roomId: string): Room | null
    getRooms(): Room[]
    getAllRooms(): Room[]
    getUser(userId: string): User | null
    getUserId(): string | null
    getDeviceId(): string | null
    getRoomsByUserId(userId: string): Room[]
    getInvitedRooms(): Room[]
    getJoinedRooms(): Room[]
    createRoom(opts: ICreateRoomOpts): Promise<{ room_id: string }>
    createRoom(options: ICreateRoomOpts): Promise<{ room_id: string }>
    setRoomName(roomId: string, name: string): Promise<void>
    setRoomTopic(roomId: string, topic: string): Promise<void>
    setRoomAvatar(roomId: string, url: string): Promise<void>
    getRoomTags(roomId: string): Promise<{ tags: Record<string, { order?: number }> }>
    setRoomTag(roomId: string, tagName: string, metadata?: { order?: number }): Promise<EmptyObject>
    deleteRoomTag(roomId: string, tagName: string): Promise<EmptyObject>
    leave(roomId: string): Promise<void>
    sendStateEvent(roomId: string, eventType: string, content: unknown, stateKey?: string): Promise<ISendEventResponse>
    sendStateEvent(
      roomId: string,
      eventType: string,
      content: unknown,
      stateKey?: string
    ): Promise<{ event_id: string }>
    invite(roomId: string, userId: string): Promise<void>
    joinRoom(roomIdOrAlias: string, opts?: { viaServers?: string[] }): Promise<Room>
    joinRoom(roomIdOrAlias: string, opts?: Record<string, unknown>): Promise<Room>
    publicRooms(opts?: IPublicRoomsOpts): Promise<IPublicRoomsResponse>
    publicRooms(options?: {
      server?: string
      limit?: number
      since?: string
      filter?: { generic_search_term?: string }
    }): Promise<IPublicRoomsResponse>
    getAccountData(eventType: string): MatrixEvent | null
    getHomeserverUrl(): string
    // SDK 已上浮 getAccountManager(): AccountManager（matrix-client-extensions.d.ts），
    // 此处不再用窄化返回类型遮蔽，否则 AccountManager.logoutAll 等成员会丢失类型。
    requestPasswordEmailToken(
      email: string,
      clientSecret: string,
      sendAttempt: number,
      nextLink?: string
    ): Promise<IRequestTokenResponse>
    setPassword(
      auth: Record<string, unknown>,
      newPassword: string,
      logoutDevices?: boolean
    ): Promise<Record<string, unknown>>
    isUsernameAvailable(username: string): Promise<{ available?: boolean }>
    setAccountData(eventType: string, content: unknown): Promise<void>
    getRoomState(roomId: string): RoomState | null
    getRoomMembers(roomId: string): RoomMember[]
    getRoomEvent(roomId: string, eventId: string): Promise<MatrixEvent>
    sendMessage(roomId: string, threadId: string | null, content: IContent, txnId?: string): Promise<ISendEventResponse>
    sendTextMessage(roomId: string, text: string, threadId?: string): Promise<ISendEventResponse>
    sendHtmlMessage(roomId: string, txnId: string, body: string, html: string): Promise<ISendEventResponse>
    sendEmote(roomId: string, txnId: string, content: string): Promise<ISendEventResponse>
    sendEvent(roomId: string, eventType: string, content: unknown, txnId?: string): Promise<ISendEventResponse>
    redactEvent(roomId: string, eventId: string, txnId?: string, opts?: { reason?: string }): Promise<void>
    getTypingManager(): TypingManager
    getReadReceiptsManager(): ReadReceiptsManager
    search(params: Record<string, unknown>): Promise<{
      search_categories?: {
        room_events?: {
          results?: Array<{
            result: {
              room_id: string
              event_id: string
              sender: string
              content: Record<string, unknown>
              origin_server_ts: number
            }
            context?: {
              profile_info?: Record<string, { displayname?: string }>
              events_before?: MatrixEvent[]
              events_after?: MatrixEvent[]
            }
          }>
          count?: number
          highlights?: string[]
        }
      }
    }>
    searchUserDirectory(opts: { term: string; limit?: number }): Promise<{
      results: Array<{
        user_id: string
        display_name?: string
        avatar_url?: string
      }>
      limited: boolean
    }>
    getProfile(userId: string): Promise<{ displayname?: string; avatar_url?: string }>
    getRoomDirectoryVisibility(roomId: string): Promise<{ visibility: 'public' | 'private' }>
    setRoomDirectoryVisibility(roomId: string, visibility: 'public' | 'private'): Promise<void>
    login(loginType: string, data: Record<string, unknown>): Promise<LoginResponse>
    getMediaApiUrl(path: string): string
    logout(): Promise<void>
    startClient(opts?: Record<string, unknown>): Promise<void>
    kick(roomId: string, userId: string, reason?: string): Promise<void>
    ban(roomId: string, userId: string, reason?: string): Promise<void>
    unban(roomId: string, userId: string): Promise<void>
    setRoomEncryption(roomId: string, encryption: unknown): Promise<void>
    getSyncState(): string | null
    getRoomsNav(): unknown
    generateTxnId(): string
    getAccessToken(): string | null
    setAccessToken(token: string): void
    getDomain(): string
    setDisplayName(name: string): Promise<void>
    setAvatarUrl(url: string): Promise<void>
    mxcUrlToHttp(
      mxcUrl: string,
      width?: number,
      height?: number,
      resizeMethod?: string,
      allowDirectLinks?: boolean,
      allowRedirects?: boolean,
      useAuthentication?: boolean
    ): string | null
    getPushRules(): Promise<IPushRules>
    setPushRule(
      scope: string,
      kind: PushRuleKind,
      ruleId: string,
      actions: unknown[],
      conditions?: IPushRuleCondition[],
      pattern?: string
    ): Promise<void>
    deletePushRule(scope: string, kind: PushRuleKind, ruleId: string): Promise<void>
    addPushRule(scope: string, kind: PushRuleKind, ruleId: string, body: Record<string, unknown>): Promise<void>
    setPusher(pusher: IPusherRequest): Promise<void>
    setPresence(presence: string, opts?: Record<string, unknown>): Promise<void>
    setPresence(opts: { presence: string; status_msg?: string }): Promise<void>
    getPresence(userId: string): Promise<{ presence: string; last_active_ago?: number; status_msg?: string }>
    getProfileInfo(userId: string): Promise<{ displayname?: string; avatar_url?: string }>
    getUserProfile(userId: string): Promise<{ displayname?: string; avatar_url?: string }>
    getDevices(): Promise<Device[]>
    getDevice(deviceId: string): Promise<Device>
    setDeviceName(deviceId: string, name: string): Promise<void>
    updateDevice(deviceId: string, updates: IDeviceUpdateRequest): Promise<void>
    deleteDevice(deviceId: string, auth?: Record<string, unknown>): Promise<void>
    deleteMultipleDevices(deviceIds: string[], auth?: Record<string, unknown>): Promise<void>
    requestAdd3pidEmailToken(
      email: string,
      clientSecret: string,
      sendAttempt: number,
      nextLink?: string
    ): Promise<IRequestTokenResponse>
    requestAdd3pidMsisdnToken(
      phoneNumber: string,
      country: string,
      clientSecret: string,
      sendAttempt: number,
      nextLink?: string
    ): Promise<IRequestTokenResponse>
    deactivateAccount(auth?: Record<string, unknown>, erase?: boolean): Promise<{ id_server_unbind_result?: string }>
    getAccountDataFromServer(eventType: string): Promise<Record<string, unknown> | null>
    setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void>
    sendReadReceipt(event: MatrixEvent, receiptType?: ReceiptType): Promise<Record<string, unknown>>
    sendReadReceipt(
      roomId: string,
      event: MatrixEvent,
      opts?: Record<string, unknown>
    ): Promise<Record<string, unknown>>
    forget(roomId: string): Promise<void>
    upgradeRoom(roomId: string, version: string): Promise<{ replacement_room: string }>
    createAlias(alias: string, roomId: string): Promise<void>
    deleteAlias(alias: string): Promise<void>
    getEventContext(roomId: string, eventId: string, opts?: Record<string, unknown>): Promise<Record<string, unknown>>
    setUserPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void>
    setPowerLevel(roomId: string, userId: string, powerLevel: number, event?: MatrixEvent): Promise<void>
    scrollback(room: Room, limit: number): Promise<Room>
    redact(roomId: string, eventId: string, txnId?: string, opts?: { reason?: string }): Promise<{ event_id: string }>
    getVisibleRooms(): Room[]
    syncOnce(opts?: Record<string, unknown>): Promise<void>
    // getBurnAfterReadManager now available in SDK (matrix-js-sdk@40.2.0+)
    // getSpaceManager now available in SDK
    // getKeyRotationManager now available in SDK
    // getDehydratedDeviceManager now available in SDK
    // getPresenceManager now available in SDK
    // getDeviceKeysManager now available in SDK
    // getCryptoKeysManager now available in SDK
    // getKeyVerificationManager now available in SDK
    // getTypingManager now available in SDK
    // getReadReceiptsManager now available in SDK
    on(event: 'room', listener: (room: Room) => void): void
    on(event: 'Room.timeline', listener: (event: MatrixEvent, room: Room | undefined) => void): void
    on(event: 'Room.name', listener: (room: Room) => void): void
    on(event: 'Room.avatar', listener: (room: Room) => void): void
    on(event: 'Room.member', listener: (event: MatrixEvent, member: RoomMember) => void): void
    on(event: 'room_timeline', listener: (event: MatrixEvent, room?: Room) => void): void
    on(event: 'accountData', listener: (event: MatrixEvent) => void): void
    on(event: 'Call.incoming', listener: (call: MatrixCall) => void): void
    on(event: 'Call.hangup', listener: (call: MatrixCall) => void): void
    on(event: 'Call.replaced', listener: (newCall: MatrixCall, oldCall: MatrixCall) => void): void
    on(
      event: 'crypto.verification.requested',
      listener: (request: { transactionId: string; userId: string; deviceId: string; methods: string[] }) => void
    ): void
    on(
      event: 'crypto.verification.finished',
      listener: (request: { transactionId: string; userId: string; deviceId: string }) => void
    ): void
    on(
      event: 'crypto.verification.cancelled',
      listener: (request: { transactionId: string; userId: string; deviceId: string; cancelReason?: string }) => void
    ): void
    on(
      event: 'crypto.verification.started',
      listener: (request: { transactionId: string; userId: string; deviceId: string }) => void
    ): void
    on(
      event: 'crypto.verification.ready',
      listener: (request: { transactionId: string; userId: string; deviceId: string; methods: string[] }) => void
    ): void
    on(event: string, listener: (...args: unknown[]) => void): void
    off(event: 'sync', listener: (state: string) => void): void
    off(event: 'room', listener: (room: Room) => void): void
    off(event: 'Room.timeline', listener: (event: MatrixEvent, room: Room | undefined) => void): void
    off(event: 'Room.name', listener: (room: Room) => void): void
    off(event: 'Room.avatar', listener: (room: Room) => void): void
    off(event: 'Room.member', listener: (event: MatrixEvent, member: RoomMember) => void): void
    off(event: 'room_timeline', listener: (event: MatrixEvent, room?: Room) => void): void
    off(event: 'accountData', listener: (event: MatrixEvent) => void): void
    off(event: 'Call.incoming', listener: (call: MatrixCall) => void): void
    off(event: 'Call.hangup', listener: (call: MatrixCall) => void): void
    off(event: 'Call.replaced', listener: (newCall: MatrixCall, oldCall: MatrixCall) => void): void
    off(
      event: 'crypto.verification.requested',
      listener: (request: { transactionId: string; userId: string; deviceId: string; methods: string[] }) => void
    ): void
    off(
      event: 'crypto.verification.finished',
      listener: (request: { transactionId: string; userId: string; deviceId: string }) => void
    ): void
    off(
      event: 'crypto.verification.cancelled',
      listener: (request: { transactionId: string; userId: string; deviceId: string; cancelReason?: string }) => void
    ): void
    off(
      event: 'crypto.verification.started',
      listener: (request: { transactionId: string; userId: string; deviceId: string }) => void
    ): void
    off(
      event: 'crypto.verification.ready',
      listener: (request: { transactionId: string; userId: string; deviceId: string; methods: string[] }) => void
    ): void
    off(event: string, listener: (...args: unknown[]) => void): void
    // Manager accessors (synapse-rust extensions)
    // 注：getDirectMessageManager/getDeviceManager/getKeyBackupManager/getDeviceKeysManager/
    // getCryptoKeysManager/getKeyVerificationManager 已由 SDK matrix-client-extensions.d.ts
    // 上浮强类型 getter，此处不再重复声明（避免弱类型 `?: unknown` 遮蔽 SDK 类型）。
    dmManager?: unknown
    getMediaQuotaManager?(): unknown
    quotaManager?: unknown
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
    // Report
    reportEvent(roomId: string, eventId: string, reason: string, explanation?: string): Promise<unknown>
    // Retention
    getServerRetention(): Promise<RetentionPolicy | null>
    getServerRetention(): Promise<Record<string, unknown>>
    // Client lifecycle
    stopClient(): void
  }

  // MatrixEvent 方法扩展

  // Room 方法扩展

  // RoomMember 方法扩展
  interface RoomMember {
    userId: string
    roomId: string
    name: string
    rawDisplayName: string
    avatarUrl: string | null
    membership: string
    powerLevel: number
    isDirect(): boolean
    getUserId(): string
    getRoomId(): string
    getName(): string
    getAvatarUrl(): string | null
    getMxcAvatarUrl(): string | null | undefined
    getDisplayName(): string | null
    getPowerLevel(): number
    getRevisedDisplayName(): string
    setDisplayName(name: string): Promise<void>
    setAvatar(avatar: string): Promise<void>
    changePowerLevel(delta: number): Promise<void>
    canKick(userId: string): boolean
    canBan(): boolean
    canRedact(): boolean
    canSendEvent(eventType: string): boolean
    isIgnored(): boolean
    getIgnoredUsers(): string[]
    ignore(): Promise<void>
    unignore(): Promise<void>
  }

  // User 类型
  interface User {
    userId: string
    displayName: string | null
    avatarUrl: string | null
    getUserId(): string
    getDisplayName(): string | null
    setDisplayName(name: string): Promise<void>
    getAvatarUrl(): string | null
    setAvatar(avatar: string): Promise<void>
  }

  // synapse-rust 特有：阅后即焚功能管理器
  // 官方 matrix-js-sdk 不包含此功能

  // synapse-rust 特有：在线状态管理器扩展
  // 官方 matrix-js-sdk 不包含此管理器接口

  // RoomState 类型

  // ==================== 搜索类型 ====================
  export interface SearchParams {
    next_batch?: string
    limit?: number
    before_limit?: number
    after_limit?: number
    include_profile?: boolean
  }

  export interface SearchResponse {
    results: SearchResult[]
    count: number
    next_batch?: string
  }

  // ==================== 同步类型 ====================
  export interface SyncParams {
    filter?: string | Filter
    since?: string
    full_state?: boolean
    set_presence?: 'online' | 'offline' | 'unavailable'
    timeout?: number
  }

  export interface SyncResponse {
    next_batch: string
    rooms?: {
      join?: Record<string, RoomData>
      invite?: Record<string, InvitedRoom>
      leave?: Record<string, LeftRoom>
    }
    presence?: PresenceUpdate[]
    account_data?: Record<string, unknown>
    to_device?: DeviceMessages[]
    device_lists?: DeviceLists
    device_one_time_keys_count?: Record<string, number>
    org_matrix_msc2656_unread_sticky_messages?: Record<string, number>
  }

  export interface RoomData {
    timeline?: TimelineData
    state?: StateData
    ephemeral?: EphemeralData
    account_data?: Record<string, unknown>
    unread_notifications?: UnreadNotifications
    summary?: RoomSummary
  }

  export interface TimelineData {
    events: MatrixEvent[]
    prev_batch?: string
    limited?: boolean
  }

  export interface StateData {
    events: MatrixEvent[]
  }

  export interface EphemeralData {
    events: MatrixEvent[]
  }

  export interface InvitedRoom {
    invite_state: {
      events: MatrixEvent[]
    }
  }

  export interface LeftRoom {
    timeline?: TimelineData
    state?: StateData
  }

  export interface PresenceUpdate {
    user_id: string
    presence: string
    last_active_ago?: number
    status_msg?: string
    currently_active?: boolean
  }

  export interface DeviceMessages {
    sender: string
    type: string
    content: unknown
  }

  export interface DeviceLists {
    changed?: string[]
    left?: string[]
  }

  export interface UnreadNotifications {
    highlight_count?: number
    total_count?: number
    unread_thread_notifications?: Record<string, UnreadNotifications>
  }

  // ==================== 分页类型 ====================

  export interface PaginatedMessages {
    chunk: MatrixEvent[]
    start: string
    end: string
    state?: MatrixEvent[]
  }

  // ==================== 过滤器类型 ====================

  // ==================== 事件关系类型 ====================
  export interface EventRelation {
    rel_type: 'm.annotation' | 'm.reference' | 'm.replace' | string
    event_id: string
    is_falling_back?: boolean
    'm.relates_to'?: {
      rel_type: string
      event_id: string
      [key: string]: unknown
    }
  }

  // ==================== 消息编辑类型 ====================
  export interface MessageEditContent {
    'm.new_content'?: {
      body: string
      msgtype: string
      [key: string]: unknown
    }
    'm.new_message'?: {
      body: string
      msgtype: string
      [key: string]: unknown
    }
    'm.relates_to'?: {
      rel_type: 'm.replace'
      event_id: string
    }
    body: string
    msgtype?: string
    [key: string]: unknown
  }

  // ==================== 回复类型 ====================
  export interface ReplyContent {
    'm.in_reply_to'?: {
      event_id: string
    }
    'm.relates_to'?: {
      rel_type: 'm.thread'
      event_id: string
      is_falling_back?: boolean
      'm.in_reply_to'?: {
        event_id: string
      }
    }
    body: string
    msgtype?: string
    [key: string]: unknown
  }

  // ==================== 线程类型 ====================
  export interface ThreadBundle {
    thread_id: string
    latest_event: MatrixEvent
    events: MatrixEvent[]
    unread_notification_count?: number
    num_latest?: number
    num_unread?: number
  }

  // ==================== 密钥备份类型 ====================

  // ==================== 设备管理类型 ====================

  // SDK-9: 设备更新请求（display_name ≤100 字符）

  export interface DeviceUpdate {
    device_id: string
    user_id: string
    content: unknown
  }

  export interface DeviceDeletion {
    device_id: string
    user_id: string
  }

  // ==================== 用户目录类型 ====================
  export interface UserDirectorySearchParams {
    term: string
    limit?: number
  }

  export interface UserDirectorySearchResponse {
    results: UserDirectoryResult[]
    limited?: boolean
  }

  export interface UserDirectoryResult {
    user_id: string
    display_name?: string
    avatar_url?: string
    avatar_mxc?: string
  }

  // ==================== 群组/社区类型 ====================
  export interface Group {
    groupId: string
    name: string
    avatarUrl: string
    shortDescription?: string
    longDescription?: string
    user?: GroupUser
    profile?: GroupProfile
  }

  export interface GroupUser {
    is_public: boolean
  }

  export interface GroupProfile {
    name?: string
    avatar_url?: string
    short_description?: string
    long_description?: string
  }

  // ==================== 第三方 API 类型 ====================
  export interface ThirdPartyProtocol {
    protocols: Record<string, ThirdPartyProtocolInstance[]>
  }

  export interface ThirdPartyProtocolInstance {
    instance_id: string
    desc: string
    icon?: string
    fields: Record<string, string>
  }

  export interface ThirdPartyUser {
    user_id: string
    medium: string
    url?: string
    threepid: string
  }

  export interface ThirdPartyLocation {
    alias: string
    description?: string
    icon?: string
    fields: Record<string, string>
  }
}

// ==================== SDK 子路径模块类型声明 ====================
// 清单 D.3: 移除 10 个仅含 extendMatrixClient() 桩声明的 declare module 块。
// extendMatrixClient 在 tjg 生产代码中零引用（sdk-compat.ts 不导出该函数），
// 这些增强块全是死代码。其中 credentials/message/profile/sending 4 个子路径
// 在 SDK package.json exports 中不存在，属于幻影声明；其余 6 个（account/auth/
// capabilities/room/media/presence）SDK 已提供真实类型，删除增强后 TS 自动回退。
