/**
 * admin 媒体域测试夹具。
 *
 * 三种结构并存，夹具必须分开：
 * - `AdminMediaListPage` / `AdminMediaListItem`：`getMediaList` **映射后**的前端模型（camelCase）
 * - `MediaInfo`：`getMediaInfo(ById)` **原样返回**的 wire 结构（snake_case），来自 SDK
 * - `LegacyMediaResult`：`getMedia` 的兼容响应（`MediaInfo` + 旧 `content_uri` / `next_token`）
 *
 * 写回执（`purgeMediaCache` / `deleteUserMedia`）统一为 `{ deleted: number }`。
 *
 * 类型来源：`AdminMediaListPage` 来自本仓 `mediaServiceTypes.ts`（字段语义对齐后端
 * `media.rs:132/162/246` 的 `created_ts`）；`MediaInfo` 经 `@/services/matrix/sdk` 边界导入，
 * 不手抄。
 */
import type { MediaInfo, UserMediaList } from '@/services/matrix/sdk'
import type { AdminMediaListItem, AdminMediaListPage, LegacyMediaResult } from '../../mediaServiceTypes'

/** 列表条目：完整字段 */
export const adminMediaListItemFixture: AdminMediaListItem = {
  mediaId: 'm1',
  mediaType: 'image/png',
  // 后端自 2026-11-20 起返回（此前只有裸 media_id，前端拼不出 mxc://）
  contentUri: 'mxc://server.test/m1',
  serverName: 'server.test',
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

// ============================================================================
// getMedia 的兼容响应（wire 结构）
// ============================================================================

/** legacy 列表条目：`MediaInfo` + 旧适配层保留的 `content_uri` */
type LegacyMediaItem = NonNullable<LegacyMediaResult['media']>[number]

/** 单条 legacy 列表项：只有 `media_id` 必填，其余按需覆盖（不注入测试未声明的字段） */
export function makeLegacyMediaItem(overrides: Partial<LegacyMediaItem> = {}): LegacyMediaItem {
  return { media_id: 'm1', ...overrides }
}

/**
 * `getMedia` 的兼容响应。
 *
 * `next_batch` 缺省 `null`（后端末页语义），旧游标 `next_token` 通过 overrides 提供，
 * 用于覆盖服务层 `result?.next_batch ?? result?.next_token` 的回退分支。
 */
export function makeLegacyMediaPage(
  items: Partial<LegacyMediaItem>[] = [],
  overrides: Partial<LegacyMediaResult> = {}
): LegacyMediaResult {
  return {
    media: items.map((item) => makeLegacyMediaItem(item)),
    total: items.length,
    next_batch: null,
    ...overrides
  }
}

// ============================================================================
// 媒体详情 / 用户媒体 / 写回执
// ============================================================================

/** 单个媒体详情：`MediaInfo` 除 `media_id` 外均为可选 */
export function makeMediaInfo(overrides: Partial<MediaInfo> = {}): MediaInfo {
  return { media_id: 'm1', ...overrides }
}

/** 用户媒体列表：`{media, total}`，`total` 缺省取条目数 */
export function makeUserMediaList(
  items: Partial<MediaInfo>[] = [],
  overrides: Partial<UserMediaList> = {}
): UserMediaList {
  return { media: items.map((item) => makeMediaInfo(item)), total: items.length, ...overrides }
}

/** `purgeMediaCache` / `deleteUserMedia` 的写回执 */
export function makeMediaDeleteResult(deleted = 0): { deleted: number } {
  return { deleted }
}

/**
 * 后端未返回 `deleted` 时的畸形响应。
 *
 * 真实契约里 `deleted` 必填；服务层 `result?.deleted ?? 0` 的降级分支专门靠它覆盖，
 * 因此保留 `as never`，避免把非契约输入伪装成合法响应。
 */
export const purgeCacheResultWithoutDeleted = {} as never
