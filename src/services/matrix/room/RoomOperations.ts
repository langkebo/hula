// src/services/matrix/room/RoomOperations.ts

import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { BaseMatrixService } from '../BaseMatrixService'

export class RoomOperations extends BaseMatrixService {
  // --- Aliases (was AliasesService) ---

  async getAliases(roomId: string): Promise<string[]> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) throw new Error(`房间不存在: ${roomId}`)
    const canonical =
      (room.currentState.getStateEvents('m.room.canonical_alias', '')?.getContent()?.alias as string | undefined) ??
      null
    const altEvents =
      (room.currentState.getStateEvents('m.room.alt_aliases', '')?.getContent()?.alt_aliases as string[] | undefined) ??
      []
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
    await client.setRoomTag(roomId, tag, order ? { order } : (undefined as any))
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

  async getDirectRooms(_throwOnError: boolean = true): Promise<Map<string, string[]>> {
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
    const res = (await client
      .getHttp()
      .authedRequest('GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/invite_blocklist`)) as {
      blocked?: string[]
    }
    return res?.blocked ?? []
  }

  async setInviteBlocklist(roomId: string, blocked: string[]): Promise<void> {
    const client = this.getClient()
    await client
      .getHttp()
      .authedRequest('POST', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/invite_blocklist`, undefined, {
        blocked
      })
  }

  async getInviteAllowlist(roomId: string): Promise<string[]> {
    const client = this.getClient()
    const res = (await client
      .getHttp()
      .authedRequest('GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/invite_allowlist`)) as {
      allowed?: string[]
    }
    return res?.allowed ?? []
  }

  async setInviteAllowlist(roomId: string, allowed: string[]): Promise<void> {
    const client = this.getClient()
    await client
      .getHttp()
      .authedRequest('POST', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/invite_allowlist`, undefined, {
        allowed
      })
  }

  // --- Lifecycle (was LifecycleService) ---

  async getServerDomain(): Promise<string> {
    const { matrixClientService } = await import('../MatrixClientService')
    await matrixClientService.waitForClientReady()
    const client = this.getClient()
    const domain = client.getDomain()
    if (domain) return domain
    try {
      const url = new URL(client.baseUrl)
      if (url.hostname) return url.hostname
    } catch {
      /* not a valid URL */
    }
    return 'matrix.org'
  }

  async upgradeRoom(roomId: string, newVersion: string): Promise<string> {
    const client = this.getClient()
    const result = await client.upgradeRoom(roomId, newVersion)
    return result.replacement_room
  }

  async incrementUnread(roomId: string, _highlight?: boolean): Promise<void> {
    try {
      const client = this.getClient()
      if (!client) return
      const room = client.getRoom(roomId)
      if (!room) return
    } catch {
      /* advisory counter; ignore all errors */
    }
  }

  async clearUnread(roomId: string): Promise<void> {
    try {
      const client = this.getClient()
      if (!client) return
      const room = client.getRoom(roomId)
      if (!room) return
    } catch {
      /* advisory counter; ignore all errors */
    }
  }

  // --- Translate (was TranslateService) ---

  async translateText(text: string, targetLang?: string, throwOnErrorOrSource?: boolean | string): Promise<string> {
    const throwOnError = typeof throwOnErrorOrSource === 'boolean' ? throwOnErrorOrSource : true
    const sourceLang = typeof throwOnErrorOrSource === 'string' ? throwOnErrorOrSource : undefined
    const lang = targetLang ?? 'en'
    const client = this.getClient()
    try {
      const res = (await client.getHttp().authedRequest('POST', '/_matrix/client/v3/translate', undefined, {
        text,
        target_lang: lang,
        source_lang: sourceLang
      })) as { translated_text?: string }
      return res?.translated_text ?? text
    } catch {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang ?? 'auto'}&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`
        const res = await fetch(url)
        const json = (await res.json()) as any
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
    return (event?.getContent()?.pinned as string[]) ?? []
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
    await this.setPinnedEvents(
      roomId,
      current.filter((id) => id !== eventId)
    )
  }

  async getStickyEvents(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    const res = (await client
      .getHttp()
      .authedRequest('GET', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/sticky_events`)) as Record<
      string,
      unknown
    >
    return res ?? {}
  }

  async setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('sticky', roomId, { events })
      return
    }
    const client = this.getClient()
    await client
      .getHttp()
      .authedRequest('POST', `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/sticky_events`, undefined, events)
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
    await client.sendStateEvent(
      roomId,
      'm.room.member',
      {
        ...currentContent,
        displayname: displayName,
        third_party_invite: isThirdPartyInvite ? currentContent.third_party_invite : undefined
      },
      myUserId
    )
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
