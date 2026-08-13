import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixClientRoom } from '@/services/matrix/MatrixClientRoom'

// ---- 依赖 mock（白盒：不依赖真实 SDK / 网络）-----------------------------------

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

// ---- 测试工具 ----------------------------------------------------------------

/** 白盒测试用的简化 Room，仅要求 roomId，其余字段开放 */
type MockRoom = { roomId: string } & Record<string, unknown>

function makeClient() {
  return {
    getRooms: vi.fn<() => MockRoom[]>(() => []),
    getRoom: vi.fn<(roomId: string) => MockRoom | null>(() => null),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    leave: vi.fn(),
    getUserId: vi.fn<() => string | null>(() => '@alice:hs')
  }
}

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    roomId: '!r:hs',
    getMyMembership: vi.fn(() => 'join'),
    getMember: vi.fn(() => undefined),
    currentState: { getMember: vi.fn(() => undefined) },
    ...overrides
  }
}

function makeRoomService() {
  const client = makeClient()
  const connectionManager = { getClient: vi.fn(() => client) }
  const service = new MatrixClientRoom({ connectionManager } as never)
  return { service, client, connectionManager }
}

describe('MatrixClientRoom', () => {
  let service: MatrixClientRoom
  let client: ReturnType<typeof makeClient>
  let connectionManager: { getClient: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    const made = makeRoomService()
    service = made.service
    client = made.client
    connectionManager = made.connectionManager
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getRooms / getRoom', () => {
    it('getRooms 返回 client.store 中的房间列表', () => {
      const rooms = [{ roomId: '!a:hs' }, { roomId: '!b:hs' }]
      client.getRooms.mockReturnValue(rooms)
      expect(service.getRooms()).toBe(rooms)
    })

    it('getRooms 无 client 时返回空数组', () => {
      connectionManager.getClient.mockReturnValue(null)
      expect(service.getRooms()).toEqual([])
    })

    it('getRoom 返回指定房间', () => {
      const room = { roomId: '!a:hs' }
      client.getRoom.mockReturnValue(room)
      expect(service.getRoom('!a:hs')).toBe(room)
      expect(client.getRoom).toHaveBeenCalledWith('!a:hs')
    })

    it('getRoom 无 client 时返回 null', () => {
      connectionManager.getClient.mockReturnValue(null)
      expect(service.getRoom('!a:hs')).toBeNull()
    })
  })

  describe('createRoom', () => {
    it('无 client 时抛出未初始化错误', async () => {
      connectionManager.getClient.mockReturnValue(null)
      await expect(service.createRoom({} as never)).rejects.toThrow('matrix_error.common.client_not_initialized')
    })

    it('创建成功并等待房间进入 store 后返回', async () => {
      const room = makeRoom()
      client.createRoom.mockResolvedValue({ room_id: '!r:hs' })
      client.getRoom.mockReturnValue(room)

      const result = await service.createRoom({ name: 'Room' })

      expect(client.createRoom).toHaveBeenCalledWith({ name: 'Room' })
      expect(result).toBe(room)
    })

    it('创建成功但超时未进入 store 时抛出失败错误', async () => {
      vi.useFakeTimers()
      client.createRoom.mockResolvedValue({ room_id: '!r:hs' })
      client.getRoom.mockReturnValue(null)

      const promise = service.createRoom({ name: 'Room' })
      promise.catch(() => {})
      await vi.advanceTimersByTimeAsync(5000)

      await expect(promise).rejects.toThrow('matrix_error.client.room_instance_failed_after_create')
    })

    it('createRoom 抛出错误时向上抛出', async () => {
      client.createRoom.mockRejectedValue(new Error('room creation failed'))
      await expect(service.createRoom({} as never)).rejects.toThrow('room creation failed')
    })
  })

  describe('joinRoom', () => {
    it('无 client 时抛出未初始化错误', async () => {
      connectionManager.getClient.mockReturnValue(null)
      await expect(service.joinRoom('!r:hs')).rejects.toThrow('matrix_error.common.client_not_initialized')
    })

    it('加入成功并返回房间', async () => {
      const room = makeRoom()
      client.joinRoom.mockResolvedValue(undefined)
      client.getRoom.mockReturnValue(room)

      const result = await service.joinRoom('!r:hs')

      expect(client.joinRoom).toHaveBeenCalledWith('!r:hs')
      expect(result).toBe(room)
    })

    it('joinRoom 抛出错误时向上抛出', async () => {
      client.joinRoom.mockRejectedValue(new Error('join failed'))
      await expect(service.joinRoom('!r:hs')).rejects.toThrow('join failed')
    })
  })

  describe('leaveRoom', () => {
    it('无 client 时抛出未初始化错误', async () => {
      connectionManager.getClient.mockReturnValue(null)
      await expect(service.leaveRoom('!r:hs')).rejects.toThrow('matrix_error.common.client_not_initialized')
    })

    it('离开成功', async () => {
      client.leave.mockResolvedValue(undefined)
      await expect(service.leaveRoom('!r:hs')).resolves.toBeUndefined()
      expect(client.leave).toHaveBeenCalledWith('!r:hs')
    })

    it('leave 抛出错误时向上抛出', async () => {
      client.leave.mockRejectedValue(new Error('leave failed'))
      await expect(service.leaveRoom('!r:hs')).rejects.toThrow('leave failed')
    })
  })

  describe('canManageSpace', () => {
    it('无 client 时返回 false', () => {
      connectionManager.getClient.mockReturnValue(null)
      expect(service.canManageSpace('!space:hs')).toBe(false)
    })

    it('spaceId 为空时返回 false', () => {
      expect(service.canManageSpace('')).toBe(false)
    })

    it('无 userId 时返回 false', () => {
      client.getUserId.mockReturnValue(null)
      expect(service.canManageSpace('!space:hs')).toBe(false)
    })

    it('不在房间内时返回 false', () => {
      const room = makeRoom({ getMyMembership: vi.fn(() => 'leave') })
      client.getRoom.mockReturnValue(room)
      expect(service.canManageSpace('!space:hs')).toBe(false)
    })

    it('member powerLevel 达到 moderator 阈值时返回 true', () => {
      const room = makeRoom({ getMember: vi.fn(() => ({ powerLevel: 50 })) })
      client.getRoom.mockReturnValue(room)
      expect(service.canManageSpace('!space:hs')).toBe(true)
    })

    it('member powerLevel 低于阈值时返回 false', () => {
      const room = makeRoom({ getMember: vi.fn(() => ({ powerLevel: 49 })) })
      client.getRoom.mockReturnValue(room)
      expect(service.canManageSpace('!space:hs')).toBe(false)
    })

    it('member 无 powerLevel 时通过 getPowerLevel() 回退判定', () => {
      const room = makeRoom({
        getMember: vi.fn(() => ({ getPowerLevel: () => 60 }))
      })
      client.getRoom.mockReturnValue(room)
      expect(service.canManageSpace('!space:hs')).toBe(true)
    })

    it('member 为 undefined 时返回 false', () => {
      const room = makeRoom({ getMember: vi.fn(() => undefined) })
      client.getRoom.mockReturnValue(room)
      expect(service.canManageSpace('!space:hs')).toBe(false)
    })
  })
})
