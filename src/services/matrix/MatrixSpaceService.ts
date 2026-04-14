import type { MatrixClient } from 'matrix-js-sdk'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'
import matrixClientService from './MatrixClientService'

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

class MatrixSpaceService extends BaseManager {
  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('客户端未初始化')
    return client
  }

  private getSpaceManager() {
    const client = this.getClient()
    const manager = (client as any).getSpaceManager?.()
    if (!manager) throw new Error('SpaceManager 未初始化')
    return manager
  }

  private async mapSpaceToInfo(space: any): Promise<SpaceInfo> {
    let memberCount = 0
    let childCount = 0

    try {
      const manager = this.getSpaceManager()
      const stats = await manager.getSpaceStats(space.space_id)
      if (stats) {
        memberCount = stats.member_count ?? stats.memberCount ?? 0
        childCount = stats.child_count ?? stats.childCount ?? 0
      }
    } catch {
      // stats not available, fallback to 0
    }

    return {
      spaceId: space.space_id,
      name: space.name || '',
      topic: space.topic,
      avatarUrl: space.avatar_url,
      memberCount,
      childCount
    }
  }

  async createSpace(options: SpaceOptions, throwOnError = true): Promise<SpaceInfo | null> {
    try {
      const manager = this.getSpaceManager()
      const createOptions = {
        name: options.name,
        topic: options.topic,
        visibility: options.visibility,
        avatar_url: options.avatarUrl
      }
      const space = await manager.createSpace(createOptions)
      info(`[Space] 已创建: ${space.space_id}`)
      return this.mapSpaceToInfo(space)
    } catch (error) {
      return this.handleError(error, 'createSpace', null, throwOnError)
    }
  }

  async getSpace(spaceId: string, throwOnError = true): Promise<SpaceInfo | null> {
    try {
      const manager = this.getSpaceManager()
      const space = await manager.getSpace(spaceId)
      if (!space) return null
      return this.mapSpaceToInfo(space)
    } catch (error) {
      return this.handleError(error, 'getSpace', null, throwOnError)
    }
  }

  async updateSpace(spaceId: string, options: Partial<SpaceOptions>, throwOnError = true): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.updateSpace(spaceId, {
        name: options.name,
        topic: options.topic,
        avatar_url: options.avatarUrl
      })
      info(`[Space] 已更新: ${spaceId}`)
    } catch (error) {
      this.handleError(error, 'updateSpace', undefined, throwOnError)
    }
  }

  async deleteSpace(spaceId: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.deleteSpace(spaceId)
      info(`[Space] 已删除: ${spaceId}`)
    } catch (error) {
      this.handleError(error, 'deleteSpace', undefined, throwOnError)
    }
  }

  async getSpaceChildren(spaceId: string, throwOnError = true): Promise<any[]> {
    try {
      const manager = this.getSpaceManager()
      return await manager.getSpaceChildren(spaceId)
    } catch (error) {
      return this.handleError(error, 'getSpaceChildren', [] as any[], throwOnError)
    }
  }

  async addChildToSpace(
    spaceId: string,
    roomId: string,
    options?: { via?: string[]; suggested?: boolean },
    throwOnError = true
  ): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.addChild(spaceId, {
        room_id: roomId,
        via_servers: options?.via,
        suggested: options?.suggested
      })
      info(`[Space] 子房间已添加: ${roomId} -> ${spaceId}`)
    } catch (error) {
      this.handleError(error, 'addChildToSpace', undefined, throwOnError)
    }
  }

  async removeChildFromSpace(spaceId: string, roomId: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getSpaceManager()
      await manager.removeChild(spaceId, roomId)
      info(`[Space] 子房间已移除: ${roomId} <- ${spaceId}`)
    } catch (error) {
      this.handleError(error, 'removeChildFromSpace', undefined, throwOnError)
    }
  }

  async getSpaceMembers(spaceId: string, throwOnError = true): Promise<any[]> {
    try {
      const manager = this.getSpaceManager()
      return await manager.getSpaceMembers(spaceId)
    } catch (error) {
      return this.handleError(error, 'getSpaceMembers', [] as any[], throwOnError)
    }
  }

  async getSpaceHierarchy(spaceId: string, throwOnError = true): Promise<any | null> {
    try {
      const manager = this.getSpaceManager()
      return await manager.getSpaceHierarchy(spaceId)
    } catch (error) {
      return this.handleError(error, 'getSpaceHierarchy', null, throwOnError)
    }
  }

  async getUserSpaces(throwOnError = true): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.getUserSpaces()
      const results: SpaceInfo[] = []
      for (const space of spaces) {
        results.push(await this.mapSpaceToInfo(space))
      }
      return results
    } catch (error) {
      return this.handleError(error, 'getUserSpaces', [] as SpaceInfo[], throwOnError)
    }
  }

  async searchSpaces(query: string, limit = 10, throwOnError = true): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.searchSpaces(query, limit)
      const results: SpaceInfo[] = []
      for (const space of spaces) {
        results.push(await this.mapSpaceToInfo(space))
      }
      return results
    } catch (error) {
      return this.handleError(error, 'searchSpaces', [] as SpaceInfo[], throwOnError)
    }
  }

  async isSpace(roomId: string, throwOnError = true): Promise<boolean> {
    try {
      const manager = this.getSpaceManager()
      return await manager.isSpace(roomId)
    } catch (error) {
      return this.handleError(error, 'isSpace', false, throwOnError)
    }
  }

  async getSpaceStats(
    spaceId: string,
    throwOnError = true
  ): Promise<{ memberCount: number; childCount: number } | null> {
    try {
      const manager = this.getSpaceManager()
      return await manager.getSpaceStats(spaceId)
    } catch (error) {
      return this.handleError(error, 'getSpaceStats', null, throwOnError)
    }
  }

  async joinSpace(spaceId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getSpaceManager()
      await manager.joinSpace(spaceId)
      info(`[Space] 已加入: ${spaceId}`)
      return true
    } catch (error) {
      return this.handleError(error, 'joinSpace', false, throwOnError)
    }
  }

  async leaveSpace(spaceId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getSpaceManager()
      await manager.leaveSpace(spaceId)
      info(`[Space] 已离开: ${spaceId}`)
      return true
    } catch (error) {
      return this.handleError(error, 'leaveSpace', false, throwOnError)
    }
  }

  async inviteToSpace(spaceId: string, userId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getSpaceManager()
      await manager.inviteToSpace(spaceId, userId)
      info(`[Space] 已邀请: ${userId} -> ${spaceId}`)
      return true
    } catch (error) {
      return this.handleError(error, 'inviteToSpace', false, throwOnError)
    }
  }

  async getSpaceRooms(spaceId: string, throwOnError = true): Promise<any[]> {
    try {
      const manager = this.getSpaceManager()
      return await manager.getSpaceRooms(spaceId)
    } catch (error) {
      return this.handleError(error, 'getSpaceRooms', [] as any[], throwOnError)
    }
  }

  async getSpaceState(spaceId: string, throwOnError = true): Promise<any | null> {
    try {
      const manager = this.getSpaceManager()
      return await manager.getSpaceState(spaceId)
    } catch (error) {
      return this.handleError(error, 'getSpaceState', null, throwOnError)
    }
  }

  async getSpaceSummary(spaceId: string, throwOnError = true): Promise<any | null> {
    try {
      const manager = this.getSpaceManager()
      return await manager.getSpaceSummary(spaceId)
    } catch (error) {
      return this.handleError(error, 'getSpaceSummary', null, throwOnError)
    }
  }

  async getPublicSpaces(throwOnError = true): Promise<SpaceInfo[]> {
    try {
      const manager = this.getSpaceManager()
      const spaces = await manager.getPublicSpaces()
      const results: SpaceInfo[] = []
      for (const space of spaces) {
        results.push(await this.mapSpaceToInfo(space))
      }
      return results
    } catch (error) {
      return this.handleError(error, 'getPublicSpaces', [] as SpaceInfo[], throwOnError)
    }
  }
}

export const matrixSpaceService = new MatrixSpaceService()
