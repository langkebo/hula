import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixRoomMember } from '../types'

const globalStoreMock = { currentSessionRoomId: 'room-1' }

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

vi.mock('@/services/matrix/room/QueryFacade', () => ({
  matrixRoomQueryFacade: {
    getRoomMembers: vi.fn(),
    getRoom: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const { createGroupMembers } = await import('../members')

const member = (userId: string, extra: Partial<MatrixRoomMember> = {}): MatrixRoomMember =>
  ({
    userId,
    uid: userId,
    displayName: userId.split(':')[0],
    name: userId.split(':')[0],
    membership: 'join',
    powerLevel: 0,
    isModerator: false,
    isCreator: false,
    roleId: 2,
    ...extra
  }) as MatrixRoomMember

describe('createGroupMembers.addUserItem 去重（根因 B：localpart 与完整 MXID 同人合并）', () => {
  beforeEach(() => {
    globalStoreMock.currentSessionRoomId = 'room-1'
  })

  it('WS localpart 与 SDK 完整 MXID 加入同一房间时只保留一条，并合并资料', () => {
    const members = createGroupMembers({ groupInfoMap: {} })

    members.addUserItem(member('@test1:matrix.test'), 'room-1')
    members.addUserItem(member('test1', { displayName: 'test1-新', name: 'test1-新' }), 'room-1')

    const list = members.membersMap['room-1']
    expect(list).toHaveLength(1) // 去重：同人一条
    expect(list[0].displayName).toBe('test1-新') // 后加入的 WS 资料合并覆盖
  })

  it('不同成员各自保留，互不合并', () => {
    const members = createGroupMembers({ groupInfoMap: {} })

    members.addUserItem(member('@test1:matrix.test'), 'room-1')
    members.addUserItem(member('@test2:matrix.test'), 'room-1')
    members.addUserItem(member('@alice:other.test'), 'room-1')

    expect(members.membersMap['room-1']).toHaveLength(3)
  })

  it('不同房间互不影响', () => {
    const members = createGroupMembers({ groupInfoMap: {} })

    members.addUserItem(member('@test1:matrix.test'), 'room-a')
    members.addUserItem(member('test1'), 'room-b') // 同人不同房间，各自保留

    expect(members.membersMap['room-a']).toHaveLength(1)
    expect(members.membersMap['room-b']).toHaveLength(1)
  })
})
