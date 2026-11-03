import { LARGE_PAGE_LIMIT } from '@/common/constants'
import type {
  GlobalMediaQuarantineChangesResponse,
  MediaInfo,
  MediaProtectionResponse,
  MediaQuarantineChangesResponse,
  MediaUnprotectionResponse,
  RoomMediaPage,
  RoomMediaQuarantineResponse,
  RoomMediaUnquarantineResponse,
  UserMediaList,
  UserMediaQuarantineResponse
} from '@/services/matrix/sdk'
import { AdminFacadeOpsMethods } from './AdminFacadeOpsMethods'

/**
 * AdminFacadeService 的媒体（media）方法片段。
 *
 * 从 `AdminFacadeDomainMethods` 中抽离：媒体相关方法数量最多且与房间/用户/安全委托无关，
 * 单独成混入类可把 Domain 文件控制在 400 行门槛以内。子类（AdminFacadeService）
 * 通过 `AdminFacadeOpsMethods` 提供 `media` 子服务字段。
 */
export abstract class AdminFacadeMediaMethods extends AdminFacadeOpsMethods {
  async getMediaList(
    limit = LARGE_PAGE_LIMIT,
    from?: string,
    orderBy?: string,
    search?: string
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
    return this.media.getMediaList(limit, from, orderBy, search)
  }

  /** 删除指定媒体。 */
  async deleteMedia(mediaId: string): Promise<void> {
    return this.media.deleteMedia(mediaId)
  }

  /** 获取单个媒体的详情，失败时返回 null。 */
  async getMediaInfo(mediaId: string): Promise<MediaInfo | null> {
    return this.media.getMediaInfo(mediaId)
  }

  /** 按服务器获取媒体详情，失败时返回 null。 */
  async getMediaInfoByServer(serverName: string, mediaId: string): Promise<MediaInfo | null> {
    return this.media.getMediaInfoByServer(serverName, mediaId)
  }

  /** 按服务器删除媒体。 */
  async deleteMediaByServer(serverName: string, mediaId: string): Promise<void> {
    return this.media.deleteMediaByServer(serverName, mediaId)
  }

  /** 按时间/体积策略删除媒体，失败时返回 null。 */
  async deleteMediaByPolicy(options: { beforeTs?: number; maxSize?: number }): Promise<{ deleted: number } | null> {
    return this.media.deleteMediaByPolicy(options)
  }

  /** 隔离指定媒体。 */
  async quarantineMedia(serverName: string, mediaId: string): Promise<void> {
    return this.media.quarantineMedia(serverName, mediaId)
  }

  /** 取消隔离指定媒体。 */
  async unquarantineMedia(serverName: string, mediaId: string): Promise<void> {
    return this.media.unquarantineMedia(serverName, mediaId)
  }

  /** 按服务器保护媒体，失败时返回 null。 */
  async protectMedia(serverName: string, mediaId: string): Promise<MediaProtectionResponse | null> {
    return this.media.protectMedia(serverName, mediaId)
  }

  /** 按媒体 ID 保护媒体，失败时返回 null。 */
  async protectMediaById(mediaId: string): Promise<MediaProtectionResponse | null> {
    return this.media.protectMediaById(mediaId)
  }

  /** 取消媒体保护，失败时返回 null。 */
  async unprotectMedia(mediaId: string): Promise<MediaUnprotectionResponse | null> {
    return this.media.unprotectMedia(mediaId)
  }

  /** 获取全局媒体隔离变更，失败时返回 null。 */
  async getGlobalQuarantineChanges(from?: number): Promise<GlobalMediaQuarantineChangesResponse | null> {
    return this.media.getGlobalQuarantineChanges(from)
  }

  /** 获取单个媒体的隔离变更，失败时返回 null。 */
  async getMediaQuarantineChanges(
    mediaId: string,
    options?: { from?: string; limit?: number }
  ): Promise<MediaQuarantineChangesResponse | null> {
    return this.media.getMediaQuarantineChanges(mediaId, options)
  }

  /** 获取房间内的媒体列表，失败时返回 null。 */
  async getRoomMedia(roomId: string, from?: string, limit?: number): Promise<RoomMediaPage | null> {
    return this.media.getRoomMedia(roomId, from, limit)
  }

  /** 删除房间内的指定媒体。 */
  async deleteRoomMedia(roomId: string, mediaId: string): Promise<void> {
    return this.media.deleteRoomMedia(roomId, mediaId)
  }

  /** 隔离房间媒体，失败时返回 null。 */
  async quarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaQuarantineResponse | null> {
    return this.media.quarantineRoomMedia(roomId, userId)
  }

  /** 取消隔离房间媒体，失败时返回 null。 */
  async unquarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaUnquarantineResponse | null> {
    return this.media.unquarantineRoomMedia(roomId, userId)
  }

  /** 获取用户上传的媒体列表，失败时返回 null。 */
  async getUserMedia(userId: string): Promise<UserMediaList | null> {
    return this.media.getUserMedia(userId)
  }

  /** 删除用户上传的媒体，失败时返回 null。 */
  async deleteUserMedia(userId: string): Promise<{ deleted: number } | null> {
    return this.media.deleteUserMedia(userId)
  }

  /** 隔离用户媒体，失败时返回 null。 */
  async quarantineUserMedia(userId: string): Promise<UserMediaQuarantineResponse | null> {
    return this.media.quarantineUserMedia(userId)
  }
}
