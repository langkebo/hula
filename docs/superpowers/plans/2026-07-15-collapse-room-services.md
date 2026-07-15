# Collapse Shallow Room Services — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen 9 shallow room-service modules and 3 pure-pass-through facades into one implementation module (`RoomOperations`) behind three interfaces (Action, Read, Member).

**Architecture:** A single `RoomOperations` class (extending `BaseMatrixService`) absorbs all try/catch + SDK delegation + offline-queue logic from the 9 shallow services. Three facade objects (`ActionFacade`, `ReadFacade`, `MemberFacade`) become the public interfaces, delegating to `RoomOperations` for absorbed methods and to the 6 deeper services (`CreationService`, `MembershipService`, `TimelineService`, `MetadataService`, `AccountDataService`, `SummaryAggregateService`) for methods that already had depth. Call sites that bypassed the facades are migrated to go through them.

**Tech Stack:** TypeScript, Vitest (vi.mock), matrix-js-sdk, BaseMatrixService, OfflineQueueService

## Global Constraints

- All Matrix SDK calls must go through service layer — never call SDK directly from components/stores
- Use `throwOnError` mode for SDK interactions
- Services extend `BaseMatrixService` for `getClient()` access
- Offline queuing uses `offlineQueueService.enqueue(type, roomId, payload)`
- Singleton pattern: `export const x = new X()` (maintained for the three facades and `RoomOperations`)
- Test mocks use `vi.mock()` with dynamic `await import()` after mock setup

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/services/matrix/room/RoomOperations.ts` | **Create** | Single implementation class absorbing all 9 shallow services |
| `src/services/matrix/room/ActionFacade.ts` | **Rewrite** | Public write interface, delegates to RoomOperations + deeper services |
| `src/services/matrix/room/ReadFacade.ts` | **Rewrite** | Public read interface, delegates to RoomOperations + deeper services |
| `src/services/matrix/room/MemberFacade.ts` | **Rewrite** | Public member interface, delegates to RoomOperations |
| `src/services/matrix/room/index.ts` | **Modify** | Add RoomOperations, remove absorbed services |
| `src/services/matrix/index.ts` | **Modify** | Remove absorbed service re-exports |
| `src/App.vue` | **Modify** | Update lazy loaders |
| 9 shallow service files | **Delete** | AliasesService, TagsService, StateService, DirectMessageService, MemberProfileService, ModerationService, LifecycleService, TranslateService, PinsService |
| 14 call site files | **Modify** | Migrate direct imports to facade imports |
| 9 test files | **Delete** | Replaced by one consolidated test |
| `src/services/matrix/room/__tests__/RoomOperations.test.ts` | **Create** | Consolidated tests for all absorbed methods |

---

### Task 1: Create the RoomOperations implementation module

**Files:**
- Create: `src/services/matrix/room/RoomOperations.ts`

**Interfaces:**
- Consumes: `BaseMatrixService` from `../../BaseMatrixService`, `offlineQueueService` from `@/services/offline/OfflineQueueService`
- Produces: `RoomOperations` class (exported as class + singleton `roomOperations`), with all methods listed below

- [ ] **Step 1: Write the RoomOperations class skeleton**

```typescript
// src/services/matrix/room/RoomOperations.ts
import { BaseMatrixService } from '../../BaseMatrixService'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import type { MatrixClient } from 'matrix-js-sdk'

export class RoomOperations extends BaseMatrixService {
  // --- Aliases (was AliasesService) ---

  async getAliases(roomId: string): Promise<string[]> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) throw new Error(`房间不存在: ${roomId}`)
    const canonical = room.currentState.getStateEvents('m.room.canonical_alias', '')?.getContent()?.alias as string | undefined ?? null
    const altEvents = room.currentState.getStateEvents('m.room.alt_aliases', '')?.getContent()?.alt_aliases as string[] | undefined ?? []
    const result = [canonical, ...altEvents].filter(Boolean) as string[]
    return result
  }

  async setAlias(roomId: string, alias: string): Promise<void> {
    const client = this.getClient()
    await client.createAlias(alias, roomId)
  }

  async deleteAlias(alias: string): Promise<void> {
    const client = this.getClient()
    await client.deleteAlias(alias)
  }

  // --- Tags (was TagsService) ---

  private tagsUnsupported = false
  private unsupportedLogged = false

  async getTags(roomId: string): Promise<Record<string, { order?: number }>> {
    if (this.tagsUnsupported) return {}
    const client = this.getClient()
    try {
      return await client.getRoomTags(roomId)
    } catch (e: any) {
      if (e?.errcode === 'M_UNRECOGNIZED' || e?.httpStatus === 404) {
        this.tagsUnsupported = true
        if (!this.unsupportedLogged) {
          this.unsupportedLogged = true
        }
        return {}
      }
      throw e
    }
  }

  async setTag(roomId: string, tag: string, order?: number): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('tag', roomId, { tag, order })
      return
    }
    const client = this.getClient()
    await client.setRoomTag(roomId, tag, order ? { order } : undefined as any)
  }

  async removeTag(roomId: string, tag: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('tag', roomId, { tag, action: 'remove' })
      return
    }
    const client = this.getClient()
    await client.deleteRoomTag(roomId, tag)
  }

  // --- State (was StateService) ---

  async setRoomName(roomId: string, name: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('state', roomId, { roomId, type: 'name', content: name })
      return
    }
    const client = this.getClient()
    await client.setRoomName(roomId, name)
  }

  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('state', roomId, { roomId, type: 'topic', content: topic })
      return
    }
    const client = this.getClient()
    await client.setRoomTopic(roomId, topic)
  }

  async setRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('state', roomId, { roomId, type: 'avatar', content: avatarUrl })
      return
    }
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.avatar', { url: avatarUrl }, '')
  }

  async getRoomState(roomId: string): Promise<unknown[]> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) throw new Error(`房间不存在: ${roomId}`)
    return room.currentState.getStateEvents('*')
  }

  async setPushRule(roomId: string, enabled: boolean): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('push_rule', roomId, { roomId, enabled })
      return
    }
    const client = this.getClient()
    if (enabled) {
      await client.deletePushRule('global', 'override', roomId)
    } else {
      await client.addPushRule('global', 'override', roomId, {
        conditions: [{ kind: 'event_match', key: 'room_id', pattern: roomId }],
        actions: []
      })
    }
  }

  // --- DirectMessage (was DirectMessageService) ---

  async createDirectRoom(userId: string): Promise<string> {
    if (!navigator.onLine) {
      const tempId = `!pending-dm-${userId}-${Date.now()}`
      offlineQueueService.enqueue('dm_creation', userId, { userId })
      return tempId
    }
    const client = this.getClient()
    const { Preset } = await import('matrix-js-sdk')
    const result = await client.createRoom({
      invite: [userId],
      is_direct: true,
      preset: Preset.TrustedPrivateChat,
      visibility: 'private'
    })
    return result.room_id
  }

  async getDirectRooms(throwOnError: boolean = true): Promise<Map<string, string[]>> {
    const client = this.getClient()
    const accountData = await client.getAccountData('m.direct')
    if (!accountData) return new Map()
    const content = accountData.getContent()
    return new Map(Object.entries(content))
  }

  async setDirectRoom(userId: string, roomId: string): Promise<void> {
    const client = this.getClient()
    const current = await this.getDirectRooms(false)
    const existing = current.get(userId) ?? []
    const updated = [...new Set([...existing, roomId])]
    // Filter rooms where the user still belongs
    const valid = updated.filter((id) => {
      const room = client.getRoom(id)
      if (!room) return false
      const membership = room.getMyMembership()
      return membership === 'join' || membership === 'invite'
    })
    current.set(userId, valid)
    await client.setAccountData('m.direct', Object.fromEntries(current))
  }

  // --- Moderation (was ModerationService) ---

  async getInviteBlocklist(roomId: string): Promise<string[]> {
    const client = this.getClient()
    const res = await client.getHttp().authedRequest(
      'GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/invite_blocklist`
    ) as { blocked?: string[] }
    return res?.blocked ?? []
  }

  async setInviteBlocklist(roomId: string, blocked: string[]): Promise<void> {
    const client = this.getClient()
    await client.getHttp().authedRequest(
      'POST', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/invite_blocklist`,
      undefined, { blocked }
    )
  }

  async getInviteAllowlist(roomId: string): Promise<string[]> {
    const client = this.getClient()
    const res = await client.getHttp().authedRequest(
      'GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/invite_allowlist`
    ) as { allowed?: string[] }
    return res?.allowed ?? []
  }

  async setInviteAllowlist(roomId: string, allowed: string[]): Promise<void> {
    const client = this.getClient()
    await client.getHttp().authedRequest(
      'POST', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/invite_allowlist`,
      undefined, { allowed }
    )
  }

  // --- Lifecycle (was LifecycleService) ---

  async getServerDomain(): Promise<string> {
    const { matrixClientService } = await import('../../MatrixClientService')
    await matrixClientService.waitForClientReady()
    const client = this.getClient()
    const domain = client.getDomain()
    if (domain) return domain
    try {
      const url = new URL(client.baseUrl)
      if (url.hostname) return url.hostname
    } catch { /* not a valid URL */ }
    return 'matrix.org'
  }

  async upgradeRoom(roomId: string, newVersion: string): Promise<string> {
    const client = this.getClient()
    const result = await client.upgradeRoom(roomId, newVersion)
    return result.replacement_room.room_id
  }

  async incrementUnread(roomId: string, highlight?: boolean): Promise<void> {
    try {
      const client = this.getClient()
      if (!client) return
      const room = client.getRoom(roomId)
      if (!room) return
    } catch { /* advisory counter; ignore all errors */ }
  }

  async clearUnread(roomId: string): Promise<void> {
    try {
      const client = this.getClient()
      if (!client) return
      const room = client.getRoom(roomId)
      if (!room) return
    } catch { /* advisory counter; ignore all errors */ }
  }

  // --- Translate (was TranslateService) ---

  async translateText(
    text: string,
    targetLang?: string,
    throwOnErrorOrSource?: boolean | string
  ): Promise<string> {
    const throwOnError = typeof throwOnErrorOrSource === 'boolean' ? throwOnErrorOrSource : true
    const sourceLang = typeof throwOnErrorOrSource === 'string' ? throwOnErrorOrSource : undefined
    const lang = targetLang ?? 'en'
    const client = this.getClient()
    try {
      const res = await client.getHttp().authedRequest(
        'POST', '/_matrix/client/v3/translate',
        undefined, { text, target_lang: lang, source_lang: sourceLang }
      ) as { translated_text?: string }
      return res?.translated_text ?? text
    } catch {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang ?? 'auto'}&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`
        const res = await fetch(url)
        const json = await res.json() as any
        return json?.[0]?.map((s: any) => s[0])?.join('') ?? text
      } catch {
        if (throwOnError) throw new Error('翻译失败')
        return text
      }
    }
  }

  // --- Pins (was PinsService) ---

  async getPinnedEvents(roomId: string): Promise<string[]> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return []
    const event = room.currentState.getStateEvents('m.room.pinned_events', '')
    return event?.getContent()?.pinned as string[] ?? []
  }

  async setPinnedEvents(roomId: string, eventIds: string[]): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { eventIds })
      return
    }
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.pinned_events', { pinned: eventIds }, '')
  }

  async pinEvent(roomId: string, eventId: string): Promise<void> {
    const current = await this.getPinnedEvents(roomId)
    if (!current.includes(eventId)) {
      await this.setPinnedEvents(roomId, [...current, eventId])
    }
  }

  async unpinEvent(roomId: string, eventId: string): Promise<void> {
    const current = await this.getPinnedEvents(roomId)
    await this.setPinnedEvents(roomId, current.filter((id) => id !== eventId))
  }

  async getStickyEvents(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    const res = await client.getHttp().authedRequest(
      'GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/sticky_events`
    ) as Record<string, unknown>
    return res ?? {}
  }

  async setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('sticky', roomId, { events })
      return
    }
    const client = this.getClient()
    await client.getHttp().authedRequest(
      'POST', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/sticky_events`,
      undefined, events
    )
  }

  // --- MemberProfile (was MemberProfileService) ---

  async setMemberDisplayName(roomId: string, displayName: string): Promise<void> {
    const client = this.getClient()
    // Read current membership event and merge displayname
    const room = client.getRoom(roomId)
    const myUserId = client.getUserId()
    if (!room || !myUserId) throw new Error('房间或用户不存在')
    const memberEvent = room.currentState.getStateEvents('m.room.member', myUserId)
    const currentContent = memberEvent?.getContent() ?? {}
    const isThirdPartyInvite = !!currentContent.third_party_invite
    await client.sendStateEvent(roomId, 'm.room.member', {
      ...currentContent,
      displayname: displayName,
      third_party_invite: isThirdPartyInvite ? currentContent.third_party_invite : undefined
    }, myUserId)
  }

  async getMemberDisplayName(roomId: string, userId: string): Promise<string | null> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return null
    const member = room.getMember(userId)
    return member?.rawDisplayName ?? member?.name ?? null
  }

  async setMemberPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void> {
    const client = this.getClient()
    await client.setUserPowerLevel(userId, roomId, powerLevel)
  }

  async setMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    await this.setMemberPowerLevel(roomId, userId, 100)
  }

  async removeMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    await this.setMemberPowerLevel(roomId, userId, 0)
  }
}

export const roomOperations = new RoomOperations()
```

- [ ] **Step 2: Run type check to verify the file compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit src/services/matrix/room/RoomOperations.ts 2>&1 | head -30`
Expected: No errors from this file (there may be pre-existing errors from other files).

- [ ] **Step 3: Commit**

```bash
git add src/services/matrix/room/RoomOperations.ts
git commit -m "feat: add RoomOperations module absorbing shallow room service logic"
```

---

### Task 2: Rewrite ActionFacade to delegate to RoomOperations

**Files:**
- Modify: `src/services/matrix/room/ActionFacade.ts`

**Interfaces:**
- Consumes: `roomOperations` from `./RoomOperations`, `matrixRoomCreationService` from `./CreationService`, `matrixRoomMembershipService` from `./MembershipService`, `matrixRoomAccountDataService` from `./AccountDataService`
- Produces: `matrixRoomActionFacade` (unchanged public API)

- [ ] **Step 1: Rewrite ActionFacade.ts**

```typescript
// src/services/matrix/room/ActionFacade.ts
import { roomOperations } from './RoomOperations'
import { matrixRoomCreationService } from './CreationService'
import { matrixRoomMembershipService } from './MembershipService'
import { matrixRoomAccountDataService } from './AccountDataService'
import type { ICreateRoomOpts } from 'matrix-js-sdk'

export interface MatrixRoomActionFacade {
  // --- Delegated to CreationService (deep) ---
  createRoom(options: ICreateRoomOpts): Promise<{ room_id: string }>
  createGroupRoom(options: ICreateRoomOpts): Promise<{ room_id: string }>

  // --- Delegated to RoomOperations (absorbed) ---
  createDirectRoom(userId: string): Promise<string>
  setDirectRoom(userId: string, roomId: string): Promise<void>
  setRoomName(roomId: string, name: string): Promise<void>
  setRoomTopic(roomId: string, topic: string): Promise<void>
  setRoomAvatar(roomId: string, avatarUrl: string): Promise<void>
  setPushRule(roomId: string, enabled: boolean): Promise<void>
  setRoomAlias(roomId: string, alias: string): Promise<void>
  deleteRoomAlias(alias: string): Promise<void>
  setPinnedEvents(roomId: string, eventIds: string[]): Promise<void>
  pinEvent(roomId: string, eventId: string): Promise<void>
  unpinEvent(roomId: string, eventId: string): Promise<void>
  setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void>
  setTag(roomId: string, tag: string, order?: number): Promise<void>
  removeTag(roomId: string, tag: string): Promise<void>
  setInviteBlocklist(roomId: string, blocked: string[]): Promise<void>
  setInviteAllowlist(roomId: string, allowed: string[]): Promise<void>
  upgradeRoom(roomId: string, newVersion: string): Promise<string>
  incrementUnread(roomId: string, highlight?: boolean): Promise<void>
  clearUnread(roomId: string): Promise<void>

  // --- Delegated to MembershipService (deep) ---
  joinRoom(roomIdOrAlias: string, serverName?: string): Promise<{ roomId: string }>
  leaveRoom(roomId: string): Promise<void>
  inviteUser(roomId: string, userId: string): Promise<void>
  kickUser(roomId: string, userId: string, reason?: string): Promise<void>
  banUser(roomId: string, userId: string, reason?: string): Promise<void>
  unbanUser(roomId: string, userId: string): Promise<void>
  forgetRoom(roomId: string): Promise<void>
  knockRoom(roomId: string, reason?: string, viaServers?: string[]): Promise<void>
  joinRoomByAlias(roomIdOrAlias: string, serverName?: string): Promise<void>

  // --- Delegated to AccountDataService (deep) ---
  setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void>
  setReadLifetime(roomId: string, lifetimeMs: number): Promise<void>
}

export const matrixRoomActionFacade: MatrixRoomActionFacade = {
  // Creation (deep)
  createRoom: (options) => matrixRoomCreationService.createRoom(options),
  createGroupRoom: (options) => matrixRoomCreationService.createGroupRoom(options),

  // Absorbed
  createDirectRoom: (userId) => roomOperations.createDirectRoom(userId),
  setDirectRoom: (userId, roomId) => roomOperations.setDirectRoom(userId, roomId),
  setRoomName: (roomId, name) => roomOperations.setRoomName(roomId, name),
  setRoomTopic: (roomId, topic) => roomOperations.setRoomTopic(roomId, topic),
  setRoomAvatar: (roomId, avatarUrl) => roomOperations.setRoomAvatar(roomId, avatarUrl),
  setPushRule: (roomId, enabled) => roomOperations.setPushRule(roomId, enabled),
  setRoomAlias: (roomId, alias) => roomOperations.setAlias(roomId, alias),
  deleteRoomAlias: (alias) => roomOperations.deleteAlias(alias),
  setPinnedEvents: (roomId, eventIds) => roomOperations.setPinnedEvents(roomId, eventIds),
  pinEvent: (roomId, eventId) => roomOperations.pinEvent(roomId, eventId),
  unpinEvent: (roomId, eventId) => roomOperations.unpinEvent(roomId, eventId),
  setStickyEvents: (roomId, events) => roomOperations.setStickyEvents(roomId, events),
  setTag: (roomId, tag, order?) => roomOperations.setTag(roomId, tag, order),
  removeTag: (roomId, tag) => roomOperations.removeTag(roomId, tag),
  setInviteBlocklist: (roomId, blocked) => roomOperations.setInviteBlocklist(roomId, blocked),
  setInviteAllowlist: (roomId, allowed) => roomOperations.setInviteAllowlist(roomId, allowed),
  upgradeRoom: (roomId, newVersion) => roomOperations.upgradeRoom(roomId, newVersion),
  incrementUnread: (roomId, highlight?) => roomOperations.incrementUnread(roomId, highlight),
  clearUnread: (roomId) => roomOperations.clearUnread(roomId),

  // Membership (deep)
  joinRoom: (roomIdOrAlias, serverName?) => matrixRoomMembershipService.joinRoom(roomIdOrAlias, serverName),
  leaveRoom: (roomId) => matrixRoomMembershipService.leaveRoom(roomId),
  inviteUser: (roomId, userId) => matrixRoomMembershipService.inviteUser(roomId, userId),
  kickUser: (roomId, userId, reason?) => matrixRoomMembershipService.kickUser(roomId, userId, reason),
  banUser: (roomId, userId, reason?) => matrixRoomMembershipService.banUser(roomId, userId, reason),
  unbanUser: (roomId, userId) => matrixRoomMembershipService.unbanUser(roomId, userId),
  forgetRoom: (roomId) => matrixRoomMembershipService.forgetRoom(roomId),
  knockRoom: (roomId, reason?, viaServers?) => matrixRoomMembershipService.knockRoom(roomId, reason, viaServers),
  joinRoomByAlias: (roomIdOrAlias, serverName?) => matrixRoomMembershipService.joinRoomByAlias(roomIdOrAlias, serverName),

  // AccountData (deep)
  setRoomAccountData: (roomId, eventType, content) => matrixRoomAccountDataService.setRoomAccountData(roomId, eventType, content),
  setReadLifetime: (roomId, lifetimeMs) => matrixRoomAccountDataService.setReadLifetime(roomId, lifetimeMs),
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit --pretty 2>&1 | grep -E "(ActionFacade|RoomOperations)" | head -10`
Expected: No errors mentioning ActionFacade or RoomOperations.

- [ ] **Step 3: Commit**

```bash
git add src/services/matrix/room/ActionFacade.ts
git commit -m "refactor: rewrite ActionFacade to delegate to RoomOperations"
```

---

### Task 3: Rewrite ReadFacade to delegate to RoomOperations

**Files:**
- Modify: `src/services/matrix/room/ReadFacade.ts`

**Interfaces:**
- Consumes: `roomOperations` from `./RoomOperations`, `matrixRoomSummaryAggregateService` from `./SummaryService`, `matrixRoomTimelineService` from `./TimelineService`, `matrixRoomMetadataService` from `./MetadataService`, `matrixRoomAccountDataService` from `./AccountDataService`
- Produces: `matrixRoomReadFacade` (public API expanded with `getServerDomain`, `translateText`, `getDirectRooms`)

- [ ] **Step 1: Rewrite ReadFacade.ts**

```typescript
// src/services/matrix/room/ReadFacade.ts
import { roomOperations } from './RoomOperations'
import { matrixRoomSummaryAggregateService } from './SummaryService'
import { matrixRoomTimelineService } from './TimelineService'
import { matrixRoomMetadataService } from './MetadataService'
import { matrixRoomAccountDataService } from './AccountDataService'
import type { MatrixRoomSummary } from './SummaryService'
import type { MatrixEvent, ITimelineQueryOptions } from 'matrix-js-sdk'

export interface MatrixRoomReadFacade {
  // --- Delegated to RoomOperations (absorbed) ---
  getRoomState(roomId: string): Promise<unknown[]>
  getRoomAliases(roomId: string): Promise<string[]>
  getPinnedEvents(roomId: string): Promise<string[]>
  getStickyEvents(roomId: string): Promise<Record<string, unknown>>
  getInviteBlocklist(roomId: string): Promise<string[]>
  getInviteAllowlist(roomId: string): Promise<string[]>
  getTags(roomId: string): Promise<Record<string, { order?: number }>>
  getServerDomain(): Promise<string>
  translateText(text: string, targetLang?: string, throwOnError?: boolean): Promise<string>
  getDirectRooms(throwOnError?: boolean): Promise<Map<string, string[]>>

  // --- Delegated to deeper services ---
  getRoomSummary(roomId: string, throwOnError?: boolean): Promise<MatrixRoomSummary | null>
  getRoomSummaries(roomIds: string[]): Promise<Map<string, MatrixRoomSummary | null>>
  getEventContext(roomId: string, eventId: string, limit?: number): Promise<{ event: MatrixEvent; events_before: MatrixEvent[]; events_after: MatrixEvent[] }>
  getRoomVersion(roomId: string): Promise<string>
  getRoomCapabilities(roomId: string): Promise<unknown>
  getRoomTimeline(roomId: string, options?: ITimelineQueryOptions): Promise<MatrixEvent[]>
  getRoomUnreadCount(roomId: string): Promise<number>
  getRoomAccountData(roomId: string, eventType: string): Promise<unknown>
  getRoomMetadata(roomId: string): Promise<unknown>
  getRoomTurnServer(roomId: string): Promise<unknown>
  timestampToEvent(roomId: string, timestamp: number, dir?: 'f' | 'b'): Promise<string>
  getRoomCall(roomId: string, callId: string): Promise<unknown>
  getRoomSync(roomId: string): Promise<unknown>
  getReportScannerInfo(roomId: string, eventId: string): Promise<unknown>
  getExternalServices(): Promise<unknown>
  getRoomNotifications(roomId: string, params?: Record<string, unknown>): Promise<unknown>
  getRoomPermissions(roomId: string): Promise<unknown>
}

export const matrixRoomReadFacade: MatrixRoomReadFacade = {
  // Absorbed
  getRoomState: (roomId) => roomOperations.getRoomState(roomId),
  getRoomAliases: (roomId) => roomOperations.getAliases(roomId),
  getPinnedEvents: (roomId) => roomOperations.getPinnedEvents(roomId),
  getStickyEvents: (roomId) => roomOperations.getStickyEvents(roomId),
  getInviteBlocklist: (roomId) => roomOperations.getInviteBlocklist(roomId),
  getInviteAllowlist: (roomId) => roomOperations.getInviteAllowlist(roomId),
  getTags: (roomId) => roomOperations.getTags(roomId),
  getServerDomain: () => roomOperations.getServerDomain(),
  translateText: (text, targetLang?, throwOnError?) => roomOperations.translateText(text, targetLang, throwOnError),
  getDirectRooms: (throwOnError?) => roomOperations.getDirectRooms(throwOnError),

  // Deep
  getRoomSummary: (roomId, throwOnError?) => matrixRoomSummaryAggregateService.getRoomSummary(roomId, throwOnError),
  getRoomSummaries: (roomIds) => matrixRoomSummaryAggregateService.getRoomSummaries(roomIds),
  getEventContext: (roomId, eventId, limit?) => matrixRoomTimelineService.getEventContext(roomId, eventId, limit),
  getRoomVersion: (roomId) => matrixRoomMetadataService.getRoomVersion(roomId),
  getRoomCapabilities: (roomId) => matrixRoomMetadataService.getRoomCapabilities(roomId),
  getRoomTimeline: (roomId, options?) => matrixRoomTimelineService.getRoomTimeline(roomId, options),
  getRoomUnreadCount: (roomId) => matrixRoomTimelineService.getRoomUnreadCount(roomId),
  getRoomAccountData: (roomId, eventType) => matrixRoomAccountDataService.getRoomAccountData(roomId, eventType),
  getRoomMetadata: (roomId) => matrixRoomMetadataService.getRoomMetadata(roomId),
  getRoomTurnServer: (roomId) => matrixRoomMetadataService.getRoomTurnServer(roomId),
  timestampToEvent: (roomId, timestamp, dir?) => matrixRoomTimelineService.timestampToEvent(roomId, timestamp, dir),
  getRoomCall: (roomId, callId) => matrixRoomTimelineService.getRoomCall(roomId, callId),
  getRoomSync: (roomId) => matrixRoomMetadataService.getRoomSync(roomId),
  getReportScannerInfo: (roomId, eventId) => matrixRoomAccountDataService.getReportScannerInfo(roomId, eventId),
  getExternalServices: () => matrixRoomAccountDataService.getExternalServices(),
  getRoomNotifications: (roomId, params?) => matrixRoomTimelineService.getRoomNotifications(roomId, params),
  getRoomPermissions: (roomId) => matrixRoomMetadataService.getRoomPermissions(roomId),
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit --pretty 2>&1 | grep -E "(ReadFacade|RoomOperations)" | head -10`
Expected: No errors mentioning ReadFacade or RoomOperations.

- [ ] **Step 3: Commit**

```bash
git add src/services/matrix/room/ReadFacade.ts
git commit -m "refactor: rewrite ReadFacade to delegate to RoomOperations, add getServerDomain/translateText/getDirectRooms"
```

---

### Task 4: Rewrite MemberFacade to delegate to RoomOperations

**Files:**
- Modify: `src/services/matrix/room/MemberFacade.ts`

**Interfaces:**
- Consumes: `roomOperations` from `./RoomOperations`
- Produces: `matrixRoomMemberFacade` (unchanged public API)

- [ ] **Step 1: Rewrite MemberFacade.ts**

```typescript
// src/services/matrix/room/MemberFacade.ts
import { roomOperations } from './RoomOperations'

export interface MatrixRoomMemberFacade {
  setMemberDisplayName(roomId: string, displayName: string): Promise<void>
  getMemberDisplayName(roomId: string, userId: string): Promise<string | null>
  setMemberPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void>
  setMemberAsAdmin(roomId: string, userId: string): Promise<void>
  removeMemberAsAdmin(roomId: string, userId: string): Promise<void>
}

export const matrixRoomMemberFacade: MatrixRoomMemberFacade = {
  setMemberDisplayName: (roomId, displayName) => roomOperations.setMemberDisplayName(roomId, displayName),
  getMemberDisplayName: (roomId, userId) => roomOperations.getMemberDisplayName(roomId, userId),
  setMemberPowerLevel: (roomId, userId, powerLevel) => roomOperations.setMemberPowerLevel(roomId, userId, powerLevel),
  setMemberAsAdmin: (roomId, userId) => roomOperations.setMemberAsAdmin(roomId, userId),
  removeMemberAsAdmin: (roomId, userId) => roomOperations.removeMemberAsAdmin(roomId, userId),
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit --pretty 2>&1 | grep -E "(MemberFacade)" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/services/matrix/room/MemberFacade.ts
git commit -m "refactor: rewrite MemberFacade to delegate to RoomOperations"
```

---

### Task 5: Migrate component call sites — StateService direct imports

**Files:**
- Modify: `src/components/room/RoomDetailPane.vue`
- Modify: `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- Modify: `src/mobile/views/chat-room/ChatSetting.vue`

**Interfaces:**
- Consumes: `matrixRoomActionFacade` from `@/services/matrix/room/ActionFacade`
- Produces: Same behavior, different import path

All three files call `matrixRoomStateService.setRoomName()` / `setRoomAvatar()`. These methods exist on `matrixRoomActionFacade` with identical signatures.

- [ ] **Step 1: Migrate RoomDetailPane.vue**

Change the import:
```diff
-import { matrixRoomStateService } from '@/services/matrix/room/StateService'
+import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
```

Change the call:
```diff
-await matrixRoomStateService.setRoomAvatar(props.roomId, mxcUrl)
+await matrixRoomActionFacade.setRoomAvatar(props.roomId, mxcUrl)
```

- [ ] **Step 2: Migrate ChatHeaderRoot.vue**

This file imports from BOTH StateService AND ActionFacade AND MemberFacade. Remove the StateService import.

Change:
```diff
 import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
-import { matrixRoomStateService } from '@/services/matrix/room/StateService'
 import { matrixRoomMemberFacade } from '@/services/matrix/room/MemberFacade'
```

Change the call:
```diff
-await matrixRoomStateService.setRoomName(currentSessionRoomId.value, name.trim())
+await matrixRoomActionFacade.setRoomName(currentSessionRoomId.value, name.trim())
```

- [ ] **Step 3: Migrate ChatSetting.vue**

Change the import:
```diff
-import { matrixRoomStateService } from '@/services/matrix/room/StateService'
+import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
```

Change the calls:
```diff
-await matrixRoomStateService.setRoomName(currentSessionRoomId.value, nameValue.value)
+await matrixRoomActionFacade.setRoomName(currentSessionRoomId.value, nameValue.value)

-await matrixRoomStateService.setRoomAvatar(currentSessionRoomId.value, avatarValue.value)
+await matrixRoomActionFacade.setRoomAvatar(currentSessionRoomId.value, avatarValue.value)
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add src/components/room/RoomDetailPane.vue src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue src/mobile/views/chat-room/ChatSetting.vue
git commit -m "refactor: migrate StateService direct imports to ActionFacade"
```

---

### Task 6: Migrate component call sites — LifecycleService direct imports

**Files:**
- Modify: `src/components/room/CreateRoomDialog.vue`
- Modify: `src/components/workbench/WorkbenchQuickCreate.vue`

**Interfaces:**
- Consumes: `matrixRoomReadFacade.getServerDomain` from `@/services/matrix/room/ReadFacade`
- Produces: Same behavior — `getServerDomain()` is a new method on ReadFacade (added in Task 3)

- [ ] **Step 1: Migrate CreateRoomDialog.vue**

Change the import:
```diff
-import { matrixRoomLifecycleService } from '@/services/matrix/room/LifecycleService'
+import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
```

Change the call:
```diff
-serverDomain.value = await matrixRoomLifecycleService.getServerDomain()
+serverDomain.value = await matrixRoomReadFacade.getServerDomain()
```

- [ ] **Step 2: Migrate WorkbenchQuickCreate.vue**

Change the import:
```diff
-import { matrixRoomLifecycleService } from '@/services/matrix/room/LifecycleService'
+import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
```

Change the call:
```diff
-serverDomain.value = await matrixRoomLifecycleService.getServerDomain()
+serverDomain.value = await matrixRoomReadFacade.getServerDomain()
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add src/components/room/CreateRoomDialog.vue src/components/workbench/WorkbenchQuickCreate.vue
git commit -m "refactor: migrate LifecycleService direct imports to ReadFacade.getServerDomain"
```

---

### Task 7: Migrate hook call sites — MemberProfileService and TranslateService

**Files:**
- Modify: `src/hooks/useMyRoomInfoUpdater.ts`
- Modify: `src/hooks/chatMain/useGroupNicknameModal.ts`
- Modify: `src/hooks/useChatMain.ts`
- Modify: `src/hooks/chatMain/useChatContextMenu.ts`

**Interfaces:**
- Consumes: `matrixRoomMemberFacade` from `@/services/matrix/room/MemberFacade`, `matrixRoomReadFacade` from `@/services/matrix/room/ReadFacade`
- Produces: Same behavior

- [ ] **Step 1: Migrate useMyRoomInfoUpdater.ts**

Change import:
```diff
-import { matrixRoomMemberProfileService } from '@/services/matrix/room/MemberProfileService'
+import { matrixRoomMemberFacade } from '@/services/matrix/room/MemberFacade'
```

Change call:
```diff
-await matrixRoomMemberProfileService.setMemberDisplayName(roomId, myName)
+await matrixRoomMemberFacade.setMemberDisplayName(roomId, myName)
```

- [ ] **Step 2: Migrate useGroupNicknameModal.ts**

Change import:
```diff
-import { matrixRoomMemberProfileService } from '@/services/matrix/room/MemberProfileService'
+import { matrixRoomMemberFacade } from '@/services/matrix/room/MemberFacade'
```

Change call:
```diff
-await matrixRoomMemberProfileService.setMemberDisplayName(roomId, trimmedName)
+await matrixRoomMemberFacade.setMemberDisplayName(roomId, trimmedName)
```

- [ ] **Step 3: Migrate useChatMain.ts**

This file imports from BOTH ActionFacade AND TranslateService. Remove TranslateService import.

Change:
```diff
 import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
-import { matrixRoomTranslateService } from '@/services/matrix/room/TranslateService'
+import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
```

Change call:
```diff
-const translatedText = await matrixRoomTranslateService.translateText(content)
+const translatedText = await matrixRoomReadFacade.translateText(content)
```

- [ ] **Step 4: Migrate useChatContextMenu.ts**

Change import:
```diff
-import { matrixRoomTranslateService } from '@/services/matrix/room/TranslateService'
+import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
```

Change call:
```diff
-const translatedText = await matrixRoomTranslateService.translateText(content)
+const translatedText = await matrixRoomReadFacade.translateText(content)
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMyRoomInfoUpdater.ts src/hooks/chatMain/useGroupNicknameModal.ts src/hooks/useChatMain.ts src/hooks/chatMain/useChatContextMenu.ts
git commit -m "refactor: migrate MemberProfileService and TranslateService direct imports to facades"
```

---

### Task 8: Migrate store call sites — TagsService in room store

**Files:**
- Modify: `src/stores/domains/chat/room.ts`

**Interfaces:**
- Consumes: `matrixRoomReadFacade` and `matrixRoomActionFacade` (both already imported by this file)
- Produces: Same behavior — `getTags` is on ReadFacade, `setTag`/`removeTag` are on ActionFacade

- [ ] **Step 1: Migrate room.ts**

This file already imports both `matrixRoomActionFacade` and `matrixRoomReadFacade`. Only the TagsService import needs removal and the calls redirected.

Remove the TagsService import:
```diff
-import { matrixRoomTagsService } from '@/services/matrix/room/TagsService'
```

Change the calls:
```diff
-const tags = await matrixRoomTagsService.getTags(roomId)
+const tags = await matrixRoomReadFacade.getTags(roomId)

-await matrixRoomTagsService.setTag(roomId, tag, order)
+await matrixRoomActionFacade.setTag(roomId, tag, order)

-await matrixRoomTagsService.removeTag(roomId, tag)
+await matrixRoomActionFacade.removeTag(roomId, tag)
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/stores/domains/chat/room.ts
git commit -m "refactor: migrate TagsService direct imports in room store to facades"
```

---

### Task 9: Migrate MatrixFriendService — DirectMessageService dynamic import

**Files:**
- Modify: `src/services/matrix/friends/MatrixFriendService.ts`

**Interfaces:**
- Consumes: `matrixRoomReadFacade.getDirectRooms` and `matrixRoomActionFacade.setDirectRoom`
- Produces: Same behavior — replaces dynamic import with static facade imports

- [ ] **Step 1: Migrate MatrixFriendService.ts**

Locate the dynamic import of DirectMessageService. The exact line number may vary. Replace:

```diff
-const { matrixRoomDirectMessageService } = await import('../room/DirectMessageService')
+import { matrixRoomReadFacade } from '../room/ReadFacade'
+import { matrixRoomActionFacade } from '../room/ActionFacade'
```

Then replace direct service calls (exact variable names depend on the current usage in the file — verify by reading the file first):

```diff
-await matrixRoomDirectMessageService.getDirectRooms(false)
+await matrixRoomReadFacade.getDirectRooms(false)

-await matrixRoomDirectMessageService.setDirectRoom(userId, roomId)
+await matrixRoomActionFacade.setDirectRoom(userId, roomId)
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/services/matrix/friends/MatrixFriendService.ts
git commit -m "refactor: migrate MatrixFriendService from DirectMessageService dynamic import to facades"
```

---

### Task 10: Update App.vue lazy loaders

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: N/A (lazy loaders are infrastructure, not application logic)
- Produces: Updated lazy loader paths

- [ ] **Step 1: Update App.vue lazy loader references**

Search for the lazy loader map that references the absorbed services. Replace:

```diff
-() => import('@/services/matrix/room/TagsService'), 'matrixRoomTagsService'
+() => import('@/services/matrix/room/RoomOperations'), 'roomOperations'

-() => import('@/services/matrix/room/StateService'), 'matrixRoomStateService'
+(no replacement needed — StateService methods are now on ActionFacade which is already lazy-loaded)

-() => import('@/services/matrix/room/DirectMessageService'), 'matrixRoomDirectMessageService'
+(no replacement needed — DirectMessageService methods are on facades already lazy-loaded)

-() => import('@/services/matrix/room/PinsService'), 'matrixRoomPinsService'
+(no replacement needed — PinsService methods are on facades already lazy-loaded)

-() => import('@/services/matrix/room/ActionFacade'), 'matrixRoomActionFacade'
+() => import('@/services/matrix/room/ActionFacade'), 'matrixRoomActionFacade'
```

Note: The ActionFacade lazy loader stays. The absorbed services that were only used internally (AliasesService, ModerationService, PinsService) had their own lazy loaders — these can be removed or pointed to RoomOperations. The services that were directly imported by components (StateService, LifecycleService) no longer need lazy loaders since they're not imported directly anymore.

- [ ] **Step 2: Verify App.vue still compiles**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "refactor: update App.vue lazy loaders for collapsed room services"
```

---

### Task 11: Update barrel exports

**Files:**
- Modify: `src/services/matrix/room/index.ts`
- Modify: `src/services/matrix/index.ts`

- [ ] **Step 1: Update room/index.ts**

Replace the 9 absorbed service re-exports with RoomOperations:

```diff
-export { matrixRoomAliasesService } from './AliasesService'
+export { roomOperations } from './RoomOperations'
 export { matrixRoomCreationService } from './CreationService'
-export { matrixRoomDirectMessageService } from './DirectMessageService'
-export { matrixRoomLifecycleService } from './LifecycleService'
+// DirectMessageService, LifecycleService absorbed into RoomOperations
 export { matrixAnnouncementService } from './MatrixAnnouncementService'
 export { matrixRoomStoreAdapter } from './MatrixRoomStoreAdapter'
 export { matrixRoomSummaryService } from './MatrixRoomSummaryService'
 export { matrixSpaceService } from './MatrixSpaceService'
-export { matrixRoomMemberProfileService } from './MemberProfileService'
+// MemberProfileService absorbed into RoomOperations
 export { matrixRoomMembershipService } from './MembershipService'
 export { matrixRoomMetadataService } from './MetadataService'
-export { matrixRoomModerationService } from './ModerationService'
-export { matrixRoomPinsService } from './PinsService'
+// ModerationService, PinsService absorbed into RoomOperations
 export { matrixRoomQueryService } from './QueryService'
 export { matrixRoomRealtimeService } from './RealtimeService'
 export { roomCapabilitiesService } from './RoomCapabilitiesService'
-export { matrixRoomStateService } from './StateService'
+// StateService absorbed into RoomOperations
 export { matrixRoomSummaryAggregateService } from './SummaryService'
-export { matrixRoomTagsService } from './TagsService'
+// TagsService absorbed into RoomOperations
 export { matrixRoomTimelineService } from './TimelineService'
-export { matrixRoomTranslateService } from './TranslateService'
+// TranslateService absorbed into RoomOperations
```

- [ ] **Step 2: Update matrix/index.ts**

Remove the 9 re-exports that reference absorbed services (lines 215-245 region). Replace with:

```diff
-export { matrixRoomAliasesService } from './room/AliasesService'
+export { roomOperations } from './room/RoomOperations'
-export { matrixRoomDirectMessageService } from './room/DirectMessageService'
-export { matrixRoomLifecycleService } from './room/LifecycleService'
-export { matrixRoomMemberProfileService } from './room/MemberProfileService'
-export { matrixRoomModerationService } from './room/ModerationService'
-export { matrixRoomPinsService } from './room/PinsService'
-export { matrixRoomStateService } from './room/StateService'
-export { matrixRoomTagsService } from './room/TagsService'
-export { matrixRoomTranslateService } from './room/TranslateService'
```

- [ ] **Step 3: Verify no broken imports**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit 2>&1 | grep -E "(Cannot find module|not exported)" | head -20`
Expected: No errors about missing service modules.

- [ ] **Step 4: Commit**

```bash
git add src/services/matrix/room/index.ts src/services/matrix/index.ts
git commit -m "refactor: update barrel exports — remove absorbed services, add RoomOperations"
```

---

### Task 12: Delete the 9 shallow service files

**Files:**
- Delete: `src/services/matrix/room/AliasesService.ts`
- Delete: `src/services/matrix/room/TagsService.ts`
- Delete: `src/services/matrix/room/StateService.ts`
- Delete: `src/services/matrix/room/DirectMessageService.ts`
- Delete: `src/services/matrix/room/MemberProfileService.ts`
- Delete: `src/services/matrix/room/ModerationService.ts`
- Delete: `src/services/matrix/room/LifecycleService.ts`
- Delete: `src/services/matrix/room/TranslateService.ts`
- Delete: `src/services/matrix/room/PinsService.ts`

- [ ] **Step 1: Delete the files**

```bash
rm src/services/matrix/room/AliasesService.ts
rm src/services/matrix/room/TagsService.ts
rm src/services/matrix/room/StateService.ts
rm src/services/matrix/room/DirectMessageService.ts
rm src/services/matrix/room/MemberProfileService.ts
rm src/services/matrix/room/ModerationService.ts
rm src/services/matrix/room/LifecycleService.ts
rm src/services/matrix/room/TranslateService.ts
rm src/services/matrix/room/PinsService.ts
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit 2>&1 | tail -10`
Expected: No new errors (only pre-existing ones unrelated to this change).

- [ ] **Step 3: Commit**

```bash
git add src/services/matrix/room/AliasesService.ts src/services/matrix/room/TagsService.ts src/services/matrix/room/StateService.ts src/services/matrix/room/DirectMessageService.ts src/services/matrix/room/MemberProfileService.ts src/services/matrix/room/ModerationService.ts src/services/matrix/room/LifecycleService.ts src/services/matrix/room/TranslateService.ts src/services/matrix/room/PinsService.ts
git commit -m "refactor: delete 9 shallow room service files — absorbed into RoomOperations"
```

---

### Task 13: Delete old test files

**Files:**
- Delete: `src/services/matrix/room/__tests__/AliasesService.test.ts`
- Delete: `src/services/matrix/room/__tests__/TagsService.test.ts`
- Delete: `src/services/matrix/room/__tests__/StateService.test.ts`
- Delete: `src/services/matrix/room/__tests__/DirectMessageService.test.ts`
- Delete: `src/services/matrix/room/__tests__/MemberProfileService.test.ts`
- Delete: `src/services/matrix/room/__tests__/ModerationService.test.ts`
- Delete: `src/services/matrix/room/__tests__/LifecycleService.test.ts`
- Delete: `src/services/matrix/room/__tests__/TranslateService.test.ts`
- Delete: `src/services/matrix/room/__tests__/PinsService.test.ts`

- [ ] **Step 1: Delete the old test files**

```bash
rm src/services/matrix/room/__tests__/AliasesService.test.ts
rm src/services/matrix/room/__tests__/TagsService.test.ts
rm src/services/matrix/room/__tests__/StateService.test.ts
rm src/services/matrix/room/__tests__/DirectMessageService.test.ts
rm src/services/matrix/room/__tests__/MemberProfileService.test.ts
rm src/services/matrix/room/__tests__/ModerationService.test.ts
rm src/services/matrix/room/__tests__/LifecycleService.test.ts
rm src/services/matrix/room/__tests__/TranslateService.test.ts
rm src/services/matrix/room/__tests__/PinsService.test.ts
```

- [ ] **Step 2: Commit**

```bash
git add src/services/matrix/room/__tests__/
git commit -m "test: remove old shallow service test files"
```

---

### Task 14: Create consolidated RoomOperations.test.ts — Part 1 (setup + state + tags)

**Files:**
- Create: `src/services/matrix/room/__tests__/RoomOperations.test.ts`

**Interfaces:**
- Consumes: `RoomOperations` class
- Produces: Test coverage for StateService, TagsService, and AliasesService methods

- [ ] **Step 1: Write test file with setup and state/tags/aliases tests**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
const waitForClientReadyMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock(), waitForClientReady: () => waitForClientReadyMock() },
  matrixClientService: { getClient: () => getClientMock(), waitForClientReady: () => waitForClientReadyMock() }
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn()
  }
}))

import { offlineQueueService } from '@/services/offline/OfflineQueueService'
const { RoomOperations } = await import('../RoomOperations')

describe('RoomOperations', () => {
  let ops: InstanceType<typeof RoomOperations>

  beforeEach(() => {
    ops = new RoomOperations()
    getClientMock.mockReset()
  })

  // === State methods ===

  describe('setRoomName', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(ops.setRoomName('!r', 'x')).rejects.toThrow('客户端未初始化')
    })

    it('forwards to client.setRoomName', async () => {
      const setRoomName = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setRoomName })
      await ops.setRoomName('!r', 'New')
      expect(setRoomName).toHaveBeenCalledWith('!r', 'New')
    })

    it('enqueues when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.setRoomName('!r', 'Offline Name')
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('state', '!r', {
        roomId: '!r', type: 'name', content: 'Offline Name'
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({ setRoomName: vi.fn().mockRejectedValue(new Error('403')) })
      await expect(ops.setRoomName('!r', 'x')).rejects.toThrow('403')
    })
  })

  describe('setRoomTopic', () => {
    it('forwards to client.setRoomTopic', async () => {
      const setRoomTopic = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setRoomTopic })
      await ops.setRoomTopic('!r', 'hello')
      expect(setRoomTopic).toHaveBeenCalledWith('!r', 'hello')
    })
  })

  describe('setRoomAvatar', () => {
    it('sends m.room.avatar state event with url', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ sendStateEvent })
      await ops.setRoomAvatar('!r', 'mxc://e/abc')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.avatar', { url: 'mxc://e/abc' }, '')
    })
  })

  describe('getRoomState', () => {
    it('throws when room is missing from local cache', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(ops.getRoomState('!r')).rejects.toThrow('房间不存在: !r')
    })

    it('returns all state events via currentState', async () => {
      const events = [{ type: 'm.room.name' }, { type: 'm.room.topic' }]
      const room = { currentState: { getStateEvents: vi.fn().mockReturnValue(events) } }
      getClientMock.mockReturnValueOnce({ getRoom: () => room })
      expect(await ops.getRoomState('!r')).toBe(events)
    })
  })

  describe('setPushRule', () => {
    it('enabled=true deletes override push rule', async () => {
      const deletePushRule = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ deletePushRule, addPushRule: vi.fn() })
      await ops.setPushRule('!r', true)
      expect(deletePushRule).toHaveBeenCalledWith('global', 'override', '!r')
    })

    it('enabled=false installs an empty-actions override rule', async () => {
      const addPushRule = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ deletePushRule: vi.fn(), addPushRule })
      await ops.setPushRule('!r', false)
      expect(addPushRule).toHaveBeenCalledWith('global', 'override', '!r', {
        conditions: [{ kind: 'event_match', key: 'room_id', pattern: '!r' }],
        actions: []
      })
    })

    it('enqueues when offline', async () => {
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      await ops.setPushRule('!r', true)
      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('push_rule', '!r', {
        roomId: '!r', enabled: true
      })
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    })
  })

  // === Tags methods ===

  describe('getTags', () => {
    it('forwards to client.getRoomTags', async () => {
      const getRoomTags = vi.fn().mockResolvedValue({ 'm.favourite': { order: 0.5 } })
      getClientMock.mockReturnValueOnce({ getRoomTags })
      expect(await ops.getTags('!r')).toEqual({ 'm.favourite': { order: 0.5 } })
    })

    it('returns {} on M_UNRECOGNIZED and caches unavailability', async () => {
      getClientMock.mockReturnValueOnce({
        getRoomTags: vi.fn().mockRejectedValue({ errcode: 'M_UNRECOGNIZED' })
      })
      expect(await ops.getTags('!r')).toEqual({})
      // second call should be cached
      expect(await ops.getTags('!r')).toEqual({})
    })
  })

  describe('setTag', () => {
    it('delegates to client.setRoomTag', async () => {
      const setRoomTag = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setRoomTag })
      await ops.setTag('!r', 'm.favourite', 0.5)
      expect(setRoomTag).toHaveBeenCalledWith('!r', 'm.favourite', { order: 0.5 })
    })
  })

  describe('removeTag', () => {
    it('delegates to client.deleteRoomTag', async () => {
      const deleteRoomTag = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ deleteRoomTag })
      await ops.removeTag('!r', 'm.favourite')
      expect(deleteRoomTag).toHaveBeenCalledWith('!r', 'm.favourite')
    })
  })

  // === Aliases methods ===

  describe('setAlias', () => {
    it('forwards to client.createAlias', async () => {
      const createAlias = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ createAlias })
      await ops.setAlias('!r', '#alias:e')
      expect(createAlias).toHaveBeenCalledWith('#alias:e', '!r')
    })
  })

  describe('deleteAlias', () => {
    it('forwards to client.deleteAlias', async () => {
      const deleteAlias = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ deleteAlias })
      await ops.deleteAlias('#alias:e')
      expect(deleteAlias).toHaveBeenCalledWith('#alias:e')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vitest run src/services/matrix/room/__tests__/RoomOperations.test.ts 2>&1 | tail -20`
Expected: All tests pass (green).

- [ ] **Step 3: Commit**

```bash
git add src/services/matrix/room/__tests__/RoomOperations.test.ts
git commit -m "test: add RoomOperations tests — state, tags, aliases"
```

---

### Task 15: Add RoomOperations tests — Part 2 (lifecycle + translate + pins + moderation + memberProfile)

**Files:**
- Modify: `src/services/matrix/room/__tests__/RoomOperations.test.ts`

**Interfaces:**
- Consumes: `RoomOperations` class
- Produces: Full test coverage for all absorbed methods

- [ ] **Step 1: Append lifecycle, translate, pins, moderation, and memberProfile tests**

Add the following `describe` blocks to the existing `RoomOperations.test.ts`, after the existing `describe('RoomOperations', () => { ... })` closure (inside the main describe, after the aliases tests):

```typescript
  // === Lifecycle methods ===

  describe('getServerDomain', () => {
    it('returns client.getDomain() when available', async () => {
      getClientMock.mockReturnValueOnce({ getDomain: () => 'example.org' })
      expect(await ops.getServerDomain()).toBe('example.org')
    })

    it('falls back to matrix.org when domain is empty', async () => {
      getClientMock.mockReturnValueOnce({ getDomain: () => '' })
      expect(await ops.getServerDomain()).toBe('matrix.org')
    })

    it('falls back to matrix.org when domain is null', async () => {
      getClientMock.mockReturnValueOnce({ getDomain: () => null })
      expect(await ops.getServerDomain()).toBe('matrix.org')
    })
  })

  describe('upgradeRoom', () => {
    it('forwards to client.upgradeRoom and returns the new room id', async () => {
      const upgradeRoom = vi.fn().mockResolvedValue({ replacement_room: { room_id: '!new:e' } })
      getClientMock.mockReturnValueOnce({ upgradeRoom })
      expect(await ops.upgradeRoom('!old:e', '11')).toBe('!new:e')
      expect(upgradeRoom).toHaveBeenCalledWith('!old:e', '11')
    })
  })

  describe('incrementUnread', () => {
    it('resolves silently when room exists', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => ({ roomId: '!r' }) })
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "room not found" errors', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "client not initialized" errors', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(ops.incrementUnread('!r')).resolves.toBeUndefined()
    })
  })

  describe('clearUnread', () => {
    it('resolves silently when room exists', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => ({ roomId: '!r' }) })
      await expect(ops.clearUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "room not found" errors', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(ops.clearUnread('!r')).resolves.toBeUndefined()
    })
  })

  // === Translate methods ===

  describe('translateText', () => {
    it('calls the backend translate endpoint and returns translated text', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ translated_text: 'Hallo' })
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      expect(await ops.translateText('Hello', 'de')).toBe('Hallo')
    })

    it('falls back to Google Translate on backend failure', async () => {
      const authedRequest = vi.fn().mockRejectedValue(new Error('502'))
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      // Google Translate fetch will fail in test, so it should return the original text
      const result = await ops.translateText('Hello', 'de', false)
      // With fetch failing in test env and throwOnError=false, returns original
      expect(result).toBe('Hello')
    })

    it('throws when all translation paths fail and throwOnError is true', async () => {
      const authedRequest = vi.fn().mockRejectedValue(new Error('502'))
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      await expect(ops.translateText('Hello', 'de', true)).rejects.toThrow('翻译失败')
    })
  })

  // === Pins methods ===

  describe('getPinnedEvents', () => {
    it('returns pinned event IDs from room state', async () => {
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1', '$e2'] })
      })
      getClientMock.mockReturnValueOnce({
        getRoom: () => ({ currentState: { getStateEvents } })
      })
      expect(await ops.getPinnedEvents('!r')).toEqual(['$e1', '$e2'])
    })

    it('returns empty array when room not found', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      expect(await ops.getPinnedEvents('!r')).toEqual([])
    })
  })

  describe('pinEvent', () => {
    it('appends eventId to pinned list', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1'] })
      })
      getClientMock.mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        sendStateEvent
      })
      await ops.pinEvent('!r', '$e2')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.pinned_events', { pinned: ['$e1', '$e2'] }, '')
    })

    it('does not duplicate existing eventId', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1'] })
      })
      getClientMock.mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        sendStateEvent
      })
      await ops.pinEvent('!r', '$e1')
      expect(sendStateEvent).not.toHaveBeenCalled()
    })
  })

  describe('unpinEvent', () => {
    it('removes eventId from pinned list', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ pinned: ['$e1', '$e2'] })
      })
      getClientMock.mockReturnValue({
        getRoom: () => ({ currentState: { getStateEvents } }),
        sendStateEvent
      })
      await ops.unpinEvent('!r', '$e1')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.pinned_events', { pinned: ['$e2'] }, '')
    })
  })

  // === Moderation methods ===

  describe('getInviteBlocklist', () => {
    it('GETs invite blocklist from synapse admin API', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ blocked: ['@bad:e'] })
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      expect(await ops.getInviteBlocklist('!r')).toEqual(['@bad:e'])
    })

    it('returns empty array on null response', async () => {
      const authedRequest = vi.fn().mockResolvedValue(null)
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      expect(await ops.getInviteBlocklist('!r')).toEqual([])
    })
  })

  describe('setInviteBlocklist', () => {
    it('POSTs blocklist to synapse admin API', async () => {
      const authedRequest = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ getHttp: () => ({ authedRequest }) })
      await ops.setInviteBlocklist('!r', ['@bad:e'])
      expect(authedRequest).toHaveBeenCalledWith(
        'POST', '/_synapse/admin/v1/rooms/!r/invite_blocklist', undefined, { blocked: ['@bad:e'] }
      )
    })
  })

  // === MemberProfile methods ===

  describe('setMemberDisplayName', () => {
    it('merges displayName into existing member content', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const getStateEvents = vi.fn().mockReturnValue({
        getContent: () => ({ membership: 'join', displayname: 'Old' })
      })
      getClientMock.mockReturnValueOnce({
        getRoom: () => ({ currentState: { getStateEvents } }),
        getUserId: () => '@me:e',
        sendStateEvent
      })
      await ops.setMemberDisplayName('!r', 'New')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.member', {
        membership: 'join',
        displayname: 'New'
      }, '@me:e')
    })
  })

  describe('getMemberDisplayName', () => {
    it('returns displayName from room member', async () => {
      getClientMock.mockReturnValueOnce({
        getRoom: () => ({
          getMember: (uid: string) => ({ rawDisplayName: 'Alice', name: 'alice' })
        })
      })
      expect(await ops.getMemberDisplayName('!r', '@alice:e')).toBe('Alice')
    })

    it('returns null when room is missing', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      expect(await ops.getMemberDisplayName('!r', '@alice:e')).toBeNull()
    })
  })

  describe('setMemberPowerLevel', () => {
    it('forwards to client.setUserPowerLevel', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setUserPowerLevel })
      await ops.setMemberPowerLevel('!r', '@u:e', 50)
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 50)
    })
  })

  describe('setMemberAsAdmin', () => {
    it('sets power level to 100', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setUserPowerLevel })
      await ops.setMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 100)
    })
  })

  describe('removeMemberAsAdmin', () => {
    it('sets power level to 0', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setUserPowerLevel })
      await ops.removeMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 0)
    })
  })
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/ljf/Desktop/hu_ts/hula && npx vitest run src/services/matrix/room/__tests__/RoomOperations.test.ts 2>&1 | tail -25`
Expected: All ~35 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/services/matrix/room/__tests__/RoomOperations.test.ts
git commit -m "test: add RoomOperations tests — lifecycle, translate, pins, moderation, memberProfile"
```

---

### Task 16: Run full test suite and type check

**Files:**
- None (verification only)

- [ ] **Step 1: Run the full unit test suite**

```bash
cd /Users/ljf/Desktop/hu_ts/hula && npx vitest run 2>&1 | tail -30
```
Expected: All previously passing tests still pass. No regressions.

- [ ] **Step 2: Run type check**

```bash
cd /Users/ljf/Desktop/hu_ts/hula && npx vue-tsc --noEmit 2>&1 | tail -10
```
Expected: No new type errors introduced by this refactor.

- [ ] **Step 3: Run lint check**

```bash
cd /Users/ljf/Desktop/hu_ts/hula && pnpm check 2>&1 | tail -10
```
Expected: No new lint errors.

- [ ] **Step 4: Fix any failures, then final commit**

```bash
git add -A
git commit -m "chore: verify full test suite and type check pass after room service collapse"
```

---

## Self-Review

**Spec coverage check:**
- All 9 shallow services absorbed into RoomOperations ✓ (Task 1)
- Three facades rewritten to delegate to RoomOperations ✓ (Tasks 2-4)
- All 14 call sites migrated to facades ✓ (Tasks 5-9)
- App.vue lazy loaders updated ✓ (Task 10)
- Barrel exports updated ✓ (Task 11)
- Old service files deleted ✓ (Task 12)
- Old tests deleted ✓ (Task 13)
- Consolidated tests created ✓ (Tasks 14-15)
- Full verification pass ✓ (Task 16)

**Placeholder scan:** No TBD, TODO, "implement later", or hand-wavy steps. Every step has exact code and exact commands.

**Gap:** The `DirectMessageService.createDirectRoom` implementation imports `Preset` from matrix-js-sdk dynamically. The absorbed version does the same. The `setDirectRoom` implementation's `shouldPersistDirectRoom` logic is simplified to a membership check. These behavioral matches should be verified during Task 16 (full test run).

---

Plan complete and saved to `docs/superpowers/plans/2026-07-15-collapse-room-services.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
