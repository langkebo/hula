import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import { useMessageSessionFilters } from '../useMessageSessionFilters'

describe('useMessageSessionFilters', () => {
  it('keeps recent ordering by default and supports local keyword and type filters', () => {
    const sourceSessions = ref([
      { roomId: '!group:server', name: '项目群', type: RoomTypeEnum.GROUP, lastMsg: '版本更新' },
      { roomId: '!single:server', name: 'Alice', type: RoomTypeEnum.SINGLE, lastMsg: 'hello world' }
    ])

    const api = useMessageSessionFilters(sourceSessions)

    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!group:server', '!single:server'])

    api.setSearchKeyword('alice')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!single:server'])

    api.setSearchKeyword('')
    api.setSessionTypeFilter('group')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!group:server'])
  })

  it('sorts by pinned first then localized name when name sort is selected', () => {
    const sourceSessions = ref([
      { roomId: '!gamma:server', name: 'Gamma', type: RoomTypeEnum.GROUP },
      { roomId: '!alpha:server', name: 'Alpha', type: RoomTypeEnum.GROUP, top: true },
      { roomId: '!beta:server', name: 'Beta', type: RoomTypeEnum.GROUP }
    ])

    const api = useMessageSessionFilters(sourceSessions)
    api.setSessionSort('name')

    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual([
      '!alpha:server',
      '!beta:server',
      '!gamma:server'
    ])
  })

  it('clears incompatible local filters when ensuring a hidden session becomes visible', () => {
    const sourceSessions = computed(() => [
      { roomId: '!group:server', name: '项目群', type: RoomTypeEnum.GROUP, lastMsg: '版本更新' },
      { roomId: '!single:server', name: 'Alice', type: RoomTypeEnum.SINGLE, lastMsg: 'hello world' }
    ])

    const api = useMessageSessionFilters(sourceSessions)
    api.setSearchKeyword('项目')
    api.setSessionTypeFilter('group')

    api.ensureSessionVisible('!single:server')

    expect(api.searchKeyword.value).toBe('')
    expect(api.sessionTypeFilter.value).toBe('all')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!group:server', '!single:server'])
  })
})
