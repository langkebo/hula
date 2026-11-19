/**
 * admin 媒体域测试夹具。
 *
 * 两种结构并存，夹具必须分开：
 * - `AdminMediaListPage` / `AdminMediaListItem`：`getMediaList` **映射后**的前端模型（camelCase）
 * - `MediaInfo`：`getMediaInfo(ById)` **原样返回**的 wire 结构（snake_case），来自 SDK
 *
 * 类型来源：`AdminMediaListPage` 来自本仓 `mediaServiceTypes.ts`（字段语义对齐后端
 * `media.rs:132/162/246` 的 `created_ts`）；`MediaInfo` 经 `@/services/matrix/sdk` 边界导入，
 * 不手抄。
 */
import type { MediaInfo } from '@/services/matrix/sdk'
import type { AdminMediaListItem, AdminMediaListPage } from '../../mediaServiceTypes'

/** 列表条目：完整字段 */
export const adminMediaListItemFixture: AdminMediaListItem = {
  mediaId: 'm1',
  mediaType: 'image/png',
  createdAt: 1795000000000,
  uploadName: 'photo.png',
  mediaLength: 20480,
  quarantined: false
}

/** 列表页：两条 + 下一页游标 */
export const adminMediaListPageFixture: AdminMediaListPage = {
  media: [adminMediaListItemFixture, { ...adminMediaListItemFixture, mediaId: 'm2', mediaType: 'video/mp4' }],
  nextToken: 'next-page'
}

/** 空列表页（测试「确实为空」与「请求失败」要能区分） */
export const adminMediaListPageEmptyFixture: AdminMediaListPage = { media: [], nextToken: undefined }

/** 单条媒体信息：wire 结构（`GET /_synapse/admin/v1/media/{server}/{media_id}`） */
export const mediaInfoFixture: MediaInfo = {
  media_id: 'm1',
  media_type: 'image/png',
  upload_name: 'photo.png',
  created_ts: 1795000000000,
  last_access_ts: 1795000000000,
  media_length: 20480,
  user_id: '@u:server.test',
  quarantined: false
}

/**
 * 按需构造列表页：测试常常只关心 1-2 个字段，但**多出来的键仍会被拦** ——
 * `Partial<AdminMediaListItem>` 依然只允许已知键（excess property check 生效），
 * 所以工厂不会降低「假结构」的检出能力。
 */
export function makeMediaListPage(items: Partial<AdminMediaListItem>[] = [], nextToken?: string): AdminMediaListPage {
  return {
    media: items.map((item) => ({ ...adminMediaListItemFixture, ...item })),
    nextToken
  }
}

/** 单条列表项：同上，按需覆盖 */
export function makeMediaListItem(overrides: Partial<AdminMediaListItem> = {}): AdminMediaListItem {
  return { ...adminMediaListItemFixture, ...overrides }
}
