/**
 * matrix-js-sdk 类型扩展
 * 提供官方 SDK 缺失的类型定义
 */
/// <reference types="vite/client" />

// ==================== 重新导出官方类型 ====================
export * from 'matrix-js-sdk'

declare module 'matrix-js-sdk' {
  // ==================== 补充 SDK 缺失的类型 ====================

  export const PendingEventOrdering: {
    readonly PendingFirst: 'pending_first'
    readonly Chronological: 'chronological'
    readonly Detached: 'detached'
  }

  export enum Method {
    Get = 'GET',
    Put = 'PUT',
    Post = 'POST',
    Delete = 'DELETE',
    Options = 'OPTIONS'
  }

  export enum ClientPrefix {
    V1 = '/_matrix/client/v1',
    V3 = '/_matrix/client/v3',
    R0 = '/_matrix/client/r0'
  }

  // Note: These types exist in matrix-js-sdk/@types/partials.ts but are not exported from main index
  // We re-export them here for convenience
  export const Visibility: {
    readonly Public: 'public'
    readonly Private: 'private'
  }
  export type Visibility = 'public' | 'private'

  export enum Preset {
    PrivateChat = 'private_chat',
    PublicChat = 'public_chat',
    TrustedPrivateChat = 'trusted_private_chat'
  }

  export const ReceiptType: {
    readonly Read: 'm.read'
    readonly ReadPrivate: 'm.read.private'
  }
  export type ReceiptType = 'm.read' | 'm.read.private'

  export const PushRuleKind: {
    readonly Override: 'override'
    readonly ContentSpecific: 'content'
    readonly RoomSpecific: 'room'
    readonly SenderSpecific: 'sender'
    readonly Underride: 'underride'
  }
  export type PushRuleKind = 'override' | 'content' | 'room' | 'sender' | 'underride'

  export enum NotificationCountType {
    Highlight = 'highlight',
    Total = 'total'
  }

  export enum RoomType {
    Space = 'm.space'
  }

  export enum Direction {
    Backward = 'b',
    Forward = 'f'
  }

  export enum EventType {
    RoomName = 'm.room.name',
    RoomTopic = 'm.room.topic',
    RoomAvatar = 'm.room.avatar',
    RoomMember = 'm.room.member',
    RoomMessage = 'm.room.message',
    Sticker = 'm.sticker',
    CallInvite = 'm.call.invite',
    CallAnswer = 'm.call.answer',
    CallHangup = 'm.call.hangup',
    RoomCreate = 'm.room.create',
    RoomJoinRules = 'm.room.join_rules',
    RoomPowerLevels = 'm.room.power_levels',
    RoomCanonicalAlias = 'm.room.canonical_alias',
    RoomGuestAccess = 'm.room.guest_access',
    RoomHistoryVisibility = 'm.room.history_visibility',
    RoomServerAcl = 'm.room.server_acl',
    RoomTombstone = 'm.room.tombstone',
    RoomPinnedEvents = 'm.room.pinned_events'
  }

  export enum TweakName {
    Highlight = 'highlight',
    Sound = 'sound'
  }

  export type PushRuleAction = string | { set_tweak: { tweak: TweakName; value: unknown } }
  export type EmptyObject = Record<string, never>

  // ==================== 接口补充 ====================
  // Note: ICreateRoomOpts exists in matrix-js-sdk/@types/requests.ts but is not exported from main index
  // We re-export it here for convenience
  export interface ICreateRoomOpts {
    room_alias_name?: string
    name?: string
    topic?: string
    visibility?: Visibility
    preset?: Preset
    creation_content?: Record<string, unknown>
    initial_state?: unknown[]
    invite?: string[]
    invite_3pid?: unknown[]
    is_direct?: boolean
    room_version?: string
    power_level_content_override?: Record<string, unknown>
    room_types?: string[]
  }

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

  export interface IPublicRoomsResponse {
    chunk: Array<{
      room_id: string
      name?: string
      topic?: string
      avatar_url?: string
      joined_members: number
      world_readable: boolean
      guest_can_join: boolean
      canonical_alias?: string
    }>
    next_batch?: string
    prev_batch?: string
    total_room_count_estimate?: number
  }

  export interface MSC3575RoomData {
    name?: string
    notification_count?: number
    highlight_count?: number
    initial?: boolean
    limited?: boolean
    is_dm?: boolean
    prev_batch?: string | null
    timeline?: unknown[]
    state?: Record<string, unknown>
    summary?: Record<string, unknown>
    [key: string]: unknown
  }

  export class SlidingSync {
    constructor(
      proxyBaseUrl: string,
      lists: Map<string, unknown>,
      roomSubscriptionInfo: Record<string, unknown>,
      client: unknown,
      timeoutMS: number
    )
    start(): void
    stop(): void
    registerExtension(extension: unknown): void
    on(
      event: 'SlidingSync.Lifecycle',
      callback: (state: SlidingSyncState, resp: MSC3575SlidingSyncResponse | null, err?: Error) => void
    ): void
    on(event: 'SlidingSync.RoomData', callback: (roomId: string, roomData: MSC3575RoomData) => void): void
    on(event: string, callback: (...args: unknown[]) => void): void
    off(
      event: 'SlidingSync.Lifecycle',
      callback: (state: SlidingSyncState, resp: MSC3575SlidingSyncResponse | null, err?: Error) => void
    ): void
    off(event: 'SlidingSync.RoomData', callback: (roomId: string, roomData: MSC3575RoomData) => void): void
    off(event: string, callback: (...args: unknown[]) => void): void
    setListRanges(listName: string, ranges: number[][]): void
    getList(
      listName: string
    ):
      | { rooms: string[]; setSort: (sort: string[]) => void; setFilters: (filters: Record<string, unknown>) => void }
      | undefined
    subscribeToRoom(roomId: string, opts?: { timelineLimit?: number; invite?: boolean }): void
    unsubscribeFromRoom(roomId: string): void
    getSyncToken(): string | null
    getRoom(roomId: string): MSC3575RoomData | null
  }

  export interface ICreateClientOpts {
    baseUrl: string
    idBaseUrl?: string
    accessToken?: string
    userId?: string
    deviceId?: string
    fetchFn?: typeof globalThis.fetch
    store?: unknown
    scheduler?: unknown
    cryptoStore?: unknown
    sessionStore?: unknown
    presence?: boolean
    useAuthorizationHeader?: boolean
    cryptoCallbacks?: unknown
    localTimeoutMs?: number
    useLazyLoading?: boolean
    allowInsecureHttp?: boolean
    pendingEventOrdering?: PendingEventOrdering
    unstableClientRelationAggregation?: boolean
    verificationCallbacks?: unknown
    deviceToVerify?: unknown
    slidingSync?: SlidingSync
  }

  export interface LoginResponse {
    user_id: string
    access_token: string
    device_id: string
    home_server?: string
    refresh_token?: string
    expires_in?: number
  }

  export interface RegisterResponse {
    user_id: string
    access_token?: string
    device_id?: string
    refresh_token?: string
    expires_in_ms?: number
  }

  export interface IRequestTokenResponse {
    sid: string
    submit_url?: string
    expires_in?: number
  }

  export interface IEventRelation {
    rel_type: string
    event_id: string
    include_threads?: boolean
  }

  // Note: ISendEventResponse exists in matrix-js-sdk/@types/requests.ts but is not exported from main index
  // We re-export it here for convenience
  export interface ISendEventResponse {
    event_id: string
  }

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

  export interface MatrixCall {
    callId: string
    roomId: string
    isVideo: boolean
    peerConn?: RTCPeerConnection
    on(event: string, callback: (...args: unknown[]) => void): void
    off(event: string, callback: (...args: unknown[]) => void): void
    hangup(reason?: string): void
    answer(stream?: MediaStream, video?: boolean): void
    placeCall(stream: MediaStream, video?: boolean): Promise<void>
    setLocalVideoMuted(muted: boolean): void
    setLocalAudioMuted(muted: boolean): void
    setScreensharingEnabled(enabled: boolean, opts?: { audio: boolean }): Promise<boolean>
  }

  export interface VoIPHandler {
    calls: Record<string, MatrixCall>
  }

  export interface IContent {
    body: string
    msgtype?: string
    [key: string]: unknown
  }

  export interface IMemberEvent {
    membership?: string
    avatar_url?: string
    displayname?: string
  }

  // ==================== OIDC ====================
  export function generateOidcAuthorizationUrl(config: unknown): Promise<{ url: string; state: string }>
  export function discoverAndValidateOIDCIssuerWellKnown(url: string): Promise<unknown>
  export function completeAuthorizationCodeGrant(code: string, redirectUri: string): Promise<{ access_token: string }>
  export interface OidcClientConfig {
    issuer: string
    clientId: string
    redirectUri: string
  }
  export function generateScope(scopes: string[]): string

  // ==================== Push ====================
  // 这些类型在 SDK `@types/PushRules` 中已有规范定义，此处显式重声明以
  // 保证在本 augmentation 场景下（declare module 'matrix-js-sdk' 覆盖了
  // 主入口 export * 的部分解析）能被 `import { IPushRule } from 'matrix-js-sdk'`
  // 找到。字段形状与 SDK canonical（`default: boolean` required）保持一致。
  export type PushRuleSet = {
    [k in PushRuleKind]?: IPushRule[]
  }

  export interface IPushRuleCondition {
    kind: string
    key?: string
    pattern?: string
    is?: string
  }

  // Note: Push types exist in matrix-js-sdk/@types/PushRules.ts but are not exported from main index
  // We re-export them here for convenience
  export interface IPushRule {
    rule_id: string
    default: boolean
    enabled: boolean
    actions: PushRuleAction[]
    conditions?: IPushRuleCondition[]
    pattern?: string
  }

  export interface IPushRules {
    global: PushRuleSet
    device?: PushRuleSet
  }

  export interface IPusher {
    app_display_name: string
    app_id: string
    data: {
      format?: string
      url?: string
      brand?: string
      [key: string]: unknown
    }
    device_display_name: string
    kind: 'http' | string
    lang: string
    profile_tag?: string
    pushkey: string
    enabled?: boolean | null
    device_id?: string | null
  }

  export interface IPusherRequest extends Omit<IPusher, 'device_id'> {
    append?: boolean
  }

  // ==================== Event 和 Timeline 类型 ====================
  // 这些类型已在 SDK 中正确定义，此处提供补充
  export class TimelineWindow {
    constructor(client: MatrixClient, timelineSet: EventTimelineSet, opts?: unknown)
    paginate(direction: string, limit: number): Promise<boolean>
    getEvents(): MatrixEvent[]
  }

  export interface EventTimeline {
    getEvents(): MatrixEvent[]
    getState(direction: 'f' | 'b'): RoomState | undefined
    getPaginationToken(direction: 'f' | 'b'): string | null
    getNeighboringTimeline(direction: 'f' | 'b'): EventTimeline | null
    getTimelineSet(): EventTimelineSet
  }

  export interface TimelineWindow {
    load(limit: number, direction: string): Promise<boolean>
    paginate(dir: string, limit: number): Promise<boolean>
    getEvents(): MatrixEvent[]
  }

  // ==================== Voice ====================
  // synapse-rust 特有：语音消息功能扩展
  // 官方 matrix-js-sdk 不包含这些类型
  export enum VoiceEvent {
    StateChanged = 'StateChanged',
    NewSession = 'NewSession',
    SessionCreated = 'SessionCreated',
    SessionEnded = 'SessionEnded',
    UploadProgress = 'UploadProgress',
    UploadComplete = 'UploadComplete',
    UploadError = 'UploadError',
    VoiceUploaded = 'VoiceUploaded',
    VoiceDeleted = 'VoiceDeleted'
  }

  export interface VoiceConfig {
    enabled: boolean
    maxDuration?: number
    max_duration_ms?: number
    max_size_bytes?: number
    supported_formats?: string[]
    sampleRate?: number
    channels?: number
  }

  export interface VoiceMessageUploadParams {
    roomId: string
    file: File | Blob | ArrayBuffer
    filename?: string
    duration?: number
    size?: number
    mimeType?: string
  }

  export interface VoiceMessageUploadResult {
    eventId: string
    message_id?: string
    url: string
    duration: number
    size: number
  }

  export interface VoiceMessage {
    eventId: string
    url: string
    duration: number
    size: number
    waveform?: number[]
  }

  export interface VoiceMessageInfo {
    eventId: string
    duration: number
    waveform?: number[]
    mimeType?: string
    size?: number
  }

  export interface VoiceStats {
    totalDuration: number
    messageCount: number
    totalSize: number
  }

  export interface VoiceConvertParams {
    inputUrl: string
    outputFormat?: string
    bitrate?: number
  }

  export interface VoiceConvertResult {
    message_id?: string
    event_id?: string
    url: string
    duration?: number
  }

  export interface VoiceOptimizeParams {
    inputUrl: string
    quality?: number
    targetSize?: number
  }

  export interface VoiceOptimizeResult {
    message_id?: string
    event_id?: string
    url: string
    duration?: number
    size?: number
  }

  export interface VoiceTranscriptionParams {
    roomId: string
    eventId: string
    lang?: string
  }

  export interface VoiceTranscriptionResult {
    text: string
    segments?: Array<{ start: number; end: number; text: string }>
  }

  // VoiceMessageManager 接口（基于 SDK 实际接口）
  export interface VoiceMessageManager {
    on(event: VoiceEvent.UploadComplete, listener: (roomId: string, result: VoiceMessageUploadResult) => void): void
    on(event: VoiceEvent.UploadError, listener: (roomId: string, error: Error) => void): void
    on(event: VoiceEvent, listener: (...args: unknown[]) => void): void
    uploadVoiceMessage(params: VoiceMessageUploadParams): Promise<VoiceMessageUploadResult>
    getVoiceMessageInfo(roomId: string, eventId: string): Promise<VoiceMessageInfo | null>
    deleteVoice(roomId: string, eventId: string): Promise<void>
    getUserVoices(roomId: string, userId: string): Promise<VoiceMessage[]>
    getRoomVoices(roomId: string): Promise<VoiceMessage[]>
    getVoiceStats(roomId: string): Promise<VoiceStats>
    getUserStats(roomId: string, userId: string): Promise<VoiceStats>
    convertVoiceMessage(params: VoiceConvertParams): Promise<VoiceConvertResult>
    optimizeVoiceMessage(params: VoiceOptimizeParams): Promise<VoiceOptimizeResult>
    transcribeVoiceMessage(params: VoiceTranscriptionParams): Promise<VoiceTranscriptionResult>
    getConfig(): VoiceConfig | undefined
    removeAllListeners(event?: VoiceEvent): void
  }

  // synapse-rust 特有：输入状态管理器扩展
  // 官方 matrix-js-sdk 不包含此管理器接口
  export interface TypingManager {
    startTyping(roomId: string, options?: { timeout?: number }): Promise<void>
    stopTyping(roomId: string): Promise<void>
    getTypingUsers(roomId: string): Promise<Array<{ userId: string; timeout: number }>>
    isUserTyping(roomId: string, userId: string): Promise<boolean>
    clearAllTimers(): void
    start(): void
    stop(): void
  }

  // synapse-rust 特有：已读回执管理器扩展
  // 官方 matrix-js-sdk 不包含此管理器接口
  export interface ReadReceiptsManager {
    sendReadReceipt(roomId: string, eventId: string): Promise<void>
    setReadMarkers(roomId: string, eventId: string, fullyReadEventId?: string): Promise<void>
    setReadMarker(roomId: string, eventId: string): Promise<void>
    getReceipt(
      roomId: string,
      eventId: string
    ): Array<{ eventId: string; ts: number; userId: string; data?: Record<string, unknown> }>
    getReadMarkers(roomId: string): {
      m_read?: string
      m_fully_read?: string
    }
  }

  // ==================== 错误和存储 ====================
  export class MatrixError extends Error {
    errcode?: string
    httpStatus?: number
    data: Record<string, unknown>
  }
  export enum SlidingSyncState {
    RequestFinished = 'FINISHED',
    Complete = 'COMPLETE'
  }
  export enum SlidingSyncEvent {
    RoomData = 'SlidingSync.RoomData',
    Lifecycle = 'SlidingSync.Lifecycle'
  }
  export interface MSC3575SlidingSyncResponse {
    pos: string
    lists: Record<string, unknown>
    rooms: Record<string, MSC3575RoomData>
    extensions: Record<string, unknown>
  }
  export class IndexedDBStore {
    constructor(opts: { indexedDB: IDBFactory; dbName: string; localStorage?: Storage })
    startup(): Promise<void>
  }
  export class MemoryStore {
    constructor(opts: { localStorage?: Storage })
  }
  export class LocalStorageCryptoStore {
    constructor(localStorage: Storage)
  }
  export function createClient(opts: ICreateClientOpts): MatrixClient
  // MatrixClient 接口扩展
  interface MatrixClient {
    readonly deviceId: string | null
    http: {
      authedRequest<T = unknown>(
        method: string,
        path: string,
        queryParams?: Record<string, string>,
        body?: object
      ): Promise<T>
      authedRequest<T = unknown>(
        opts: Record<string, unknown>,
        method: string,
        path: string,
        queryParams?: Record<string, unknown>,
        data?: unknown
      ): Promise<T>
      request<T = unknown>(
        method: string,
        path: string,
        queryParams?: Record<string, unknown>,
        data?: unknown,
        opts?: {
          prefix?: string
          headers?: Record<string, string>
        }
      ): Promise<T>
    }
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
    getAccountManager(): {
      submitEmailToken(sid: string, clientSecret: string, token: string): Promise<Record<string, unknown>>
    }
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
    deleteDevice(deviceId: string, auth?: Record<string, unknown>): Promise<void>
    deleteMultipleDevices(deviceIds: string[], auth?: Record<string, unknown>): Promise<void>
    getThreePids(): Promise<{
      threepids: Array<{ medium: string; address: string; validated_at: number; added_at: number }>
    }>
    addThreePidOnly(body: Record<string, unknown>, bind?: boolean): Promise<void>
    bindThreePid(body: Record<string, unknown>, bind?: boolean): Promise<void>
    deleteThreePid(
      params: { medium: string; address: string },
      idServer?: string
    ): Promise<{ id_server_unbind_result: string }>
    unbindThreePid(
      params: { medium: string; address: string },
      idServer?: string
    ): Promise<{ id_server_unbind_result: string }>
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
    upgradeRoom(roomId: string, version: string): Promise<string>
    createAlias(alias: string, roomId: string): Promise<void>
    deleteAlias(alias: string): Promise<void>
    getEventContext(roomId: string, eventId: string, opts?: Record<string, unknown>): Promise<Record<string, unknown>>
    setUserPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void>
    setPowerLevel(roomId: string, userId: string, powerLevel: number, event?: MatrixEvent): Promise<void>
    scrollback(room: Room, limit: number): Promise<Room>
    redact(roomId: string, eventId: string, txnId?: string, opts?: { reason?: string }): Promise<{ event_id: string }>
    getVisibleRooms(): Room[]
    syncOnce(opts?: Record<string, unknown>): Promise<void>
    getBurnAfterReadManager(): BurnAfterReadManager
    oidcUserInfo(): Promise<Record<string, unknown>>
    isCrossSigningReady(): Promise<boolean>
    isSecretStorageReady(): Promise<boolean>
    requestVerificationDM(userId: string, deviceId: string, methods?: string[]): Promise<unknown>
    requestVerification(userId: string, methods?: string[]): Promise<unknown>
    getVerificationRequestsToDevice(userId: string): unknown[]
    setDeviceVerified(userId: string, deviceId: string, verified?: boolean): Promise<void>
    setDeviceBlocked(userId: string, deviceId: string, blocked?: boolean): Promise<void>
    setDeviceKnown(userId: string, deviceId: string, known?: boolean): Promise<void>
    checkKeyBackup(): Promise<unknown>
    isKeyBackupKeyBackupEnabled(): Promise<boolean>
    getKeyBackupInfo(): Promise<unknown>
    getPresenceManager(): PresenceManager | null
    checkDeviceTrust(userId: string, deviceId: string): Promise<unknown>
    getStoredDevicesForUser(userId: string): Promise<unknown[]>
    getRoomStateEvent(roomId: string, eventType: string, stateKey: string): Promise<Record<string, unknown>>
    getServerRetention(): Promise<RetentionPolicy | null>
    sync(options: Record<string, unknown>): Promise<void>
    on(event: 'sync', listener: (state: string) => void): void
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
  }

  // MatrixEvent 方法扩展
  export class MatrixEvent {
    getId(): string | null
    getType(): string
    getSender(): string | null
    getTs(): number
    getRoomId(): string
    getOriginServerTs(): number
    getContent(): Record<string, unknown>
    getRaw(): Record<string, unknown>
    getStateKey(): string | null
    isState(): boolean
    isEncrypted(): boolean
    sender: RoomMember | null
    getAge(): number
    getTarget(): MatrixEvent
    reply(event: MatrixEvent, content: IContent): Promise<string>
    remove(): Promise<void>
    retry(): Promise<void>
    getRelation(): { rel_type?: string; event_id?: string } | undefined
    getAssociatedId(): string | null
    status: unknown
    localTimestamp: number
    direction: unknown
  }

  // Room 方法扩展
  export interface EventTimelineSet {
    getLiveTimeline(): EventTimeline
    getEvents(): MatrixEvent[]
  }

  export interface Room {
    roomId: string
    name: string
    topic: string
    currentState: RoomState
    getUnfilteredTimelineSet(): EventTimelineSet
    timeline: MatrixEvent[]
    liveTimeline: EventTimeline | null
    oldState: RoomState
    newState: RoomState
    summary: unknown
    storageToken: string | null
    accountData: Map<string, MatrixEvent>
    tags: Map<string, unknown>
    getMember(userId: string): RoomMember | null
    getMembers(): RoomMember[]
    getJoinedMembers(): RoomMember[]
    getName(): string
    getAvatarUrl(baseUrl?: string, width?: number, height?: number, resizeMethod?: string): string
    getMxcAvatarUrl(): string | null
    getCanonicalAlias(): string | null
    getAltAliases(): string[]
    getHistoryVisibility(): string
    getGuestAccess(): string
    getJoinRule(): string
    getLastActiveTimestamp(): number
    getMemberCount(): number
    isSpaceRoom(): boolean
    isDirect(): boolean
    isEncrypted(): boolean
    isFederated(): boolean
    getTypingUsers(): string[]
    getInvitedMemberCount(): number
    getJoinedMemberCount(): number
    canInvite(userId: string): boolean
    getThread(eventId: string): unknown
    getThreads(): unknown[]
    getLiveTimeline(): EventTimeline
    getPendingEvents(): MatrixEvent[]
    getUser(userId: string): User | null
    getAccountData(type: string): MatrixEvent | null
    setAccountData(type: string, content: unknown): Promise<void>
    addEventsToTimeline(eventIds: string[], options: { forward: boolean; roomState: boolean }): void
    applyEvent(event: MatrixEvent): void
    addEvent(event: MatrixEvent, forward: boolean): void
    removeEvent(eventId: string): void
    findEventById(eventId: string): MatrixEvent | null
    getEventTimeline(timelineSet: unknown, eventId: string): Promise<unknown>
    getMessages(options: { before?: string; after?: string; limit: number; direction: string }): Promise<unknown>
    createRoom(options: unknown): Promise<{ room_id: string }>
    sendMessage(content: IContent): Promise<ISendEventResponse>
    sendTextMessage(text: string): Promise<ISendEventResponse>
    sendEvent(eventType: string, content: unknown): Promise<ISendEventResponse>
    leave(): Promise<void>
    invite(userId: string): Promise<void>
    kick(userId: string, reason?: string): Promise<void>
    ban(userId: string, reason?: string): Promise<void>
    unban(userId: string): Promise<void>
    updateBaseIcons(icon: string | null): Promise<void>
    setName(name: string): Promise<void>
    setAvatar(avatar: string): Promise<void>
    setTopic(topic: string): Promise<void>
    setPowerLevels(powerLevels: unknown): Promise<void>
    updateMyMembership(membership: string): void
    getMyMembership(): string
    recalc(): void
    getEventReadUpTo(userId: string, unthreaded?: boolean): string | null
    hasUserReadEvent(userId: string, eventId: string): boolean
    getUnreadNotificationCount(type?: NotificationCountType): number | undefined
    getUnreadCountForEventContext(type: NotificationCountType | undefined, event: MatrixEvent): number
    getRoomUnreadNotificationCount(type?: NotificationCountType): number
    getThreadUnreadNotificationCount(threadId: string, type?: NotificationCountType): number
    setThreadUnreadNotificationCount(threadId: string, type: NotificationCountType, count: number): void
    setUnreadNotificationCount(type: NotificationCountType, count: number): void
    setUnread(type: NotificationCountType, count: number): void
  }

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
  export interface BurnAfterReadManager {
    enableBurn(roomId: string, burnAfterMs?: number): Promise<{ enabled: boolean; burn_after_ms: number }>
    disableBurn(roomId: string): Promise<{ enabled: boolean; burn_after_ms: number }>
    getBurnSettings(roomId: string): Promise<{ enabled: boolean; burn_after_ms: number }>
    isBurnEnabled(roomId: string): Promise<boolean>
    getPendingBurns(roomId: string): Promise<Array<{ event_id: string; created_at: number; delete_at: number }>>
    markBurnRead(roomId: string, eventId: string): Promise<{ event_id: string; marked: boolean }>
    cancelBurn(roomId: string, eventId: string): Promise<{ event_id: string; cancelled: boolean }>
    setBurnConfig(defaultBurnMs: number): Promise<{ default_burn_ms: number }>
    getBurnStats(): Promise<{ total_burned: number; total_pending: number; rooms_with_burn_enabled: number }>
    sendMessage(params: Record<string, unknown>): Promise<{ event_id: string; expires_in: number; expires_at: number }>
    burnMessage(eventId: string): Promise<void>
    extendBurnTime(eventId: string, additionalTime: number): Promise<void>
    on(event: string, listener: (...args: unknown[]) => void): void
    off(event: string, listener: (...args: unknown[]) => void): void
    start(): void
    stop(): void
  }

  // synapse-rust 特有：在线状态管理器扩展
  // 官方 matrix-js-sdk 不包含此管理器接口
  export interface PresenceManager {
    setPresence(userId: string, presence: string, statusMsg?: string): Promise<void>
    getPresence(
      userId: string
    ): Promise<{ presence: string; status_msg?: string; last_active_ago?: number; currently_active?: boolean }>
    subscribeToPresence(userIds: string[]): Promise<unknown>
    unsubscribeFromPresence(userIds: string[]): Promise<void>
    getPresenceList(userId: string): Promise<unknown>
  }

  // RoomState 类型
  export class RoomState {
    roomId: string
    name: string
    avatarUrl: string | null
    getMember(userId: string): RoomMember | null
    getMembers(): RoomMember[]
    getJoinRule(): string
    getGuestAccess(): string
    getHistoryVisibility(): string
    getCanonicalAlias(): string | null
    getAltAliases(): string[]
    getPowerLevels(): unknown
    getLiveTimeline(): unknown
    getStateEvents(eventType: string): MatrixEvent[]
    getStateEvents(eventType: string, stateKey: string): MatrixEvent | null
  }

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

  export interface SearchResult {
    rank: number
    result: MatrixEvent
    context?: {
      before_limit: number
      after_limit: number
      event_id: string
      room_id: string
      start?: string
      end?: string
    }
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

  export interface RoomSummary {
    'm.joined_member_count'?: number
    'm.invited_member_count'?: number
    'm.heroes'?: string[]
    'm.joined_member_count'?: number
    'm.skipped_state_events'?: number
  }

  // ==================== 分页类型 ====================
  export interface PaginationParams {
    dir: 'b' | 'f'
    limit?: number
    from?: string
    filter?: Filter
  }

  export interface PaginatedMessages {
    chunk: MatrixEvent[]
    start: string
    end: string
    state?: MatrixEvent[]
  }

  // ==================== 过滤器类型 ====================
  export interface Filter {
    limit?: number
    not_senders?: string[]
    not_types?: string[]
    senders?: string[]
    types?: string[]
    rooms?: string[]
    not_rooms?: string[]
    contains_lazy_loadable_terms?: boolean
    include_redundant_members?: boolean
    use_lazy_load_members?: boolean
    event_format?: 'client' | ' federation'
    presence?: FilterPresence
    account_data?: FilterAccountData
    room?: FilterRoom
  }

  export interface FilterPresence {
    limit?: number
    not_senders?: string[]
    not_types?: string[]
    senders?: string[]
    types?: string[]
  }

  export interface FilterAccountData {
    limit?: number
    not_send_types?: string[]
    not_types?: string[]
    send_types?: string[]
    types?: string[]
  }

  export interface FilterRoom {
    limit?: number
    not_senders?: string[]
    not_types?: string[]
    senders?: string[]
    types?: string[]
    rooms?: string[]
    not_rooms?: string[]
    account_data?: FilterRoomAccountData
    ephemeral?: FilterRoomEphemeral
    include_default_filters?: boolean
    state?: FilterRoomState
    timeline?: FilterRoomTimeline
  }

  export interface FilterRoomAccountData {
    limit?: number
    not_send_types?: string[]
    not_types?: string[]
    send_types?: string[]
    types?: string[]
  }

  export interface FilterRoomEphemeral {
    limit?: number
    not_send_types?: string[]
    not_types?: string[]
    send_types?: string[]
    types?: string[]
  }

  export interface FilterRoomState {
    lazy_load_members?: boolean
    include_redundant_members?: boolean
    not_senders?: string[]
    not_types?: string[]
    senders?: string[]
    types?: string[]
  }

  export interface FilterRoomTimeline {
    limit?: number
    not_senders?: string[]
    not_types?: string[]
    senders?: string[]
    types?: string[]
    include?: string[]
    raw_types?: string[]
  }

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
  export interface KeyBackupSession {
    first_message_index: number
    forwarded_count: number
    is_verified: boolean
    message_count: number
    olm_key: string
  }

  export interface KeyBackupRoomSessions {
    sessions: Record<string, KeyBackupSession>
  }

  export interface KeyBackupInfo {
    version: string
    algorithm: string
    auth_data: unknown
    count?: number
    etag?: string
  }

  // ==================== 设备管理类型 ====================
  export interface Device {
    device_id: string
    user_id: string
    display_name?: string
    last_seen_ip?: string
    last_seen_ts?: number
    last_seen_user_agent?: string
    known_at?: number
  }

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
