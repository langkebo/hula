import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Friend } from '@/services/matrix/sdk'
import { MatrixFriendGroups } from '../MatrixFriendGroups'
import type { MatrixFriendSync } from '../MatrixFriendSync'

/**
 * MatrixFriendGroups 单元测试。
 * 依赖注入：构造注入 mock 的 MatrixFriendSync，其 requireFriendManager 返回 mock manager。
 */

const mockManager = {
  getFriendGroups: vi.fn(),
  createFriendGroup: vi.fn(),
  deleteFriendGroup: vi.fn(),
  renameFriendGroup: vi.fn(),
  addFriendToGroup: vi.fn(),
  removeFriendFromGroup: vi.fn(),
  getFriendsInGroup: vi.fn(),
  getFriendGroupsByUser: vi.fn()
}

const mockSync = {
  requireFriendManager: vi.fn(async () => mockManager)
} as unknown as MatrixFriendSync

let groups: MatrixFriendGroups

beforeEach(() => {
  vi.clearAllMocks()
  groups = new MatrixFriendGroups(mockSync)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('getFriendGroups', () => {
  it('将 SDK 分组映射为前端 FriendGroup（group_id / member_count / created_at）', async () => {
    mockManager.getFriendGroups.mockResolvedValue([
      { id: 'g1', name: '家人', members: ['@a:example.org', '@b:example.org'], created_at: 1700000000 },
      { id: 'g2', name: '同事', members: [], created_at: undefined }
    ])

    const result = await groups.getFriendGroups()

    expect(mockSync.requireFriendManager).toHaveBeenCalledTimes(1)
    expect(result).toEqual([
      { group_id: 'g1', name: '家人', member_count: 2, created_at: 1700000000 },
      { group_id: 'g2', name: '同事', member_count: 0, created_at: undefined }
    ])
  })

  it('manager 无 getFriendGroups 方法或返回 undefined 时返回空数组', async () => {
    mockManager.getFriendGroups.mockResolvedValue(undefined)

    const result = await groups.getFriendGroups()

    expect(result).toEqual([])
  })

  it('manager 抛错时抛出错误', async () => {
    const boom = new Error('group fetch failed')
    mockManager.getFriendGroups.mockRejectedValue(boom)

    await expect(groups.getFriendGroups()).rejects.toThrow('group fetch failed')
  })
})

describe('createFriendGroup', () => {
  it('返回值是 string 时构造 { group_id, name }', async () => {
    mockManager.createFriendGroup.mockResolvedValue('new-group-id')

    const result = await groups.createFriendGroup('我的分组')

    expect(result).toEqual({ group_id: 'new-group-id', name: '我的分组' })
  })

  it('返回值是对象且带 id 时映射为 group_id', async () => {
    mockManager.createFriendGroup.mockResolvedValue({ id: 'gx', name: '对象名', member_count: 3 })

    const result = await groups.createFriendGroup('入参名')

    expect(result).toEqual({ id: 'gx', name: '对象名', member_count: 3, group_id: 'gx' })
  })

  it('返回值是对象且带 group_id 时优先使用 group_id', async () => {
    mockManager.createFriendGroup.mockResolvedValue({ group_id: 'gy', name: '对象名' })

    const result = await groups.createFriendGroup('入参名')

    expect(result.group_id).toBe('gy')
    expect(result.name).toBe('对象名')
  })

  it('返回值是空对象时回退 group_id 为空、name 用入参', async () => {
    mockManager.createFriendGroup.mockResolvedValue({})

    const result = await groups.createFriendGroup('入参名')

    expect(result).toEqual({ group_id: '', name: '入参名' })
  })

  it('manager 抛错时抛出错误', async () => {
    mockManager.createFriendGroup.mockRejectedValue(new Error('create failed'))

    await expect(groups.createFriendGroup('x')).rejects.toThrow('create failed')
  })
})

describe('deleteFriendGroup', () => {
  it('调用 manager.deleteFriendGroup', async () => {
    mockManager.deleteFriendGroup.mockResolvedValue(undefined)

    await groups.deleteFriendGroup('g1')

    expect(mockManager.deleteFriendGroup).toHaveBeenCalledWith('g1')
  })

  it('manager 抛错时抛出错误', async () => {
    mockManager.deleteFriendGroup.mockRejectedValue(new Error('delete failed'))

    await expect(groups.deleteFriendGroup('g1')).rejects.toThrow('delete failed')
  })
})

describe('renameFriendGroup', () => {
  it('调用 manager.renameFriendGroup', async () => {
    mockManager.renameFriendGroup.mockResolvedValue(undefined)

    await groups.renameFriendGroup('g1', '新名字')

    expect(mockManager.renameFriendGroup).toHaveBeenCalledWith('g1', '新名字')
  })

  it('manager 抛错时抛出错误', async () => {
    mockManager.renameFriendGroup.mockRejectedValue(new Error('rename failed'))

    await expect(groups.renameFriendGroup('g1', 'x')).rejects.toThrow('rename failed')
  })
})

describe('addFriendToGroup', () => {
  it('调用 manager.addFriendToGroup', async () => {
    mockManager.addFriendToGroup.mockResolvedValue(undefined)

    await groups.addFriendToGroup('g1', '@user:example.org')

    expect(mockManager.addFriendToGroup).toHaveBeenCalledWith('g1', '@user:example.org')
  })

  it('manager 抛错时抛出错误', async () => {
    mockManager.addFriendToGroup.mockRejectedValue(new Error('add failed'))

    await expect(groups.addFriendToGroup('g1', '@user:example.org')).rejects.toThrow('add failed')
  })
})

describe('removeFriendFromGroup', () => {
  it('调用 manager.removeFriendFromGroup', async () => {
    mockManager.removeFriendFromGroup.mockResolvedValue(undefined)

    await groups.removeFriendFromGroup('g1', '@user:example.org')

    expect(mockManager.removeFriendFromGroup).toHaveBeenCalledWith('g1', '@user:example.org')
  })

  it('manager 抛错时抛出错误', async () => {
    mockManager.removeFriendFromGroup.mockRejectedValue(new Error('remove failed'))

    await expect(groups.removeFriendFromGroup('g1', '@user:example.org')).rejects.toThrow('remove failed')
  })
})

describe('getFriendsInGroup', () => {
  it('返回分组内好友列表', async () => {
    const friends: Friend[] = [{ user_id: '@a:example.org' }, { user_id: '@b:example.org' }]
    mockManager.getFriendsInGroup.mockResolvedValue(friends)

    const result = await groups.getFriendsInGroup('g1')

    expect(result).toEqual(friends)
  })

  it('返回 undefined 时回退为空数组', async () => {
    mockManager.getFriendsInGroup.mockResolvedValue(undefined)

    const result = await groups.getFriendsInGroup('g1')

    expect(result).toEqual([])
  })

  it('manager 抛错时抛出错误', async () => {
    mockManager.getFriendsInGroup.mockRejectedValue(new Error('get friends failed'))

    await expect(groups.getFriendsInGroup('g1')).rejects.toThrow('get friends failed')
  })
})

describe('getFriendGroupsByUser', () => {
  it('返回用户所属分组', async () => {
    const userGroups = [{ group_id: 'g1', name: '家人' }]
    mockManager.getFriendGroupsByUser.mockResolvedValue(userGroups)

    const result = await groups.getFriendGroupsByUser('@user:example.org')

    expect(result).toEqual(userGroups)
  })

  it('返回 undefined 时回退为空数组', async () => {
    mockManager.getFriendGroupsByUser.mockResolvedValue(undefined)

    const result = await groups.getFriendGroupsByUser('@user:example.org')

    expect(result).toEqual([])
  })

  it('manager 抛错时抛出错误', async () => {
    mockManager.getFriendGroupsByUser.mockRejectedValue(new Error('get groups by user failed'))

    await expect(groups.getFriendGroupsByUser('@user:example.org')).rejects.toThrow('get groups by user failed')
  })
})
