# `as unknown as` 类型债务审计报告

> 生成时间: 2026-08-01
> 命令: `grep -rn "as unknown as" src/services/matrix --include="*.ts" | grep -v "__tests__" | grep -v "\.test\."`

## 总体统计

| 指标 | 数值 |
|------|------|
| 总数 | **189** |
| 涉及文件 | **~45** |
| 最高单文件 | MatrixCryptoService.ts (28) |

## 按文件分布

| 文件 | 数量 | 优先级 | 原因分类 | 建议解决方案 |
|------|------|--------|----------|--------------|
| MatrixCryptoService.ts | 28 | P0 | A - SDK 返回类型过于宽泛 | 扩展 KeyBackupManager 类型 |
| RoomService.ts | 13 | P0 | A - Admin Manager 返回类型宽泛 | 扩展 AdminRoomManager 类型 |
| MatrixVerificationService.ts | 10 | P1 | A - Verification Manager 类型宽泛 | 扩展 VerificationManager 类型 |
| BackgroundUpdateService.ts | 10 | P1 | A - Admin Manager 类型宽泛 | 复用 AdminRoomManager 类型 |
| MatrixQrLoginSdkService.ts | 9 | P1 | C - SDK 方法缺失 | 扩展 AuthManager |
| UserService.ts | 9 | P0 | A - Admin Manager 类型宽泛 | 扩展 AdminUserManager 类型 |
| MatrixDeviceService.ts | 6 | P1 | A - Device Manager 类型宽泛 | 扩展 DeviceManager 类型 |
| MatrixNotificationService.ts | 6 | P1 | A - Notification Manager 类型宽泛 | 扩展 NotificationManager |
| MatrixFriendService.ts | 6 | P1 | A - Friend Manager 类型宽泛 | 扩展 FriendManager 类型 |
| TelemetryService.ts | 6 | P1 | A - Admin Manager 类型宽泛 | 扩展 AdminServerManager |
| MatrixKeyBackupService.ts | 5 | P0 | A - Key Backup Manager 类型宽泛 | 扩展 KeyBackupManager 类型 |
| SecurityService.ts | 4 | P1 | A - Admin Manager 类型宽泛 | 扩展 AdminManager |
| RoomCapabilitiesService.ts | 3 | P2 | A - Room Manager 类型宽泛 | 复用 RoomSummaryManager |
| MetadataService.ts | 3 | P1 | A - Room Manager 类型宽泛 | 扩展 RoomManager |
| CreationService.ts | 3 | P1 | A - Room Manager 类型宽泛 | 扩展 RoomManager |
| MatrixReceiptService.ts | 3 | P1 | A - Receipt Manager 类型宽泛 | 扩展 ReceiptManager |
| MatrixMessageRelationService.ts | 3 | P1 | A - Relations Manager 类型宽泛 | 扩展 RelationsManager |
| MatrixDelayedEventsService.ts | 3 | P1 | A - Events Manager 类型宽泛 | 扩展 EventsManager |
| MatrixVoIPService.ts | 3 | P1 | A - Media Manager 类型宽泛 | 扩展 MediaManager |
| CryptoSDKAdapter.ts | 3 | P2 | A - Crypto 扩展类型不匹配 | 更新类型扩展 |

## 原因分类统计

| 分类 | 描述 | 数量 | 占比 |
|------|------|------|------|
| A | SDK 返回类型过于宽泛 | ~114 | 60% |
| B | 前端本地接口与 SDK 类型字段名不匹配 | ~47 | 25% |
| C | SDK 方法缺失 | ~19 | 10% |
| D | 运行时类型不确定 | ~9 | 5% |

## 详细清单

src/services/matrix/MatrixSyncManager.ts:175:  const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection
src/services/matrix/MatrixSyncManager.ts:365:      navigator as unknown as { connection?: { addEventListener?: (type: string, handler: () => void) => void } }
src/services/matrix/MatrixSyncManager.ts:379:      navigator as unknown as { connection?: { removeEventListener?: (type: string, handler: () => void) => void } }
src/services/matrix/SynapseRustExtensionsService.ts:306:          return rest as unknown as T
src/services/matrix/SynapseRustExtensionsService.ts:1039:      return (result as unknown as Array<Record<string, unknown>>) || []
src/services/matrix/SynapseRustExtensionsService.ts:1051:      return (result as unknown as Array<Record<string, unknown>>) || []
src/services/matrix/MatrixWsBridge.ts:54:      (event as unknown as { event?: { redacts?: string } }).event?.redacts ??
src/services/matrix/MatrixSearchService.ts:276:          typeof (room as unknown as Record<string, unknown>).getDMInviter === 'function'
src/services/matrix/MatrixSearchService.ts:277:            ? ((room as unknown as { getDMInviter: () => string | undefined }).getDMInviter() as string | undefined)
src/services/matrix/MatrixEventRouter.ts:82:    const roomAny = room as unknown as {
src/services/matrix/MatrixEventRouter.ts:261:      const roomAny = entry.room as unknown as {
src/services/matrix/crypto/CryptoHealthMonitor.ts:109:      const userId = (client as unknown as { getUserId?: () => string }).getUserId?.()
src/services/matrix/crypto/CryptoHealthMonitor.ts:136:        client as unknown as { getCrypto?: () => { isCrossSigningReady?: () => Promise<boolean> } }
src/services/matrix/crypto/CryptoHealthMonitor.ts:178:            const roomId = (room as unknown as { roomId?: string }).roomId
src/services/matrix/MatrixHttpClient.ts:276:      const http = client.http as unknown as MatrixAuthedRequestInvoker
src/services/matrix/MatrixClientService.ts:662:      const getter: unknown = (client as unknown as Record<string, unknown>)[getterName]
src/services/matrix/crypto/CryptoSDKAdapter.ts:60:    return matrixClientService.getClient() as unknown as MatrixClientExtended
src/services/matrix/crypto/CryptoSDKAdapter.ts:356:    const crossSigningInfo = (crypto as unknown as { crossSigningInfo?: { getId?(type?: string): string | undefined } })
src/services/matrix/crypto/CryptoSDKAdapter.ts:613:      if ((room as unknown as { hasEncryptionStateEvent: () => boolean }).hasEncryptionStateEvent()) {
src/services/matrix/crypto/MatrixVerificationService.ts:76:      const phase = (request as unknown as { phase?: VerificationPhase }).phase
src/services/matrix/crypto/MatrixVerificationService.ts:79:        ;(request as unknown as { off(ev: string, cb: () => void): void }).off(
src/services/matrix/crypto/MatrixVerificationService.ts:85:        ;(request as unknown as { off(ev: string, cb: () => void): void }).off(
src/services/matrix/crypto/MatrixVerificationService.ts:91:    ;(request as unknown as { on(ev: string, cb: () => void): void }).on(VerificationRequestEvent.Change, handleChange)
src/services/matrix/crypto/MatrixVerificationService.ts:106:    const client = this.getClient() as unknown as MatrixClientExtended
src/services/matrix/crypto/MatrixVerificationService.ts:132:    const handler = this.handleRequestReceived as unknown as (...args: unknown[]) => void
src/services/matrix/crypto/MatrixVerificationService.ts:135:      ;(this.observedClient as unknown as { off(ev: string, cb: (...a: unknown[]) => void): void }).off(
src/services/matrix/crypto/MatrixVerificationService.ts:141:    ;(client as unknown as { on(ev: string, cb: (...a: unknown[]) => void): void }).on(
src/services/matrix/crypto/MatrixVerificationService.ts:284:      return (result.requests ?? []) as unknown as Array<Record<string, unknown>>
src/services/matrix/crypto/MatrixVerificationService.ts:298:      return result as unknown as { qr_code: string; transaction_id: string }
src/services/matrix/crypto/MatrixCryptoService.ts:600:        return [versions as unknown as KeyBackupVersionInfo]
src/services/matrix/crypto/MatrixCryptoService.ts:602:      return versions as unknown as KeyBackupVersionInfo[]
src/services/matrix/crypto/MatrixCryptoService.ts:618:        authData as unknown as Parameters<typeof manager.createBackupVersion>[1],
src/services/matrix/crypto/MatrixCryptoService.ts:633:      return result as unknown as KeyBackupVersionInfo
src/services/matrix/crypto/MatrixCryptoService.ts:645:        authData as unknown as Parameters<typeof manager.updateBackupVersion>[1]
src/services/matrix/crypto/MatrixCryptoService.ts:670:      return result as unknown as RoomKeysResponse
src/services/matrix/crypto/MatrixCryptoService.ts:683:      return result as unknown as KeyBackupWriteResult
src/services/matrix/crypto/MatrixCryptoService.ts:696:      return result as unknown as KeyBackupWriteResult
src/services/matrix/crypto/MatrixCryptoService.ts:708:      return result as unknown as RoomKeySessionsResponse
src/services/matrix/crypto/MatrixCryptoService.ts:727:      return result as unknown as KeyBackupWriteResult
src/services/matrix/crypto/MatrixCryptoService.ts:740:      return result as unknown as KeyBackupWriteResult
src/services/matrix/crypto/MatrixCryptoService.ts:752:      return result as unknown as SessionKeyData
src/services/matrix/crypto/MatrixCryptoService.ts:775:      return result as unknown as KeyBackupWriteResult
src/services/matrix/crypto/MatrixCryptoService.ts:788:      return result as unknown as KeyBackupWriteResult
src/services/matrix/crypto/MatrixCryptoService.ts:812:      return result as unknown as Record<string, unknown>
src/services/matrix/crypto/MatrixCryptoService.ts:824:      return result as unknown as RecoveryProgress
src/services/matrix/crypto/MatrixCryptoService.ts:837:      return result as unknown as BackupVerifyResult
src/services/matrix/crypto/MatrixCryptoService.ts:854:      return result as unknown as BatchRecoverResult
src/services/matrix/crypto/MatrixCryptoService.ts:866:      return result as unknown as Record<string, unknown>
src/services/matrix/crypto/MatrixCryptoService.ts:878:      return result as unknown as Record<string, unknown>
src/services/matrix/crypto/MatrixCryptoService.ts:946:      return result as unknown as SasVerificationStartResponse
src/services/matrix/crypto/MatrixCryptoService.ts:975:      return result as unknown as SasVerificationAcceptResponse
src/services/matrix/crypto/MatrixCryptoService.ts:991:      return result as unknown as SasKeyAgreementResponse
src/services/matrix/crypto/MatrixCryptoService.ts:1008:      return result as unknown as SasMacResponse
src/services/matrix/crypto/MatrixCryptoService.ts:1023:      return result as unknown as SasDoneResponse
src/services/matrix/crypto/MatrixCryptoService.ts:1052:      return (result.requests ?? []) as unknown as PendingVerificationRequest[]
src/services/matrix/crypto/MatrixCryptoService.ts:1070:      return result as unknown as QrCodeShowResponse
src/services/matrix/crypto/MatrixCryptoService.ts:1102:      return result as unknown as QrCodeScanResponse
src/services/matrix/crypto/MatrixKeyBackupService.ts:102:    const client = this.getClient() as unknown as MatrixClientExtended
src/services/matrix/crypto/MatrixKeyBackupService.ts:107:    const client = this.getClient() as unknown as MatrixClientExtended
src/services/matrix/crypto/MatrixKeyBackupService.ts:184:      typeof (keyBackupManager as unknown as Record<string, unknown>).scheduleKeyBackupSend === 'function'
src/services/matrix/crypto/MatrixKeyBackupService.ts:186:      ;(keyBackupManager as unknown as Record<string, () => void>).scheduleKeyBackupSend()
src/services/matrix/crypto/MatrixKeyBackupService.ts:460:      return result as unknown as Record<string, unknown>
src/services/matrix/room/MatrixRoomSummaryService.ts:208:      (client as unknown as { getRoomSummaryManager?: () => RoomSummaryManager | null }).getRoomSummaryManager?.() ??
src/services/matrix/room/MatrixRoomStoreAdapter.ts:29:    typeof (room as unknown as Record<string, unknown>).getDMInviter === 'function'
src/services/matrix/room/MatrixRoomStoreAdapter.ts:30:      ? ((room as unknown as { getDMInviter: () => string | undefined }).getDMInviter() as string | undefined)
src/services/matrix/room/TimelineService.ts:103:        notifications: result.notifications as unknown as Array<Record<string, unknown>>,
src/services/matrix/room/RoomCapabilitiesService.ts:62:          capabilities: result.capabilities as unknown as RoomCapabilitiesPayload['capabilities'],
src/services/matrix/room/RoomCapabilitiesService.ts:63:          features: (result as unknown as RoomCapabilitiesPayload).features,
src/services/matrix/room/RoomCapabilitiesService.ts:64:          join_rule: (result as unknown as RoomCapabilitiesPayload).join_rule
src/services/matrix/room/AccountDataService.ts:185:        config as unknown as Parameters<typeof matrixAIConnectionService.createConnection>[0]
src/services/matrix/room/MetadataService.ts:56:      return result as unknown as Record<string, unknown>
src/services/matrix/room/MetadataService.ts:67:      return result as unknown as Record<string, unknown>
src/services/matrix/room/MetadataService.ts:78:      return result as unknown as Record<string, unknown>
src/services/matrix/room/CreationService.ts:42:      } as unknown as Room
src/services/matrix/room/CreationService.ts:131:    const roomAsRecord = room as unknown as Record<string, unknown>
src/services/matrix/room/CreationService.ts:147:    const syncData = (room as unknown as { syncData?: SyncData }).syncData
src/services/matrix/room/RoomOperations.ts:233:    const baseUrl = (client as unknown as { baseUrl?: string }).baseUrl
src/services/matrix/room/RoomOperations.ts:363:      return result as unknown as Record<string, unknown>
src/services/matrix/room/MatrixSpaceService.ts:650:      return spaces as unknown as Array<Record<string, unknown>>
src/services/matrix/room/MatrixSpaceService.ts:881:      return members as unknown as Array<Record<string, unknown>>
src/services/matrix/rendezvous/MatrixRendezvousService.ts:98:    const clientWithMethods = client as unknown as Record<string, unknown>
src/services/matrix/widget/MatrixWidgetService.ts:103:    const client = matrixClientService.getClient() as unknown as {
src/services/matrix/auth/MatrixAuthService.ts:594:      const r = result as unknown as {
src/services/matrix/auth/MatrixAuthService.ts:746:        (result as unknown as { flows?: Array<{ type: string; stages?: string[]; [key: string]: unknown }> }).flows ??
src/services/matrix/auth/MatrixAuthService.ts:788:      await (client.getAccountManager() as unknown as { logoutAll: () => Promise<unknown> }).logoutAll()
src/services/matrix/auth/MatrixQrLoginSdkService.ts:304:      this.session = session as unknown as RendezvousSessionInstance
src/services/matrix/auth/MatrixQrLoginSdkService.ts:305:      this.channel = channel as unknown as SecureChannelInstance
src/services/matrix/auth/MatrixQrLoginSdkService.ts:448:      } as unknown as ConstructorParameters<typeof MSC4108RendezvousSession>[0])
src/services/matrix/auth/MatrixQrLoginSdkService.ts:451:      this.session = session as unknown as RendezvousSessionInstance
src/services/matrix/auth/MatrixQrLoginSdkService.ts:452:      this.channel = channel as unknown as SecureChannelInstance
src/services/matrix/auth/MatrixQrLoginSdkService.ts:542:      const userId = (client as unknown as { getUserId(): string }).getUserId()
src/services/matrix/auth/MatrixQrLoginSdkService.ts:543:      const deviceId = (client as unknown as { getDeviceId(): string | null }).getDeviceId() ?? ''
src/services/matrix/auth/MatrixQrLoginSdkService.ts:637:      this.session = session as unknown as RendezvousSessionInstance
src/services/matrix/auth/MatrixQrLoginSdkService.ts:638:      this.channel = channel as unknown as SecureChannelInstance
src/services/matrix/auth/SessionOrchestrator.ts:43:    const store = matrixStore() as unknown as {
src/services/matrix/auth/SessionOrchestrator.ts:78:        return (matrixStore() as unknown as { refreshToken?: string }).refreshToken ?? undefined
src/services/matrix/admin/RetentionService.ts:24:        policies: policy ? [policy as unknown as Record<string, unknown>] : [],
src/services/matrix/admin/RetentionService.ts:37:      return (policy as unknown as Record<string, unknown>) ?? null
src/services/matrix/admin/RetentionService.ts:77:      return (status as unknown as Record<string, unknown>) ?? {}
src/services/matrix/auth/MatrixOidcService.ts:179:      return userInfo as unknown as OidcUserInfo
src/services/matrix/admin/ServerService.ts:85:      return (result as unknown as Record<string, unknown>) ?? null
src/services/matrix/admin/ServerService.ts:119:      return (result as unknown as Record<string, unknown>) ?? null
src/services/matrix/admin/QuotaService.ts:35:        : ((client as unknown as { quotaManager?: QuotaManager }).quotaManager as QuotaManager | undefined)
src/services/matrix/auth/MatrixRuntimeSessionService.ts:648:          body: msg.message.body as unknown as string
src/services/matrix/admin/UserService.ts:288:        return (result as unknown as Record<string, unknown>) ?? {}
src/services/matrix/admin/UserService.ts:291:      return (result as unknown as Record<string, unknown>) ?? {}
src/services/matrix/admin/UserService.ts:313:      return (result as unknown as Record<string, unknown>) ?? null
src/services/matrix/admin/UserService.ts:346:      return result as unknown as Record<string, unknown> | null
src/services/matrix/admin/UserService.ts:405:      return (result as unknown as Record<string, unknown>) ?? null
src/services/matrix/admin/UserService.ts:420:        stats: [result as unknown as Record<string, unknown>],
src/services/matrix/admin/UserService.ts:515:      return [result as unknown as Record<string, unknown>]
src/services/matrix/admin/UserService.ts:537:      return (result as unknown as Record<string, unknown>) ?? null
src/services/matrix/admin/UserService.ts:609:      return (result as unknown as Record<string, unknown>) ?? null
src/services/matrix/admin/AdminFacadeService.ts:84:    async () => this.sdkAdmin() as unknown as import('./ApplicationService').ApplicationServiceAdmin
src/services/matrix/admin/RoomService.ts:179:        chunk: (result?.chunk ?? []).map((msg) => msg as unknown as Record<string, unknown>),
src/services/matrix/admin/RoomService.ts:283:        stats: (result ?? []) as unknown as Array<Record<string, unknown>>,
src/services/matrix/admin/RoomService.ts:297:      return result as unknown as Record<string, unknown>
src/services/matrix/admin/RoomService.ts:309:      return result as unknown as Record<string, unknown>
src/services/matrix/admin/RoomService.ts:332:      return result as unknown as Record<string, unknown>
src/services/matrix/admin/RoomService.ts:352:        results: (result?.results ?? []).map((e) => e as unknown as Record<string, unknown>),
src/services/matrix/admin/RoomService.ts:373:        rooms: (result?.results ?? []).map((e) => e as unknown as Record<string, unknown>),
src/services/matrix/admin/RoomService.ts:387:      if (Array.isArray(result)) return result as unknown as Array<Record<string, unknown>>
src/services/matrix/admin/RoomService.ts:407:        spaces: (result?.spaces ?? []).map((s) => s as unknown as Record<string, unknown>),
src/services/matrix/admin/RoomService.ts:432:      return result as unknown as Record<string, unknown>
src/services/matrix/admin/RoomService.ts:443:      return (result?.users ?? []) as unknown as Array<Record<string, unknown>>
src/services/matrix/admin/RoomService.ts:454:      return (result?.rooms ?? []) as unknown as Array<Record<string, unknown>>
src/services/matrix/admin/RoomService.ts:465:      return result as unknown as Record<string, unknown>
src/services/matrix/admin/AdminModerationService.ts:49:    const manager = (client as unknown as { moderationManager?: ModerationManager }).moderationManager ?? null
src/services/matrix/admin/TelemetryService.ts:132:      return (result as unknown as TelemetryStatus) ?? null
src/services/matrix/admin/TelemetryService.ts:146:      return (result as unknown as TelemetryResourceAttributes) ?? { attributes: {} }
src/services/matrix/admin/TelemetryService.ts:160:      return (result as unknown as TelemetryMetricsSummary) ?? null
src/services/matrix/admin/TelemetryService.ts:178:      return (result?.alerts as unknown as TelemetryAlert[]) ?? []
src/services/matrix/admin/TelemetryService.ts:192:    return result as unknown as TelemetryAlert
src/services/matrix/admin/TelemetryService.ts:202:      return (result as unknown as TelemetryHealthCheck) ?? null
src/services/matrix/admin/ReportService.ts:133:      return result as unknown as ScannerInfo
src/services/matrix/admin/BackgroundUpdateService.ts:148:        updates: (result?.updates as unknown as BackgroundUpdate[]) ?? [],
src/services/matrix/admin/BackgroundUpdateService.ts:163:      return result as unknown as BackgroundUpdate
src/services/matrix/admin/BackgroundUpdateService.ts:180:    return result as unknown as BackgroundUpdate
src/services/matrix/admin/BackgroundUpdateService.ts:189:    return result as unknown as BackgroundUpdate
src/services/matrix/admin/BackgroundUpdateService.ts:198:    return result as unknown as BackgroundUpdate
src/services/matrix/admin/BackgroundUpdateService.ts:207:    return result as unknown as BackgroundUpdate
src/services/matrix/admin/BackgroundUpdateService.ts:216:    return result as unknown as BackgroundUpdate
src/services/matrix/admin/BackgroundUpdateService.ts:252:        (result as unknown as BackgroundUpdateStatusSummary) ?? {
src/services/matrix/admin/BackgroundUpdateService.ts:280:      return (result as unknown as BackgroundUpdateHistory[]) ?? []
src/services/matrix/admin/BackgroundUpdateService.ts:293:      return (result as unknown as BackgroundUpdateStats[]) ?? []
src/services/matrix/admin/SecurityService.ts:121:        logs: (result?.events ?? []).map((e) => e as unknown as Record<string, unknown>),
src/services/matrix/admin/SecurityService.ts:277:      return (result?.backups ?? []) as unknown as Array<Record<string, unknown>>
src/services/matrix/admin/SecurityService.ts:288:      return (result as unknown as Record<string, unknown>) ?? null
src/services/matrix/admin/SecurityService.ts:310:      return (result as unknown as Record<string, unknown>) ?? null
src/services/matrix/user/MatrixDeviceService.ts:86:      const extendedClient = client as unknown as MatrixClientExtended
src/services/matrix/user/MatrixDeviceService.ts:111:      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()
src/services/matrix/user/MatrixDeviceService.ts:141:      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()
src/services/matrix/user/MatrixDeviceService.ts:171:      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()
src/services/matrix/user/MatrixDeviceService.ts:195:      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()
src/services/matrix/user/MatrixDeviceService.ts:218:      const deviceManager = (client as unknown as MatrixClientExtended).getDeviceManager?.()
src/services/matrix/user/MatrixPresenceService.ts:234:        return result as unknown as PresenceListResponse
src/services/matrix/user/MatrixPresenceService.ts:288:      return result as unknown as PresenceListResponse
src/services/matrix/user/MatrixAccountService.ts:274:      const extra = result as unknown as Record<string, unknown>
src/services/matrix/user/MatrixAccountService.ts:396:      return result as unknown as Record<string, unknown>
src/services/matrix/messaging/MatrixThreadService.ts:180:    return (client as unknown as { threadingManager?: ThreadingManagerCompat }).threadingManager ?? null
src/services/matrix/messaging/MatrixMessageService.ts:656:      return Array.isArray(chunk) ? (chunk as unknown as MatrixEvent[]) : []
src/services/matrix/messaging/MatrixMessageRelationService.ts:513:      )) as unknown as RelationsResponse
src/services/matrix/messaging/MatrixMessageRelationService.ts:537:      )) as unknown as RelationsResponse
src/services/matrix/messaging/MatrixMessageRelationService.ts:554:      )) as unknown as AggregationsResponse
src/services/matrix/guest/MatrixGuestService.ts:29:    const clientWithMethods = client as unknown as Record<string, unknown>
src/services/matrix/friends/MatrixFriendService.ts:94:    const clientWithMethods = client as unknown as Record<string, unknown>
src/services/matrix/friends/MatrixFriendService.ts:457:      return pending.incoming as unknown as FriendRequest[]
src/services/matrix/friends/MatrixFriendService.ts:478:      return pending.outgoing as unknown as FriendRequest[]
src/services/matrix/friends/MatrixFriendService.ts:744:      return (groups as unknown as FriendGroup[] | undefined) ?? []
src/services/matrix/friends/MatrixFriendService.ts:941:          ((r as unknown as Record<string, unknown>).display_name as string | undefined) ??
src/services/matrix/friends/MatrixFriendService.ts:942:          ((r as unknown as Record<string, unknown>).displayname as string | undefined),
src/services/matrix/messaging/MatrixReceiptService.ts:86:      const eventId = (lastEvent as unknown as { event_id?: string }).event_id
src/services/matrix/messaging/MatrixReceiptService.ts:159:          : ((event as unknown as { event_id?: string; id?: string }).event_id ??
src/services/matrix/messaging/MatrixReceiptService.ts:160:            (event as unknown as { event_id?: string; id?: string }).id)
src/services/matrix/messaging/MatrixDelayedEventsService.ts:100:    const result = await (client as unknown as DelayedEventClient)._unstable_sendDelayedEvent(
src/services/matrix/messaging/MatrixDelayedEventsService.ts:129:    const result = await (client as unknown as DelayedEventClient)._unstable_sendDelayedStateEvent(
src/services/matrix/messaging/MatrixDelayedEventsService.ts:163:    const result = await (client as unknown as DelayedEventClient)._unstable_sendStickyDelayedEvent(
src/services/matrix/moderation/MatrixEventReportService.ts:27:    const clientWithMethods = client as unknown as Record<string, unknown>
src/services/matrix/notifications/MatrixNotificationService.ts:93:        this.config as unknown as Record<string, unknown>
src/services/matrix/notifications/MatrixNotificationService.ts:241:        const ruleList = ((rules as unknown as Record<string, unknown>)?.[kind] ?? undefined) as unknown as
src/services/matrix/notifications/MatrixNotificationService.ts:369:        notifications: result.notifications as unknown as Array<Record<string, unknown>>,
src/services/matrix/notifications/MatrixNotificationService.ts:465:        body as unknown as Parameters<typeof pushManager.updatePushRule>[3]
src/services/matrix/notifications/MatrixNotificationService.ts:497:      return pushers as unknown as Array<Record<string, unknown>>
src/services/matrix/notifications/MatrixNotificationService.ts:511:      await pushManager.setPusher(pusher as unknown as IPusherRequest)
src/services/matrix/notifications/MatrixPushService.ts:99:      const pusherData = pusher as unknown as Record<string, unknown>
src/services/matrix/media/MatrixVoIPService.ts:299:    const calls = (client as unknown as { getCallHandler?: () => VoIPCallHandler }).getCallHandler?.()?.calls || {}
src/services/matrix/media/MatrixVoIPService.ts:541:      const r = (await client.getTurnServerManager().getTurnServerConfig()) as unknown as Record<string, unknown>
src/services/matrix/media/MatrixVoIPService.ts:576:      const r = (await client.getTurnServerManager().getTurnServerConfig()) as unknown as Record<string, unknown>
src/services/matrix/media/MatrixMediaService.ts:245:      const encryptedBlobFile = new File([encryptedPayload.encryptedData as unknown as BlobPart], file.name, {
