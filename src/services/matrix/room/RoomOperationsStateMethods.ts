import type { IContent } from '@/services/matrix/sdk'
import { ConditionKind, Preset, PushRuleKind, Visibility } from '@/services/matrix/sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { BaseMatrixService } from '../BaseMatrixService'

/**
 * RoomOperations 的房间配置方法片段：别名、标签、基础状态、目录可见性与单聊创建。
 *
 * 从 `RoomOperations` 抽出：这些方法只依赖 `this.getClient()` 与离线队列，
 * 单独成基类可把门面文件控制在 400 行门槛以内，公开方法签名保持不变。
 */
export abstract class RoomOperationsStateMethods extends BaseMatrixService {
  // --- Aliases (was AliasesService) ---

  /** 获取房间别名列表（本地主别名在前，其余为 alternate aliases）。 */
  async getAliases(roomId: string): Promise<string[]> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return []
    const aliases = room.getAltAliases() ?? []
    const canonical = room.getCanonicalAlias()
    if (canonical) aliases.unshift(canonical)
    return aliases
  }

  /** 创建房间别名并指向该房间。 */
  async setAlias(roomId: string, alias: string): Promise<void> {
    const client = this.getClient()
    await client.createAlias(alias, roomId)
  }

  /** 删除房间别名。 */
  async deleteAlias(alias: string): Promise<void> {
    const client = this.getClient()
    await client.deleteAlias(alias)
  }

  // --- Tags (was TagsService) ---

  private tagsUnsupported = false
  private unsupportedLogged = false

  /** 读取房间标签（`m.tag`）；服务端不支持标签时一次性置位并返回空对象。 */
  async getTags(roomId: string): Promise<Record<string, { order?: number }>> {
    if (this.tagsUnsupported) return {}
    const client = this.getClient()
    try {
      const result = await client.getRoomTags(roomId)
      return result.tags ?? {}
    } catch (e) {
      const err = e as { errcode?: unknown; httpStatus?: unknown }
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

  /** 设置房间标签与排序；离线时入队。 */
  async setTag(roomId: string, tag: string, order?: number): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('tag', roomId, { roomId, tag, order, action: 'set' })
      return
    }
    const client = this.getClient()
    if (!client.getUserId()) throw new Error(this.t('matrix_error.common.user_not_logged_in'))
    await client.setRoomTag(roomId, tag, order !== undefined ? { order } : {})
  }

  /** 删除房间标签；离线时入队。 */
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

  /** 设置房间名称；离线时入队。 */
  async setRoomName(roomId: string, name: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('state', roomId, { roomId, type: 'name', content: name })
      return
    }
    const client = this.getClient()
    await client.setRoomName(roomId, name)
  }

  /** 设置房间主题；离线时入队。 */
  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('state', roomId, { roomId, type: 'topic', content: topic })
      return
    }
    const client = this.getClient()
    await client.setRoomTopic(roomId, topic)
  }

  /** 设置房间头像；离线时入队。 */
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
  async getRetentionPolicy(roomId: string): Promise<{ content: IContent } | null> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return null
    const event = room.currentState.getStateEvents('m.room.retention', '')
    if (!event) return null
    return { content: event.getContent() }
  }

  /** 设置消息保留策略
   */
  async setRetentionPolicy(roomId: string, content: IContent): Promise<void> {
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

  /** 读取房间全部状态事件（`*`）；房间不在本地缓存时抛错。 */
  async getRoomState(roomId: string): Promise<unknown[]> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) throw new Error(`房间不存在: ${roomId}`)
    return room.currentState.getStateEvents('*')
  }

  /**
   * 切换房间的通知静音：`enabled=false` 时创建静音 override 规则，`true` 时删除该规则恢复默认。
   * 离线时入队。
   */
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
        const errcode = (err as { errcode?: unknown })?.errcode
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

  /** 创建单聊房间并邀请对方；离线时返回临时 ID 并入队。 */
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

  /** 读取 `m.direct` 账号数据并以 userId → roomIds 映射返回。 */
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

  private parseDirectRoomsContent(content: IContent): Map<string, string[]> {
    const directRooms = new Map<string, string[]>()
    for (const [userId, roomIds] of Object.entries(content)) {
      if (!Array.isArray(roomIds)) continue
      const normalized = roomIds.filter((id): id is string => typeof id === 'string')
      directRooms.set(userId, normalized)
    }
    return directRooms
  }

  /** 把房间登记到对应用户的单聊列表（写入 `m.direct`），并剔除已离开的房间。 */
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
}
