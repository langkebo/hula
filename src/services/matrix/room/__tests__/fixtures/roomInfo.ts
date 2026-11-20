/**
 * 房间 store 测试夹具（摘要 / 房间信息 / 标签）。
 *
 * 类型全部来自真实契约：
 * - `MatrixRoomSummary`：`room/SummaryService.ts` 导出，12 键必填；
 * - `RoomInfo`：`@/services/types` 导出，11 键必填（`detail` 可选）；
 * - 标签映射：从 `matrixRoomReadFacade.getTags()` 返回签名推导。
 *
 * 早前测试用 `{ roomId, topic, ... } as any` 冒充摘要，缺 `name / ownerId /
 * joinRule / createdTs`，属于「测不存在的响应」；改用本夹具后缺键会被 `vue-tsc` 拦下。
 */
import type { RoomInfo } from '@/services/types'
import type { matrixRoomReadFacade } from '../../RoomFacade'
import type { MatrixRoomSummary } from '../../SummaryService'

export type RoomTagsFixture = Awaited<ReturnType<typeof matrixRoomReadFacade.getTags>>

export function makeRoomSummary(overrides: Partial<MatrixRoomSummary> = {}): MatrixRoomSummary {
  return {
    roomId: '!room:id',
    name: null,
    topic: null,
    avatarUrl: null,
    memberCount: 0,
    joinedCount: 0,
    ownerId: null,
    joinRule: null,
    canonicalAlias: null,
    createdTs: null,
    isPublic: false,
    ...overrides
  }
}

export function makeRoomInfo(overrides: Partial<RoomInfo> = {}): RoomInfo {
  return {
    roomId: '!room:id',
    name: 'Test Room',
    avatarUrl: null,
    isDirect: false,
    isEncrypted: false,
    unreadCount: 0,
    highlightCount: 0,
    notificationCount: 0,
    lastMessage: null,
    lastMessageTime: null,
    members: [],
    ...overrides
  }
}

export function makeRoomTags(overrides: RoomTagsFixture = {}): RoomTagsFixture {
  return { ...overrides }
}
