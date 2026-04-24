import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixEmojiService } from '../MatrixEmojiService'
import { matrixClientService } from '../../MatrixClientService'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn()
  }
}))

vi.mock('../../media/MatrixMediaService', () => ({
  matrixMediaService: {
    uploadFile: vi.fn().mockResolvedValue({ contentUri: 'mxc://server/emoji123', mimetype: 'image/png' })
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixEmojiService', () => {
  let mockRequest: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockRequest = vi.fn().mockResolvedValue({ packs: [] })
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      http: { request: mockRequest },
      getUserId: vi.fn(() => '@user:server')
    } as any)
  })

  describe('emojiList', () => {
    it('should get emoji packs list', async () => {
      mockRequest.mockResolvedValue({
        packs: [{ id: 'pack1', name: 'My Pack', items: [], created_ts: 123, updated_ts: 456 }]
      })

      const result = await matrixEmojiService.emojiList()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('My Pack')
    })

    it('should throw on error', async () => {
      mockRequest.mockRejectedValue(new Error('fail'))
      await expect(matrixEmojiService.emojiList()).rejects.toThrow('fail')
    })
  })

  describe('emojiDelete', () => {
    it('should delete an emoji', async () => {
      mockRequest.mockResolvedValue({})

      await matrixEmojiService.emojiDelete('emoji1')

      expect(mockRequest).toHaveBeenCalled()
    })
  })
})
