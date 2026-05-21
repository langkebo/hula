import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/messaging/MatrixTypingService', () => ({
  matrixTypingService: {
    startTyping: vi.fn(),
    stopTyping: vi.fn(),
    getTypingUsers: vi.fn(() => []),
    getBatchTyping: vi.fn(() => ({})),
    getTypingUsersText: vi.fn(() => ''),
    isUserTyping: vi.fn(() => false),
    isRoomTyping: vi.fn(() => false),
    cleanup: vi.fn()
  }
}))

vi.mock('@/hooks/useMitt', () => ({
  useMitt: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

import { matrixTypingService } from '@/services/matrix/messaging/MatrixTypingService'
import { useTyping } from '../useTyping'

describe('useTyping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // startTyping
  // ============================================================================

  describe('startTyping', () => {
    it('delegates to matrixTypingService.startTyping', () => {
      const { startTyping } = useTyping()
      startTyping('room1')
      expect(matrixTypingService.startTyping).toHaveBeenCalledWith('room1', undefined)
    })

    it('passes timeout parameter', () => {
      const { startTyping } = useTyping()
      startTyping('room1', 5000)
      expect(matrixTypingService.startTyping).toHaveBeenCalledWith('room1', 5000)
    })
  })

  // ============================================================================
  // stopTyping
  // ============================================================================

  describe('stopTyping', () => {
    it('delegates to matrixTypingService.stopTyping', () => {
      const { stopTyping } = useTyping()
      stopTyping('room1')
      expect(matrixTypingService.stopTyping).toHaveBeenCalledWith('room1')
    })
  })

  // ============================================================================
  // getTypingUsers
  // ============================================================================

  describe('getTypingUsers', () => {
    it('returns typing users from service', () => {
      const mockUsers = [
        { userId: 'user1', displayName: 'Alice', avatarUrl: '', lastTyped: Date.now() },
        { userId: 'user2', displayName: 'Bob', avatarUrl: '', lastTyped: Date.now() }
      ]
      vi.mocked(matrixTypingService.getTypingUsers).mockReturnValueOnce(mockUsers)

      const { getTypingUsers } = useTyping()
      const result = getTypingUsers('room1')

      expect(matrixTypingService.getTypingUsers).toHaveBeenCalledWith('room1')
      expect(result).toEqual(mockUsers)
    })

    it('returns empty array when no one is typing', () => {
      vi.mocked(matrixTypingService.getTypingUsers).mockReturnValueOnce([])

      const { getTypingUsers } = useTyping()
      const result = getTypingUsers('room1')

      expect(result).toEqual([])
    })
  })

  // ============================================================================
  // getBatchTyping (batchGetTypingStatus)
  // ============================================================================

  describe('getBatchTyping', () => {
    it('returns batch typing status for multiple rooms', () => {
      const mockResult = {
        room1: [{ userId: 'user1', displayName: 'Alice', avatarUrl: '', lastTyped: Date.now() }],
        room2: []
      }
      vi.mocked(matrixTypingService.getBatchTyping).mockReturnValueOnce(mockResult)

      const { getBatchTyping } = useTyping()
      const result = getBatchTyping(['room1', 'room2'])

      expect(matrixTypingService.getBatchTyping).toHaveBeenCalledWith(['room1', 'room2'])
      expect(result).toEqual(mockResult)
    })

    it('returns empty object for empty room list', () => {
      vi.mocked(matrixTypingService.getBatchTyping).mockReturnValueOnce({})

      const { getBatchTyping } = useTyping()
      const result = getBatchTyping([])

      expect(result).toEqual({})
    })
  })

  // ============================================================================
  // getTypingUsersText
  // ============================================================================

  describe('getTypingUsersText', () => {
    it('returns typing text from service', () => {
      vi.mocked(matrixTypingService.getTypingUsersText).mockReturnValueOnce('Alice 正在输入...')

      const { getTypingUsersText } = useTyping()
      const result = getTypingUsersText('room1')

      expect(matrixTypingService.getTypingUsersText).toHaveBeenCalledWith('room1', undefined)
      expect(result).toBe('Alice 正在输入...')
    })

    it('passes maxDisplay parameter', () => {
      vi.mocked(matrixTypingService.getTypingUsersText).mockReturnValueOnce('')

      const { getTypingUsersText } = useTyping()
      getTypingUsersText('room1', 3)

      expect(matrixTypingService.getTypingUsersText).toHaveBeenCalledWith('room1', 3)
    })
  })

  // ============================================================================
  // isUserTyping
  // ============================================================================

  describe('isUserTyping', () => {
    it('returns true when user is typing', () => {
      vi.mocked(matrixTypingService.isUserTyping).mockReturnValueOnce(true)

      const { isUserTyping } = useTyping()
      expect(isUserTyping('room1', 'user1')).toBe(true)
      expect(matrixTypingService.isUserTyping).toHaveBeenCalledWith('room1', 'user1')
    })

    it('returns false when user is not typing', () => {
      vi.mocked(matrixTypingService.isUserTyping).mockReturnValueOnce(false)

      const { isUserTyping } = useTyping()
      expect(isUserTyping('room1', 'user1')).toBe(false)
    })
  })

  // ============================================================================
  // isRoomTyping
  // ============================================================================

  describe('isRoomTyping', () => {
    it('returns true when room has typing activity', () => {
      vi.mocked(matrixTypingService.isRoomTyping).mockReturnValueOnce(true)

      const { isRoomTyping } = useTyping()
      expect(isRoomTyping('room1')).toBe(true)
      expect(matrixTypingService.isRoomTyping).toHaveBeenCalledWith('room1')
    })

    it('returns false when room has no typing activity', () => {
      vi.mocked(matrixTypingService.isRoomTyping).mockReturnValueOnce(false)

      const { isRoomTyping } = useTyping()
      expect(isRoomTyping('room1')).toBe(false)
    })
  })

  // ============================================================================
  // cleanup
  // ============================================================================

  describe('cleanup', () => {
    it('delegates to matrixTypingService.cleanup', () => {
      const { cleanup } = useTyping()
      cleanup()
      expect(matrixTypingService.cleanup).toHaveBeenCalled()
    })
  })
})
