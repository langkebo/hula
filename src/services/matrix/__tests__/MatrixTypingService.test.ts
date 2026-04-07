import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { matrixTypingService } from '../MatrixTypingService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null)
  }
}))

import matrixClientService from '../MatrixClientService'

const mockRoom = {
  getLiveTimeline: vi.fn(() => ({
    getState: vi.fn(() => ({
      getStateEvents: vi.fn(() => ({
        getContent: vi.fn(() => ({ user_ids: ['@user1:matrix.org', '@user2:matrix.org'] }))
      }))
    }))
  })),
  getMember: vi.fn((userId: string) => ({
    name: userId.split(':')[0].replace('@', ''),
    getMxcAvatarUrl: vi.fn(() => `mxc://matrix.org/avatar/${userId}`)
  }))
}

const mockClient = {
  sendTyping: vi.fn(),
  getRoom: vi.fn(),
  getUserId: vi.fn(() => '@me:matrix.org')
}

describe('MatrixTypingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    matrixTypingService.cleanup()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
    matrixTypingService.cleanup()
  })

  describe('sendTypingNotification', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      await expect(matrixTypingService.sendTypingNotification('!room:id', true)).rejects.toThrow('客户端未初始化')
    })

    it('should send typing notification successfully', async () => {
      mockClient.sendTyping.mockResolvedValueOnce(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      await matrixTypingService.sendTypingNotification('!room:id', true, 30000)

      expect(mockClient.sendTyping).toHaveBeenCalledWith('!room:id', true, 30000)
    })

    it('should send stop typing notification', async () => {
      mockClient.sendTyping.mockResolvedValueOnce(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      await matrixTypingService.sendTypingNotification('!room:id', false)

      expect(mockClient.sendTyping).toHaveBeenCalledWith('!room:id', false, 30000)
    })
  })

  describe('startTyping', () => {
    it('should send typing notification and set timeout', async () => {
      mockClient.sendTyping.mockResolvedValueOnce(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      matrixTypingService.startTyping('!room:id', 30000)

      expect(mockClient.sendTyping).toHaveBeenCalledWith('!room:id', true, 30000)
    })

    it('should clear existing timeout before setting new one', async () => {
      mockClient.sendTyping.mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      matrixTypingService.startTyping('!room:id', 30000)
      matrixTypingService.startTyping('!room:id', 30000)

      expect(mockClient.sendTyping).toHaveBeenCalledTimes(2)
    })
  })

  describe('stopTyping', () => {
    it('should send stop typing notification', async () => {
      mockClient.sendTyping.mockResolvedValueOnce(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      matrixTypingService.stopTyping('!room:id')

      expect(mockClient.sendTyping).toHaveBeenCalledWith('!room:id', false, 30000)
    })

    it('should clear timeout', async () => {
      mockClient.sendTyping.mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      matrixTypingService.startTyping('!room:id', 30000)
      matrixTypingService.stopTyping('!room:id')

      vi.advanceTimersByTime(25000)
      expect(mockClient.sendTyping).toHaveBeenCalledTimes(2)
    })

    it('should handle error silently when client is not initialized', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      expect(() => matrixTypingService.stopTyping('!room:id')).not.toThrow()
    })
  })

  describe('getTypingUsers', () => {
    it('should return empty array when client is not initialized', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      const users = matrixTypingService.getTypingUsers('!room:id')
      expect(users).toEqual([])
    })

    it('should return empty array when room is not found', () => {
      mockClient.getRoom.mockReturnValueOnce(null)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const users = matrixTypingService.getTypingUsers('!room:id')
      expect(users).toEqual([])
    })

    it('should return typing users excluding self', () => {
      mockClient.getRoom.mockReturnValueOnce(mockRoom as any)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const users = matrixTypingService.getTypingUsers('!room:id')

      expect(users).toHaveLength(2)
      expect(users[0].userId).toBe('@user1:matrix.org')
      expect(users[1].userId).toBe('@user2:matrix.org')
    })
  })

  describe('getTypingUsersText', () => {
    beforeEach(() => {
      mockClient.getRoom.mockReturnValue(mockRoom as any)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)
    })

    it('should return empty string when no users are typing', () => {
      mockRoom.getLiveTimeline.mockReturnValueOnce({
        getState: vi.fn(() => ({
          getStateEvents: vi.fn(() => ({
            getContent: vi.fn(() => ({ user_ids: [] }))
          }))
        }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id')
      expect(text).toBe('')
    })

    it('should return text for single typing user', () => {
      mockRoom.getLiveTimeline.mockReturnValueOnce({
        getState: vi.fn(() => ({
          getStateEvents: vi.fn(() => ({
            getContent: vi.fn(() => ({ user_ids: ['@user1:matrix.org'] }))
          }))
        }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id')
      expect(text).toBe('user1 正在输入...')
    })

    it('should return text for two typing users', () => {
      mockRoom.getLiveTimeline.mockReturnValueOnce({
        getState: vi.fn(() => ({
          getStateEvents: vi.fn(() => ({
            getContent: vi.fn(() => ({ user_ids: ['@user1:matrix.org', '@user2:matrix.org'] }))
          }))
        }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id')
      expect(text).toBe('user1 和 user2 正在输入...')
    })

    it('should return text for three typing users', () => {
      mockRoom.getLiveTimeline.mockReturnValueOnce({
        getState: vi.fn(() => ({
          getStateEvents: vi.fn(() => ({
            getContent: vi.fn(() => ({ user_ids: ['@user1:matrix.org', '@user2:matrix.org', '@user3:matrix.org'] }))
          }))
        }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id')
      expect(text).toBe('user1、user2 和 user3 正在输入...')
    })

    it('should return text for many typing users with max display', () => {
      mockRoom.getLiveTimeline.mockReturnValueOnce({
        getState: vi.fn(() => ({
          getStateEvents: vi.fn(() => ({
            getContent: vi.fn(() => ({
              user_ids: [
                '@user1:matrix.org',
                '@user2:matrix.org',
                '@user3:matrix.org',
                '@user4:matrix.org',
                '@user5:matrix.org'
              ]
            }))
          }))
        }))
      })

      const text = matrixTypingService.getTypingUsersText('!room:id', 3)
      expect(text).toBe('user1、user2、user3 和其他 2 人正在输入...')
    })
  })

  describe('isUserTyping', () => {
    it('should return true if user is typing', () => {
      mockClient.getRoom.mockReturnValue(mockRoom as any)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const isTyping = matrixTypingService.isUserTyping('!room:id', '@user1:matrix.org')
      expect(isTyping).toBe(true)
    })

    it('should return false if user is not typing', () => {
      mockClient.getRoom.mockReturnValue(mockRoom as any)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      const isTyping = matrixTypingService.isUserTyping('!room:id', '@unknown:matrix.org')
      expect(isTyping).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should clear all timeouts and stop typing', async () => {
      mockClient.sendTyping.mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

      matrixTypingService.startTyping('!room1:id', 30000)
      matrixTypingService.startTyping('!room2:id', 30000)

      matrixTypingService.cleanup()

      expect(mockClient.sendTyping).toHaveBeenCalledWith('!room1:id', false, 30000)
      expect(mockClient.sendTyping).toHaveBeenCalledWith('!room2:id', false, 30000)
    })

    it('should handle cleanup when client is not initialized', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

      expect(() => matrixTypingService.cleanup()).not.toThrow()
    })
  })
})
