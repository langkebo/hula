import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockEmojiList,
  mockCreatePack,
  mockDeletePack,
  mockRenamePack,
  mockEmojiUpload,
  mockEmojiDelete,
  mockShowFeedback
} = vi.hoisted(() => ({
  mockEmojiList: vi.fn(),
  mockCreatePack: vi.fn(),
  mockDeletePack: vi.fn(),
  mockRenamePack: vi.fn(),
  mockEmojiUpload: vi.fn(),
  mockEmojiDelete: vi.fn(),
  mockShowFeedback: vi.fn()
}))

vi.mock('@/services/matrix/messaging/MatrixEmojiService', () => ({
  matrixEmojiService: {
    emojiList: mockEmojiList,
    createPack: mockCreatePack,
    deletePack: mockDeletePack,
    renamePack: mockRenamePack,
    emojiUpload: mockEmojiUpload,
    emojiDelete: mockEmojiDelete
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

import { useEmojiPackManager } from '../useEmojiPackManager'

describe('useEmojiPackManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('load', () => {
    it('加载成功时填充 packs 并关闭 loading', async () => {
      const packs = [{ id: 'pack_1', name: '默认包', items: [], createdTs: 0, updatedTs: 0 }]
      mockEmojiList.mockResolvedValueOnce(packs)

      const manager = useEmojiPackManager()
      await manager.load()

      expect(manager.packs.value).toEqual(packs)
      expect(manager.loading.value).toBe(false)
      expect(manager.error.value).toBeNull()
      expect(mockShowFeedback).not.toHaveBeenCalled()
    })

    it('加载失败时设置 error 并显示错误反馈', async () => {
      mockEmojiList.mockRejectedValueOnce(new Error('network'))

      const manager = useEmojiPackManager()
      await manager.load()

      expect(manager.error.value).toBe('emoticon.packs.load_failed')
      expect(manager.loading.value).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.load_failed', 'error')
    })

    it('加载期间 loading 为 true,结束后为 false', async () => {
      let resolveList: (v: unknown) => void = () => {}
      mockEmojiList.mockImplementationOnce(() => new Promise((resolve) => (resolveList = resolve)))

      const manager = useEmojiPackManager()
      const promise = manager.load()

      expect(manager.loading.value).toBe(true)

      resolveList([])
      await promise

      expect(manager.loading.value).toBe(false)
    })
  })

  describe('createPack', () => {
    it('创建成功后显示成功反馈并重新加载列表', async () => {
      mockCreatePack.mockResolvedValueOnce(undefined)
      mockEmojiList.mockResolvedValueOnce([])

      const manager = useEmojiPackManager()
      const ok = await manager.createPack('我的表情包')

      expect(ok).toBe(true)
      expect(mockCreatePack).toHaveBeenCalledWith('我的表情包')
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.create_success', 'success')
      expect(mockEmojiList).toHaveBeenCalled()
      expect(manager.creating.value).toBe(false)
    })

    it('名称为空时不调用服务并返回 false', async () => {
      const manager = useEmojiPackManager()
      const ok = await manager.createPack('   ')

      expect(ok).toBe(false)
      expect(mockCreatePack).not.toHaveBeenCalled()
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.create_failed', 'error')
    })

    it('创建失败时显示错误反馈并返回 false', async () => {
      mockCreatePack.mockRejectedValueOnce(new Error('forbidden'))

      const manager = useEmojiPackManager()
      const ok = await manager.createPack('新包')

      expect(ok).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.create_failed', 'error')
      expect(manager.creating.value).toBe(false)
    })

    it('创建期间 creating 为 true', async () => {
      let resolveCreate: (v: unknown) => void = () => {}
      mockCreatePack.mockImplementationOnce(() => new Promise((resolve) => (resolveCreate = resolve)))

      const manager = useEmojiPackManager()
      const promise = manager.createPack('新包')

      expect(manager.creating.value).toBe(true)

      resolveCreate(undefined)
      mockEmojiList.mockResolvedValueOnce([])
      await promise

      expect(manager.creating.value).toBe(false)
    })
  })

  describe('deletePack', () => {
    it('删除成功后显示成功反馈并重新加载', async () => {
      mockDeletePack.mockResolvedValueOnce(undefined)
      mockEmojiList.mockResolvedValueOnce([])

      const manager = useEmojiPackManager()
      const ok = await manager.deletePack('pack_1')

      expect(ok).toBe(true)
      expect(mockDeletePack).toHaveBeenCalledWith('pack_1')
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.uninstall_success', 'success')
    })

    it('删除失败时显示错误反馈并返回 false', async () => {
      mockDeletePack.mockRejectedValueOnce(new Error('not found'))

      const manager = useEmojiPackManager()
      const ok = await manager.deletePack('pack_1')

      expect(ok).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.uninstall_failed', 'error')
    })
  })

  describe('renamePack', () => {
    it('重命名成功后显示成功反馈并重新加载', async () => {
      mockRenamePack.mockResolvedValueOnce(undefined)
      mockEmojiList.mockResolvedValueOnce([])

      const manager = useEmojiPackManager()
      const ok = await manager.renamePack('pack_1', '新名称')

      expect(ok).toBe(true)
      expect(mockRenamePack).toHaveBeenCalledWith('pack_1', '新名称')
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.rename_success', 'success')
    })

    it('名称为空时不调用服务并返回 false', async () => {
      const manager = useEmojiPackManager()
      const ok = await manager.renamePack('pack_1', '')

      expect(ok).toBe(false)
      expect(mockRenamePack).not.toHaveBeenCalled()
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.rename_failed', 'error')
    })

    it('重命名失败时显示错误反馈并返回 false', async () => {
      mockRenamePack.mockRejectedValueOnce(new Error('denied'))

      const manager = useEmojiPackManager()
      const ok = await manager.renamePack('pack_1', '新名称')

      expect(ok).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.rename_failed', 'error')
    })
  })

  describe('addEmoji', () => {
    it('上传成功后显示成功反馈并重新加载', async () => {
      mockEmojiUpload.mockResolvedValueOnce({ id: 'emote_1', name: '笑脸', url: 'mxc://x', mxcUrl: 'mxc://x' })
      mockEmojiList.mockResolvedValueOnce([])

      const manager = useEmojiPackManager()
      const file = new File(['data'], 'smile.png', { type: 'image/png' })
      const ok = await manager.addEmoji('pack_1', { file, name: '笑脸' })

      expect(ok).toBe(true)
      expect(mockEmojiUpload).toHaveBeenCalledWith(file, '笑脸', 'pack_1')
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.add_emoji_success', 'success')
    })

    it('上传失败时显示上传错误反馈并返回 false', async () => {
      mockEmojiUpload.mockRejectedValueOnce(new Error('too large'))

      const manager = useEmojiPackManager()
      const file = new File(['data'], 'smile.png', { type: 'image/png' })
      const ok = await manager.addEmoji('pack_1', { file, name: '笑脸' })

      expect(ok).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.upload_failed', 'error')
    })
  })

  describe('removeEmoji', () => {
    it('移除成功后显示成功反馈并重新加载', async () => {
      mockEmojiDelete.mockResolvedValueOnce(undefined)
      mockEmojiList.mockResolvedValueOnce([])

      const manager = useEmojiPackManager()
      const ok = await manager.removeEmoji('pack_1', 'emote_1')

      expect(ok).toBe(true)
      expect(mockEmojiDelete).toHaveBeenCalledWith('emote_1', 'pack_1')
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.remove_emoji_success', 'success')
    })

    it('移除失败时显示错误反馈并返回 false', async () => {
      mockEmojiDelete.mockRejectedValueOnce(new Error('missing'))

      const manager = useEmojiPackManager()
      const ok = await manager.removeEmoji('pack_1', 'emote_1')

      expect(ok).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('emoticon.packs.remove_emoji_failed', 'error')
    })
  })
})
