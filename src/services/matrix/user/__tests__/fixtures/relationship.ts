/**
 * 用户关系/资料测试夹具。
 *
 * 类型来源：
 * - `MatrixContactService.UserProfile`（`getUserProfile()` 返回值）；
 * - `MatrixRelationshipService.MutualRoomsResult`（SDK `getMutualRooms()` 归一化结果）。
 */
import type { UserProfile } from '@/services/matrix/user/MatrixContactService'
import type { MutualRoomsResult } from '@/services/matrix/user/MatrixRelationshipService'

export function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return { userId: '@alice:example.org', displayName: 'Alice', avatarUrl: 'mxc://example.org/alice', ...overrides }
}

export function makeMutualRoomsResult(overrides: Partial<MutualRoomsResult> = {}): MutualRoomsResult {
  return { roomIds: [], ...overrides }
}
