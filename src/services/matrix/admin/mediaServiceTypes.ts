import type { AdminManager, MediaInfo, MediaPage } from '@/services/matrix/sdk'

/**
 * 媒体管理依赖的 AdminManager 能力子集。
 *
 * 扁平 `deleteUserMedia` 在运行时被路由到子 Manager 且无返回值，
 * 因此显式改走 `media.deleteUserMedia`（返回 `{ deleted: number }`）。
 */
export type MediaAdminSdk = Pick<
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
  | 'quarantineUserMedia'
> & {
  media: Pick<AdminManager['media'], 'deleteUserMedia'>
}

/** 获取媒体管理 AdminManager 子集的异步工厂。 */
export type MediaDomainSdkGetter = () => Promise<MediaAdminSdk>

/**
 * 后端媒体列表的兼容形状。
 *
 * 后端并未返回 `content_uri`，历史适配层仍保留该字段（缺省空串）；
 * 分页游标同时兼容 SDK 的 `next_batch` 与旧的 `next_token`。
 */
export type LegacyMediaResult = Omit<MediaPage, 'media'> & {
  media?: Array<MediaInfo & { content_uri?: string }>
  next_token?: string
}
