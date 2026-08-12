import type { Friend } from '@/services/matrix/sdk'

import { createLogger } from '@/utils/Logger'

import type { FriendGroup, FriendManagerCompat } from './friendUtils'
import type { MatrixFriendSync } from './MatrixFriendSync'

const logger = createLogger('MatrixFriendGroups')

/**
 * 承载好友分组相关操作：增删改查分组、分组内好友管理。
 * 通过构造函数注入 MatrixFriendSync 以获取 FriendManager 访问能力。
 */
export class MatrixFriendGroups {
  constructor(private readonly sync: MatrixFriendSync) {}

  async getFriendGroups(): Promise<FriendGroup[]> {
    const manager = await this.sync.requireFriendManager()

    try {
      const groups = await (
        manager as FriendManagerCompat & {
          getFriendGroups?: () => Promise<Array<{ id: string; name: string; members?: string[]; created_at?: number }>>
        }
      ).getFriendGroups?.()
      logger.info(`[MatrixFriend] 获取好友分组成功: ${groups?.length ?? 0} 个`)
      // SDK FriendGroup.id → 前端 FriendGroup.group_id 映射
      return (groups ?? []).map((g) => ({
        group_id: g.id,
        name: g.name,
        member_count: g.members?.length,
        created_at: g.created_at
      }))
    } catch (err) {
      logger.error(`[MatrixFriend] 获取好友分组失败: ${err}`)
      throw err
    }
  }

  async createFriendGroup(name: string): Promise<FriendGroup> {
    const manager = await this.sync.requireFriendManager()

    try {
      const result = await (
        manager as FriendManagerCompat & {
          createFriendGroup?: (name: string) => Promise<unknown>
        }
      ).createFriendGroup?.(name)
      logger.info(`[MatrixFriend] 创建好友分组成功: ${name}`)

      if (typeof result === 'string') {
        return { group_id: result, name }
      }
      const raw = (result ?? {}) as Partial<FriendGroup> & { id?: string }
      return {
        ...raw,
        group_id: raw.group_id ?? raw.id ?? '',
        name: raw.name ?? name
      }
    } catch (err) {
      logger.error(`[MatrixFriend] 创建好友分组失败: ${err}`)
      throw err
    }
  }

  async deleteFriendGroup(groupId: string): Promise<void> {
    const manager = await this.sync.requireFriendManager()

    try {
      await (
        manager as FriendManagerCompat & {
          deleteFriendGroup?: (groupId: string) => Promise<void>
        }
      ).deleteFriendGroup?.(groupId)
      logger.info(`[MatrixFriend] 删除好友分组成功: ${groupId}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 删除好友分组失败: ${err}`)
      throw err
    }
  }

  async renameFriendGroup(groupId: string, name: string): Promise<void> {
    const manager = await this.sync.requireFriendManager()

    try {
      await (
        manager as FriendManagerCompat & {
          renameFriendGroup?: (groupId: string, name: string) => Promise<void>
        }
      ).renameFriendGroup?.(groupId, name)
      logger.info(`[MatrixFriend] 重命名好友分组成功: ${groupId} -> ${name}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 重命名好友分组失败: ${err}`)
      throw err
    }
  }

  async addFriendToGroup(groupId: string, userId: string): Promise<void> {
    const manager = await this.sync.requireFriendManager()

    try {
      await (
        manager as FriendManagerCompat & {
          addFriendToGroup?: (groupId: string, userId: string) => Promise<void>
        }
      ).addFriendToGroup?.(groupId, userId)
      logger.info(`[MatrixFriend] 添加好友到分组成功: ${userId} -> ${groupId}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 添加好友到分组失败: ${err}`)
      throw err
    }
  }

  async removeFriendFromGroup(groupId: string, userId: string): Promise<void> {
    const manager = await this.sync.requireFriendManager()

    try {
      await (
        manager as FriendManagerCompat & {
          removeFriendFromGroup?: (groupId: string, userId: string) => Promise<void>
        }
      ).removeFriendFromGroup?.(groupId, userId)
      logger.info(`[MatrixFriend] 从分组移除好友成功: ${userId} <- ${groupId}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 从分组移除好友失败: ${err}`)
      throw err
    }
  }

  async getFriendsInGroup(groupId: string): Promise<Friend[]> {
    const manager = await this.sync.requireFriendManager()

    try {
      const friends = await (
        manager as FriendManagerCompat & {
          getFriendsInGroup?: (groupId: string) => Promise<Friend[]>
        }
      ).getFriendsInGroup?.(groupId)
      logger.info(`[MatrixFriend] 获取分组内好友成功: ${groupId} -> ${friends?.length ?? 0} 个`)
      return friends ?? []
    } catch (err) {
      logger.error(`[MatrixFriend] 获取分组内好友失败: ${err}`)
      throw err
    }
  }

  async getFriendGroupsByUser(userId: string): Promise<FriendGroup[]> {
    const manager = await this.sync.requireFriendManager()

    try {
      const groups = await (
        manager as FriendManagerCompat & {
          getFriendGroupsByUser?: (userId: string) => Promise<FriendGroup[]>
        }
      ).getFriendGroupsByUser?.(userId)
      logger.info(`[MatrixFriend] 获取用户所属分组成功: ${userId} -> ${groups?.length ?? 0} 个`)
      return groups ?? []
    } catch (err) {
      logger.error(`[MatrixFriend] 获取用户所属分组失败: ${err}`)
      throw err
    }
  }
}
