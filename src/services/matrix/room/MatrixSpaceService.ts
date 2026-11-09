import { Visibility } from 'matrix-js-sdk'
import { SPACE_SEARCH_LIMIT } from '@/common/constants'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import type {
  SpaceChild as SdkSpaceChild,
  SpaceManager as SdkSpaceManager,
  SpaceMember as SdkSpaceMember
} from '../sdk-compat'
import {
  getSpaceChildIds,
  getSpaceChildrenFromRoom,
  normalizeSpaceTreePathItems,
  roomToSpaceInfo,
  sdkSpaceToSpaceInfo
} from './spaceHelpers'
import { createSpaceQueries } from './spaceQueries'

const logger = createLogger('MatrixSpaceService')

export interface SpaceOptions {
  name: string
  topic?: string
  visibility?: Visibility
  avatarUrl?: string
  /** 加入规则："public" | "invite"（仅空间创建者可通过设置页修改） */
  joinRule?: string
  /** 是否公开，与 visibility 联动（public → true，private → false） */
  isPublic?: boolean
  /**
   * 同名防重逃生阀：服务端对已存在同名空间返回 409 M_ROOM_IN_USE。
   * 用户经确认弹窗选择"仍然创建"后置 true 重发，跳过查重。
   */
  ignoreDuplicateName?: boolean
}

export interface SpaceInfo {
  spaceId: string
  name: string
  topic?: string | undefined
  avatarUrl?: string | undefined
  memberCount: number
  childCount: number
}

export type { SpaceMember } from '../sdk-compat'

/**
 * Matrix Space 服务：Space CRUD / 成员 / 子房间 / 层级。
 * 纯函数在 `spaceHelpers`，查询工厂在 `spaceQueries`。
 */
class SpaceService extends BaseMatrixService {
  private getSpaceManager(): SdkSpaceManager {
    return this.getClient().getSpaceManager()
  }

  private queries = createSpaceQueries(
    () => this.getClient(),
    () => this.getSpaceManager()
  )

  // ── Space CRUD ──

  /**
   * 从 spaceId 中提取服务器名作为 viaServers
   * 例如：!abc:matrix.test -> ['matrix.test']
   */
  private extractViaServers(spaceId: string): string[] {
    try {
      const serverName = spaceId.split(':')[1]
      return serverName ? [serverName] : []
    } catch {
      return []
    }
  }

  async createSpace(options: SpaceOptions): Promise<SpaceInfo | null> {
    const client = this.getClient()
    try {
      const userId = client.getUserId()
      if (!userId) {
        throw new Error('用户未登录，无法创建 Space')
      }

      const { room_id } = await client.createRoom({
        name: options.name,
        ...(options.topic !== undefined ? { topic: options.topic } : {}),
        ...(options.visibility !== undefined ? { visibility: options.visibility } : {}),
        // ⚠️ 必须用 `creation_content.type`（MSC1772）；`room_types` 会被 SDK 原样发出 → 400 M_BAD_JSON。
        creation_content: { type: 'm.space' },
        ...(options.ignoreDuplicateName !== undefined ? { ignore_duplicate_name: options.ignoreDuplicateName } : {}),
        initial_state: [
          ...(options.avatarUrl ? [{ type: 'm.room.avatar', state_key: '', content: { url: options.avatarUrl } }] : [])
        ]
      })
      logger.info(`[Space] Space 已创建: ${room_id}`)
      // ⚠️ 建 m.space 房时后端**已自动登记**进空间注册表；再无条件 createSpace 会插第二条
      // （同 room_id、不同 space_id）⇒ 列表出现重复卡片。故先查后登记。
      let spaceId = room_id
      try {
        const manager = this.getSpaceManager()
        const existing = (await manager.query.getUserSpaces(true)).find((s) => s.room_id === room_id)
        if (existing?.space_id) {
          spaceId = existing.space_id
        } else {
          const created = await manager.lifecycle.createSpace({
            room_id,
            name: options.name,
            ...(options.topic !== undefined ? { topic: options.topic } : {}),
            ...(options.avatarUrl !== undefined ? { avatar_url: options.avatarUrl } : {}),
            visibility: options.visibility === 'public' ? 'public' : 'private'
          })
          spaceId = created?.space_id || room_id
          logger.info(`[Space] Space 已注册到后端: ${spaceId}`)
        }
      } catch (mgrErr) {
        logger.info(`[Space] SpaceManager 注册失败（非致命）: ${mgrErr}`)
      }
      return {
        spaceId,
        name: options.name,
        topic: options.topic,
        avatarUrl: options.avatarUrl,
        memberCount: 1,
        childCount: 0
      }
    } catch (err) {
      logger.error(`[Space] 创建 Space 失败: ${err}`)
      throw err
    }
  }

  async getSpace(spaceId: string): Promise<SpaceInfo | null> {
    try {
      const space = await this.getSpaceManager().lifecycle.getSpace(spaceId)
      const client = this.getClient()
      const room = client.getRoom(spaceId) ?? undefined
      const info = sdkSpaceToSpaceInfo(space, room)
      if (!room) {
        try {
          const stats = await this.getSpaceManager().query.getSpaceStats(spaceId)
          info.memberCount = stats.memberCount
          info.childCount = stats.childCount
        } catch {
          /* Stats unavailable */
        }
      }
      return info
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (!errMsg.includes('M_NOT_FOUND') && !errMsg.includes('404')) {
        logger.error(`[Space] SpaceManager 获取 Space 失败: ${err}`)
      }
      try {
        const room = this.getClient().getRoom(spaceId)
        return room ? roomToSpaceInfo(room, getSpaceChildIds) : null
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取 Space 失败: ${fallbackErr}`)
        return null
      }
    }
  }

  async updateSpace(spaceId: string, options: Partial<SpaceOptions>): Promise<void> {
    // Visibility 枚举值（"public"/"private"）与 SDK UpdateSpaceOptions.visibility 的
    // 字符串字面量精确一致，这里显式映射避免类型歧义。
    const visibility =
      options.visibility === Visibility.Public
        ? 'public'
        : options.visibility === Visibility.Private
          ? 'private'
          : undefined

    try {
      await this.getSpaceManager().lifecycle.updateSpace(spaceId, {
        ...(options.name !== undefined ? { name: options.name } : {}),
        ...(options.topic !== undefined ? { topic: options.topic } : {}),
        ...(options.avatarUrl !== undefined ? { avatar_url: options.avatarUrl } : {}),
        ...(options.joinRule !== undefined ? { join_rule: options.joinRule } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
        ...(options.isPublic !== undefined ? { is_public: options.isPublic } : {})
      })
      logger.info(`[Space] Space 已更新: ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 更新失败，回退到客户端调用: ${err}`)
      try {
        const client = this.getClient()
        if (options.name) await client.setRoomName(spaceId, options.name)
        if (options.topic !== undefined) await client.setRoomTopic(spaceId, options.topic)
        // SDK 真实归属是 `getRoomSettingsManager().setRoomAvatar(roomId, mxcUrl)`
        // （SDK 的 JSDoc 原文即此用法）；MatrixClient 本体没有 setRoomAvatar。
        if (options.avatarUrl) await client.getRoomSettingsManager().setRoomAvatar(spaceId, options.avatarUrl)
        logger.info(`[Space] Space 已更新（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 更新 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  async deleteSpace(spaceId: string): Promise<void> {
    try {
      await this.getSpaceManager().lifecycle.deleteSpace(spaceId)
      logger.info(`[Space] Space 已删除: ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 删除失败，回退到离开房间: ${err}`)
      try {
        await this.getClient().leave(spaceId)
        logger.info(`[Space] Space 已删除（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 删除 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  // ── Space membership ──

  async getSpaceMembers(spaceId: string): Promise<SdkSpaceMember[]> {
    try {
      return await this.getSpaceManager().member.getSpaceMembers(spaceId)
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取成员失败，回退: ${err}`)
      try {
        const room = this.getClient().getRoom(spaceId)
        if (room) return room.getJoinedMembers().map((m) => ({ space_id: spaceId, user_id: m.userId }))
        // SDK 真实归属是 `getMembershipManager().getRoomMembers(roomId)`；MatrixClient 本体没有该方法。
        return this.getClient()
          .getMembershipManager()
          .getRoomMembers(spaceId)
          .map((m) => ({ space_id: spaceId, user_id: m.userId }))
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取成员也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  async inviteToSpace(spaceId: string, userId: string): Promise<void> {
    try {
      await this.getSpaceManager().member.inviteToSpace(spaceId, userId)
      logger.info(`[Space] 邀请用户到 Space 成功: ${userId} -> ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 邀请失败，回退到客户端调用: ${err}`)
      try {
        await this.getClient().invite(spaceId, userId)
        logger.info(`[Space] 邀请用户到 Space 成功（回退）: ${userId} -> ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 邀请用户到 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  async joinSpace(spaceId: string, viaServers?: string[]): Promise<void> {
    // 自动获取 viaServers（如果未提供）
    if (!viaServers || viaServers.length === 0) {
      viaServers = this.extractViaServers(spaceId)
    }

    let lastError: Error | null = null
    const maxRetries = 2

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.getSpaceManager().member.joinSpace(spaceId)
        logger.info(`[Space] 加入 Space 成功: ${spaceId} (尝试 ${attempt + 1})`)
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const errMsg = lastError.message

        // 403 错误：需要邀请，不重试
        if (errMsg.includes('403') || errMsg.includes('invite-only')) {
          throw new Error('该空间仅限邀请加入，请联系空间管理员获取邀请')
        }

        // 临时性错误：重试
        if (attempt < maxRetries) {
          logger.info(`[Space] 加入 Space 失败，${attempt + 1}/${maxRetries} 重试: ${err}`)
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }

    // 所有重试失败，尝试回退到客户端调用
    logger.info(`[Space] SpaceManager 加入失败，回退到客户端调用: ${lastError}`)
    try {
      await this.getClient().joinRoom(spaceId, { viaServers })
      logger.info(`[Space] 加入 Space 成功（回退）: ${spaceId}`)
    } catch (fallbackErr) {
      const fallbackErrMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)

      // 400 错误：联邦连接问题
      if (fallbackErrMsg.includes('400') || fallbackErrMsg.includes('make_join')) {
        throw new Error('无法连接到远程服务器，请稍后重试或检查网络连接')
      }

      logger.error(`[Space] 加入 Space 失败: ${fallbackErr}`)
      throw fallbackErr
    }
  }

  async leaveSpace(spaceId: string): Promise<void> {
    try {
      await this.getSpaceManager().member.leaveSpace(spaceId)
      logger.info(`[Space] 离开 Space 成功: ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 离开失败，回退到客户端调用: ${err}`)
      try {
        await this.getClient().leave(spaceId)
        logger.info(`[Space] 离开 Space 成功（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 离开 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  // ── Space children ──

  async getSpaceChildren(spaceId: string): Promise<SdkSpaceChild[]> {
    try {
      return await this.getSpaceManager().child.getSpaceChildren(spaceId)
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取子房间失败，回退: ${err}`)
      try {
        const room = this.getClient().getRoom(spaceId)
        return room ? getSpaceChildrenFromRoom(room, spaceId) : []
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取子房间也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  async removeChild(spaceId: string, roomId: string): Promise<void> {
    try {
      await this.getSpaceManager().child.removeChild(spaceId, roomId)
      logger.info(`[Space] 子房间已移除: ${roomId} 从 ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 移除子房间失败，回退到状态事件: ${err}`)
      try {
        await this.getClient().sendStateEvent(spaceId, 'm.space.child', {}, roomId)
        logger.info(`[Space] 子房间已移除（回退）: ${roomId} 从 ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 移除子房间失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  async addChildToSpace(
    spaceId: string,
    roomId: string,
    options?: { via?: string[]; suggested?: boolean; order?: string }
  ): Promise<void> {
    const via = options?.via || []
    const suggested = options?.suggested || false
    const order = options?.order
    try {
      await this.getSpaceManager().child.addChild(spaceId, {
        room_id: roomId,
        via_servers: via,
        suggested,
        ...(order === undefined ? {} : { order })
      })
      logger.info(`[Space] 子房间已添加: ${roomId} 到 ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 添加子房间失败，回退到状态事件: ${err}`)
      try {
        const content = { via, suggested, ...(order === undefined ? {} : { order }) }
        await this.getClient().sendStateEvent(spaceId, 'm.space.child', content, roomId)
        logger.info(`[Space] 子房间已添加（回退）: ${roomId} 到 ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 添加子房间失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  /** 切换子房间的 suggested 标记，保留既有 via / order。 */
  async setChildSuggested(spaceId: string, roomId: string, suggested: boolean): Promise<void> {
    const child = (await this.getSpaceChildren(spaceId)).find((c) => c.room_id === roomId)
    await this.addChildToSpace(spaceId, roomId, {
      via: child?.via_servers ?? [],
      suggested,
      ...(child?.order === undefined ? {} : { order: child.order })
    })
  }

  // ── Space queries（委托 spaceQueries）──

  async getRoomParentSpaces(roomId: string): Promise<SpaceInfo[]> {
    return this.queries.getRoomParentSpaces(roomId)
  }

  async searchSpaces(query: string, limit = SPACE_SEARCH_LIMIT): Promise<SpaceInfo[]> {
    return this.queries.searchSpaces(query, limit)
  }

  async getUserSpaces(): Promise<SpaceInfo[]> {
    return this.queries.getUserSpaces()
  }

  async getSpaces(): Promise<SpaceInfo[]> {
    return this.getUserSpaces()
  }

  async getPublicSpaces(limit: number = 50): Promise<SpaceInfo[]> {
    return this.queries.getPublicSpaces(limit)
  }

  // ── Space rooms ──

  /**
   * 空间下的房间列表。
   *
   * ⚠️ 不要用 `child.getSpaceRooms()`：后端 `/spaces/{id}/rooms` 只回 `{rooms:["!id"]}`，
   * SDK 却按 space 对象归一化 ⇒ 每项变成 `{roomId:'', name:''}`（UI 渲染空白行）。
   * 改走 `children`（有 room_id）+ 本地房间名，缺失时兜底 roomId。
   */
  async getSpaceRooms(spaceId: string): Promise<Array<{ roomId: string; name: string; avatarUrl?: string }>> {
    const client = this.getClient()
    const toRow = (roomId: string) => {
      const room = client.getRoom(roomId)
      const avatarUrl = room?.getMxcAvatarUrl?.() || undefined
      return { roomId, name: room?.name || roomId, ...(avatarUrl ? { avatarUrl } : {}) }
    }
    try {
      const children = await this.getSpaceManager().child.getSpaceChildren(spaceId)
      return children
        .map((c) => c.room_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .map(toRow)
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取 Space 房间列表失败，回退: ${err}`)
      try {
        const room = client.getRoom(spaceId)
        return room ? getSpaceChildIds(room).map(toRow) : []
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取 Space 房间列表也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  // ── Space hierarchy ──

  async getSpaceHierarchy(
    spaceId: string,
    options?: { maxDepth?: number }
  ): Promise<{ rooms: Array<Record<string, unknown>>; next_batch?: string }> {
    try {
      // 后端 HierarchyQuery 只声明 max_depth 且 deny_unknown_fields，传 limit/from/suggested_only 会直接 400
      return (await this.getSpaceManager().hierarchy.getSpaceHierarchyPage(spaceId, {
        ...(options?.maxDepth !== undefined ? { max_depth: options.maxDepth } : {})
      })) as { rooms: Array<Record<string, unknown>>; next_batch?: string }
    } catch (err) {
      logger.error(`[Space] 获取空间层级失败: ${spaceId}, ${err}`)
      return { rooms: [] }
    }
  }

  async getSpaceTreePath(spaceId: string): Promise<Array<{ space_id: string; name: string }>> {
    try {
      const result = (await this.getSpaceManager().hierarchy.getSpaceTreePath(spaceId)) as {
        path?: Array<{ space_id: string; name: string }>
      }
      return normalizeSpaceTreePathItems(result.path ?? [])
    } catch (err) {
      logger.error(`[Space] 获取空间树路径失败: ${spaceId}, ${err}`)
      return []
    }
  }
}

export const matrixSpaceService = new SpaceService()
