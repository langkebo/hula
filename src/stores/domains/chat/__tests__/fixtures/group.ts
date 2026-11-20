/**
 * 群/房间信息测试夹具。
 *
 * 契约来源：`useGroupStore().loadGroupInfo()` 的返回值 `MatrixGroupInfo`。
 */
import type { MatrixGroupInfo } from '@/stores/domains/chat/group/types'

export function makeGroupInfo(overrides: Partial<MatrixGroupInfo> = {}): MatrixGroupInfo {
  return {
    roomId: '!room:example.org',
    name: 'Room',
    avatarUrl: null,
    topic: null,
    memberCount: 0,
    isEncrypted: false,
    isPublic: false,
    creator: null,
    avatar: '',
    groupName: 'Room',
    roleId: 0,
    account: '',
    myName: '',
    ...overrides
  }
}
