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
    invite?: string[]
    room_version?: string
    initial_state?: unknown[]
    is_direct?: boolean
    encryption?: boolean
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
}
