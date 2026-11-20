import type { SpaceHierarchyPage, SpaceHierarchyRoomEntry, SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'

/**
 * 空间（Space）域测试夹具。
 *
 * `SpaceInfo` 是 `MatrixSpaceService` 的对外契约（`getSpaces` / `getSpace` / `createSpace` 的返回），
 * 字段与 `spaceQueries` 的归一化结果一致。
 */

/** 生成空间摘要；默认 1 名成员、0 个子房间。 */
export function makeSpaceInfo(overrides: Partial<SpaceInfo> = {}): SpaceInfo {
  return {
    spaceId: 's1',
    name: 'S',
    memberCount: 1,
    childCount: 0,
    ...overrides
  }
}

/** `MatrixSpaceService.getSpaceHierarchy()` 的单条房间（wire 字段为 snake_case）。 */
export function makeSpaceHierarchyRoomEntry(overrides: Partial<SpaceHierarchyRoomEntry> = {}): SpaceHierarchyRoomEntry {
  return {
    room_id: '!room:example.org',
    room_type: 'm.space',
    name: 'Room',
    topic: '',
    avatar_url: '',
    num_joined_members: 1,
    ...overrides
  }
}

/** `getSpaceHierarchy()` 的分页结果。 */
export function makeSpaceHierarchyPage(rooms: SpaceHierarchyRoomEntry[] = [], nextBatch?: string): SpaceHierarchyPage {
  return nextBatch === undefined ? { rooms } : { rooms, next_batch: nextBatch }
}
