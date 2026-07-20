import type { MatrixClient, Room } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixTypingService } from '../MatrixTypingService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const mockTypingManager = {
  startTyping: vi.fn(),
  stopTyping: vi.fn(),
  clearAllTimers: vi.fn()
}

const mockRoom = {
  currentState: {
    getStateEvents: vi.fn(() => ({
      getContent: vi.fn(() => ({ user_ids: ['@user1:matrix.org', '@user2:matrix.org'] }))
    }))
  },
  getMember: vi.fn((userId: string) => ({
    name: userId.split(':')[0].replace('@', ''),
    getMxcAvatarUrl: vi.fn(() => `mxc://matrix.org/avatar/${userId}`)
  }))
}

const mockClient = {
  getTypingManager: vi.fn(() => mockTypingManager),
  getRoom: vi.fn(),
  getUserId: vi.fn(() => '@me:matrix.org')
}

describe('MatrixTypingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    vi.useFakeTimers()
    matrixTypingService.cleanup()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    matrixTypingService.cleanup()
  })

  describe('sendTypingNotification', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      await expect(matrixTypingService.sendTypingNotification('!room:id', true)).rejects.toThrow('客户端未初始化')
    })

    it('should send typing notification successfully', async () => {
      mockTypingManager.startTyping.mockResolvedValueOnce(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      await matrixTypingService.sendTypingNotification('!room:id', true, 30000)

      expect(mockTypingManager.startTyping).toHaveBeenCalledWith('!room:id', { timeout: 30000 })
    })

    it('should send stop typing notification', async () => {
      mockTypingManager.stopTyping.mockResolvedValueOnce(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      await matrixTypingService.sendTypingNotification('!room:id', false)

      expect(mockTypingManager.stopTyping).toHaveBeenCalledWith('!room:id')
    })
  })

  describe('startTyping', () => {
    it('should send typing notification and set timeout', async () => {
      mockTypingManager.startTyping.mockResolvedValueOnce(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      matrixTypingService.startTyping('!room:id', 30000)
      await Promise.resolve()

      expect(mockTypingManager.startTyping).toHaveBeenCalledWith('!room:id', { timeout: 30000 })
    })

    it('should clear existing timeout before setting new one', async () => {
      mockTypingManager.startTyping.mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      matrixTypingService.startTyping('!room:id', 30000)
      matrixTypingService.startTyping('!room:id', 30000)
      await Promise.resolve()

      expect(mockTypingManager.startTyping).toHaveBeenCalledTimes(2)
    })
  })

  describe('stopTyping', () => {
    it('should send stop typing notification', async () => {
      mockTypingManager.stopTyping.mockResolvedValueOnce(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      matrixTypingService.stopTyping('!room:id')
      await Promise.resolve()

      expect(mockTypingManager.stopTyping).toHaveBeenCalledWith('!room:id')
    })

    it('should clear timeout', async () => {
      mockTypingManager.startTyping.mockResolvedValue(undefined)
      mockTypingManager.stopTyping.mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      matrixTypingService.startTyping('!room:id', 30000)
      matrixTypingService.stopTyping('!room:id')
      await Promise.resolve()

      expect(mockTypingManager.startTyping).toHaveBeenCalledTimes(1)
      expect(mockTypingManager.stopTyping).toHaveBeenCalledTimes(1)
    })

    it('should handle error silently when client is not initialized', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      expect(() => matrixTypingService.stopTyping('!room:id')).not.toThrow()
    })
  })

  describe('getTypingUsers', () => {
    it('should return empty array when client is not initialized', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const users = matrixTypingService.getTypingUsers('!room:id')
      expect(users).toEqual([])
    })

    it('should return empty array when room is not found', () => {
      mockClient.getRoom.mockReturnValueOnce(null)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      const users = matrixTypingService.getTypingUsers('!room:id')
      expect(users).toEqual([])
    })

    it('should return typing users excluding self', () => {
      mockClient.getRoom.mockReturnValueOnce(mockRoom as unknown as Room)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      const users = matrixTypingService.getTypingUsers('!room:id')

      expect(users).toHaveLength(2)
      expect(users[0].userId).toBe('@user1:matrix.org')
      expect(users[1].userId).toBe('@user2:matrix.org')
    })
  })

  describe('getTypingUsersText', () => {
    beforeEach(() => {
      mockClient.getRoom.mockReturnValue(mockRoom as unknown as Room)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    })

    it('should return empty string when no users are typing', () => {
      mockRoom.currentState.getStateEvents.mockReturnValueOnce({
        getContent: vi.fn(() => ({ user_ids: [] }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id')
      expect(text).toBe('')
    })

    it('should return text for single typing user', () => {
      mockRoom.currentState.getStateEvents.mockReturnValueOnce({
        getContent: vi.fn(() => ({ user_ids: ['@user1:matrix.org'] }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id')
      expect(text).toBe('user1 正在输入...')
    })

    it('should return text for two typing users', () => {
      mockRoom.currentState.getStateEvents.mockReturnValueOnce({
        getContent: vi.fn(() => ({ user_ids: ['@user1:matrix.org', '@user2:matrix.org'] }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id')
      expect(text).toBe('user1 和 user2 正在输入...')
    })

    it('should return text for three typing users', () => {
      mockRoom.currentState.getStateEvents.mockReturnValueOnce({
        getContent: vi.fn(() => ({ user_ids: ['@user1:matrix.org', '@user2:matrix.org', '@user3:matrix.org'] }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id')
      expect(text).toBe('user1、user2 和 user3 正在输入...')
    })

    it('should return text for many typing users with max display', () => {
      mockRoom.currentState.getStateEvents.mockReturnValueOnce({
        getContent: vi.fn(() => ({
          user_ids: [
            '@user1:matrix.org',
            '@user2:matrix.org',
            '@user3:matrix.org',
            '@user4:matrix.org',
            '@user5:matrix.org'
          ]
        }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id', 3)
      expect(text).toBe('user1、user2、user3 和其他 2 人正在输入...')
    })
  })

  describe('isUserTyping', () => {
    it('should return true if user is typing', () => {
      mockClient.getRoom.mockReturnValue(mockRoom as unknown as Room)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      const isTyping = matrixTypingService.isUserTyping('!room:id', '@user1:matrix.org')
      expect(isTyping).toBe(true)
    })

    it('should return false if user is not typing', () => {
      mockClient.getRoom.mockReturnValue(mockRoom as unknown as Room)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      const isTyping = matrixTypingService.isUserTyping('!room:id', '@unknown:matrix.org')
      expect(isTyping).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should clear all timeouts and stop typing', async () => {
      mockTypingManager.startTyping.mockResolvedValue(undefined)
      mockTypingManager.stopTyping.mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      matrixTypingService.startTyping('!room1:id', 30000)
      matrixTypingService.startTyping('!room2:id', 30000)
      await Promise.resolve()

      matrixTypingService.cleanup()

      expect(mockTypingManager.clearAllTimers).toHaveBeenCalled()
      expect(mockTypingManager.stopTyping).toHaveBeenCalledWith('!room1:id')
      expect(mockTypingManager.stopTyping).toHaveBeenCalledWith('!room2:id')
    })

    it('should handle cleanup when client is not initialized', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      expect(() => matrixTypingService.cleanup()).not.toThrow()
    })
  })
})
