import type { MatrixClient, Room } from 'matrix-js-sdk'
import type { DirectMessageManager } from 'matrix-js-sdk/dm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixDirectMessageService } from '../MatrixDirectMessageService'

const mockDmManager = {
  createDm: vi.fn(),
  getDMRooms: vi.fn(async () => [] as Awaited<ReturnType<DirectMessageManager['getDMRooms']>>),
  getDmForUser: vi.fn(() => null),
  setDmRoom: vi.fn(),
  removeDmRoom: vi.fn(),
  getDmRoomInfo: vi.fn(() => null),
  getDirectRoomsByUser: vi.fn(async () => ({})),
  getDirectRoomsFromServer: vi.fn(),
  updateDirectRoom: vi.fn(),
  isDmRoomFromServer: vi.fn(),
  getDmPartnerFromServer: vi.fn()
}

const mockClient = {
  getDirectMessageManager: vi.fn(() => mockDmManager as unknown as DirectMessageManager),
  getRoom: vi.fn(() => null as Room | null)
}

describe('MatrixDirectMessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as unknown as MatrixClient)
    matrixDirectMessageService.stop()
  })

  afterEach(() => {
    matrixDirectMessageService.stop()
    vi.resetAllMocks()
  })

  it('should get direct rooms from server', async () => {
    mockDmManager.getDirectRoomsFromServer.mockResolvedValueOnce({
      '@alice:example.com': ['!dm:example.com']
    })

    const result = await matrixDirectMessageService.getDirectRoomsFromServer()

    expect(result).toEqual({
      '@alice:example.com': ['!dm:example.com']
    })
    expect(mockDmManager.getDirectRoomsFromServer).toHaveBeenCalledTimes(1)
  })

  it('should throw when querying dm rooms without manager by default', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

    await expect(matrixDirectMessageService.getDMRooms()).rejects.toThrow('DirectMessageManager 未初始化')
  })

  it('should return empty dm room list when manager is unavailable and throwOnError is false', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

    await expect(matrixDirectMessageService.getDMRooms(false)).resolves.toEqual([])
  })

  it('should throw when querying dm room by user without manager by default', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

    await expect(matrixDirectMessageService.getDmForUser('@alice:example.com')).rejects.toThrow(
      'DirectMessageManager 未初始化'
    )
  })

  it('should return null when querying dm room by user without manager and throwOnError is false', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

    await expect(matrixDirectMessageService.getDmForUser('@alice:example.com', false)).resolves.toBeNull()
  })

  it('should delegate isDmRoomFromServer with default throwOnError', async () => {
    mockDmManager.isDmRoomFromServer.mockResolvedValueOnce(true)

    const result = await matrixDirectMessageService.isDmRoomFromServer('!dm:example.com')

    expect(result).toBe(true)
    expect(mockDmManager.isDmRoomFromServer).toHaveBeenCalledWith('!dm:example.com', true)
  })

  it('should return false when manager is unavailable and throwOnError is false', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

    await expect(matrixDirectMessageService.isDmRoomFromServer('!dm:example.com', false)).resolves.toBe(false)
  })

  it('should get dm partner from server', async () => {
    mockDmManager.getDmPartnerFromServer.mockResolvedValueOnce({
      room_id: '!dm:example.com',
      user_id: '@alice:example.com',
      display_name: 'Alice',
      avatar_url: 'mxc://example.com/alice'
    })

    const result = await matrixDirectMessageService.getDmPartnerFromServer('!dm:example.com')

    expect(result).toEqual({
      room_id: '!dm:example.com',
      user_id: '@alice:example.com',
      display_name: 'Alice',
      avatar_url: 'mxc://example.com/alice'
    })
    expect(mockDmManager.getDmPartnerFromServer).toHaveBeenCalledWith('!dm:example.com', true)
  })

  it('should return null when partner lookup falls back without manager', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as unknown as MatrixClient)

    await expect(matrixDirectMessageService.getDmPartnerFromServer('!dm:example.com', false)).resolves.toBeNull()
  })

  it('should resolve cached room info by room id after initialization', async () => {
    mockDmManager.getDMRooms.mockResolvedValueOnce([
      {
        roomId: '!dm:example.com',
        invitees: ['@alice:example.com'],
        inviter: '@alice:example.com'
      }
    ] as unknown as Awaited<ReturnType<DirectMessageManager['getDMRooms']>>)

    await matrixDirectMessageService.initialize()

    expect(matrixDirectMessageService.getCachedDmRoomInfoByRoomId('!dm:example.com')).toEqual({
      roomId: '!dm:example.com',
      invitees: ['@alice:example.com'],
      inviter: '@alice:example.com'
    })
  })

  it('should refresh cached manager when matrix client changes', async () => {
    const oldDmManager = {
      ...mockDmManager,
      getDMRooms: vi.fn(() => [
        {
          roomId: '!old:example.com',
          invitees: ['@old:example.com']
        }
      ])
    }
    const newDmManager = {
      ...mockDmManager,
      getDMRooms: vi.fn(() => [
        {
          roomId: '!new:example.com',
          invitees: ['@new:example.com']
        }
      ])
    }
    const oldClient = {
      getDirectMessageManager: vi.fn(() => oldDmManager as unknown as DirectMessageManager),
      getRoom: vi.fn(() => null as Room | null)
    }
    const newClient = {
      getDirectMessageManager: vi.fn(() => newDmManager as unknown as DirectMessageManager),
      getRoom: vi.fn(() => null as Room | null)
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue(oldClient as unknown as MatrixClient)
    await matrixDirectMessageService.initialize()

    vi.mocked(matrixClientService.getClient).mockReturnValue(newClient as unknown as MatrixClient)
    const rooms = await matrixDirectMessageService.getDMRooms()

    expect(oldDmManager.getDMRooms).toHaveBeenCalledTimes(1)
    expect(newDmManager.getDMRooms).toHaveBeenCalledTimes(1)
    expect(rooms[0].roomId).toBe('!new:example.com')
  })
})
