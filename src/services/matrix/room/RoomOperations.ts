import { ConditionKind, PushRuleActionName, PushRuleKind, TweakName } from 'matrix-js-sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { safeDelete } from '../MatrixRequestHelper'
import { PREFIX_UNSTABLE } from '../paths/prefixes'
import { RoomOperationsModerationMethods } from './RoomOperationsModerationMethods'
import { canWriteStateEventInRoom } from './roomPowerLevels'

const logger = createLogger('RoomOperations')

/** 私密模式状态事件类型：房间级持久化，重进房间时据此恢复开关。 */
export const PRIVATE_MODE_STATE_EVENT_TYPE = 'com.hula.private_mode'

/**
 * 房间操作门面：置顶 / 粘性事件 / 成员资料 / 通知级别。
 *
 * 别名、标签、状态、单聊创建等房间配置方法见 `RoomOperationsStateMethods`；
 * 审核、生命周期、翻译、历史可见性与权限等级见 `RoomOperationsModerationMethods`。
 * 三者通过继承链合并为同一实例，公开方法签名保持不变。
 */
export class RoomOperations extends RoomOperationsModerationMethods {
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

  /**
   * 读取房间级私密模式标记。
   *
   * 房间不在本地缓存时按未开启处理，避免把「未知」误判成开启。
   */
  async getPrivateMode(roomId: string): Promise<boolean> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return false
    const event = room.currentState.getStateEvents(PRIVATE_MODE_STATE_EVENT_TYPE, '')
    const content = event?.getContent() as { enabled?: unknown } | undefined
    return content?.enabled === true
  }

  /**
   * 写入房间级私密模式标记。
   *
   * 需要该 state 事件的写权限；调用方应先通过 `canWriteStateEvent` 判定，
   * 无权限时降级为「仅在本次会话生效」。
   */
  async setPrivateMode(roomId: string, enabled: boolean): Promise<void> {
    const client = this.getClient()
    await client.sendStateEvent(roomId, PRIVATE_MODE_STATE_EVENT_TYPE, { enabled }, '')
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

  /**
   * 清除某个 event_type 的粘性事件（MSC4354 DELETE）。
   *
   * R1 说明：SDK 的 `RoomManager` 只提供 `getStickyEvents` / `setStickyEvents`，
   * 没有 DELETE 封装；此处经 `MatrixRequestHelper`（唯一 authedRequest 适配器）
   * 补该端点，不新建平行 HTTP 客户端。
   * synapse-rust 的 `sticky_events/{event_type}` 是「每用户每 event_type 一条」语义，
   * 因此按 event_type 清除等价于清除该条。
   */
  async clearStickyEvent(roomId: string, eventType: string): Promise<void> {
    // MSC 段放在**路径**里、`prefix` 只给根常量：`prefix + path` 是字符串拼接，
    // 请求 URL 与原先 `prefix: `${PREFIX_UNSTABLE}/org.matrix.msc4354`` 完全一致，
    // 但这样 `check:bare-matrix-paths` 才能用根前缀拼出完整路径去比对后端台账；
    // 否则「前缀里混了路径段」既不是根前缀也不是完整路径，会被判成未登记缺陷
    // （2026-11-19：这正是 check:release 唯一红的那一条）。
    await safeDelete(
      `/org.matrix.msc4354/rooms/${encodeURIComponent(roomId)}/sticky_events/${encodeURIComponent(eventType)}`,
      undefined,
      { prefix: PREFIX_UNSTABLE }
    )
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
      // 仅 @提及 通知：只有 m.mentions（MSC3952）能可靠表达「这条消息 @ 了我」，
      // 服务端默认规则 `.m.rule.is_user_mention` 同样使用 event_property_contains。
      // 旧实现用 EventMatch 对 content.body 做整串相等比较，永远不会命中；
      // contains_display_name 仅在正文出现显示名时成立，按 MXID @ 或用户改过昵称会漏推。
      const userId = client.getUserId()
      await client.getPushManager().createPushRule('global', PushRuleKind.Override, roomId, {
        conditions: [
          { kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId },
          userId
            ? { kind: ConditionKind.EventPropertyContains, key: 'content.m\\.mentions.user_ids', value: userId }
            : { kind: ConditionKind.ContainsDisplayName }
        ],
        actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: true }]
      })
    }
    // level === 'all' 时不清除（默认行为）
  }
}

export const roomOperations = new RoomOperations()
