# vi.mock Remaining Audit (2026-07-20)

## Executive Summary

- **Total vi.mock lines across project**: 2047
- **In matrix services** (`src/services/matrix/`): 651 lines in 101 test files
- **Outside matrix services**: 1391 lines (stores, composables, views, etc.)
- **Test files already using MSW**: 44
- **Direct SDK-level `vi.mock('matrix-js-sdk', ...)` calls**: 4 lines in 2 files
- **MatrixClientService mock lines** (hula wrapper, debatable): 28 lines
- **Verdict**: The overwhelming majority (647 of 651 / 99.4%) of vi.mock lines in matrix services mock **non-SDK** dependencies — the migration is effectively complete for matrix services. The residual work is small and focused.

## Per-Service Classification

| Service | vi.mock lines | Test files | MSW users | SDK mocks | Non-SDK mocks | Action |
|---------|--------------|------------|-----------|-----------|---------------|--------|
| room/ | 192 | 18 | 9 | 0 | 192 | keep (see details) |
| messaging/ | 94 | 12 | 6 | 0 | 94 | keep (see details) |
| __tests__/ (core) | 79 | 22 | 7 | 2 | 77 | migrate 1 file |
| media/ | 63 | 12 | 7 | 0 | 63 | keep |
| auth/ | 52 | 7 | 3 | 1 | 51 | evaluate (already MSW) |
| crypto/ | 46 | 10 | 0 | 0 | 46 | keep |
| user/ | 36 | 7 | 5 | 0 | 36 | keep |
| notifications/ | 24 | 5 | 4 | 0 | 24 | keep |
| admin/ | 20 | 14 | 3 | 0 | 20 | keep |
| friends/ | 15 | 2 | 1 | 1 | 14 | evaluate (already MSW) |
| sync/ | 13 | 2 | 0 | 0 | 13 | keep |
| ai/ | 9 | 1 | 1 | 0 | 9 | keep |
| widget/ | 4 | 1 | 0 | 0 | 4 | keep |
| rendezvous/ | 2 | 1 | 0 | 0 | 2 | keep |
| network/ | 2 | 1 | 0 | 0 | 2 | keep |
| **Total** | **651** | **101** | **44** | **4** | **647** | — |

## Detailed Classification

### 1. Direct SDK Mocks (4 lines, 2 files) — MIGRATE

These `vi.mock('matrix-js-sdk', ...)` calls bypass the real SDK module entirely.

| File | Line(s) | Mock target | Status |
|------|---------|-------------|--------|
| `auth/__tests__/MatrixAuthService.test.ts` | 60 | `vi.mock('matrix-js-sdk', ...)` in hoisted block | Already uses MSW (6 handlers). vi.mock is used to mock `createClient` constructor. Could be replaced with spyOn + module factory. |
| `friends/__tests__/MatrixFriendService.test.ts` | 49 | `vi.mock('matrix-js-sdk/friend', ...)` | Already uses MSW. Mocks synapse-rust friend extension. Could use spyOn. |
| `__tests__/MatrixClientService.slidingsync.test.ts` | 7, 46 | `vi.mock('matrix-js-sdk', ...)` + `vi.mock('matrix-js-sdk/friend', ...)` | **No MSW**. This is the only file that needs full migration. 2 SDK mock calls. |

**Recommendation**: 
- `MatrixClientService.slidingsync.test.ts` is the only file requiring substantive migration (no MSW at all).
- The other 2 files (auth, friends) already use MSW for HTTP — their SDK vi.mock calls are residual and could be replaced with spyOn patterns, but are not blocking correctness.

### 2. MatrixClientService Mocks (28 lines across many files) — DEBATABLE

These mock hula's own `MatrixClientService` (not the SDK), typically via:
- `vi.mock('../../MatrixClientService', ...)` 
- `vi.spyOn(matrixClientService, 'getClient').mockReturnValue(...)`
- `vi.spyOn(matrixClientService, 'joinRoom').mockResolvedValue(...)`

**Distribution**: room (6), messaging (4), media (4), auth (2), notifications (2), user (1), sync (2), __tests__ (7)

**Assessment**: These mock hula's own service wrapper, not the SDK. The spyOn pattern (`vi.spyOn(matrixClientService, 'getClient')`) is already the modern approach. The `vi.mock('../../MatrixClientService', ...)` calls could be converted to spyOn for consistency, but this is low priority since:
1. MatrixClientService is hula code, not SDK code
2. spyOn is already used in many files alongside vi.mock for the same module
3. The actual HTTP layer is tested via MSW in the 44 files that use it

### 3. Hula Service Mocks (sibling services) — KEEP

These mock other hula service modules to isolate the unit under test. All are legitimate unit test patterns.

| Mocked service | Where mocked | Count |
|---------------|-------------|-------|
| MatrixEventService | room, messaging, media, notifications | 5 |
| MatrixReactionService | messaging | 2 |
| MatrixReceiptService | messaging, room | 4 |
| MatrixMessageRelationService | messaging | 2 |
| MatrixSlidingSyncService | room, sync | 3 |
| SynapseRustExtensionsService | room, user, friends | 3 |
| MatrixMessageService | room, messaging | 2 |
| OfflineQueueService | room, messaging, __tests__ | 7 |
| MatrixRoomStoreAdapter | room | 1 |
| MatrixCapabilityService / EndpointCapabilityService | __tests__, media | 5 |
| MatrixMediaService | messaging | 1 |
| MatrixPushService | notifications | 1 |
| MatrixRequestDeduper | notifications | 1 |
| MatrixHttpClient | notifications, friends | 2 |
| MatrixSpecialFriendService | friends | 1 |
| Other (QueryService, MembershipService, CreationService, MatrixWorkerHost, etc.) | various | 10 |

### 4. Platform/Util Mocks — KEEP

These mock non-SDK platform APIs and utilities. All legitimate.

| Mocked module | Count | Notes |
|--------------|-------|-------|
| `@tauri-apps/plugin-log` | 45 | Logger — legitimate; Tauri plugin |
| `@/services/i18n` | 11 | i18n — legitimate |
| `@tauri-apps/api/*` (core, event, webviewWindow) | 3 | Tauri APIs — legitimate |
| `@/utils/Logger` | 3 | Logger — legitimate |
| `@/utils/ImageUtils` | 1 | — legitimate |
| `@/utils/PlatformConstants` | 1 | — legitimate |
| `@/utils/AvatarUtils` | 1 | — legitimate |
| `@/utils/AppStateReady` | 1 | — legitimate |
| `@/services/backend/config` | 2 | Backend config — legitimate |
| `@/services/matrix/matrixClientPlatform` | 2 | Platform abstraction — legitimate |
| `@/services/performance/ChunkUploadService` | 1 | — legitimate |
| `@/services/matrix/network/runtimeFetch` | 3 | Runtime fetch — legitimate |
| `@/composables/common/useMitt` | 1 | Vue composable — legitimate |
| `@/stores/domains/*` (9 Pinia stores) | 10 | Pinia stores — legitimate |
| `../sdk-compat` | 1 | SDK compat layer — legitimate |

### 5. Already Migrated (44 files using MSW)

These files import `msw` and have HTTP-level test handlers. Many still have residual non-SDK vi.mock calls (for Tauri log, i18n, etc.) which are legitimate.

```
room/: AccountDataService, MatrixSpaceService, MembershipService, MetadataService,
       RoomOperations, TimelineService, room.contract, space.contract, timeline.account.contract
messaging/: MatrixMessageRelationService, MatrixMessageService, message.contract, relation.contract
media/: MatrixMediaService, MatrixUrlPreviewService, MatrixVoiceService,
        media.contract, urlPreview.contract, voice.contract, voip.contract
auth/: MatrixAuthService, MatrixOidcService, auth.contract
user/: MatrixAccountService, MatrixDeviceService, MatrixPresenceService, MatrixProfileService, user.contract
notifications/: MatrixPushService, MatrixRoomNotificationService, MatrixServerNotificationService, notifications.contract
admin/: FederationService, MediaService, ReportService
friends/: MatrixFriendService
__tests__/: MatrixRequestHelper, mswIntegration, synapserust-thirdparty.contract,
           synapseRust.friends.contract, synapseRust.rooms.contract,
           tokenRefresh.contract, urlPrefix.contract
ai/: aiConnection.contract
```

## Migration Priority

| Priority | File | vi.mock lines to migrate | Effort | Rationale |
|----------|------|-------------------------|--------|-----------|
| **P1** | `__tests__/MatrixClientService.slidingsync.test.ts` | 2 SDK mocks + 3 non-SDK | Medium | Only file with zero MSW usage despite testing SDK interaction |
| **P2** | `auth/__tests__/MatrixAuthService.test.ts` | 1 SDK mock (residual) | Low | Already uses MSW; just remove the residual vi.mock |
| **P3** | `friends/__tests__/MatrixFriendService.test.ts` | 1 SDK mock (residual) | Low | Already uses MSW; just remove the residual vi.mock |
| **P4** | MatrixClientService mock conversion | 28 lines across 15+ files | High | Low ROI — these mock hula code, not SDK code. Wait for each file's natural refactor cycle. |

## Key Observations

1. **The SDK mock surface is tiny**: Only 4 lines directly mock `matrix-js-sdk` modules across the entire matrix services layer. The earlier migration waves (tasks #61-#72) successfully eliminated the bulk of SDK-level mocking.

2. **MSW adoption is strong**: 44 of 101 test files (44%) already use MSW for HTTP-level interception. The pattern is well-established and understood.

3. **Most vi.mock is for dependency isolation, not SDK mocking**: The 647 non-SDK vi.mock lines mock Tauri plugins, Pinia stores, hula's own services, and utility modules — standard unit test isolation patterns that do not need migration.

4. **Hybrid pattern dominates in MSW files**: Files that use MSW typically still have vi.mock for non-SDK dependencies (Tauri log, i18n). This is a reasonable pattern — MSW handles HTTP, vi.mock isolates platform deps.

5. **Outside matrix services, 1391 vi.mock lines remain**: These are in store tests, composable tests, and view tests. A separate audit would be needed for those, but they follow a different testing strategy (primarily mocking Vue/Pinia/Tauri APIs, not SDK modules).

## Recommendations

1. **P1**: Migrate `MatrixClientService.slidingsync.test.ts` to use MSW + spyOn (the only file that fully relies on vi.mock for SDK interaction).
2. **P2/P3**: Remove residual `vi.mock('matrix-js-sdk', ...)` from auth and friends tests, replacing with spyOn where needed.
3. **No action needed** for the 647 non-SDK vi.mock lines — they mock legitimate test boundaries.
4. **Phase 2**: Consider a separate audit of the 1391 vi.mock lines outside matrix services (stores, composables, views) to identify any SDK mocking there.
5. **Enforce at review time**: Add a lint rule or review checklist item: new test files must use MSW for HTTP-level testing; `vi.mock('matrix-js-sdk', ...)` is forbidden without explicit justification.
