import type { AdminManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import type { AdminSpaceInfo, AdminSpaceRoom, AdminSpaceStatsInfo, AdminSpaceUser } from './AdminTypes'

const logger = createLogger('RoomSpace')

type RoomSpaceSdkGetter = () => Promise<AdminManager>

/**
 * `AdminRoomService` 的空间管理方法片段。
 *
 * 从 `RoomService.ts` 抽离：空间（space）维度的管理端点独立成域，
 * 避免房间服务文件随端点增加持续膨胀。子类提供 SDK 管理器 getter。
 */
export abstract class RoomSpaceMethods {
  protected abstract readonly sdkAdmin: RoomSpaceSdkGetter

  async adminGetSpaces(
    limit: number = 50,
    from?: string
  ): Promise<{
    spaces: AdminSpaceInfo[]
    next_batch?: string | undefined
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listSpaces(from, limit)
      return {
        spaces: (result?.spaces ?? []).map((s) => unknownToObject<AdminSpaceInfo>(s) ?? {}),
        next_batch: undefined
      }
    } catch (err) {
      logger.error(`[Admin] 获取空间列表失败: ${err}`)
      return { spaces: [] }
    }
  }

  /** 删除指定空间；失败时向上抛错。 */
  async adminDeleteSpace(spaceId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteSpace(spaceId)
      logger.info(`[Admin] 删除空间成功: ${spaceId}`)
    } catch (err) {
      logger.error(`[Admin] 删除空间失败: ${err}`)
      throw err
    }
  }

  /** 读取空间详情；失败时返回 null。 */
  async getSpaceDetails(spaceId: string): Promise<AdminSpaceInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getSpace(spaceId)
      return unknownToObject<AdminSpaceInfo>(result)
    } catch (err) {
      logger.error(`[Admin] 获取空间详情失败: ${err}`)
      return null
    }
  }

  /** 读取空间成员列表；失败时返回空数组。 */
  async getSpaceUsers(spaceId: string): Promise<AdminSpaceUser[]> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getSpaceUsers(spaceId)
      return (result?.users ?? []).map((u) => unknownToObject<AdminSpaceUser>(u) ?? {})
    } catch (err) {
      logger.error(`[Admin] 获取空间用户失败: ${err}`)
      return []
    }
  }

  /** 读取空间内的房间列表；失败时返回空数组。 */
  async getSpaceRooms(spaceId: string): Promise<AdminSpaceRoom[]> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getSpaceRooms(spaceId)
      return (result?.rooms ?? []).map((r) => unknownToObject<AdminSpaceRoom>(r) ?? {})
    } catch (err) {
      logger.error(`[Admin] 获取空间房间失败: ${err}`)
      return []
    }
  }

  /** 读取空间统计信息；失败时返回 null。 */
  async getSpaceStats(spaceId: string): Promise<AdminSpaceStatsInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getSpaceStats(spaceId)
      return unknownToObject<AdminSpaceStatsInfo>(result)
    } catch (err) {
      logger.error(`[Admin] 获取空间统计失败: ${err}`)
      return null
    }
  }
}
