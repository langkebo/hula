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
  /** `content_uri` / `server_name` 由后端 `/media` 列表在 2026-11-20 起返回 */
  media?: Array<MediaInfo & { content_uri?: string; server_name?: string }>
  next_token?: string
}

/**
 * 媒体列表条目 —— `AdminMediaService.getMediaList` **映射后**的前端模型（camelCase）。
 *
 * 此前它是 `getMediaList` 签名里的**内联匿名类型**：无法复用、夹具没法标注、
 * 也不受任何门禁检查。提出来的同时保留字段语义：
 * - `createdAt` 来自 wire 的 `created_ts`（后端 `media.rs:132/162/246` 确认用这个键）
 * - `quarantined` 仅 `get_all_media` / `get_media_info` 返回
 */
export interface AdminMediaListItem {
  mediaId: string
  mediaType: string
  /**
   * 媒体内容的 `mxc://<server>/<media_id>`。
   *
   * 2026-11-20 起由后端 `get_all_media` 直接返回（此前只回 8 个字段、缺
   * `content_uri`/`server_name`，前端构造不出 URL，只能把整块 JSON 拍给管理员）。
   * 用 `MediaService.getMediaList` 里的空串兜底：老后端（未升级）仍会走空值。
   */
  contentUri: string
  /** 媒体所属服务器；与 `contentUri` 同源，单独给出便于按 server 过滤 */
  serverName: string
  createdAt: number
  uploadName?: string | undefined
  mediaLength?: number | undefined
  quarantined?: boolean | undefined
}

/** 媒体列表页 —— `{ media, nextToken }` */
export interface AdminMediaListPage {
  media: AdminMediaListItem[]
  nextToken?: string | undefined
}
