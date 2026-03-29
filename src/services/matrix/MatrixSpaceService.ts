/**
 * Matrix Space API 服务
 *
 * 提供 Space (空间) 功能支持
 * 统一使用 SDK SpaceManager
 */

import type { MatrixClient, Room } from 'matrix-js-sdk'
import { SpaceManager, Space, SpaceChild, SpaceMember, SpaceHierarchy, CreateSpaceOptions } from 'matrix-js-sdk'

export interface SpaceOptions {
  name: string
  topic?: string
  visibility?: 'public' | 'private'
  avatarUrl?: string
}

export interface SpaceInfo {
  spaceId: string
  name: string
  topic?: string
  avatarUrl?: string
  memberCount: number
  childCount: number
}

/**
 * Space 服务
 * 统一使用 matrix-js-sdk 的 SpaceManager
 */
class SpaceService {
  private client: MatrixClient | null = null
  private spaceManager: SpaceManager | null = null

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    // 使用 SDK 的 SpaceManager
    this.spaceManager = client.getSpaceManager()
    console.log('[Space] 服务已初始化')
  }

  /**
   * 创建 Space
   */
  async createSpace(options: SpaceOptions): Promise<SpaceInfo | null> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      const createOptions: CreateSpaceOptions = {
        name: options.name,
        topic: options.topic,
        visibility: options.visibility,
        avatarUrl: options.avatarUrl
      }

      const space = await this.spaceManager.createSpace(createOptions)

      console.log('[Space] Space 已创建:', space.space_id)

      return {
        spaceId: space.space_id,
        name: space.name || options.name,
        topic: space.topic || options.topic,
        avatarUrl: space.avatar_url || options.avatarUrl,
        memberCount: space.member_count || 0,
        childCount: 0
      }
    } catch (error) {
      console.error('[Space] 创建 Space 失败:', error)
      throw error
    }
  }

  /**
   * 获取 Space 信息
   */
  async getSpace(spaceId: string): Promise<SpaceInfo | null> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      const space = await this.spaceManager.getSpace(spaceId)
      if (!space) return null

      return {
        spaceId: space.space_id,
        name: space.name || '',
        topic: space.topic,
        avatarUrl: space.avatar_url,
        memberCount: space.member_count || 0,
        childCount: 0
      }
    } catch (error) {
      console.error('[Space] 获取 Space 失败:', error)
      return null
    }
  }

  /**
   * 更新 Space
   */
  async updateSpace(spaceId: string, options: Partial<SpaceOptions>): Promise<void> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      await this.spaceManager.updateSpace(spaceId, {
        name: options.name,
        topic: options.topic,
        avatarUrl: options.avatarUrl
      })
      console.log('[Space] Space 已更新:', spaceId)
    } catch (error) {
      console.error('[Space] 更新 Space 失败:', error)
      throw error
    }
  }

  /**
   * 删除 Space
   */
  async deleteSpace(spaceId: string): Promise<void> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      await this.spaceManager.deleteSpace(spaceId)
      console.log('[Space] Space 已删除:', spaceId)
    } catch (error) {
      console.error('[Space] 删除 Space 失败:', error)
      throw error
    }
  }

  /**
   * 获取 Space 子房间
   */
  async getSpaceChildren(spaceId: string): Promise<SpaceChild[]> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      const children = await this.spaceManager.getSpaceChildren(spaceId)
      return children
    } catch (error) {
      console.error('[Space] 获取 Space 子房间失败:', error)
      return []
    }
  }

  /**
   * 添加子房间到 Space
   */
  async addChildToSpace(spaceId: string, roomId: string, options?: { via?: string[]; suggested?: boolean }): Promise<void> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      await this.spaceManager.addChild(spaceId, {
        room_id: roomId,
        via_servers: options?.via,
        is_suggested: options?.suggested
      })
      console.log('[Space] 子房间已添加:', roomId, '到', spaceId)
    } catch (error) {
      console.error('[Space] 添加子房间失败:', error)
      throw error
    }
  }

  /**
   * 从 Space 移除子房间
   */
  async removeChildFromSpace(spaceId: string, roomId: string): Promise<void> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      await this.spaceManager.removeChild(spaceId, roomId)
      console.log('[Space] 子房间已移除:', roomId, '从', spaceId)
    } catch (error) {
      console.error('[Space] 移除子房间失败:', error)
      throw error
    }
  }

  /**
   * 获取 Space 成员
   */
  async getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      const members = await this.spaceManager.getSpaceMembers(spaceId)
      return members
    } catch (error) {
      console.error('[Space] 获取 Space 成员失败:', error)
      return []
    }
  }

  /**
   * 获取 Space 层级结构
   */
  async getSpaceHierarchy(spaceId: string): Promise<SpaceHierarchy | null> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      const hierarchy = await this.spaceManager.getSpaceHierarchy(spaceId)
      return hierarchy
    } catch (error) {
      console.error('[Space] 获取 Space 层级结构失败:', error)
      return null
    }
  }

  /**
   * 获取用户所有 Space
   */
  async getUserSpaces(): Promise<SpaceInfo[]> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      const spaces = await this.spaceManager.getUserSpaces()

      return spaces.map((space: Space) => ({
        spaceId: space.space_id,
        name: space.name || '',
        topic: space.topic,
        avatarUrl: space.avatar_url,
        memberCount: space.member_count || 0,
        childCount: 0
      }))
    } catch (error) {
      console.error('[Space] 获取用户 Spaces 失败:', error)
      return []
    }
  }

  /**
   * 搜索 Spaces
   */
  async searchSpaces(query: string, limit = 10): Promise<SpaceInfo[]> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      const spaces = await this.spaceManager.searchSpaces(query, limit)

      return spaces.map((space: Space) => ({
        spaceId: space.space_id,
        name: space.name || '',
        topic: space.topic,
        avatarUrl: space.avatar_url,
        memberCount: space.member_count || 0,
        childCount: 0
      }))
    } catch (error) {
      console.error('[Space] 搜索 Spaces 失败:', error)
      return []
    }
  }

  /**
   * 检查房间是否是 Space
   */
  async isSpace(roomId: string): Promise<boolean> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      return await this.spaceManager.isSpace(roomId)
    } catch (error) {
      console.error('[Space] 检查 Space 失败:', error)
      return false
    }
  }

  /**
   * 获取 Space 统计信息
   */
  async getSpaceStats(spaceId: string): Promise<{ totalMessages: number; activeMembers: number; joinedMembers: number } | null> {
    if (!this.spaceManager) {
      throw new Error('SpaceManager 未初始化')
    }

    try {
      const stats = await this.spaceManager.getSpaceStats(spaceId)
      return stats
    } catch (error) {
      console.error('[Space] 获取 Space 统计失败:', error)
      return null
    }
  }
}

export const matrixSpaceService = new SpaceService()
