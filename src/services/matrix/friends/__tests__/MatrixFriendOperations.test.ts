import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FriendStatus } from '../friendUtils'
import { MatrixFriendOperations } from '../MatrixFriendOperations'
import type { MatrixFriendSync } from '../MatrixFriendSync'

// 依赖 mock：MatrixFriendOperations 运行时会使用这些单例
vi.mock('../../extensions/SynapseFriendExtensionService', () => ({
  synapseFriendExtensionService: {
    sendFriendRequest: vi.fn(),
    acceptFriendRequest: vi.fn(),
    cancelFriendRequest: vi.fn(),
    declineFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
    setFriendNote: vi.fn()
  }
}))

vi.mock('../../room/RoomFacade', () => ({
  matrixRoomActionFacade: {
    createDirectRoom: vi.fn()
  }
}))

vi.mock('../MatrixSpecialFriendService', () => ({
  matrixSpecialFriendService: {
    addSpecialFriend: vi.fn(),
    removeSpecialFriend: vi.fn()
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => `translated:${key}` })
}))

import { synapseFriendExtensionService } from '../../extensions/SynapseFriendExtensionService'
import { matrixRoomActionFacade } from '../../room/RoomFacade'
import { matrixSpecialFriendService } from '../MatrixSpecialFriendService'

const mockManager = {
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  setFriendDisplayName: vi.fn(),
  updateFriendNote: vi.fn(),
  setFriendNote: vi.fn(),
  setFriendStatus: vi.fn()
}

const mockSync = {
  ensureFriendManager: vi.fn(),
  requireFriendManager: vi.fn()
} as unknown as MatrixFriendSync & {
  ensureFriendManager: ReturnType<typeof vi.fn>
  requireFriendManager: ReturnType<typeof vi.fn>
}

let operations: MatrixFriendOperations

beforeEach(() => {
  vi.clearAllMocks()
  operations = new MatrixFriendOperations(mockSync)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('sendFriendRequest', () => {
  it('FriendManager 可用时调用 manager.sendFriendRequest', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockResolvedValue(undefined)

    await operations.sendFriendRequest('@alice:example.org', 'hi')

    expect(mockSync.ensureFriendManager).toHaveBeenCalledWith(false)
    expect(mockManager.sendFriendRequest).toHaveBeenCalledWith('@alice:example.org', 'hi')
    expect(synapseFriendExtensionService.sendFriendRequest).not.toHaveBeenCalled()
  })

  it('FriendManager 为空时回退到 REST API，并携带确定性幂等键', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(null)
    vi.mocked(synapseFriendExtensionService.sendFriendRequest).mockResolvedValue({ request_id: 1, status: 'pending' })

    await operations.sendFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.sendFriendRequest).toHaveBeenCalledWith('@alice:example.org', undefined, {
      idempotencyKey: 'friend-request:@alice:example.org'
    })
  })

  // 审计 §8 B-4 用例 1：业务错误（409）不降级、视为成功
  it('SDK 抛 409 业务冲突时不调用 REST 通道，且视为成功', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    const conflict = Object.assign(new Error('friend request already exists'), {
      httpStatus: 409,
      errcode: 'M_USER_IN_USE'
    })
    mockManager.sendFriendRequest.mockRejectedValue(conflict)

    await expect(operations.sendFriendRequest('@alice:example.org')).resolves.toBeUndefined()
    expect(synapseFriendExtensionService.sendFriendRequest).not.toHaveBeenCalled()
    expect(matrixRoomActionFacade.createDirectRoom).not.toHaveBeenCalled()
  })

  it('旧式字符串错误（无结构化字段）中的 already exists 仍视为业务成功', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockRejectedValue(new Error('friend request already exists'))

    await expect(operations.sendFriendRequest('@alice:example.org')).resolves.toBeUndefined()
    expect(synapseFriendExtensionService.sendFriendRequest).not.toHaveBeenCalled()
  })

  // 审计 §8 B-4 用例 2：连接类错误可降级，且降级调用必须携带幂等键
  it('SDK 抛连接类错误时降级到 REST API，且降级调用携带幂等键', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockRejectedValue(new TypeError('fetch failed'))
    vi.mocked(synapseFriendExtensionService.sendFriendRequest).mockResolvedValue({ request_id: 1, status: 'pending' })

    await operations.sendFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.sendFriendRequest).toHaveBeenCalledWith('@alice:example.org', undefined, {
      idempotencyKey: 'friend-request:@alice:example.org'
    })
  })

  // 审计 §8 B-4 变异自证：去掉幂等键 ⇒ 本用例的「重复提交」断言必须失败
  it('重复提交共享同一幂等键，使服务端可识别为同一逻辑操作', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockRejectedValue(new TypeError('fetch failed'))
    vi.mocked(synapseFriendExtensionService.sendFriendRequest).mockResolvedValue({ request_id: 1, status: 'pending' })

    await operations.sendFriendRequest('@alice:example.org')
    await operations.sendFriendRequest('@alice:example.org')

    const calls = vi.mocked(synapseFriendExtensionService.sendFriendRequest).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0][2]?.idempotencyKey).toBe('friend-request:@alice:example.org')
    expect(calls[1][2]?.idempotencyKey).toBe(calls[0][2]?.idempotencyKey)
  })

  it('好友端点不可用时回退到创建 DM 房间', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockRejectedValue(new Error('friend endpoint unavailable'))
    vi.mocked(matrixRoomActionFacade.createDirectRoom).mockResolvedValue('!dm:example.org')

    await operations.sendFriendRequest('@alice:example.org')

    expect(matrixRoomActionFacade.createDirectRoom).toHaveBeenCalledWith('@alice:example.org')
    expect(synapseFriendExtensionService.sendFriendRequest).not.toHaveBeenCalled()
  })

  it('连接类错误降级 REST 仍失败且不适用 DM 兜底时抛出原始错误', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockRejectedValue(new TypeError('fetch failed'))
    vi.mocked(synapseFriendExtensionService.sendFriendRequest).mockRejectedValue(new Error('rest boom'))

    await expect(operations.sendFriendRequest('@alice:example.org')).rejects.toThrow('fetch failed')
    expect(matrixRoomActionFacade.createDirectRoom).not.toHaveBeenCalled()
  })
})

describe('acceptFriendRequest', () => {
  it('FriendManager 可用时调用 manager.acceptFriendRequest', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.acceptFriendRequest.mockResolvedValue(undefined)

    await operations.acceptFriendRequest('@alice:example.org')

    expect(mockManager.acceptFriendRequest).toHaveBeenCalledWith('@alice:example.org')
    expect(synapseFriendExtensionService.acceptFriendRequest).not.toHaveBeenCalled()
  })

  it('manager 未初始化时降级到 REST API', async () => {
    mockSync.requireFriendManager.mockRejectedValue(new Error('朋友管理器未初始化 (not initialized)'))
    vi.mocked(synapseFriendExtensionService.acceptFriendRequest).mockResolvedValue({ status: 'ok', room_id: '!r' })

    await operations.acceptFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.acceptFriendRequest).toHaveBeenCalledWith('@alice:example.org')
  })

  it('manager 抛服务端错误时不降级，直接抛出', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.acceptFriendRequest.mockRejectedValue(new Error('An internal error occurred'))

    await expect(operations.acceptFriendRequest('@alice:example.org')).rejects.toThrow('An internal error occurred')
    expect(synapseFriendExtensionService.acceptFriendRequest).not.toHaveBeenCalled()
  })
})

describe('cancelFriendRequest', () => {
  it('FriendManager 可用时调用 manager.cancelFriendRequest 并返回', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.cancelFriendRequest.mockResolvedValue(undefined)

    await operations.cancelFriendRequest('@alice:example.org')

    expect(mockManager.cancelFriendRequest).toHaveBeenCalledWith('@alice:example.org')
    expect(synapseFriendExtensionService.cancelFriendRequest).not.toHaveBeenCalled()
  })

  it('FriendManager 为空时回退到 REST API', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(null)
    vi.mocked(synapseFriendExtensionService.cancelFriendRequest).mockResolvedValue(undefined)

    await operations.cancelFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.cancelFriendRequest).toHaveBeenCalledWith('@alice:example.org')
  })

  it('manager 抛错时回退到 REST API', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.cancelFriendRequest.mockRejectedValue(new Error('boom'))
    vi.mocked(synapseFriendExtensionService.cancelFriendRequest).mockResolvedValue(undefined)

    await operations.cancelFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.cancelFriendRequest).toHaveBeenCalledWith('@alice:example.org')
  })

  it('REST API 也失败时抛出错误', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(null)
    vi.mocked(synapseFriendExtensionService.cancelFriendRequest).mockRejectedValue(new Error('rest boom'))

    await expect(operations.cancelFriendRequest('@alice:example.org')).rejects.toThrow('rest boom')
  })
})

describe('rejectFriendRequest', () => {
  it('FriendManager 可用时调用 manager.rejectFriendRequest', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.rejectFriendRequest.mockResolvedValue(undefined)

    await operations.rejectFriendRequest('@alice:example.org')

    expect(mockManager.rejectFriendRequest).toHaveBeenCalledWith('@alice:example.org')
    expect(synapseFriendExtensionService.declineFriendRequest).not.toHaveBeenCalled()
  })

  it('manager 未初始化时降级到 REST API declineFriendRequest', async () => {
    mockSync.requireFriendManager.mockRejectedValue(new Error('朋友管理器未初始化 (not initialized)'))
    vi.mocked(synapseFriendExtensionService.declineFriendRequest).mockResolvedValue(undefined)

    await operations.rejectFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.declineFriendRequest).toHaveBeenCalledWith('@alice:example.org')
  })

  it('manager 抛服务端错误时不降级，直接抛出', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.rejectFriendRequest.mockRejectedValue(new Error('An internal error occurred'))

    await expect(operations.rejectFriendRequest('@alice:example.org')).rejects.toThrow('An internal error occurred')
    expect(synapseFriendExtensionService.declineFriendRequest).not.toHaveBeenCalled()
  })
})

describe('removeFriend', () => {
  it('FriendManager 可用时调用 manager.removeFriend', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.removeFriend.mockResolvedValue(undefined)

    await operations.removeFriend('@alice:example.org')

    expect(mockManager.removeFriend).toHaveBeenCalledWith('@alice:example.org')
    expect(synapseFriendExtensionService.removeFriend).not.toHaveBeenCalled()
  })

  it('manager 未初始化时降级到 REST API removeFriend', async () => {
    mockSync.requireFriendManager.mockRejectedValue(new Error('朋友管理器未初始化 (not initialized)'))
    vi.mocked(synapseFriendExtensionService.removeFriend).mockResolvedValue(undefined)

    await operations.removeFriend('@alice:example.org')

    expect(synapseFriendExtensionService.removeFriend).toHaveBeenCalledWith('@alice:example.org')
  })

  it('manager 抛服务端错误时不降级，直接抛出', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.removeFriend.mockRejectedValue(new Error('An internal error occurred'))

    await expect(operations.removeFriend('@alice:example.org')).rejects.toThrow('An internal error occurred')
    expect(synapseFriendExtensionService.removeFriend).not.toHaveBeenCalled()
  })
})

describe('setFriendDisplayName', () => {
  it('调用 manager.setFriendDisplayName', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.setFriendDisplayName.mockResolvedValue(undefined)

    await operations.setFriendDisplayName('@alice:example.org', '备注名')

    expect(mockManager.setFriendDisplayName).toHaveBeenCalledWith('@alice:example.org', '备注名')
  })

  it('manager 抛错时抛出错误', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.setFriendDisplayName.mockRejectedValue(new Error('boom'))

    await expect(operations.setFriendDisplayName('@alice:example.org', 'x')).rejects.toThrow('boom')
  })
})

describe('setFriendNote', () => {
  it('优先使用 manager.updateFriendNote', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.updateFriendNote.mockResolvedValue(undefined)

    await operations.setFriendNote('@alice:example.org', 'note')

    expect(mockManager.updateFriendNote).toHaveBeenCalledWith('@alice:example.org', 'note')
    expect(mockManager.setFriendNote).not.toHaveBeenCalled()
  })

  it('无 updateFriendNote 时使用 manager.setFriendNote', async () => {
    const managerWithoutUpdate = { ...mockManager, updateFriendNote: undefined }
    mockSync.requireFriendManager.mockResolvedValue(managerWithoutUpdate)
    mockManager.setFriendNote.mockResolvedValue(undefined)

    await operations.setFriendNote('@alice:example.org', 'note')

    expect(mockManager.setFriendNote).toHaveBeenCalledWith('@alice:example.org', 'note')
  })

  it('两者都不可用且抛错时降级到 REST API setFriendNote', async () => {
    const managerWithoutMethods = { ...mockManager, updateFriendNote: undefined, setFriendNote: undefined }
    mockSync.requireFriendManager.mockResolvedValue(managerWithoutMethods)
    vi.mocked(synapseFriendExtensionService.setFriendNote).mockResolvedValue(undefined)

    await operations.setFriendNote('@alice:example.org', 'note')

    expect(synapseFriendExtensionService.setFriendNote).toHaveBeenCalledWith('@alice:example.org', 'note')
  })
})

describe('setFriendStatus', () => {
  it('favorite 状态委托给 matrixSpecialFriendService.addSpecialFriend', async () => {
    vi.mocked(matrixSpecialFriendService.addSpecialFriend).mockResolvedValue(undefined)

    await operations.setFriendStatus('@alice:example.org', 'favorite')

    expect(matrixSpecialFriendService.addSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
    expect(mockManager.setFriendStatus).not.toHaveBeenCalled()
  })

  it('accepted 状态仅移除特别关注并本地处理，不调用后端', async () => {
    vi.mocked(matrixSpecialFriendService.removeSpecialFriend).mockResolvedValue(undefined)

    await operations.setFriendStatus('@alice:example.org', 'accepted')

    expect(matrixSpecialFriendService.removeSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
    expect(mockManager.setFriendStatus).not.toHaveBeenCalled()
  })

  it('normal 状态仅移除特别关注并本地处理', async () => {
    vi.mocked(matrixSpecialFriendService.removeSpecialFriend).mockResolvedValue(undefined)

    await operations.setFriendStatus('@alice:example.org', 'normal')

    expect(matrixSpecialFriendService.removeSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
    expect(mockManager.setFriendStatus).not.toHaveBeenCalled()
  })

  it('blocked 状态移除特别关注后调用 manager.setFriendStatus', async () => {
    vi.mocked(matrixSpecialFriendService.removeSpecialFriend).mockResolvedValue(undefined)
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.setFriendStatus.mockResolvedValue(undefined)

    await operations.setFriendStatus('@alice:example.org', 'blocked')

    expect(matrixSpecialFriendService.removeSpecialFriend).toHaveBeenCalledWith('@alice:example.org')
    expect(mockManager.setFriendStatus).toHaveBeenCalledWith('@alice:example.org', 'blocked')
  })

  it('manager 无 setFriendStatus 方法时抛出错误', async () => {
    vi.mocked(matrixSpecialFriendService.removeSpecialFriend).mockResolvedValue(undefined)
    mockSync.requireFriendManager.mockResolvedValue({ ...mockManager, setFriendStatus: undefined })

    await expect(operations.setFriendStatus('@alice:example.org', 'blocked' as FriendStatus)).rejects.toThrow(
      'translated:matrix_error.friends.status_update_unsupported'
    )
  })
})
