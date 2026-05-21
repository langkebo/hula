import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useWorkbenchEmptyDescription } from '../useWorkbenchEmptyDescription'

describe('useWorkbenchEmptyDescription', () => {
  const t = (key: 'space.empty_filtered_sessions' | 'space.empty_sessions') => key

  it('returns the default empty description when no filters are active', () => {
    const searchKeyword = ref('')
    const sessionTypeFilter = ref<'all' | 'group' | 'single'>('all')
    const sessionEngagementFilter = ref<'all' | 'unread' | 'mention' | 'invite'>('all')

    const emptyDescription = useWorkbenchEmptyDescription({
      t,
      searchKeyword,
      sessionTypeFilter,
      sessionEngagementFilter
    })

    expect(emptyDescription.value).toBe('space.empty_sessions')
  })

  it('returns the filtered empty description when any local filter is active', () => {
    const searchKeyword = ref('alpha')
    const sessionTypeFilter = ref<'all' | 'group' | 'single'>('all')
    const sessionEngagementFilter = ref<'all' | 'unread' | 'mention' | 'invite'>('all')

    const emptyDescription = useWorkbenchEmptyDescription({
      t,
      searchKeyword,
      sessionTypeFilter,
      sessionEngagementFilter
    })

    expect(emptyDescription.value).toBe('space.empty_filtered_sessions')
  })

  it('treats the active space filter as a filtered state', () => {
    const searchKeyword = computed(() => '')
    const sessionTypeFilter = computed(() => 'all' as const)
    const sessionEngagementFilter = computed(() => 'all' as const)
    const selectedSpaceId = ref('!space:server')

    const emptyDescription = useWorkbenchEmptyDescription({
      t,
      searchKeyword,
      sessionTypeFilter,
      sessionEngagementFilter,
      selectedSpaceId
    })

    expect(emptyDescription.value).toBe('space.empty_filtered_sessions')
  })
})
