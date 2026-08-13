import { describe, expect, it, vi } from 'vitest'
import type { Room } from '../../sdk'
import type { Space as SdkSpace } from '../../sdk-compat'
import { getSpaceChildIds, normalizeSpaceTreePathItems, roomToSpaceInfo, sdkSpaceToSpaceInfo } from '../spaceHelpers'

describe('spaceHelpers', () => {
  describe('sdkSpaceToSpaceInfo', () => {
    it('converts all fields from SdkSpace to SpaceInfo', () => {
      const space = {
        space_id: '!space1:server',
        name: 'My Space',
        topic: 'Space topic',
        avatar_url: 'mxc://server/avatar1'
      } as unknown as SdkSpace

      const result = sdkSpaceToSpaceInfo(space)

      expect(result).toEqual({
        spaceId: '!space1:server',
        name: 'My Space',
        topic: 'Space topic',
        avatarUrl: 'mxc://server/avatar1',
        memberCount: 0,
        childCount: 0
      })
    })

    it('uses empty string for missing name', () => {
      const space = {
        space_id: '!space2:server',
        name: undefined,
        topic: 'topic',
        avatar_url: 'mxc://server/avatar'
      } as unknown as SdkSpace

      const result = sdkSpaceToSpaceInfo(space)

      expect(result.name).toBe('')
    })

    it('uses empty string for empty name', () => {
      const space = {
        space_id: '!space3:server',
        name: '',
        topic: 'topic',
        avatar_url: 'mxc://server/avatar'
      } as unknown as SdkSpace

      const result = sdkSpaceToSpaceInfo(space)

      expect(result.name).toBe('')
    })

    it('uses undefined for missing topic', () => {
      const space = {
        space_id: '!space4:server',
        name: 'Name',
        topic: undefined,
        avatar_url: 'mxc://server/avatar'
      } as unknown as SdkSpace

      const result = sdkSpaceToSpaceInfo(space)

      expect(result.topic).toBeUndefined()
    })

    it('uses undefined for empty topic', () => {
      const space = {
        space_id: '!space5:server',
        name: 'Name',
        topic: '',
        avatar_url: 'mxc://server/avatar'
      } as unknown as SdkSpace

      const result = sdkSpaceToSpaceInfo(space)

      expect(result.topic).toBeUndefined()
    })

    it('uses undefined for missing avatar_url', () => {
      const space = {
        space_id: '!space6:server',
        name: 'Name',
        topic: 'topic',
        avatar_url: undefined
      } as unknown as SdkSpace

      const result = sdkSpaceToSpaceInfo(space)

      expect(result.avatarUrl).toBeUndefined()
    })

    it('uses undefined for empty avatar_url', () => {
      const space = {
        space_id: '!space7:server',
        name: 'Name',
        topic: 'topic',
        avatar_url: ''
      } as unknown as SdkSpace

      const result = sdkSpaceToSpaceInfo(space)

      expect(result.avatarUrl).toBeUndefined()
    })

    it('sets memberCount and childCount to 0', () => {
      const space = {
        space_id: '!space8:server',
        name: 'Name',
        topic: 'topic',
        avatar_url: 'mxc://server/avatar'
      } as unknown as SdkSpace

      const result = sdkSpaceToSpaceInfo(space)

      expect(result.memberCount).toBe(0)
      expect(result.childCount).toBe(0)
    })

    it('handles all fields missing except space_id', () => {
      const space = {
        space_id: '!space9:server'
      } as unknown as SdkSpace

      const result = sdkSpaceToSpaceInfo(space)

      expect(result).toEqual({
        spaceId: '!space9:server',
        name: '',
        topic: undefined,
        avatarUrl: undefined,
        memberCount: 0,
        childCount: 0
      })
    })
  })

  describe('roomToSpaceInfo', () => {
    it('converts roomId to spaceId', () => {
      const room = {
        roomId: '!room1:server',
        name: 'Name',
        topic: 'topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue(''),
        getJoinedMembers: vi.fn().mockReturnValue([])
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue([])

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result.spaceId).toBe('!room1:server')
    })

    it('uses room.name for name', () => {
      const room = {
        roomId: '!room2:server',
        name: 'Room Name',
        topic: 'topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue(''),
        getJoinedMembers: vi.fn().mockReturnValue([])
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue([])

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result.name).toBe('Room Name')
    })

    it('uses empty string for missing name', () => {
      const room = {
        roomId: '!room3:server',
        name: '',
        topic: 'topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue(''),
        getJoinedMembers: vi.fn().mockReturnValue([])
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue([])

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result.name).toBe('')
    })

    it('uses room.topic for topic', () => {
      const room = {
        roomId: '!room4:server',
        name: 'Name',
        topic: 'Room Topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue(''),
        getJoinedMembers: vi.fn().mockReturnValue([])
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue([])

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result.topic).toBe('Room Topic')
    })

    it('uses undefined for empty topic', () => {
      const room = {
        roomId: '!room5:server',
        name: 'Name',
        topic: '',
        getMxcAvatarUrl: vi.fn().mockReturnValue(''),
        getJoinedMembers: vi.fn().mockReturnValue([])
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue([])

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result.topic).toBeUndefined()
    })

    it('uses getMxcAvatarUrl for avatarUrl', () => {
      const room = {
        roomId: '!room6:server',
        name: 'Name',
        topic: 'topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue('mxc://server/avatar'),
        getJoinedMembers: vi.fn().mockReturnValue([])
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue([])

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result.avatarUrl).toBe('mxc://server/avatar')
      expect(room.getMxcAvatarUrl).toHaveBeenCalledOnce()
    })

    it('uses undefined for empty avatarUrl from getMxcAvatarUrl', () => {
      const room = {
        roomId: '!room7:server',
        name: 'Name',
        topic: 'topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue(''),
        getJoinedMembers: vi.fn().mockReturnValue([])
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue([])

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result.avatarUrl).toBeUndefined()
    })

    it('uses getJoinedMembers().length for memberCount', () => {
      const members = [{}, {}, {}]
      const room = {
        roomId: '!room8:server',
        name: 'Name',
        topic: 'topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue(''),
        getJoinedMembers: vi.fn().mockReturnValue(members)
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue([])

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result.memberCount).toBe(3)
      expect(room.getJoinedMembers).toHaveBeenCalledOnce()
    })

    it('uses getSpaceChildIds callback for childCount', () => {
      const childIds = ['!child1:server', '!child2:server', '!child3:server']
      const room = {
        roomId: '!room9:server',
        name: 'Name',
        topic: 'topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue(''),
        getJoinedMembers: vi.fn().mockReturnValue([])
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue(childIds)

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result.childCount).toBe(3)
      expect(getSpaceChildIdsMock).toHaveBeenCalledWith(room)
    })

    it('converts all fields correctly together', () => {
      const members = [{}, {}]
      const childIds = ['!child1:server']
      const room = {
        roomId: '!room10:server',
        name: 'Full Room',
        topic: 'Full Topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue('mxc://server/full'),
        getJoinedMembers: vi.fn().mockReturnValue(members)
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue(childIds)

      const result = roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(result).toEqual({
        spaceId: '!room10:server',
        name: 'Full Room',
        topic: 'Full Topic',
        avatarUrl: 'mxc://server/full',
        memberCount: 2,
        childCount: 1
      })
    })

    it('passes room to getSpaceChildIds callback', () => {
      const room = {
        roomId: '!room11:server',
        name: 'Name',
        topic: 'topic',
        getMxcAvatarUrl: vi.fn().mockReturnValue(''),
        getJoinedMembers: vi.fn().mockReturnValue([])
      } as unknown as Room
      const getSpaceChildIdsMock = vi.fn().mockReturnValue([])

      roomToSpaceInfo(room, getSpaceChildIdsMock)

      expect(getSpaceChildIdsMock).toHaveBeenCalledWith(room)
    })
  })

  describe('getSpaceChildIds', () => {
    it('extracts state keys from m.space.child events', () => {
      const childEvents = [
        { getStateKey: () => '!child1:server' },
        { getStateKey: () => '!child2:server' },
        { getStateKey: () => '!child3:server' }
      ]
      const room = {
        currentState: {
          getStateEvents: vi.fn().mockReturnValue(childEvents)
        }
      } as unknown as Room

      const result = getSpaceChildIds(room)

      expect(result).toEqual(['!child1:server', '!child2:server', '!child3:server'])
      expect(room.currentState.getStateEvents).toHaveBeenCalledWith('m.space.child')
    })

    it('filters out null state keys', () => {
      const childEvents = [
        { getStateKey: () => '!child1:server' },
        { getStateKey: () => null },
        { getStateKey: () => '!child3:server' }
      ]
      const room = {
        currentState: {
          getStateEvents: vi.fn().mockReturnValue(childEvents)
        }
      } as unknown as Room

      const result = getSpaceChildIds(room)

      expect(result).toEqual(['!child1:server', '!child3:server'])
    })

    it('filters out empty string state keys', () => {
      const childEvents = [
        { getStateKey: () => '!child1:server' },
        { getStateKey: () => '' },
        { getStateKey: () => '!child3:server' }
      ]
      const room = {
        currentState: {
          getStateEvents: vi.fn().mockReturnValue(childEvents)
        }
      } as unknown as Room

      const result = getSpaceChildIds(room)

      expect(result).toEqual(['!child1:server', '!child3:server'])
    })

    it('handles empty events array', () => {
      const room = {
        currentState: {
          getStateEvents: vi.fn().mockReturnValue([])
        }
      } as unknown as Room

      const result = getSpaceChildIds(room)

      expect(result).toEqual([])
    })

    it('returns empty array when all keys are null', () => {
      const childEvents = [{ getStateKey: () => null }, { getStateKey: () => null }]
      const room = {
        currentState: {
          getStateEvents: vi.fn().mockReturnValue(childEvents)
        }
      } as unknown as Room

      const result = getSpaceChildIds(room)

      expect(result).toEqual([])
    })

    it('returns empty array when all keys are empty strings', () => {
      const childEvents = [{ getStateKey: () => '' }, { getStateKey: () => '' }]
      const room = {
        currentState: {
          getStateEvents: vi.fn().mockReturnValue(childEvents)
        }
      } as unknown as Room

      const result = getSpaceChildIds(room)

      expect(result).toEqual([])
    })

    it('preserves order of child events', () => {
      const childEvents = [
        { getStateKey: () => '!child3:server' },
        { getStateKey: () => '!child1:server' },
        { getStateKey: () => '!child2:server' }
      ]
      const room = {
        currentState: {
          getStateEvents: vi.fn().mockReturnValue(childEvents)
        }
      } as unknown as Room

      const result = getSpaceChildIds(room)

      expect(result).toEqual(['!child3:server', '!child1:server', '!child2:server'])
    })

    it('calls getStateEvents with m.space.child event type', () => {
      const room = {
        currentState: {
          getStateEvents: vi.fn().mockReturnValue([])
        }
      } as unknown as Room

      getSpaceChildIds(room)

      expect(room.currentState.getStateEvents).toHaveBeenCalledWith('m.space.child')
    })
  })

  describe('normalizeSpaceTreePathItems', () => {
    it('deduplicates items by space_id', () => {
      const items = [
        { space_id: '!space1:server', name: 'Space One' },
        { space_id: '!space2:server', name: 'Space Two' },
        { space_id: '!space1:server', name: 'Space One Duplicate' }
      ]

      const result = normalizeSpaceTreePathItems(items)

      expect(result).toEqual([
        { space_id: '!space1:server', name: 'Space One' },
        { space_id: '!space2:server', name: 'Space Two' }
      ])
    })

    it('skips items without space_id', () => {
      const items = [
        { space_id: '!space1:server', name: 'Space One' },
        { space_id: '', name: 'Empty Space' },
        { space_id: '!space2:server', name: 'Space Two' }
      ]

      const result = normalizeSpaceTreePathItems(items)

      expect(result).toEqual([
        { space_id: '!space1:server', name: 'Space One' },
        { space_id: '!space2:server', name: 'Space Two' }
      ])
    })

    it('uses empty string for missing name', () => {
      const items = [{ space_id: '!space1:server', name: '' }]

      const result = normalizeSpaceTreePathItems(items)

      expect(result).toEqual([{ space_id: '!space1:server', name: '' }])
    })

    it('uses empty string for undefined name', () => {
      const items = [{ space_id: '!space1:server', name: undefined as unknown as string }]

      const result = normalizeSpaceTreePathItems(items)

      expect(result).toEqual([{ space_id: '!space1:server', name: '' }])
    })

    it('preserves order of first occurrence', () => {
      const items = [
        { space_id: '!space3:server', name: 'Three' },
        { space_id: '!space1:server', name: 'One' },
        { space_id: '!space2:server', name: 'Two' },
        { space_id: '!space1:server', name: 'One Dup' },
        { space_id: '!space3:server', name: 'Three Dup' }
      ]

      const result = normalizeSpaceTreePathItems(items)

      expect(result).toEqual([
        { space_id: '!space3:server', name: 'Three' },
        { space_id: '!space1:server', name: 'One' },
        { space_id: '!space2:server', name: 'Two' }
      ])
    })

    it('handles empty input array', () => {
      const result = normalizeSpaceTreePathItems([])

      expect(result).toEqual([])
    })

    it('handles array with only items missing space_id', () => {
      const items = [
        { space_id: '', name: 'Empty 1' },
        { space_id: '', name: 'Empty 2' }
      ]

      const result = normalizeSpaceTreePathItems(items)

      expect(result).toEqual([])
    })

    it('returns new array without mutating input', () => {
      const items = [{ space_id: '!space1:server', name: 'Space One' }]

      const result = normalizeSpaceTreePathItems(items)

      expect(result).not.toBe(items)
      expect(items).toEqual([{ space_id: '!space1:server', name: 'Space One' }])
    })

    it('handles all duplicates of the same space_id', () => {
      const items = [
        { space_id: '!space1:server', name: 'First' },
        { space_id: '!space1:server', name: 'Second' },
        { space_id: '!space1:server', name: 'Third' }
      ]

      const result = normalizeSpaceTreePathItems(items)

      expect(result).toEqual([{ space_id: '!space1:server', name: 'First' }])
    })

    it('keeps first occurrence when duplicates exist', () => {
      const items = [
        { space_id: '!space1:server', name: 'First Name' },
        { space_id: '!space1:server', name: 'Second Name' }
      ]

      const result = normalizeSpaceTreePathItems(items)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('First Name')
    })
  })
})
