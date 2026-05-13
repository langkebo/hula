import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
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

  it('filters by unread / mention / invite engagement axes', () => {
    const sourceSessions = ref([
      {
        roomId: '!quiet:server',
        name: 'Quiet',
        type: RoomTypeEnum.GROUP,
        unreadCount: 0,
        highlightCount: 0
      },
      {
        roomId: '!unread:server',
        name: 'Unread',
        type: RoomTypeEnum.GROUP,
        unreadCount: 3,
        highlightCount: 0
      },
      {
        roomId: '!mention:server',
        name: 'Mention',
        type: RoomTypeEnum.GROUP,
        unreadCount: 5,
        highlightCount: 2
      },
      {
        roomId: '!invite:server',
        name: 'Invite',
        type: RoomTypeEnum.SINGLE,
        unreadCount: 0,
        highlightCount: 0,
        isInvite: true
      }
    ])

    const api = useMessageSessionFilters(sourceSessions)
    expect(api.filteredSessionList.value).toHaveLength(4)

    api.setSessionEngagementFilter('unread')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!unread:server', '!mention:server'])

    api.setSessionEngagementFilter('mention')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!mention:server'])

    api.setSessionEngagementFilter('invite')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!invite:server'])

    api.setSessionEngagementFilter('all')
    expect(api.filteredSessionList.value).toHaveLength(4)
  })

  it('relaxes engagement filter when ensuring a hidden session becomes visible', () => {
    const sourceSessions = ref([
      { roomId: '!a:server', name: 'A', type: RoomTypeEnum.GROUP, unreadCount: 5, highlightCount: 1 },
      { roomId: '!b:server', name: 'B', type: RoomTypeEnum.GROUP, unreadCount: 0, highlightCount: 0 }
    ])

    const api = useMessageSessionFilters(sourceSessions)
    api.setSessionEngagementFilter('mention')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!a:server'])

    api.ensureSessionVisible('!b:server')

    expect(api.sessionEngagementFilter.value).toBe('all')
    expect(api.filteredSessionList.value.map((item) => item.roomId)).toEqual(['!a:server', '!b:server'])
  })
})
