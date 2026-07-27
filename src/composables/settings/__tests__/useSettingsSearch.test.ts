import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useSettingsSearch } from '@/composables/settings/useSettingsSearch'

describe('useSettingsSearch — 设置页快速搜索 (§5.2)', () => {
  describe('搜索过滤', () => {
    it('空查询时返回全部 Tab', () => {
      const { filteredTabs } = useSettingsSearch()
      expect(filteredTabs.value.length).toBeGreaterThan(0)
    })

    it('搜索 "notifications" 过滤出通知设置', () => {
      const { searchQuery, filteredTabs } = useSettingsSearch()
      searchQuery.value = 'notifications'

      expect(filteredTabs.value.some((tab) => tab.id === 'notifications')).toBe(true)
      // 只包含匹配的 Tab
      expect(filteredTabs.value.every((tab) => tab.id === 'notifications')).toBe(true)
    })

    it('搜索 "security" 过滤出安全设置', () => {
      const { searchQuery, filteredTabs } = useSettingsSearch()
      searchQuery.value = 'security'

      expect(filteredTabs.value.some((tab) => tab.id === 'securityPrivacy')).toBe(true)
    })

    it('搜索 "encryption" 过滤出加密设置', () => {
      const { searchQuery, filteredTabs } = useSettingsSearch()
      searchQuery.value = 'encryption'

      expect(filteredTabs.value.some((tab) => tab.id === 'encryption')).toBe(true)
    })

    it('无匹配时返回空数组', () => {
      const { searchQuery, filteredTabs } = useSettingsSearch()
      searchQuery.value = 'zzz_nonexistent_zzz'

      expect(filteredTabs.value).toHaveLength(0)
    })
  })

  describe('isSearching', () => {
    it('空查询时 isSearching 为 false', () => {
      const { isSearching } = useSettingsSearch()
      expect(isSearching.value).toBe(false)
    })

    it('非空查询时 isSearching 为 true', () => {
      const { searchQuery, isSearching } = useSettingsSearch()
      searchQuery.value = 'account'
      expect(isSearching.value).toBe(true)
    })

    it('纯空格查询时 isSearching 为 false', () => {
      const { searchQuery, isSearching } = useSettingsSearch()
      searchQuery.value = '   '
      expect(isSearching.value).toBe(false)
    })
  })

  describe('firstMatch', () => {
    it('返回第一个匹配的 Tab', () => {
      const { searchQuery, firstMatch } = useSettingsSearch()
      searchQuery.value = 'notifications'

      expect(firstMatch.value).not.toBeNull()
      expect(firstMatch.value?.id).toBe('notifications')
    })

    it('无匹配时返回 null', () => {
      const { searchQuery, firstMatch } = useSettingsSearch()
      searchQuery.value = 'zzz_nonexistent_zzz'

      expect(firstMatch.value).toBeNull()
    })

    it('空查询时返回 null', () => {
      const { firstMatch } = useSettingsSearch()
      expect(firstMatch.value).toBeNull()
    })
  })

  describe('clearSearch', () => {
    it('清空搜索查询', async () => {
      const { searchQuery, clearSearch, isSearching } = useSettingsSearch()
      searchQuery.value = 'account'
      expect(isSearching.value).toBe(true)

      clearSearch()
      await nextTick()
      expect(searchQuery.value).toBe('')
      expect(isSearching.value).toBe(false)
    })
  })

  describe('高亮匹配', () => {
    it('highlightMatch 返回匹配分段', () => {
      const { searchQuery, highlightMatch } = useSettingsSearch()
      searchQuery.value = 'sec'

      const segments = highlightMatch('Security & Privacy')
      expect(segments.some((s) => s.matched)).toBe(true)
    })

    it('空查询时不高亮', () => {
      const { highlightMatch } = useSettingsSearch()
      const segments = highlightMatch('Account')

      expect(segments).toHaveLength(1)
      expect(segments[0].matched).toBe(false)
    })
  })
})
