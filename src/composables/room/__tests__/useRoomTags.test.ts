import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetTags, mockSetTag, mockRemoveTag, mockShowFeedback } = vi.hoisted(() => ({
  mockGetTags: vi.fn(),
  mockSetTag: vi.fn(),
  mockRemoveTag: vi.fn(),
  mockShowFeedback: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomOperations', () => ({
  roomOperations: {
    getTags: mockGetTags,
    setTag: mockSetTag,
    removeTag: mockRemoveTag
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

import { SUGGESTED_TAGS, useRoomTags } from '../useRoomTags'

describe('useRoomTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('初始状态', () => {
    it('初始状态下 tags 为空且非加载中', () => {
      const flow = useRoomTags({ roomId: '!r:s' })
      expect(flow.tags.value).toEqual([])
      expect(flow.loading.value).toBe(false)
      expect(flow.updating.value).toBe(false)
      expect(flow.errorMessage.value).toBeNull()
    })

    it('初始计算属性 tagCount/tagNames/hasTags 反映空状态', () => {
      const flow = useRoomTags({ roomId: '!r:s' })
      expect(flow.tagCount.value).toBe(0)
      expect(flow.tagNames.value).toEqual([])
      expect(flow.hasTags.value).toBe(false)
    })

    it('导出推荐标签 SUGGESTED_TAGS', () => {
      expect(SUGGESTED_TAGS).toEqual(['favorite', 'work', 'personal', 'todo', 'important'])
    })
  })

  describe('load', () => {
    it('成功加载并将 tag 映射解析为数组', async () => {
      mockGetTags.mockResolvedValueOnce({
        'm.favourite': { order: 0.1 },
        work: {}
      })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      expect(mockGetTags).toHaveBeenCalledWith('!r:s')
      expect(flow.tags.value).toHaveLength(2)
      expect(flow.tags.value[0]).toEqual({ name: 'm.favourite', order: 0.1 })
      expect(flow.tags.value[1]).toEqual({ name: 'work', order: undefined })
      expect(flow.loading.value).toBe(false)
    })

    it('加载失败时设置 errorMessage', async () => {
      mockGetTags.mockRejectedValueOnce(new Error('network'))

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      expect(flow.errorMessage.value).toBe('room_tags.load_failed')
      expect(flow.loading.value).toBe(false)
    })

    it('roomId 为 null 时清空标签且不调用 getTags', async () => {
      const flow = useRoomTags({ roomId: null })
      await flow.load()

      expect(mockGetTags).not.toHaveBeenCalled()
      expect(flow.tags.value).toEqual([])
    })

    it('加载成功后 hasTags 与 tagNames 反映最新数据', async () => {
      mockGetTags.mockResolvedValueOnce({ important: {}, todo: { order: 1 } })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      expect(flow.hasTags.value).toBe(true)
      expect(flow.tagCount.value).toBe(2)
      expect(flow.tagNames.value).toEqual(['important', 'todo'])
    })
  })

  describe('addTag', () => {
    it('成功添加标签并刷新本地状态', async () => {
      mockSetTag.mockResolvedValueOnce(undefined)
      mockGetTags.mockResolvedValueOnce({ 'new-tag': {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.addTag('new-tag')

      expect(result).toBe(true)
      expect(mockSetTag).toHaveBeenCalledWith('!r:s', 'new-tag', undefined)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.add_success', 'success')
      expect(flow.tags.value).toHaveLength(1)
      expect(flow.updating.value).toBe(false)
    })

    it('支持传入 order 参数', async () => {
      mockSetTag.mockResolvedValueOnce(undefined)
      mockGetTags.mockResolvedValueOnce({})

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.addTag('work', 0.5)

      expect(mockSetTag).toHaveBeenCalledWith('!r:s', 'work', 0.5)
    })

    it('自动去除标签名首尾空白', async () => {
      mockSetTag.mockResolvedValueOnce(undefined)
      mockGetTags.mockResolvedValueOnce({})

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.addTag('  work  ')

      expect(mockSetTag).toHaveBeenCalledWith('!r:s', 'work', undefined)
    })

    it('空标签名返回 false 并给出警告', async () => {
      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.addTag('   ')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.name_empty', 'warning')
      expect(mockSetTag).not.toHaveBeenCalled()
    })

    it('重复标签名返回 false 并给出警告', async () => {
      mockGetTags.mockResolvedValueOnce({ work: {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      const result = await flow.addTag('work')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.name_exists', 'warning')
      expect(mockSetTag).not.toHaveBeenCalled()
    })

    it('超过 32 字符的标签名返回 false 并给出警告', async () => {
      const flow = useRoomTags({ roomId: '!r:s' })
      const longName = 'a'.repeat(33)
      const result = await flow.addTag(longName)

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.name_too_long', 'warning')
      expect(mockSetTag).not.toHaveBeenCalled()
    })

    it('roomId 为 null 时返回 false 并给出错误', async () => {
      const flow = useRoomTags({ roomId: null })
      const result = await flow.addTag('work')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.add_failed', 'error')
      expect(mockSetTag).not.toHaveBeenCalled()
    })

    it('setTag 抛错时返回 false 并给出错误', async () => {
      mockSetTag.mockRejectedValueOnce(new Error('forbidden'))

      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.addTag('work')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.add_failed', 'error')
      expect(flow.updating.value).toBe(false)
    })
  })

  describe('removeTag', () => {
    it('成功删除标签并刷新本地状态', async () => {
      mockRemoveTag.mockResolvedValueOnce(undefined)
      mockGetTags.mockResolvedValueOnce({})

      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.removeTag('work')

      expect(result).toBe(true)
      expect(mockRemoveTag).toHaveBeenCalledWith('!r:s', 'work')
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.remove_success', 'success')
      expect(flow.updating.value).toBe(false)
    })

    it('roomId 为 null 时返回 false 且不调用 removeTag', async () => {
      const flow = useRoomTags({ roomId: null })
      const result = await flow.removeTag('work')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.remove_failed', 'error')
      expect(mockRemoveTag).not.toHaveBeenCalled()
    })

    it('removeTag 抛错时返回 false 并给出错误', async () => {
      mockRemoveTag.mockRejectedValueOnce(new Error('failed'))

      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.removeTag('work')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.remove_failed', 'error')
      expect(flow.updating.value).toBe(false)
    })
  })

  describe('renameTag', () => {
    it('先 remove 再 add 完成重命名并刷新状态', async () => {
      mockRemoveTag.mockResolvedValueOnce(undefined)
      mockSetTag.mockResolvedValueOnce(undefined)
      mockGetTags.mockResolvedValueOnce({ renamed: {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.renameTag('old', 'renamed')

      expect(result).toBe(true)
      expect(mockRemoveTag).toHaveBeenCalledWith('!r:s', 'old')
      expect(mockSetTag).toHaveBeenCalledWith('!r:s', 'renamed')
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.add_success', 'success')
    })

    it('新名为空时返回 false', async () => {
      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.renameTag('old', '   ')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.name_empty', 'warning')
      expect(mockRemoveTag).not.toHaveBeenCalled()
    })

    it('新名与已有标签(非旧名)重复时返回 false', async () => {
      mockGetTags.mockResolvedValueOnce({ existing: {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      const result = await flow.renameTag('old', 'existing')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.name_exists', 'warning')
      expect(mockRemoveTag).not.toHaveBeenCalled()
    })

    it('新名等于旧名时不视为重复,允许执行', async () => {
      mockRemoveTag.mockResolvedValueOnce(undefined)
      mockSetTag.mockResolvedValueOnce(undefined)
      mockGetTags.mockResolvedValueOnce({ same: {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.renameTag('same', 'same')

      expect(result).toBe(true)
    })

    it('重命名过程中抛错时返回 false 并刷新状态', async () => {
      mockRemoveTag.mockRejectedValueOnce(new Error('failed'))

      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.renameTag('old', 'new')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.add_failed', 'error')
      expect(flow.updating.value).toBe(false)
    })
  })

  describe('hasTag', () => {
    it('已存在的标签返回 true', async () => {
      mockGetTags.mockResolvedValueOnce({ work: {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      expect(flow.hasTag('work')).toBe(true)
    })

    it('不存在的标签返回 false', async () => {
      mockGetTags.mockResolvedValueOnce({ work: {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      expect(flow.hasTag('missing')).toBe(false)
    })
  })

  describe('clearAll', () => {
    it('循环删除所有标签', async () => {
      mockRemoveTag.mockResolvedValue(undefined)
      mockGetTags.mockResolvedValueOnce({ a: {}, b: {}, c: {} }).mockResolvedValueOnce({})

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      const result = await flow.clearAll()

      expect(result).toBe(true)
      expect(mockRemoveTag).toHaveBeenCalledTimes(3)
      expect(mockRemoveTag).toHaveBeenCalledWith('!r:s', 'a')
      expect(mockRemoveTag).toHaveBeenCalledWith('!r:s', 'b')
      expect(mockRemoveTag).toHaveBeenCalledWith('!r:s', 'c')
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.remove_success', 'success')
      expect(flow.updating.value).toBe(false)
    })

    it('没有标签时直接返回 true 且不调用 removeTag', async () => {
      const flow = useRoomTags({ roomId: '!r:s' })
      const result = await flow.clearAll()

      expect(result).toBe(true)
      expect(mockRemoveTag).not.toHaveBeenCalled()
    })

    it('roomId 为 null 时返回 false', async () => {
      const flow = useRoomTags({ roomId: null })
      const result = await flow.clearAll()

      expect(result).toBe(false)
      expect(mockRemoveTag).not.toHaveBeenCalled()
    })

    it('部分删除失败时返回 false 并刷新状态', async () => {
      mockRemoveTag.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom'))
      mockGetTags.mockResolvedValueOnce({ a: {}, b: {} }).mockResolvedValueOnce({ a: {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      const result = await flow.clearAll()

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('room_tags.remove_failed', 'error')
      expect(flow.updating.value).toBe(false)
    })
  })

  describe('计算属性', () => {
    it('tagNames 返回所有标签名数组', async () => {
      mockGetTags.mockResolvedValueOnce({ x: {}, y: { order: 2 } })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      expect(flow.tagNames.value).toEqual(['x', 'y'])
    })

    it('tagCount 返回标签数量', async () => {
      mockGetTags.mockResolvedValueOnce({ x: {}, y: {}, z: {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      expect(flow.tagCount.value).toBe(3)
    })

    it('hasTags 在有标签时为 true', async () => {
      mockGetTags.mockResolvedValueOnce({ x: {} })

      const flow = useRoomTags({ roomId: '!r:s' })
      await flow.load()

      expect(flow.hasTags.value).toBe(true)
    })
  })
})
