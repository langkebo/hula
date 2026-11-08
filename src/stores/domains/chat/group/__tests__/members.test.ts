import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixGroupInfo, MatrixRoomMember } from '../types'

const globalStoreMock = { currentSessionRoomId: 'room-1' }

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
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

const groupInfo = (roomId: string): MatrixGroupInfo => ({
  roomId,
  name: roomId,
  avatarUrl: null,
  topic: null,
  memberCount: 1,
  isEncrypted: false,
  isPublic: false,
  creator: null,
  avatar: '',
  groupName: roomId,
  roleId: 2,
  account: '',
  myName: ''
})

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

describe('createGroupMembers.updateUserPresence 精确写入', () => {
  beforeEach(() => {
    globalStoreMock.currentSessionRoomId = 'room-1'
  })

  it('只替换包含该用户的房间数组，其余房间保持引用不变', () => {
    const members = createGroupMembers({ groupInfoMap: {} })
    members.addUserItem(member('@alice:matrix.test'), 'room-a')
    members.addUserItem(member('@bob:matrix.test'), 'room-b')

    const roomABefore = members.membersMap['room-a']
    const roomBBefore = members.membersMap['room-b']

    const updated = members.updateUserPresence('@alice:matrix.test', { activeStatus: 1, lastOptTime: 100 })

    expect(updated).toBe(true)
    expect(members.membersMap['room-a']).not.toBe(roomABefore)
    expect(members.membersMap['room-a'][0].activeStatus).toBe(1)
    // 未命中的房间不复制、不触发依赖方重算
    expect(members.membersMap['room-b']).toBe(roomBBefore)
  })

  it('用户不在任何房间时不产生写入并返回 false', () => {
    const members = createGroupMembers({ groupInfoMap: {} })
    members.addUserItem(member('@alice:matrix.test'), 'room-a')
    const before = members.membersMap['room-a']

    const updated = members.updateUserPresence('@nobody:matrix.test', { activeStatus: 1, lastOptTime: 100 })

    expect(updated).toBe(false)
    expect(members.membersMap['room-a']).toBe(before)
  })

  it('同一房间内的重复记录全部更新', () => {
    const members = createGroupMembers({ groupInfoMap: {} })
    members.updateMemberCache('room-a', [
      member('@alice:matrix.test'),
      member('@alice:matrix.test', { displayName: 'alice-dup' })
    ])

    members.updateUserPresence('@alice:matrix.test', { activeStatus: 1, lastOptTime: 100 })

    const list = members.membersMap['room-a']
    expect(list).toHaveLength(2)
    expect(list.every((m) => m.activeStatus === 1)).toBe(true)
  })

  it('命中房间时同步触碰群信息，未命中房间不触碰', () => {
    const groupInfoMap: Record<string, MatrixGroupInfo> = {
      'room-a': groupInfo('room-a'),
      'room-b': groupInfo('room-b')
    }
    const members = createGroupMembers({ groupInfoMap })
    members.addUserItem(member('@alice:matrix.test'), 'room-a')
    members.addUserItem(member('@bob:matrix.test'), 'room-b')
    const roomAInfoBefore = groupInfoMap['room-a']
    const roomBInfoBefore = groupInfoMap['room-b']

    members.updateUserPresence('@alice:matrix.test', { activeStatus: 1, lastOptTime: 100 })

    // 命中房间替换群信息引用以触发依赖方更新，未命中房间保持原引用
    expect(groupInfoMap['room-a']).not.toBe(roomAInfoBefore)
    expect(groupInfoMap['room-b']).toBe(roomBInfoBefore)
  })
})

describe('createGroupMembers.allUserInfo localpart 归一化去重', () => {
  beforeEach(() => {
    globalStoreMock.currentSessionRoomId = 'room-1'
  })

  it('跨房间的 localpart 和完整 MXID 同人只保留一条', () => {
    const members = createGroupMembers({ groupInfoMap: {} })

    // room-a 用完整 MXID
    members.addUserItem(member('@test1:matrix.test'), 'room-a')
    // room-b 用 localpart
    members.addUserItem(member('test1'), 'room-b')

    const all = members.allUserInfo.value
    // 同一个人跨两个房间，allUserInfo 应只返回一条
    const test1Entries = all.filter((m) => m.displayName?.includes('test1'))
    expect(test1Entries).toHaveLength(1)
  })

  it('不同成员跨房间各自保留', () => {
    const members = createGroupMembers({ groupInfoMap: {} })

    members.addUserItem(member('@test1:matrix.test'), 'room-a')
    members.addUserItem(member('@alice:matrix.test'), 'room-b')

    const all = members.allUserInfo.value
    expect(all).toHaveLength(2)
  })

  it('同房间内 localpart + MXID 混合只保留一条', () => {
    const members = createGroupMembers({ groupInfoMap: {} })

    members.addUserItem(member('@test1:matrix.test'), 'room-1')
    members.addUserItem(member('test1', { displayName: 'test1-merged' }), 'room-1')

    // membersMap 内部已有 addUserItem 去重
    expect(members.membersMap['room-1']).toHaveLength(1)
    // allUserInfo 也应只返回一条
    expect(members.allUserInfo.value).toHaveLength(1)
  })
})
