import { LARGE_PAGE_LIMIT } from '@/common/constants'
import type {
  AdminManager,
  GlobalMediaQuarantineChangesResponse,
  MediaInfo,
  MediaPage,
  MediaProtectionResponse,
  MediaQuarantineChangesResponse,
  MediaUnprotectionResponse,
  RoomMediaPage,
  RoomMediaQuarantineResponse,
  RoomMediaUnquarantineResponse,
  UserMediaList,
  UserMediaQuarantineResponse
} from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MediaService')

type MediaAdminSdk = Pick<
  AdminManager,
  | 'getMedia'
  | 'getMediaInfo'
  | 'getMediaInfoByServer'
  | 'deleteMedia'
  | 'deleteMediaByServer'
  | 'purgeMediaCache'
  | 'deleteMediaByPolicy'
  | 'quarantineMedia'
  | 'unquarantineMedia'
  | 'protectMedia'
  | 'protectMediaById'
  | 'unprotectMedia'
  | 'getGlobalMediaQuarantineChanges'
  | 'getMediaQuarantineChanges'
  | 'getRoomMedia'
  | 'deleteRoomMedia'
  | 'quarantineRoomMedia'
  | 'unquarantineRoomMedia'
  | 'getUserMedia'
  | 'deleteUserMedia'
  | 'quarantineUserMedia'
>

type MediaDomainSdkGetter = () => Promise<MediaAdminSdk>

// 后端媒体列表并未返回 `content_uri`，历史适配层仍保留该字段（缺省空串）；
// 分页游标同时兼容 SDK 的 `next_batch` 与旧的 `next_token`。
type LegacyMediaResult = Omit<MediaPage, 'media'> & {
  media?: Array<MediaInfo & { content_uri?: string }>
  next_token?: string
}

// 扁平 AdminManager 将 deleteUserMedia 声明为 Promise<void>，但运行时实际返回 { deleted: number }
// （见 admin-media-manager.d.ts 的 deleteUserMedia）；此处按运行时形状窄化读取，
// 形状缺失时与失败语义一致降级为 null。
type DeleteUserMediaResult = { deleted: number }

function isDeleteUserMediaResult(value: unknown): value is DeleteUserMediaResult {
  return typeof value === 'object' && value !== null && 'deleted' in value && typeof value.deleted === 'number'
}

export class AdminMediaService {
  constructor(private readonly sdkAdmin: MediaDomainSdkGetter) {}

  // 媒体方法错误语义：
  // - void 写方法（delete/quarantine/unquarantine 等）失败时记录日志并 rethrow，由调用方反馈；
  // - 有返回值的方法失败时降级返回 null（不抛出），调用方必须先判空。
  async getMediaList(
    limit = LARGE_PAGE_LIMIT,
    from?: string,
    _orderBy?: string,
    _search?: string
  ): Promise<{
    media: Array<{
      mediaId: string
      mediaType: string
      contentUri: string
      createdAt: number
      uploadName?: string | undefined
      mediaLength?: number | undefined
      quarantined?: boolean | undefined
    }>
    nextToken?: string | undefined
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = (await admin.getMedia(limit, from)) as LegacyMediaResult
      return {
        media: (result?.media ?? []).map((m) => ({
          mediaId: m.media_id ?? '',
          mediaType: m.media_type ?? '',
          contentUri: m.content_uri ?? '',
          createdAt: m.created_ts ?? 0,
          uploadName: m.upload_name,
          mediaLength: m.media_length,
          quarantined: m.quarantined
        })),
        nextToken: result?.next_batch ?? result?.next_token
      }
    } catch (err) {
      logger.error(`[AdminMedia] 获取媒体列表失败: ${err}`)
      return { media: [] }
    }
  }

  /**
   * 获取单个媒体详情。
   * @param mediaId 媒体 ID。
   * @returns 媒体详情；失败时返回 null。
   */
  async getMediaInfo(mediaId: string): Promise<MediaInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.getMediaInfo(mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 获取媒体详情失败: ${err}`)
      return null
    }
  }

  /**
   * 按服务器获取单个媒体详情。
   * @param serverName 媒体所在服务器名。
   * @param mediaId 媒体 ID。
   * @returns 媒体详情；失败时返回 null。
   */
  async getMediaInfoByServer(serverName: string, mediaId: string): Promise<MediaInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.getMediaInfoByServer(serverName, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 按服务器获取媒体详情失败: ${err}`)
      return null
    }
  }

  async deleteMedia(mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteMedia(mediaId)
      logger.info(`[AdminMedia] 媒体已删除: ${mediaId}`)
    } catch (err) {
      logger.error(`[AdminMedia] 删除媒体失败: ${err}`)
      throw err
    }
  }

  /**
   * 按服务器删除媒体。
   * @param serverName 媒体所在服务器名。
   * @param mediaId 媒体 ID。
   * @returns 无返回值；失败时抛出。
   */
  async deleteMediaByServer(serverName: string, mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteMediaByServer(serverName, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 按服务器删除媒体失败: ${err}`)
      throw err
    }
  }

  async purgeMediaCache(beforeTs?: number): Promise<{ deleted: number }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.purgeMediaCache(beforeTs)
      logger.info(`[AdminMedia] 清理媒体缓存: ${result?.deleted ?? 0}个`)
      return { deleted: result?.deleted ?? 0 }
    } catch (err) {
      logger.error(`[AdminMedia] 清理媒体缓存失败: ${err}`)
      throw err
    }
  }

  /**
   * 隔离媒体。
   * @param serverName 媒体所在服务器名。
   * @param mediaId 媒体 ID。
   * @returns 无返回值；失败时抛出。
   */
  async quarantineMedia(serverName: string, mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.quarantineMedia(serverName, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 隔离媒体失败: ${err}`)
      throw err
    }
  }

  /**
   * 取消隔离媒体。
   * @param serverName 媒体所在服务器名。
   * @param mediaId 媒体 ID。
   * @returns 无返回值；失败时抛出。
   */
  async unquarantineMedia(serverName: string, mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.unquarantineMedia(serverName, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 取消隔离媒体失败: ${err}`)
      throw err
    }
  }

  /**
   * 保护媒体（按服务器 + 媒体 ID）。
   * @param serverName 媒体所在服务器名。
   * @param mediaId 媒体 ID。
   * @returns 保护响应；失败时返回 null。
   */
  async protectMedia(serverName: string, mediaId: string): Promise<MediaProtectionResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.protectMedia(serverName, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 保护媒体失败: ${err}`)
      return null
    }
  }

  /**
   * 按媒体 ID 保护媒体。
   * @param mediaId 媒体 ID。
   * @returns 保护响应；失败时返回 null。
   */
  async protectMediaById(mediaId: string): Promise<MediaProtectionResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.protectMediaById(mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 按 ID 保护媒体失败: ${err}`)
      return null
    }
  }

  /**
   * 取消保护媒体。
   * @param mediaId 媒体 ID。
   * @returns 取消保护响应；失败时返回 null。
   */
  async unprotectMedia(mediaId: string): Promise<MediaUnprotectionResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.unprotectMedia(mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 取消保护媒体失败: ${err}`)
      return null
    }
  }

  /**
   * 按策略（时间/体积阈值）删除媒体。
   * @param options 删除条件，可含 `beforeTs` 与 `maxSize`。
   * @returns 删除条数；失败时返回 null。
   */
  async deleteMediaByPolicy(options: { beforeTs?: number; maxSize?: number }): Promise<{ deleted: number } | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.deleteMediaByPolicy(options)
    } catch (err) {
      logger.error(`[AdminMedia] 按策略删除媒体失败: ${err}`)
      return null
    }
  }

  /**
   * 获取全局媒体隔离变更。
   * @param from 起始游标，缺省为 0。
   * @returns 隔离变更响应；失败时返回 null。
   */
  async getGlobalQuarantineChanges(from?: number): Promise<GlobalMediaQuarantineChangesResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.getGlobalMediaQuarantineChanges({ from: from ?? 0 })
    } catch (err) {
      logger.error(`[AdminMedia] 获取全局隔离变更失败: ${err}`)
      return null
    }
  }

  async getMediaQuarantineChanges(
    mediaId: string,
    options?: { from?: string; limit?: number }
  ): Promise<MediaQuarantineChangesResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.getMediaQuarantineChanges(mediaId, options)
    } catch (err) {
      logger.error(`[AdminMedia] 获取媒体隔离变更失败: ${err}`)
      return null
    }
  }

  /**
   * 获取房间媒体列表。
   * @param roomId 房间 ID。
   * @param from 分页游标。
   * @param limit 单页条数。
   * @returns 房间媒体分页；失败时返回 null。
   */
  async getRoomMedia(roomId: string, from?: string, limit?: number): Promise<RoomMediaPage | null> {
    try {
      const admin = await this.sdkAdmin()
      const options: { from?: string; limit?: number } = {}
      if (from !== undefined) options.from = from
      if (limit !== undefined) options.limit = limit
      return await admin.getRoomMedia(roomId, Object.keys(options).length > 0 ? options : undefined)
    } catch (err) {
      logger.error(`[AdminMedia] 获取房间媒体失败: ${err}`)
      return null
    }
  }

  /**
   * 删除房间媒体。
   * @param roomId 房间 ID。
   * @param mediaId 媒体 ID。
   * @returns 无返回值；失败时抛出。
   */
  async deleteRoomMedia(roomId: string, mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteRoomMedia(roomId, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 删除房间媒体失败: ${err}`)
      throw err
    }
  }

  /**
   * 隔离房间媒体。
   * @param roomId 房间 ID。
   * @param userId 可选，仅隔离该用户的媒体。
   * @returns 隔离响应；失败时返回 null。
   */
  async quarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaQuarantineResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.quarantineRoomMedia(roomId, userId ? { userId } : undefined)
    } catch (err) {
      logger.error(`[AdminMedia] 隔离房间媒体失败: ${err}`)
      return null
    }
  }

  /**
   * 取消隔离房间媒体。
   * @param roomId 房间 ID。
   * @param userId 可选，仅取消隔离该用户的媒体。
   * @returns 取消隔离响应；失败时返回 null。
   */
  async unquarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaUnquarantineResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.unquarantineRoomMedia(roomId, userId ? { userId } : undefined)
    } catch (err) {
      logger.error(`[AdminMedia] 取消隔离房间媒体失败: ${err}`)
      return null
    }
  }

  /**
   * 获取用户媒体列表。
   * @param userId 用户 ID。
   * @returns 用户媒体列表；失败时返回 null。
   */
  async getUserMedia(userId: string): Promise<UserMediaList | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.getUserMedia(userId)
    } catch (err) {
      logger.error(`[AdminMedia] 获取用户媒体失败: ${err}`)
      return null
    }
  }

  /**
   * 删除用户媒体。
   * @param userId 用户 ID。
   * @returns 删除条数；响应形状缺失或失败时返回 null。
   */
  async deleteUserMedia(userId: string): Promise<{ deleted: number } | null> {
    try {
      const admin = await this.sdkAdmin()
      const result: unknown = await admin.deleteUserMedia(userId)
      if (!isDeleteUserMediaResult(result)) {
        logger.warn(`[AdminMedia] 删除用户媒体未返回删除条数: ${userId}`)
        return null
      }
      logger.info(`[AdminMedia] 已删除用户媒体: ${userId} (${result.deleted}个)`)
      return { deleted: result.deleted }
    } catch (err) {
      logger.error(`[AdminMedia] 删除用户媒体失败: ${err}`)
      return null
    }
  }

  /**
   * 隔离用户媒体。
   * @param userId 用户 ID。
   * @returns 隔离响应；失败时返回 null。
   */
  async quarantineUserMedia(userId: string): Promise<UserMediaQuarantineResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.quarantineUserMedia(userId)
    } catch (err) {
      logger.error(`[AdminMedia] 隔离用户媒体失败: ${err}`)
      return null
    }
  }
}
