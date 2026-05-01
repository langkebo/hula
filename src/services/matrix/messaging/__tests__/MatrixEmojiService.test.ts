import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixMediaService } from '../../media/MatrixMediaService'
import { matrixEmojiService } from '../MatrixEmojiService'

const { getClientMock } = vi.hoisted(() => ({
  getClientMock: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: getClientMock
  },
  matrixClientService: {
    getClient: getClientMock
  }
}))

vi.mock('../../media/MatrixMediaService', () => ({
  matrixMediaService: {
    uploadFile: vi.fn().mockResolvedValue({ contentUri: 'mxc://server/emoji123', mimetype: 'image/png' }),
    getMediaUrl: vi.fn().mockReturnValue('https://server/_matrix/media/v3/download/server/emoji123')
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixEmojiService', () => {
  let getAccountDataFromServer: ReturnType<typeof vi.fn>
  let setAccountData: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getAccountDataFromServer = vi.fn().mockResolvedValue({ packs: {} })
    setAccountData = vi.fn().mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUserId: vi.fn(() => '@user:server'),
      getAccountDataFromServer,
      setAccountData
    } as unknown as MatrixClient)
  })

  describe('emojiList', () => {
    it('should get emoji packs list', async () => {
      getAccountDataFromServer.mockResolvedValue({
        packs: {
          pack1: {
            name: 'My Pack',
            emoticons: {},
            created_at: 123,
            updated_at: 456
          }
        }
      })

      const result = await matrixEmojiService.emojiList()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('My Pack')
      expect(getAccountDataFromServer).toHaveBeenCalledWith('im.hula.user_emotes')
    })

    it('should throw on error', async () => {
      getAccountDataFromServer.mockRejectedValue(new Error('fail'))
      await expect(matrixEmojiService.emojiList()).rejects.toThrow('fail')
    })
  })

  describe('emojiUpload', () => {
    it('should persist uploaded emoji into account data', async () => {
      const file = new File(['data'], 'emoji.png', { type: 'image/png' })

      const result = await matrixEmojiService.emojiUpload(file, 'Smile')

      expect(matrixMediaService.uploadFile).toHaveBeenCalledWith(file)
      expect(setAccountData).toHaveBeenCalledTimes(1)
      const [eventType, payload] = setAccountData.mock.calls[0]
      expect(eventType).toBe('im.hula.user_emotes')
      expect(payload.packs.default.emoticons[result.id]).toMatchObject({
        name: 'Smile',
        url: 'mxc://server/emoji123'
      })
      expect(result.url).toBe('https://server/_matrix/media/v3/download/server/emoji123')
    })

    it('should throw for unsupported file types', async () => {
      const file = new File(['data'], 'test.txt', { type: 'text/plain' })
      await expect(matrixEmojiService.emojiUpload(file, 'test')).rejects.toThrow('不支持的图片格式')
    })
  })

  describe('emojiDelete', () => {
    it('should delete an emoji', async () => {
      getAccountDataFromServer.mockResolvedValue({
        packs: {
          default: {
            name: 'default',
            emoticons: {
              emoji1: {
                name: 'Smile',
                url: 'mxc://server/emoji123',
                created_at: 123
              }
            },
            created_at: 123,
            updated_at: 123
          }
        }
      })

      await matrixEmojiService.emojiDelete('emoji1')

      expect(setAccountData).toHaveBeenCalledTimes(1)
      const [, payload] = setAccountData.mock.calls[0]
      expect(payload.packs.default.emoticons.emoji1).toBeUndefined()
    })

    it('should delete an emoji from specific pack', async () => {
      getAccountDataFromServer.mockResolvedValue({
        packs: {
          pack1: {
            name: 'Pack 1',
            emoticons: {
              emoji1: { name: 'Smile', url: 'mxc://url' }
            }
          }
        }
      })

      await matrixEmojiService.emojiDelete('emoji1', 'pack1')

      expect(setAccountData).toHaveBeenCalledTimes(1)
      const [, payload] = setAccountData.mock.calls[0]
      expect(payload.packs.pack1.emoticons.emoji1).toBeUndefined()
    })
  })

  describe('packManagement', () => {
    it('should create a new pack', async () => {
      const packName = 'New Pack'
      const result = await matrixEmojiService.createPack(packName)

      expect(result.name).toBe(packName)
      expect(setAccountData).toHaveBeenCalledTimes(1)
      const [, payload] = setAccountData.mock.calls[0]
      expect(payload.packs[result.id].name).toBe(packName)
    })

    it('should create a pack with icon', async () => {
      const iconFile = new File(['icon'], 'icon.png', { type: 'image/png' })
      const result = await matrixEmojiService.createPack('Pack with icon', iconFile)

      expect(matrixMediaService.uploadFile).toHaveBeenCalledWith(iconFile)
      expect(result.iconUrl).toBe('mxc://server/emoji123')
    })

    it('should delete a pack', async () => {
      getAccountDataFromServer.mockResolvedValue({
        packs: {
          pack1: { name: 'To be deleted' }
        }
      })

      await matrixEmojiService.deletePack('pack1')

      expect(setAccountData).toHaveBeenCalledTimes(1)
      const [, payload] = setAccountData.mock.calls[0]
      expect(payload.packs.pack1).toBeUndefined()
    })
  })

  describe('emojiPackOperations', () => {
    beforeEach(() => {
      getAccountDataFromServer.mockResolvedValue({
        packs: {
          pack1: {
            name: 'Pack 1',
            emoticons: {
              emoji1: { name: 'Smile', url: 'mxc://url' }
            }
          },
          pack2: {
            name: 'Pack 2',
            emoticons: {}
          }
        }
      })
    })

    it('should add emoji to another pack', async () => {
      await matrixEmojiService.addEmojiToPack('pack2', 'emoji1')

      expect(setAccountData).toHaveBeenCalledTimes(1)
      const [, payload] = setAccountData.mock.calls[0]
      expect(payload.packs.pack2.emoticons.emoji1).toEqual({
        name: 'Smile',
        url: 'mxc://url'
      })
    })

    it('should throw if emoji not found when adding to pack', async () => {
      await expect(matrixEmojiService.addEmojiToPack('pack2', 'non-existent')).rejects.toThrow('表情不存在')
    })

    it('should remove emoji from pack', async () => {
      await matrixEmojiService.removeEmojiFromPack('pack1', 'emoji1')

      expect(setAccountData).toHaveBeenCalledTimes(1)
      const [, payload] = setAccountData.mock.calls[0]
      expect(payload.packs.pack1.emoticons.emoji1).toBeUndefined()
    })
  })
})
