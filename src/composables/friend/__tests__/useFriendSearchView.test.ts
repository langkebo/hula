import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useFriendSearchView } from '@/composables/friend/useFriendSearchView'

describe('useFriendSearchView — 好友搜索即时展示视图切换 (§5.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('视图切换', () => {
    it('关键词为空时 isSearching 为 false（显示好友列表）', () => {
      const { isSearching } = useFriendSearchView()
      expect(isSearching.value).toBe(false)
    })

    it('设置非空关键词后 300ms 防抖内 isSearching 仍为 false', async () => {
      const { isSearching, setKeyword } = useFriendSearchView()
      setKeyword('alice')
      await nextTick()

      // 防抖延迟内尚未触发
      expect(isSearching.value).toBe(false)
    })

    it('防抖 300ms 后 isSearching 变为 true（显示搜索结果）', async () => {
      const { isSearching, setKeyword, debouncedKeyword } = useFriendSearchView()
      setKeyword('alice')
      await nextTick()

      vi.advanceTimersByTime(300)
      await nextTick()

      expect(isSearching.value).toBe(true)
      expect(debouncedKeyword.value).toBe('alice')
    })

    it('清空关键词后 isSearching 变为 false（恢复好友列表）', async () => {
      const { isSearching, setKeyword, clearSearch } = useFriendSearchView()
      setKeyword('alice')
      vi.advanceTimersByTime(300)
      await nextTick()
      expect(isSearching.value).toBe(true)

      clearSearch()
      await nextTick()
      // 清空应立即生效，不等防抖
      expect(isSearching.value).toBe(false)
    })
  })

  describe('防抖', () => {
    it('300ms 内多次输入只触发一次搜索', async () => {
      const { setKeyword, debouncedKeyword } = useFriendSearchView()

      setKeyword('a')
      vi.advanceTimersByTime(100)
      setKeyword('al')
      vi.advanceTimersByTime(100)
      setKeyword('ali')
      vi.advanceTimersByTime(100)
      // 最后一次设置后仅 100ms，300ms 还未到
      expect(debouncedKeyword.value).toBe('')

      // 再推进 200ms，总计从最后一次设置起 300ms
      vi.advanceTimersByTime(200)
      await nextTick()
      expect(debouncedKeyword.value).toBe('ali')
    })

    it('设置空字符串关键词不触发搜索', async () => {
      const { isSearching, setKeyword } = useFriendSearchView()
      setKeyword('')
      vi.advanceTimersByTime(300)
      await nextTick()
      expect(isSearching.value).toBe(false)
    })

    it('设置纯空格关键词不触发搜索', async () => {
      const { isSearching, setKeyword } = useFriendSearchView()
      setKeyword('   ')
      vi.advanceTimersByTime(300)
      await nextTick()
      expect(isSearching.value).toBe(false)
    })
  })

  describe('高亮匹配', () => {
    it('highlightMatch 返回匹配文本的分段', () => {
      const { highlightMatch } = useFriendSearchView()
      const segments = highlightMatch('Alice Wang', 'ali')

      // 'Ali' 在开头匹配，不产生空前缀段
      expect(segments).toHaveLength(2)
      expect(segments[0]).toEqual({ text: 'Ali', matched: true })
      expect(segments[1]).toEqual({ text: 'ce Wang', matched: false })
    })

    it('无匹配时返回整段未匹配文本', () => {
      const { highlightMatch } = useFriendSearchView()
      const segments = highlightMatch('Bob', 'alice')

      expect(segments).toHaveLength(1)
      expect(segments[0]).toEqual({ text: 'Bob', matched: false })
    })

    it('空关键词时返回整段未匹配文本', () => {
      const { highlightMatch } = useFriendSearchView()
      const segments = highlightMatch('Alice', '')

      expect(segments).toHaveLength(1)
      expect(segments[0]).toEqual({ text: 'Alice', matched: false })
    })

    it('匹配不区分大小写', () => {
      const { highlightMatch } = useFriendSearchView()
      const segments = highlightMatch('Alice', 'ALICE')

      expect(segments).toHaveLength(1)
      expect(segments[0]).toEqual({ text: 'Alice', matched: true })
    })
  })
})
