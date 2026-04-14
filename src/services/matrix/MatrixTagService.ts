/**
 * Matrix 标签服务
 *
 * 封装 SDK TagManager，提供房间标签管理功能
 *
 * 功能:
 * - 房间收藏 (m.favourite)
 * - 低优先级房间 (m.lowpriority)
 * - 自定义标签
 */

import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'

export enum SdkTagEvent {
  TagAdded = 'TagAdded',
  TagRemoved = 'TagRemoved',
  TagError = 'TagError'
}

export interface SdkRoomTag {
  order?: number
  [key: string]: unknown
}

export interface SdkRoomTags {
  [tag: string]: SdkRoomTag
}

export type RoomTagType = 'm.favourite' | 'm.lowpriority' | string

export interface RoomTagInfo {
  name: string
  order?: number
  isFavorite: boolean
  isLowPriority: boolean
}

export interface TagStats {
  favoriteCount: number
  lowPriorityCount: number
  totalTaggedRooms: number
}

class MatrixTagService extends BaseManager {
  private tagManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.tagManager = (client as any).getTagManager?.() ?? null
      if (this.tagManager) {
        this.setupEventListeners()
        this.initialized = true
      } else {
        this.initialized = true
      }
    } catch (_error) {}
  }

  private setupEventListeners(): void {
    if (!this.tagManager) return

    this.tagManager.on(SdkTagEvent.TagAdded, (_roomId: string, _tag: string) => {})

    this.tagManager.on(SdkTagEvent.TagRemoved, (_roomId: string, _tag: string) => {})

    this.tagManager.on(SdkTagEvent.TagError, (_roomId: string, _error: Error) => {})
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.tagManager) {
      this.initialize()
    }
    if (!this.tagManager) {
      throw new Error('标签服务未初始化')
    }
  }

  async getRoomTags(roomId: string, throwOnError = true): Promise<SdkRoomTags> {
    try {
      this.ensureInitialized()
      return await this.tagManager!.getRoomTags(roomId)
    } catch (error) {
      return this.handleError(error, 'getRoomTags', {} as SdkRoomTags, throwOnError)
    }
  }

  async getRoomTagInfo(roomId: string, throwOnError = true): Promise<RoomTagInfo> {
    try {
      const tags = await this.getRoomTags(roomId, false)

      return {
        name: roomId,
        isFavorite: tags['m.favourite'] !== undefined,
        isLowPriority: tags['m.lowpriority'] !== undefined,
        order: tags['m.favourite']?.order ?? tags['m.lowpriority']?.order
      }
    } catch (error) {
      return this.handleError(error, 'getRoomTagInfo', { name: roomId, isFavorite: false, isLowPriority: false } as RoomTagInfo, throwOnError)
    }
  }

  async addRoomTag(roomId: string, tag: RoomTagType, order?: number, throwOnError = false): Promise<void> {
    try {
      this.ensureInitialized()
      await this.tagManager!.addRoomTag(roomId, tag, order)
    } catch (error) {
      this.handleError(error, 'addRoomTag', undefined as unknown as void, throwOnError)
    }
  }

  async removeRoomTag(roomId: string, tag: RoomTagType, throwOnError = false): Promise<void> {
    try {
      this.ensureInitialized()
      await this.tagManager!.removeRoomTag(roomId, tag)
    } catch (error) {
      this.handleError(error, 'removeRoomTag', undefined as unknown as void, throwOnError)
    }
  }

  async setRoomTagOrder(roomId: string, tag: RoomTagType, order: number, throwOnError = false): Promise<void> {
    try {
      this.ensureInitialized()
      await this.tagManager!.setRoomTagOrder(roomId, tag, order)
    } catch (error) {
      this.handleError(error, 'setRoomTagOrder', undefined as unknown as void, throwOnError)
    }
  }

  async clearRoomTags(roomId: string, throwOnError = false): Promise<void> {
    try {
      this.ensureInitialized()
      await this.tagManager!.clearRoomTags(roomId)
    } catch (error) {
      this.handleError(error, 'clearRoomTags', undefined as unknown as void, throwOnError)
    }
  }

  async getFavoriteRooms(throwOnError = true): Promise<string[]> {
    try {
      this.ensureInitialized()
      return await this.tagManager!.getFavoriteRooms()
    } catch (error) {
      return this.handleError(error, 'getFavoriteRooms', [] as string[], throwOnError)
    }
  }

  async addToFavorites(roomId: string, throwOnError = false): Promise<void> {
    try {
      this.ensureInitialized()
      await this.tagManager!.addToFavorites(roomId)
    } catch (error) {
      this.handleError(error, 'addToFavorites', undefined as unknown as void, throwOnError)
    }
  }

  async removeFromFavorites(roomId: string, throwOnError = false): Promise<void> {
    try {
      this.ensureInitialized()
      await this.tagManager!.removeFromFavorites(roomId)
    } catch (error) {
      this.handleError(error, 'removeFromFavorites', undefined as unknown as void, throwOnError)
    }
  }

  async toggleFavorite(roomId: string, throwOnError = false): Promise<boolean> {
    try {
      const isFav = await this.isFavorite(roomId, false)
      if (isFav) {
        await this.removeFromFavorites(roomId, throwOnError)
        return false
      } else {
        await this.addToFavorites(roomId, throwOnError)
        return true
      }
    } catch (error) {
      return this.handleError(error, 'toggleFavorite', false, throwOnError)
    }
  }

  async isFavorite(roomId: string, throwOnError = true): Promise<boolean> {
    try {
      this.ensureInitialized()
      return await this.tagManager!.isFavorite(roomId)
    } catch (error) {
      return this.handleError(error, 'isFavorite', false, throwOnError)
    }
  }

  async getLowPriorityRooms(throwOnError = true): Promise<string[]> {
    try {
      this.ensureInitialized()
      return await this.tagManager!.getLowPriorityRooms()
    } catch (error) {
      return this.handleError(error, 'getLowPriorityRooms', [] as string[], throwOnError)
    }
  }

  async addToLowPriority(roomId: string, throwOnError = false): Promise<void> {
    try {
      this.ensureInitialized()
      await this.tagManager!.addToLowPriority(roomId)
    } catch (error) {
      this.handleError(error, 'addToLowPriority', undefined as unknown as void, throwOnError)
    }
  }

  async removeFromLowPriority(roomId: string, throwOnError = false): Promise<void> {
    try {
      this.ensureInitialized()
      await this.tagManager!.removeFromLowPriority(roomId)
    } catch (error) {
      this.handleError(error, 'removeFromLowPriority', undefined as unknown as void, throwOnError)
    }
  }

  async toggleLowPriority(roomId: string, throwOnError = false): Promise<boolean> {
    try {
      const isLow = await this.isLowPriority(roomId, false)
      if (isLow) {
        await this.removeFromLowPriority(roomId, throwOnError)
        return false
      } else {
        await this.addToLowPriority(roomId, throwOnError)
        return true
      }
    } catch (error) {
      return this.handleError(error, 'toggleLowPriority', false, throwOnError)
    }
  }

  async isLowPriority(roomId: string, throwOnError = true): Promise<boolean> {
    try {
      this.ensureInitialized()
      return await this.tagManager!.isLowPriority(roomId)
    } catch (error) {
      return this.handleError(error, 'isLowPriority', false, throwOnError)
    }
  }

  async getRoomsByTag(tag: RoomTagType, throwOnError = true): Promise<string[]> {
    try {
      this.ensureInitialized()
      return await this.tagManager!.getRoomsByTag(tag)
    } catch (error) {
      return this.handleError(error, 'getRoomsByTag', [] as string[], throwOnError)
    }
  }

  async getTaggedRooms(throwOnError = true): Promise<Map<string, string[]>> {
    try {
      this.ensureInitialized()
      return await this.tagManager!.getTaggedRooms()
    } catch (error) {
      return this.handleError(error, 'getTaggedRooms', new Map<string, string[]>(), throwOnError)
    }
  }

  getCachedTags(roomId: string): SdkRoomTags {
    if (!this.tagManager) return {}
    return this.tagManager.getCachedTags(roomId)
  }

  getCachedRoomsByTag(tag: RoomTagType): string[] {
    if (!this.tagManager) return []
    return this.tagManager.getCachedRoomsByTag(tag)
  }

  async getTagStats(): Promise<TagStats> {
    const favoriteRooms = await this.getFavoriteRooms()
    const lowPriorityRooms = await this.getLowPriorityRooms()
    const allTagged = await this.getTaggedRooms()

    let totalTagged = 0
    allTagged.forEach((rooms) => {
      totalTagged += rooms.length
    })

    return {
      favoriteCount: favoriteRooms.length,
      lowPriorityCount: lowPriorityRooms.length,
      totalTaggedRooms: totalTagged
    }
  }

  async start(): Promise<void> {
    if (this.tagManager) {
      await this.tagManager.start()
    }
  }

  stop(): void {
    if (this.tagManager) {
      this.tagManager.stop()
    }
    this.initialized = false
  }

  clearCache(): void {
    if (this.tagManager) {
      this.tagManager.clearCache()
    }
  }

  on(event: SdkTagEvent, handler: (roomId: string, ...args: unknown[]) => void): void {
    if (this.tagManager) {
      this.tagManager.on(event, handler)
    }
  }

  off(event: SdkTagEvent, handler: (roomId: string, ...args: unknown[]) => void): void {
    if (this.tagManager) {
      this.tagManager.off(event, handler)
    }
  }
}

export const matrixTagService = new MatrixTagService()
export default matrixTagService
