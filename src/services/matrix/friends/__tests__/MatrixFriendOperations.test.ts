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

vi.mock('../../room/ActionFacade', () => ({
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
import { matrixRoomActionFacade } from '../../room/ActionFacade'
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

  it('FriendManager 为空时回退到 REST API', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(null)
    vi.mocked(synapseFriendExtensionService.sendFriendRequest).mockResolvedValue({ request_id: 1, status: 'pending' })

    await operations.sendFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.sendFriendRequest).toHaveBeenCalledWith('@alice:example.org', undefined)
  })

  it('manager 抛出 409/already exists 时视为正常业务，不抛错', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockRejectedValue(new Error('friend request already exists'))

    await expect(operations.sendFriendRequest('@alice:example.org')).resolves.toBeUndefined()
    expect(synapseFriendExtensionService.sendFriendRequest).not.toHaveBeenCalled()
  })

  it('manager 抛错时降级到 REST API 并成功返回', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockRejectedValue(new Error('boom'))
    vi.mocked(synapseFriendExtensionService.sendFriendRequest).mockResolvedValue({ request_id: 1, status: 'pending' })

    await operations.sendFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.sendFriendRequest).toHaveBeenCalledWith('@alice:example.org', undefined)
  })

  it('manager 抛端点不可用错误且 REST 也失败时回退到创建 DM 房间', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockRejectedValue(new Error('friend endpoint unavailable'))
    vi.mocked(synapseFriendExtensionService.sendFriendRequest).mockRejectedValue(new Error('rest boom'))
    vi.mocked(matrixRoomActionFacade.createDirectRoom).mockResolvedValue('!dm:example.org')

    await operations.sendFriendRequest('@alice:example.org')

    expect(matrixRoomActionFacade.createDirectRoom).toHaveBeenCalledWith('@alice:example.org')
  })

  it('全部路径失败时抛出原始错误', async () => {
    mockSync.ensureFriendManager.mockResolvedValue(mockManager)
    mockManager.sendFriendRequest.mockRejectedValue(new Error('boom'))
    vi.mocked(synapseFriendExtensionService.sendFriendRequest).mockRejectedValue(new Error('rest boom'))
    vi.mocked(matrixRoomActionFacade.createDirectRoom).mockRejectedValue(new Error('dm boom'))

    await expect(operations.sendFriendRequest('@alice:example.org')).rejects.toThrow('boom')
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

  it('manager 抛错时降级到 REST API', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.acceptFriendRequest.mockRejectedValue(new Error('boom'))
    vi.mocked(synapseFriendExtensionService.acceptFriendRequest).mockResolvedValue({ status: 'ok', room_id: '!r' })

    await operations.acceptFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.acceptFriendRequest).toHaveBeenCalledWith('@alice:example.org')
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

  it('manager 抛错时降级到 REST API declineFriendRequest', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.rejectFriendRequest.mockRejectedValue(new Error('boom'))
    vi.mocked(synapseFriendExtensionService.declineFriendRequest).mockResolvedValue(undefined)

    await operations.rejectFriendRequest('@alice:example.org')

    expect(synapseFriendExtensionService.declineFriendRequest).toHaveBeenCalledWith('@alice:example.org')
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

  it('manager 抛错时降级到 REST API removeFriend', async () => {
    mockSync.requireFriendManager.mockResolvedValue(mockManager)
    mockManager.removeFriend.mockRejectedValue(new Error('boom'))
    vi.mocked(synapseFriendExtensionService.removeFriend).mockResolvedValue(undefined)

    await operations.removeFriend('@alice:example.org')

    expect(synapseFriendExtensionService.removeFriend).toHaveBeenCalledWith('@alice:example.org')
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
