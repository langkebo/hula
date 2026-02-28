import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { matrixRoomService } from '../MatrixRoomService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null),
    isLoggedIn: vi.fn(() => false),
    createRoom: vi.fn(() => {
      throw new Error('客户端未初始化')
    }),
    joinRoom: vi.fn(() => {
      throw new Error('客户端未初始化')
    }),
    leaveRoom: vi.fn(() => {
      throw new Error('客户端未初始化')
    })
  }
}))

describe('MatrixRoomService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getRooms', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.getRooms()).rejects.toThrow('客户端未初始化')
    })
  })

  describe('getRoom', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.getRoom('!room:id')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('createRoom', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.createRoom({})).rejects.toThrow('客户端未初始化')
    })
  })

  describe('joinRoom', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.joinRoom('!room:id')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('leaveRoom', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.leaveRoom('!room:id')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('inviteUser', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.inviteUser('!room:id', '@user:matrix.org')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('kickUser', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.kickUser('!room:id', '@user:matrix.org')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('banUser', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.banUser('!room:id', '@user:matrix.org')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('unbanUser', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.unbanUser('!room:id', '@user:matrix.org')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('setRoomName', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.setRoomName('!room:id', 'New Room Name')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('setRoomTopic', () => {
    it('should throw error when client is not initialized', async () => {
      await expect(matrixRoomService.setRoomTopic('!room:id', 'New Topic')).rejects.toThrow('客户端未初始化')
    })
  })
})
