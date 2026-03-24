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
    R0 = '/_matrix/client/r0',
    IdentityPrefix_V2 = '/_matrix/identity/v2'
  }
  
  export enum Visibility {
    Public = 'public',
    Private = 'private'
  }
  
  export enum Preset {
    PrivateChat = 'private_chat',
    PublicChat = 'public_chat',
    TrustedPrivateChat = 'trusted_private_chat'
  }
  
  export enum PushRuleKind {
    Override = 'override',
    ContentSpecific = 'content',
    RoomSpecific = 'room',
    SenderSpecific = 'sender',
    Underride = 'underride'
  }
  
  export enum ReceiptType {
    Read = 'm.read',
    ReadPrivate = 'm.read.private',
    FullyRead = 'm.fully_read',
    DeliveryReceipt = 'm.d'
  }

  export enum NotificationCountType {
    Highlight = 'highlight',
    Total = 'total'
  }

  export enum RoomType {
    Cat = 'm.category',
    Space = 'm.space',
    Enums = 0
  }
  
  export enum EventType {
    RoomName = 'm.room.name',
    RoomTopic = 'm.room.topic',
    RoomAvatar = 'm.room.avatar',
    RoomMember = 'm.room.member',
    RoomMessage = 'm.room.message',
    RoomEncrypted = 'm.room.encrypted',
    Sticker = 'm.sticker',
    CallInvite = 'm.call.invite',
    CallAnswer = 'm.call.answer',
    CallHangup = 'm.call.hangup'
  }

  export enum TweakName {
    Highlight = 'highlight',
    Sound = 'sound'
  }

  export type PushRuleAction = string | { set_tweak: { tweak: TweakName; value: unknown } }
  export type EmptyObject = Record<string, never>
  
  // ==================== 接口补充 ====================
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
  }
  
  export interface SlidingSync {
    start(): void
    stop(): void
    registerExtension(extension: unknown): void
    on(event: string, callback: (...args: unknown[]) => void): void
  }
  
  export interface ICreateClientOpts {
    baseUrl: string
    accessToken?: string
    userId?: string
    deviceId?: string
    store?: unknown
    cryptoStore?: unknown
    idBaseUrl?: string
    useAuthorizationHeader?: boolean
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

  export interface ISendEventResponse {
    event_id: string
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
  export type PushRuleSet = {
    [k in PushRuleKind]?: IPushRule[]
  }

  export interface IPushRules {
    global: PushRuleSet
  }
  export interface IPusher {
    app_display_name: string
    app_id: string
    data: Record<string, unknown>
    device_display_name: string
    device_id: string
    push_provider: string
    kind: string
    pushkey: string
    lang?: string
  }
  export interface IPusherRequest {
    app_display_name?: string
    app_id?: string
    pushkey: string
    [key: string]: unknown
  }
  export interface IPushRule {
    rule_id: string
    enabled: boolean
    actions: unknown[]
    conditions?: IPushRuleCondition[]
    pattern?: string
  }
  export interface IPushRuleCondition {
    kind: string
    key?: string
    pattern?: string
  }

  // ==================== Event 和 Timeline 类型 ====================
  // 这些类型已在 SDK 中正确定义，此处提供补充
  export class TimelineWindow {
    constructor(client: MatrixClient, timelineSet: EventTimelineSet, opts?: unknown)
    paginate(direction: string, limit: number): Promise<boolean>
    getEvents(): MatrixEvent[]
  }
  
  export interface EventTimeline {
    static readonly FORWARDS: 'f'
    static readonly BACKWARDS: 'b'
    getEvents(): MatrixEvent[]
    getState(direction: 'f' | 'b'): RoomState | undefined
  }

  export interface TimelineWindow {
    load(limit: number, direction: string): Promise<boolean>
    paginate(dir: string, limit: number): Promise<boolean>
    getEvents(): MatrixEvent[]
  }

  // ==================== Voice ====================
  // Voice 类型的补充定义
  export enum VoiceEvent {
    StateChanged = 'StateChanged',
    NewSession = 'NewSession',
    SessionCreated = 'SessionCreated',
    SessionEnded = 'SessionEnded',
    UploadProgress = 'UploadProgress',
    UploadComplete = 'UploadComplete',
    UploadError = 'UploadError',
    VoiceUploaded = 'VoiceUploaded',
    VoiceDeleted = 'VoiceDeleted',
    VoiceConverted = 'VoiceConverted',
    VoiceOptimized = 'VoiceOptimized'
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

  // ==================== 错误和存储 ====================
  export class MatrixError extends Error {
    errcode?: string
    statusCode: number
    data: Record<string, unknown>
  }
  export class IndexedDBStore {
    constructor(opts: { indexedDB: IDBFactory; dbName: string; localStorage?: Storage })
    startup(): Promise<void>
  }
  export class LocalStorageCryptoStore {
    constructor(localStorage: Storage)
  }
  export function createClient(opts: ICreateClientOpts): MatrixClient
  // MatrixClient 接口扩展
  interface MatrixClient {
    isCryptoEnabled(): boolean
    getCrypto(): unknown
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
    getRoomsByUserId(userId: string): Room[]
    getInvitedRooms(): Room[]
    getJoinedRooms(): Room[]
    getAccountData(eventType: string): MatrixEvent | null
    setAccountData(eventType: string, content: unknown): Promise<void>
    getRoomState(roomId: string): RoomState | null
    getRoomMembers(roomId: string): RoomMember[]
    sendMessage(roomId: string, threadId: string | null, content: IContent, txnId?: string): Promise<ISendEventResponse>
    sendTextMessage(roomId: string, text: string, threadId?: string): Promise<ISendEventResponse>
    sendEvent(roomId: string, eventType: string, content: unknown, txnId?: string): Promise<ISendEventResponse>
    leave(roomId: string): Promise<void>
    invite(roomId: string, userId: string): Promise<void>
    kick(roomId: string, userId: string, reason?: string): Promise<void>
    ban(roomId: string, userId: string, reason?: string): Promise<void>
    unban(roomId: string, userId: string): Promise<void>
    setRoomEncryption(roomId: string, encryption: unknown): Promise<void>
    getSyncState(): string | null
    getRoomsNav(): unknown
    generateTxnId(): string
  }

  // MatrixEvent 方法扩展
  interface MatrixEvent {
    getId(): string
    getType(): string
    getSender(): string
    getTs(): number
    getRoomId(): string
    getOriginServerTs(): number
    getContent(): Record<string, unknown>
    getRaw(): Record<string, unknown>
    getStateKey(): string | undefined
    isState(): boolean
    isEncrypted(): boolean
    sender: unknown
    getAge(): number
    getTarget(): MatrixEvent
    reply(event: MatrixEvent, content: IContent): Promise<string>
    remove(): Promise<void>
    retry(): Promise<void>
    status: unknown
    localTimestamp: number
    direction: unknown
  }

  // Room 方法扩展
  interface Room {
    roomId: string
    name: string
    currentState: RoomState
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
    getAvatarUrl(): string
    getMxcAvatarUrl(): string | undefined
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
    getInvitedMemberCount(): number
    getJoinedMemberCount(): number
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
    avatarUrl: string
    membership: string
    powerLevel: number
    isDirect(): boolean
    getUserId(): string
    getRoomId(): string
    getName(): string
    getAvatarUrl(): string
    getMxcAvatarUrl(): string | undefined
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

  // RoomState 类型
  interface RoomState {
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
    "m.relates_to"?: {
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
      "m.in_reply_to"?: {
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
