import type { Ref } from 'vue'
import type { adminService, MediaInfo } from '@/services/matrix/admin'
import type { GlobalMediaQuarantineChange, MediaQuarantineChange, RoomMediaItem } from '@/services/matrix/sdk'

type MediaListPage = Awaited<ReturnType<typeof adminService.getMediaList>>

/** 媒体库列表项：沿用服务层已归一化的驼峰形状（服务层把 `next_batch` 归一为 `nextToken`）。 */
export type MediaLibraryItem = MediaListPage['media'][number]

/**
 * Admin 媒体管理 composable 的对外契约。
 *
 * 单独成文件，避免 `useAdminMedia.ts` 因接口声明膨胀越过 400 行门槛；
 * 成员名称与签名保持与实现完全一致。
 */
export interface UseAdminMedia {
  library: Ref<MediaLibraryItem[]>
  libraryNextBatch: Ref<string | null>
  libraryLoading: Ref<boolean>
  selectedMedia: Ref<MediaInfo | null>
  detailLoading: Ref<boolean>
  quarantineChanges: Ref<GlobalMediaQuarantineChange[]>
  quarantineNextBatch: Ref<number>
  quarantineLoading: Ref<boolean>
  roomMedia: Ref<RoomMediaItem[]>
  roomMediaNextBatch: Ref<string | null>
  roomMediaLoading: Ref<boolean>
  roomMediaRoomId: Ref<string | null>
  userMedia: Ref<MediaInfo[]>
  userMediaLoading: Ref<boolean>
  userMediaUserId: Ref<string | null>
  mutating: Ref<boolean>
  loadLibrary: (reset?: boolean) => Promise<void>
  loadMoreLibrary: () => Promise<void>
  openMediaDetail: (mediaId: string) => Promise<void>
  openMediaDetailByServer: (serverName: string, mediaId: string) => Promise<void>
  closeMediaDetail: () => void
  loadQuarantineChanges: (reset?: boolean) => Promise<void>
  loadMoreQuarantineChanges: () => Promise<void>
  loadMediaQuarantineHistory: (mediaId: string) => Promise<MediaQuarantineChange[]>
  loadRoomMedia: (roomId: string, reset?: boolean) => Promise<void>
  loadMoreRoomMedia: () => Promise<void>
  loadUserMedia: (userId: string) => Promise<void>
  quarantine: (serverName: string, mediaId: string) => Promise<void>
  unquarantine: (serverName: string, mediaId: string) => Promise<void>
  protect: (serverName: string, mediaId: string) => Promise<void>
  protectById: (mediaId: string) => Promise<void>
  unprotect: (mediaId: string) => Promise<void>
  deleteOne: (serverName: string | null, mediaId: string) => Promise<void>
  deleteRoomOne: (roomId: string, mediaId: string) => Promise<void>
  deleteUserAll: (userId: string) => Promise<void>
  quarantineRoom: (roomId: string, userId?: string) => Promise<void>
  unquarantineRoom: (roomId: string, userId?: string) => Promise<void>
  quarantineUser: (userId: string) => Promise<void>
  deleteByPolicy: (options: { beforeTs?: number; maxSize?: number }) => Promise<number>
}
