/**
 * matrix-js-sdk 类型扩展 —— MatrixClient 方法面
 *
 * 从 `matrix-js-sdk-augmentations.d.ts` 拆出（原文件 686 行、MatrixClient 独占 234 行）。
 * `declare module 'matrix-js-sdk'` 在多文件间由 TS 声明合并，因此这里只搬运、不新增语义。
 */
/// <reference types="vite/client" />

import type { Room } from 'matrix-js-sdk'

declare module 'matrix-js-sdk' {
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
    // W-06 收口（2026-10-10）：此处原有的两行 `getSsoLoginUrl(redirectUrl, deviceName?, …)`
    // 是**错误的重复声明** —— SDK 早已声明该方法，且第二参是
    // `loginType`（**会拼进 URL 路径段**，默认 "sso"）而不是设备名。
    // 该错误命名直接诱导调用方传 `'Tjg Client'`，拼出
    // `/_matrix/client/v3/login/Tjg%20Client/redirect/…` ⇒ **404**
    // （后端只注册 `/login/sso/redirect` 与 `/login/sso/redirect/{cas|saml}`）。
    // 故**删除**这两行，直接用 SDK 的真实声明（形如
    // `(redirectUrl: string, loginType?: string, idpId?: string, action?: SSOAction): string`；
    // SDK 侧的 `idpId` 已按 §9.14.3 W-06 删除，随下次重打包生效）。
    // SDK 已声明 callEventHandler?: CallEventHandler（client.d.ts:354），
    // 此处不再重复声明 voipHandler / getCallHandler（SDK 中不存在，是幻影声明）。
    createCall(roomId: string, threadId?: string, opts?: { audio: boolean; video: boolean }): MatrixCall | null
    // 说明：SDK 没有 `client.crypto` 属性（只有 getCrypto()），
    // 也没有 getCrossSigningInfo / getStoredDevice / getUserDevices / getKeyBackupEnabled。
    // 这些幻影声明已移除——保留会让 vue-tsc 通过而运行时 undefined。
    // `getCrypto()` 不再重复声明：SDK 已声明 `getCrypto(): CryptoApi | undefined`；
    // 曾误写为 `| null`（CryptoApi 未导入时被 any 掩盖），导入后暴露为返回值重载冲突（TS2322）。
    createFilter(filter: unknown): Promise<unknown>
    getRoom(roomId: string): Room | null
    getRooms(): Room[]
    getUser(userId: string): User | null
    getUserId(): string | null
    getDeviceId(): string | null
    createRoom(opts: ICreateRoomOpts): Promise<{ room_id: string }>
    createRoom(options: ICreateRoomOpts): Promise<{ room_id: string }>
    setRoomName(roomId: string, name: string): Promise<void>
    setRoomTopic(roomId: string, topic: string): Promise<void>
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
    sendMessage(roomId: string, threadId: string | null, content: IContent, txnId?: string): Promise<ISendEventResponse>
    sendTextMessage(roomId: string, text: string, threadId?: string): Promise<ISendEventResponse>
    sendHtmlMessage(roomId: string, txnId: string, body: string, html: string): Promise<ISendEventResponse>
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
    getRoomDirectoryVisibility(roomId: string): Promise<{ visibility: 'public' | 'private' }>
    setRoomDirectoryVisibility(roomId: string, visibility: 'public' | 'private'): Promise<void>
    logout(): Promise<void>
    startClient(opts?: Record<string, unknown>): Promise<void>
    kick(roomId: string, userId: string, reason?: string): Promise<void>
    ban(roomId: string, userId: string, reason?: string): Promise<void>
    unban(roomId: string, userId: string): Promise<void>
    getSyncState(): string | null
    getAccessToken(): string | null
    setAccessToken(token: string): void
    getDomain(): string
    setDisplayName(name: string): Promise<void>
    setAvatarUrl(url: string): Promise<void>
    // mxcUrlToHttp 由 SDK 本体声明（2026-11-05 SDK-1 补齐），此处不再 augmentation。
    // 应用层仍统一走 src/services/matrix/media/mxcUrl.ts 的 resolveMxcToHttp()（含回退）。
    setPresence(presence: string, opts?: Record<string, unknown>): Promise<void>
    setPresence(opts: { presence: string; status_msg?: string }): Promise<void>
    getProfileInfo(userId: string): Promise<{ displayname?: string; avatar_url?: string }>
    getUserProfile(userId: string): Promise<{ displayname?: string; avatar_url?: string }>
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
    forget(roomId: string): Promise<void>
    upgradeRoom(roomId: string, version: string): Promise<{ replacement_room: string }>
    createAlias(alias: string, roomId: string): Promise<void>
    deleteAlias(alias: string): Promise<void>
    getEventContext(roomId: string, eventId: string, opts?: Record<string, unknown>): Promise<Record<string, unknown>>
    setPowerLevel(roomId: string, userId: string, powerLevel: number, event?: MatrixEvent): Promise<void>
    scrollback(room: Room, limit: number): Promise<Room>
    getVisibleRooms(): Room[]
    // getBurnAfterReadManager now available in SDK (matrix-js-sdk@40.2.0+)
    // getSpaceManager now available in SDK
    // getKeyRotationManager now available in SDK
    // getDehydratedDeviceManager now available in SDK
    // getPresenceManager now available in SDK
    // getDeviceKeysManager now available in SDK
    // getCryptoKeysManager now available in SDK
    // getKeyVerificationManager 已随死后端面（keys/device_signing/verify_*）一并删除
    // getTypingManager now available in SDK
    // getReadReceiptsManager now available in SDK
    // Manager accessors (synapse-rust extensions)
    // 注：getDirectMessageManager/getDeviceManager/getKeyBackupManager/getDeviceKeysManager/
    // getCryptoKeysManager 已由 SDK matrix-client-extensions.d.ts 声明（getKeyVerificationManager 已删除）
    // 上浮强类型 getter，此处不再重复声明（避免弱类型 `?: unknown` 遮蔽 SDK 类型）。
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
    // Retention
    getServerRetention(): Promise<RetentionPolicy | null>
    getServerRetention(): Promise<Record<string, unknown>>
    // Client lifecycle
    stopClient(): void
  }

  // MatrixEvent 方法扩展

  // Room 方法扩展

  // RoomMember 方法扩展
}
