import { Preset, Visibility } from 'matrix-js-sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { HttpClient } from '@/utils/HttpClient'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

export class RoomOperations extends BaseMatrixService {
  // --- Aliases (was AliasesService) ---

  async getAliases(roomId: string): Promise<string[]> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return []
    const aliases = room.getAltAliases() ?? []
    const canonical = room.getCanonicalAlias()
    if (canonical) aliases.unshift(canonical)
    return aliases
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
      const result = await client.getRoomTags(roomId)
      return result.tags ?? {}
    } catch (e) {
      const err = e as Record<string, unknown>
      if (err.errcode === 'M_UNRECOGNIZED' || err.errcode === 'M_NOT_FOUND' || err.httpStatus === 404) {
        this.tagsUnsupported = true
        if (!this.unsupportedLogged) {
          this.unsupportedLogged = true
        }
        return {}
      }
      return {}
    }
  }

  async setTag(roomId: string, tag: string, order?: number): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('tag', roomId, { roomId, tag, order, action: 'set' })
      return
    }
    const client = this.getClient()
    if (!client.getUserId()) throw new Error(this.t('matrix_error.common.user_not_logged_in'))
    await client.setRoomTag(roomId, tag, order !== undefined ? { order } : {})
  }

  async removeTag(roomId: string, tag: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('tag', roomId, { roomId, tag, action: 'remove' })
      return
    }
    const client = this.getClient()
    if (!client.getUserId()) throw new Error(this.t('matrix_error.common.user_not_logged_in'))
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

  /** 获取房间消息保留策略（m.room.retention 状态事件） */
  async getRetentionPolicy(roomId: string): Promise<{ content: Record<string, unknown> } | null> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return null
    const event = room.currentState.getStateEvents('m.room.retention', '')
    if (!event) return null
    return { content: event.getContent() as Record<string, unknown> }
  }

  /** 设置房间消息保留策略（m.room.retention 状态事件） */
  async setRetentionPolicy(roomId: string, content: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.retention', content, '')
  }

  /**
   * 设置房间在房间目录中的可见性（公开/私密）
   * 对应 Matrix API: PUT /_matrix/client/v3/directory/list/room/{roomId}
   */
  async setRoomVisibility(roomId: string, visibility: 'public' | 'private'): Promise<void> {
    const client = this.getClient()
    await client.getDiscoveryManager().setRoomVisibility(roomId, visibility)
  }

  /**
   * 获取房间在房间目录中的可见性
   * 对应 Matrix API: GET /_matrix/client/v3/directory/list/room/{roomId}
   */
  async getRoomVisibility(roomId: string): Promise<'public' | 'private'> {
    const client = this.getClient()
    const result = await client.getDiscoveryManager().getRoomVisibility(roomId)
    return result?.visibility === 'public' ? 'public' : 'private'
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
      const tempId = `!pending-dm-${Date.now()}`
      offlineQueueService.enqueue('dm_creation', tempId, { userId })
      return tempId
    }
    const client = this.getClient()
    const result = await client.createRoom({
      invite: [userId],
      is_direct: true,
      preset: Preset.TrustedPrivateChat,
      visibility: Visibility.Private
    })
    return result.room_id
  }

  async getDirectRooms(throwOnError?: boolean): Promise<Map<string, string[]>> {
    const client = this.getClient()
    try {
      const accountData = client.getAccountData('m.direct')
      if (!accountData) return new Map()
      return this.parseDirectRoomsContent(accountData.getContent())
    } catch (err) {
      if (throwOnError) throw err
      return new Map()
    }
  }

  private parseDirectRoomsContent(content: Record<string, unknown>): Map<string, string[]> {
    const directRooms = new Map<string, string[]>()
    for (const [userId, roomIds] of Object.entries(content)) {
      if (!Array.isArray(roomIds)) continue
      const normalized = roomIds.filter((id): id is string => typeof id === 'string')
      directRooms.set(userId, normalized)
    }
    return directRooms
  }

  async setDirectRoom(userId: string, roomId: string): Promise<void> {
    const client = this.getClient()
    const directRooms = await this.getDirectRooms()
    const rooms = directRooms.get(userId) ?? []
    if (!rooms.includes(roomId)) {
      rooms.push(roomId)
      const validRooms = rooms.filter((id) => {
        const room = client.getRoom(id)
        if (!room) return true
        return room.getMyMembership() === 'join'
      })
      if (validRooms.length > 0) {
        directRooms.set(userId, validRooms)
        await client.setAccountData('m.direct', Object.fromEntries(directRooms))
      }
    }
  }

  // --- Moderation (was ModerationService) ---

  async getInviteBlocklist(roomId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', `/rooms/${encodeURIComponent(roomId)}/invite_blocklist`)
      return (result as { blocked?: string[] }).blocked ?? []
    } catch {
      return []
    }
  }

  async setInviteBlocklist(roomId: string, blocked: string[]): Promise<void> {
    const client = this.getClient()
    await client.http.authedRequest('POST', `/rooms/${encodeURIComponent(roomId)}/invite_blocklist`, undefined, {
      blocked
    })
  }

  async getInviteAllowlist(roomId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', `/rooms/${encodeURIComponent(roomId)}/invite_allowlist`)
      return (result as { allowed?: string[] }).allowed ?? []
    } catch {
      return []
    }
  }

  async setInviteAllowlist(roomId: string, allowed: string[]): Promise<void> {
    const client = this.getClient()
    await client.http.authedRequest('POST', `/rooms/${encodeURIComponent(roomId)}/invite_allowlist`, undefined, {
      allowed
    })
  }

  // --- Lifecycle (was LifecycleService) ---

  async getServerDomain(): Promise<string> {
    await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
    const client = this.getClient()
    const domain = client.getDomain()
    if (domain) return domain

    const baseUrl = (client as unknown as { baseUrl?: string }).baseUrl
    if (baseUrl) {
      try {
        const url = new URL(baseUrl)
        const hostname = url.hostname
        if (hostname && hostname !== '0.0.0.0' && hostname !== '::') {
          return hostname
        }
      } catch {
        /* not a valid URL */
      }
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
      const room = client.getRoom(roomId)
      if (!room) throw new Error(`房间不存在: ${roomId}`)
    } catch {
      /* advisory counter; ignore all errors */
    }
  }

  async clearUnread(roomId: string): Promise<void> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      if (!room) throw new Error(`房间不存在: ${roomId}`)
    } catch {
      /* advisory counter; ignore all errors */
    }
  }

  // --- Translate (was TranslateService) ---

  async translateText(text: string, targetLang?: string, throwOnErrorOrSource?: boolean | string): Promise<string> {
    const target = typeof targetLang === 'string' && targetLang !== '' ? targetLang : 'zh-CN'
    const throwOnError = typeof throwOnErrorOrSource === 'boolean' ? throwOnErrorOrSource : true
    const sourceLang = typeof throwOnErrorOrSource === 'string' ? throwOnErrorOrSource : undefined

    try {
      const result = await this.translateViaBackend(text, target, sourceLang)
      return result.translated_text
    } catch {
      try {
        const translated = await this.translateViaFallback(text, target)
        return translated
      } catch (fallbackErr) {
        if (throwOnError) throw fallbackErr
        return text
      }
    }
  }

  private async translateViaBackend(
    text: string,
    targetLang: string,
    sourceLang?: string
  ): Promise<{ translated_text: string }> {
    const client = this.getClient()
    const body: Record<string, unknown> = { text, target_lang: targetLang }
    if (sourceLang) body.source_lang = sourceLang
    return (await client.http.authedRequest('POST', '/translate', undefined, body)) as {
      translated_text: string
    }
  }

  private async translateViaFallback(text: string, targetLang: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
    // biome-ignore lint/suspicious/noExplicitAny: Google Translate API response shape is unstructured
    const data = await HttpClient.get<any>(url)
    if (data?.[0]) return data[0].map((item: unknown[]) => item[0]).join('')
    return text
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
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'pinned', eventIds })
      return
    }
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.pinned_events', { pinned: eventIds }, '')
  }

  async pinEvent(roomId: string, eventId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'pin', eventId })
      return
    }
    const current = await this.getPinnedEvents(roomId)
    if (!current.includes(eventId)) {
      await this.setPinnedEvents(roomId, [...current, eventId])
    }
  }

  async unpinEvent(roomId: string, eventId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'unpin', eventId })
      return
    }
    const current = await this.getPinnedEvents(roomId)
    await this.setPinnedEvents(
      roomId,
      current.filter((id) => id !== eventId)
    )
  }

  async getStickyEvents(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', `/rooms/${encodeURIComponent(roomId)}/sticky_events`)
      return result as Record<string, unknown>
    } catch {
      return {}
    }
  }

  async setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'sticky', events })
      return
    }
    const client = this.getClient()
    await client.http.authedRequest('POST', `/rooms/${encodeURIComponent(roomId)}/sticky_events`, undefined, events)
  }

  // --- MemberProfile (was MemberProfileService) ---

  async setMemberDisplayName(roomId: string, displayName: string): Promise<void> {
    const client = this.getClient()
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
