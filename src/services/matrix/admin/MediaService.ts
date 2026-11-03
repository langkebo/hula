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

export class AdminMediaService {
  constructor(private readonly sdkAdmin: MediaDomainSdkGetter) {}

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
          mediaLength: m.media_length
        })),
        nextToken: result?.next_batch ?? result?.next_token
      }
    } catch (err) {
      logger.error(`[AdminMedia] 获取媒体列表失败: ${err}`)
      return { media: [] }
    }
  }

  async getMediaInfo(mediaId: string): Promise<MediaInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.getMediaInfo(mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 获取媒体详情失败: ${err}`)
      return null
    }
  }

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

  async quarantineMedia(serverName: string, mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.quarantineMedia(serverName, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 隔离媒体失败: ${err}`)
      throw err
    }
  }

  async unquarantineMedia(serverName: string, mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.unquarantineMedia(serverName, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 取消隔离媒体失败: ${err}`)
      throw err
    }
  }

  async protectMedia(serverName: string, mediaId: string): Promise<MediaProtectionResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.protectMedia(serverName, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 保护媒体失败: ${err}`)
      return null
    }
  }

  async protectMediaById(mediaId: string): Promise<MediaProtectionResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.protectMediaById(mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 按 ID 保护媒体失败: ${err}`)
      return null
    }
  }

  async unprotectMedia(mediaId: string): Promise<MediaUnprotectionResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.unprotectMedia(mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 取消保护媒体失败: ${err}`)
      return null
    }
  }

  async deleteMediaByPolicy(options: { beforeTs?: number; maxSize?: number }): Promise<{ deleted: number } | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.deleteMediaByPolicy(options)
    } catch (err) {
      logger.error(`[AdminMedia] 按策略删除媒体失败: ${err}`)
      return null
    }
  }

  async getGlobalQuarantineChanges(from?: number): Promise<GlobalMediaQuarantineChangesResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.getGlobalMediaQuarantineChanges({ from: from ?? 0 })
    } catch (err) {
      logger.error(`[AdminMedia] 获取全局隔离变更失败: ${err}`)
      return null
    }
  }

  async getMediaQuarantineChanges(mediaId: string, since?: number): Promise<MediaQuarantineChangesResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      const options = since === undefined ? undefined : { from: String(since) }
      return await admin.getMediaQuarantineChanges(mediaId, options)
    } catch (err) {
      logger.error(`[AdminMedia] 获取媒体隔离变更失败: ${err}`)
      return null
    }
  }

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

  async deleteRoomMedia(roomId: string, mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteRoomMedia(roomId, mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 删除房间媒体失败: ${err}`)
      throw err
    }
  }

  async quarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaQuarantineResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.quarantineRoomMedia(roomId, userId ? { userId } : undefined)
    } catch (err) {
      logger.error(`[AdminMedia] 隔离房间媒体失败: ${err}`)
      return null
    }
  }

  async unquarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaUnquarantineResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.unquarantineRoomMedia(roomId, userId ? { userId } : undefined)
    } catch (err) {
      logger.error(`[AdminMedia] 取消隔离房间媒体失败: ${err}`)
      return null
    }
  }

  async getUserMedia(userId: string): Promise<UserMediaList | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.getUserMedia(userId)
    } catch (err) {
      logger.error(`[AdminMedia] 获取用户媒体失败: ${err}`)
      return null
    }
  }

  async deleteUserMedia(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteUserMedia(userId)
    } catch (err) {
      logger.error(`[AdminMedia] 删除用户媒体失败: ${err}`)
      throw err
    }
  }

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
