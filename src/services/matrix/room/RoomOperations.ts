import type { MatrixClient } from 'matrix-js-sdk'
import { ConditionKind, Preset, PushRuleActionName, PushRuleKind, TweakName, Visibility } from 'matrix-js-sdk'
import { CLIENT_READY_TIMEOUT_MS } from '@/common/constants'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { HttpClient } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import { canWriteStateEventInRoom } from './roomPowerLevels'

const logger = createLogger('RoomOperations')

/**
 * InviteBlocklistManager 实例类型。
 *
 * 注：`matrix-js-sdk/invite-blocklist` 子路径未在 package.json exports 中暴露，
 * 这里通过 MatrixClient 的访问器返回类型派生，避免违反 SDK 边界策略。
 */
type InviteBlocklistManagerInstance = ReturnType<NonNullable<MatrixClient['getInviteBlocklistManager']>>

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

  /** 获取消息保留策略
   */
  async getRetentionPolicy(roomId: string): Promise<{ content: Record<string, unknown> } | null> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return null
    const event = room.currentState.getStateEvents('m.room.retention', '')
    if (!event) return null
    return { content: event.getContent() as Record<string, unknown> }
  }

  /** 设置消息保留策略
   */
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
      // 置顶 = 删除 override 推送规则（恢复默认通知）；规则不存在时 M_NOT_FOUND 属良性，静默处理
      try {
        await client.getPushManager().deletePushRule('global', PushRuleKind.Override, roomId)
      } catch (err) {
        const errcode = (err as Record<string, unknown>)?.errcode
        if (errcode !== 'M_NOT_FOUND') throw err
      }
    } else {
      await client.getPushManager().createPushRule('global', PushRuleKind.Override, roomId, {
        conditions: [{ kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId }],
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

  /**
   * 获取邀请黑名单。
   *
   * 注：SDK InviteBlocklistManager.getBlocklist 内部已捕获错误并返回缓存值（或空数组），
   * 因此 `throwOnError` 参数在此实现中不再向上抛错——保留参数仅为向后兼容签名。
   * 失败时由 SDK 记录 warn 日志并返回缓存。
   */
  async getInviteBlocklist(roomId: string, _throwOnError = false): Promise<string[]> {
    try {
      return await this.getInviteBlocklistMgr().getBlocklist(roomId)
    } catch (err) {
      // 仅在 SDK 本身抛错（如客户端未初始化）时记录
      logger.error(`获取 invite blocklist 失败: ${roomId} ${err}`)
      return []
    }
  }

  async setInviteBlocklist(roomId: string, blocked: string[]): Promise<void> {
    await this.getInviteBlocklistMgr().setBlocklist(roomId, blocked)
  }

  /**
   * 获取邀请白名单。同 getInviteBlocklist，SDK 内部已处理错误。
   */
  async getInviteAllowlist(roomId: string, _throwOnError = false): Promise<string[]> {
    try {
      return await this.getInviteBlocklistMgr().getAllowlist(roomId)
    } catch (err) {
      logger.error(`获取 invite allowlist 失败: ${roomId} ${err}`)
      return []
    }
  }

  async setInviteAllowlist(roomId: string, allowed: string[]): Promise<void> {
    await this.getInviteBlocklistMgr().setAllowlist(roomId, allowed)
  }

  private getInviteBlocklistMgr(): InviteBlocklistManagerInstance {
    const client = this.getClient()
    const fn = (client as { getInviteBlocklistManager?: () => InviteBlocklistManagerInstance })
      .getInviteBlocklistManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getInviteBlocklistManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  // --- Lifecycle (was LifecycleService) ---

  async getServerDomain(): Promise<string> {
    await matrixClientService.waitForClientReady({ timeoutMs: CLIENT_READY_TIMEOUT_MS })
    const client = this.getClient()
    const domain = client.getDomain()
    if (domain) return domain

    const baseUrl = (client as { baseUrl?: string }).baseUrl
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
    return await client.getRoomManager().translateText(text, targetLang, sourceLang)
  }

  /**
   * 降级翻译：调用外部第三方 Google 翻译端点（后端 `translateText` 不可用时）。
   *
   * ⚠️ 两个须知（Batch 3.4 复核订正了本文档原先「直连、绕过管控」的表述）：
   * 1. 它**不是**裸请求 —— 走 `@/utils/HttpClient`，而后者用 `getRuntimeAwareFetch()`
   *    （即统一传输层 `runtimeFetch`，含限流包装）并带显式超时；目标域名
   *    `translate.googleapis.com` 也已在 `utils/httpAllowlistConfig.ts` 的 allowlist 里显式登记。
   * 2. 但它是**内容出境**：用户消息正文会被发送到 Google。仅在后端翻译失败时才会走到这里，
   *    若后续要加强隐私，应在这里加用户级开关或直接删除该降级路径（属产品决策，本轮保留）。
   */
  private async translateViaFallback(text: string, targetLang: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
    // biome-ignore lint/suspicious/noExplicitAny: Google Translate API response shape is unstructured
    const translationPayload = await HttpClient.get<any>(url)
    if (translationPayload?.[0]) return translationPayload[0].map((item: unknown[]) => item[0]).join('')
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

  /**
   * 能否发送 `m.room.pinned_events`（置顶/取消置顶）。权限规则见 `roomPowerLevels.ts`。
   */
  canPinEvents(roomId: string): boolean {
    return this.canWriteStateEvent(roomId, 'm.room.pinned_events')
  }

  /**
   * 判断当前用户能否写某个 state event（房间级设置的通用权限判定）。
   *
   * 规则与缺省值见 `roomPowerLevels.ts`（纯函数，已单测）：与服务端
   * `verify_state_event_write` 一致。
   */
  canWriteStateEvent(roomId: string, eventType: string): boolean {
    return canWriteStateEventInRoom(matrixClientService.getClient(), roomId, eventType)
  }

  /**
   * 能否切换房间级「防截屏」标记（`com.hula.privacy`）：服务端写的是状态事件，
   * 因此要求该类型的 state 写权限；普通成员（PL 0）会被 403。
   */
  canManageAntiScreenshot(roomId: string): boolean {
    return this.canWriteStateEvent(roomId, 'com.hula.privacy')
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
      return await client.getRoomManager().getStickyEvents(roomId)
    } catch (err) {
      // R-12: sticky events 获取失败不应静默
      logger.error(`获取 sticky events 失败: ${roomId} ${err}`)
      return {}
    }
  }

  async setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'sticky', events })
      return
    }
    const client = this.getClient()
    await client.getRoomManager().setStickyEvents(roomId, events)
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
    // SDK 真实签名为 setPowerLevel(roomId, userId, powerLevel)（client.d.ts:1423）。
    // 历史缺陷：曾误用不存在的 setUserPowerLevel，且实参顺序与声明相反。
    await client.setPowerLevel(roomId, userId, powerLevel)
  }

  async setMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    await this.setMemberPowerLevel(roomId, userId, 100)
  }

  async removeMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    await this.setMemberPowerLevel(roomId, userId, 0)
  }

  // --- History Visibility ---

  /** 获取历史消息可见性
   */
  async getHistoryVisibility(roomId: string): Promise<string> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return 'shared'
    const event = room.currentState.getStateEvents('m.room.history_visibility', '')
    return (event?.getContent()?.history_visibility as string) ?? 'shared'
  }

  /** 设置历史消息可见性
   */
  async setHistoryVisibility(roomId: string, visibility: string): Promise<void> {
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.history_visibility', { history_visibility: visibility }, '')
  }

  // --- Power Levels ---

  /** 获取房间权限等级
   */
  async getPowerLevels(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return {}
    const event = room.currentState.getStateEvents('m.room.power_levels', '')
    return (event?.getContent() as Record<string, unknown>) ?? {}
  }

  /** 设置房间权限等级
   */
  async setPowerLevels(roomId: string, content: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.power_levels', content, '')
  }

  // --- Notification Level ---

  /** 获取通知级别
   */
  async getNotificationLevel(roomId: string): Promise<'all' | 'mentions' | 'mute'> {
    const client = this.getClient()
    try {
      const rules = await client.getPushManager().getPushRules()
      const overrideRules = rules?.global?.override ?? []
      const roomRule = overrideRules.find((r: { rule_id: string }) => r.rule_id === roomId)
      if (roomRule) {
        if (!roomRule.actions || roomRule.actions.length === 0) return 'mute'
        return 'mentions'
      }
    } catch {
      // 规则不存在时视为默认 all
    }
    return 'all'
  }

  /** 设置通知级别
   */
  async setNotificationLevel(roomId: string, level: 'all' | 'mentions' | 'mute'): Promise<void> {
    const client = this.getClient()
    // 先清除现有规则
    try {
      await client.getPushManager().deletePushRule('global', PushRuleKind.Override, roomId)
    } catch {
      // 规则不存在时忽略
    }

    if (level === 'mute') {
      await client.getPushManager().createPushRule('global', PushRuleKind.Override, roomId, {
        conditions: [{ kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId }],
        actions: []
      })
    } else if (level === 'mentions') {
      // 仅 @提及 通知：EventMatch 对 content.body 做整串匹配，永远无法命中，
      // 改用服务端内置的“正文包含当前用户显示名”条件。
      await client.getPushManager().createPushRule('global', PushRuleKind.Override, roomId, {
        conditions: [
          { kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId },
          { kind: ConditionKind.ContainsDisplayName }
        ],
        actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: true }]
      })
    }
    // level === 'all' 时不清除（默认行为）
  }
}

export const roomOperations = new RoomOperations()
