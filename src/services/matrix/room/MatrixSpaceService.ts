import type { Visibility } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import type {
  SpaceChild as SdkSpaceChild,
  SpaceManager as SdkSpaceManager,
  SpaceMember as SdkSpaceMember
} from '../sdk-compat'
import { getSpaceChildIds, normalizeSpaceTreePathItems, roomToSpaceInfo, sdkSpaceToSpaceInfo } from './spaceHelpers'
import { createSpaceQueries } from './spaceQueries'

const logger = createLogger('MatrixSpaceService')

export interface SpaceOptions {
  name: string
  topic?: string
  visibility?: Visibility
  avatarUrl?: string
  /**
   * 同名防重逃生阀：服务端对已存在同名空间返回 409 M_ROOM_IN_USE。
   * 用户经确认弹窗选择"仍然创建"后置 true 重发，跳过查重。
   */
  ignoreDuplicateName?: boolean
}

export interface SpaceInfo {
  spaceId: string
  name: string
  topic?: string
  avatarUrl?: string
  memberCount: number
  childCount: number
}

export type { SpaceChild, SpaceMember } from '../sdk-compat'

/**
 * Matrix Space 服务 — 创建/查询/成员管理/子房间管理/层级关系。
 *
 * 实现已拆分为两个子模块：
 * - spaceHelpers：纯函数（类型转换、路径规范化、子房间 ID 提取）
 * - spaceQueries：查询操作工厂（父空间、搜索、用户空间、公开空间）
 *
 * 本文件保留：Space CRUD、成员管理、子房间管理、层级关系。
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

  async createSpace(options: SpaceOptions): Promise<SpaceInfo | null> {
    const client = this.getClient()
    try {
      const { room_id } = await client.createRoom({
        name: options.name,
        topic: options.topic,
        visibility: options.visibility,
        room_types: ['m.space'],
        ignore_duplicate_name: options.ignoreDuplicateName,
        initial_state: [
          ...(options.avatarUrl ? [{ type: 'm.room.avatar', state_key: '', content: { url: options.avatarUrl } }] : [])
        ]
      })
      logger.info(`[Space] Space 已创建: ${room_id}`)
      try {
        await this.getSpaceManager().createSpace({
          room_id,
          name: options.name,
          topic: options.topic,
          avatar_url: options.avatarUrl,
          visibility: options.visibility === 'public' ? 'public' : 'private'
        })
        logger.info(`[Space] Space 已注册到后端: ${room_id}`)
      } catch (mgrErr) {
        logger.info(`[Space] SpaceManager 注册失败（非致命）: ${mgrErr}`)
      }
      return {
        spaceId: room_id,
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
      const space = await this.getSpaceManager().getSpace(spaceId)
      const client = this.getClient()
      const room = client.getRoom(spaceId) ?? undefined
      const info = sdkSpaceToSpaceInfo(space, room)
      if (!room) {
        try {
          const stats = await this.getSpaceManager().getSpaceStats(spaceId)
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
    try {
      await this.getSpaceManager().updateSpace(spaceId, {
        name: options.name,
        topic: options.topic,
        avatar_url: options.avatarUrl
      })
      logger.info(`[Space] Space 已更新: ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 更新失败，回退到客户端调用: ${err}`)
      try {
        const client = this.getClient()
        if (options.name) await client.setRoomName(spaceId, options.name)
        if (options.topic !== undefined) await client.setRoomTopic(spaceId, options.topic)
        if (options.avatarUrl) await client.setRoomAvatar(spaceId, options.avatarUrl)
        logger.info(`[Space] Space 已更新（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 更新 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  async deleteSpace(spaceId: string): Promise<void> {
    try {
      await this.getSpaceManager().deleteSpace(spaceId)
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
      return await this.getSpaceManager().getSpaceMembers(spaceId)
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取成员失败，回退: ${err}`)
      try {
        const room = this.getClient().getRoom(spaceId)
        if (room) return room.getJoinedMembers().map((m) => ({ space_id: spaceId, user_id: m.userId }))
        return this.getClient()
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
      await this.getSpaceManager().inviteToSpace(spaceId, userId)
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
    try {
      await this.getSpaceManager().joinSpace(spaceId, viaServers ? { via_servers: viaServers } : undefined)
      logger.info(`[Space] 加入 Space 成功: ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 加入失败，回退到客户端调用: ${err}`)
      try {
        await this.getClient().joinRoom(spaceId, { viaServers })
        logger.info(`[Space] 加入 Space 成功（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 加入 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  async leaveSpace(spaceId: string): Promise<void> {
    try {
      await this.getSpaceManager().leaveSpace(spaceId)
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
      return await this.getSpaceManager().getSpaceChildren(spaceId)
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取子房间失败，回退: ${err}`)
      try {
        const room = this.getClient().getRoom(spaceId)
        if (!room) return []
        const childEvents = room.currentState.getStateEvents('m.space.child')
        return childEvents
          .map((e) => {
            const key = e.getStateKey()
            if (!key) return null
            const content = e.getContent() as { via?: string[]; suggested?: boolean; order?: string }
            return {
              space_id: spaceId,
              room_id: key,
              via_servers: content.via || [],
              is_suggested: content.suggested ?? false,
              order: content.order
            } as SdkSpaceChild
          })
          .filter((c): c is SdkSpaceChild => c !== null)
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取子房间也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  async removeChild(spaceId: string, roomId: string): Promise<void> {
    try {
      await this.getSpaceManager().removeChild(spaceId, roomId)
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
    options?: { via?: string[]; suggested?: boolean }
  ): Promise<void> {
    try {
      await this.getSpaceManager().addChild(spaceId, {
        room_id: roomId,
        via_servers: options?.via || [],
        suggested: options?.suggested || false
      })
      logger.info(`[Space] 子房间已添加: ${roomId} 到 ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 添加子房间失败，回退到状态事件: ${err}`)
      try {
        await this.getClient().sendStateEvent(
          spaceId,
          'm.space.child',
          { via: options?.via || [], suggested: options?.suggested || false },
          roomId
        )
        logger.info(`[Space] 子房间已添加（回退）: ${roomId} 到 ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 添加子房间失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }

  /** @deprecated Use {@link removeChild} instead. */
  async removeChildFromSpace(spaceId: string, roomId: string): Promise<void> {
    return this.removeChild(spaceId, roomId)
  }

  // ── Space queries（委托 spaceQueries）──

  async getRoomParentSpaces(roomId: string): Promise<SpaceInfo[]> {
    return this.queries.getRoomParentSpaces(roomId)
  }

  async searchSpaces(query: string, limit = 10): Promise<SpaceInfo[]> {
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

  async getSpaceRooms(spaceId: string): Promise<Array<{ roomId: string; name: string; avatarUrl?: string }>> {
    try {
      const spaces = await this.getSpaceManager().getSpaceRooms(spaceId)
      return spaces.map((s) => ({ roomId: s.room_id, name: s.name || '', avatarUrl: s.avatar_url || undefined }))
    } catch (err) {
      logger.error(`[Space] SpaceManager 获取 Space 房间列表失败，回退: ${err}`)
      try {
        const room = this.getClient().getRoom(spaceId)
        const childIds = room ? getSpaceChildIds(room) : []
        const rooms: Array<{ roomId: string; name: string; avatarUrl?: string }> = []
        for (const childId of childIds) {
          const childRoom = this.getClient().getRoom(childId)
          if (childRoom) {
            rooms.push({
              roomId: childId,
              name: childRoom.name || '',
              avatarUrl: childRoom.getMxcAvatarUrl() || undefined
            })
          }
        }
        return rooms
      } catch (fallbackErr) {
        logger.error(`[Space] 回退获取 Space 房间列表也失败: ${fallbackErr}`)
        return []
      }
    }
  }

  // ── Space hierarchy ──

  async getSpaceHierarchy(
    spaceId: string,
    options?: { from?: string; limit?: number; maxDepth?: number; suggestedOnly?: boolean }
  ): Promise<{ rooms: Array<Record<string, unknown>>; next_batch?: string }> {
    try {
      return (await this.getSpaceManager().getSpaceHierarchyPage(spaceId, {
        from: options?.from,
        limit: options?.limit,
        max_depth: options?.maxDepth,
        suggested_only: options?.suggestedOnly
      })) as { rooms: Array<Record<string, unknown>>; next_batch?: string }
    } catch (err) {
      logger.error(`[Space] 获取空间层级失败: ${spaceId}, ${err}`)
      return { rooms: [] }
    }
  }

  async getSpaceTreePath(spaceId: string): Promise<Array<{ space_id: string; name: string }>> {
    try {
      const result = (await this.getSpaceManager().getSpaceTreePath(spaceId)) as {
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
