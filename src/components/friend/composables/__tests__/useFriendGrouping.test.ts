import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { OnlineEnum } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'

const { useFriendsMock, groupsMock, groupMembersMock } = vi.hoisted(() => ({
  useFriendsMock: {
    getFriendGroups: vi.fn(),
    getFriendsInGroup: vi.fn()
  },
  groupsMock: [
    { group_id: 'group-1', name: 'Design Team', member_count: 2 },
    { group_id: 'group-2', name: 'Backend Guild', member_count: 1 }
  ],
  groupMembersMock: {
    'group-1': [{ user_id: '@alice:example.com' }, { user_id: '@bob:example.com' }],
    'group-2': [{ user_id: '@charlie:example.com' }]
  } as Record<string, Array<{ user_id: string }>>
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'friend.group.section.favorite') return '星标好友'
      if (key === 'friend.group.section.ungrouped') return '未分组'
      if (key === 'friend.group.section.count') return `${params?.count ?? 0}`
      return key
    }
  })
}))

vi.mock('@/composables/useFriends', () => ({
  useFriends: () => useFriendsMock
}))

import { useFriendGrouping } from '../useFriendGrouping'

const makeContact = (overrides: Partial<MatrixContact> = {}): MatrixContact => ({
  userId: '@user:example.com',
  displayName: 'User',
  avatarUrl: null,
  uid: '@user:example.com',
  name: 'user',
  account: 'user',
  avatar: '',
  activeStatus: OnlineEnum.OFFLINE,
  remark: '',
  lastOptTime: 0,
  hideMyPosts: false,
  hideTheirPosts: false,
  ...overrides
})

describe('useFriendGrouping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFriendsMock.getFriendGroups.mockResolvedValue(groupsMock)
    useFriendsMock.getFriendsInGroup.mockImplementation((groupId: string) => {
      return Promise.resolve(groupMembersMock[groupId] ?? [])
    })
  })

  describe('loadGroups', () => {
    it('fetches groups and builds user-group mapping', async () => {
      const { loadGroups, groups, isLoadingGroups } = useFriendGrouping()

      expect(isLoadingGroups.value).toBe(false)

      const promise = loadGroups()
      expect(isLoadingGroups.value).toBe(true)

      await promise

      expect(isLoadingGroups.value).toBe(false)
      expect(groups.value).toHaveLength(2)
      expect(useFriendsMock.getFriendGroups).toHaveBeenCalledTimes(1)
      expect(useFriendsMock.getFriendsInGroup).toHaveBeenCalledWith('group-1')
      expect(useFriendsMock.getFriendsInGroup).toHaveBeenCalledWith('group-2')
    })

    it('gracefully handles load failure by falling back to empty groups', async () => {
      useFriendsMock.getFriendGroups.mockRejectedValueOnce(new Error('network'))

      const { loadGroups, groups, isLoadingGroups } = useFriendGrouping()
      await loadGroups()

      expect(groups.value).toHaveLength(0)
      expect(isLoadingGroups.value).toBe(false)
    })

    it('handles getFriendsInGroup failure for a single group without failing all', async () => {
      useFriendsMock.getFriendsInGroup.mockImplementation((groupId: string) => {
        if (groupId === 'group-1') return Promise.reject(new Error('timeout'))
        return Promise.resolve(groupMembersMock[groupId] ?? [])
      })

      const { loadGroups, groups } = useFriendGrouping()
      await loadGroups()

      expect(groups.value).toHaveLength(2)
    })
  })

  describe('groupFriends', () => {
    it('returns empty sections when no friends provided', async () => {
      const { loadGroups, groupFriends } = useFriendGrouping()
      await loadGroups()

      const sections = groupFriends([])
      expect(sections).toHaveLength(0)
    })

    it('places favorite friends in a dedicated section at top', async () => {
      const friends = [
        makeContact({ userId: '@alice:example.com', name: 'Alice', friendStatus: 'favorite' }),
        makeContact({ userId: '@dave:example.com', name: 'Dave', friendStatus: 'normal' })
      ]

      const { loadGroups, groupFriends } = useFriendGrouping()
      await loadGroups()

      const sections = groupFriends(friends)

      expect(sections[0].groupId).toBe('__favorite__')
      expect(sections[0].isFavorite).toBe(true)
      expect(sections[0].friends).toHaveLength(1)
      expect(sections[0].friends[0]?.userId).toBe('@alice:example.com')
    })

    it('assigns non-favorite friends to their custom groups', async () => {
      const friends = [
        makeContact({ userId: '@alice:example.com', name: 'Alice', friendStatus: 'normal' }),
        makeContact({ userId: '@charlie:example.com', name: 'Charlie', friendStatus: 'normal' })
      ]

      const { loadGroups, groupFriends } = useFriendGrouping()
      await loadGroups()

      const sections = groupFriends(friends)

      const designSection = sections.find((s) => s.groupId === 'group-1')
      expect(designSection).toBeTruthy()
      expect(designSection?.friends).toHaveLength(1)
      expect(designSection?.friends[0]?.userId).toBe('@alice:example.com')

      const backendSection = sections.find((s) => s.groupId === 'group-2')
      expect(backendSection).toBeTruthy()
      expect(backendSection?.friends).toHaveLength(1)
      expect(backendSection?.friends[0]?.userId).toBe('@charlie:example.com')
    })

    it('puts non-favorite friends without a group into ungrouped section', async () => {
      const friends = [
        makeContact({ userId: '@alice:example.com', name: 'Alice', friendStatus: 'normal' }),
        makeContact({ userId: '@eve:example.com', name: 'Eve', friendStatus: 'normal' })
      ]

      const { loadGroups, groupFriends } = useFriendGrouping()
      await loadGroups()

      const sections = groupFriends(friends)

      const ungroupedSection = sections.find((s) => s.groupId === '__ungrouped__')
      expect(ungroupedSection).toBeTruthy()
      expect(ungroupedSection?.isUngrouped).toBe(true)
      expect(ungroupedSection?.friends).toHaveLength(1)
      expect(ungroupedSection?.friends[0]?.userId).toBe('@eve:example.com')
    })

    it('favorite section always appears first, then custom groups, then ungrouped', async () => {
      const friends = [
        makeContact({ userId: '@eve:example.com', name: 'Eve', friendStatus: 'normal' }),
        makeContact({ userId: '@alice:example.com', name: 'Alice', friendStatus: 'favorite' }),
        makeContact({ userId: '@charlie:example.com', name: 'Charlie', friendStatus: 'normal' }),
        makeContact({ userId: '@bob:example.com', name: 'Bob', friendStatus: 'normal' })
      ]

      const { loadGroups, groupFriends } = useFriendGrouping()
      await loadGroups()

      const sections = groupFriends(friends)

      expect(sections[0]?.groupId).toBe('__favorite__')
      const customGroupIndices = sections.filter((s) => !s.isFavorite && !s.isUngrouped).map((s) => sections.indexOf(s))
      const ungroupedIndex = sections.findIndex((s) => s.isUngrouped)

      for (const idx of customGroupIndices) {
        expect(idx).toBeGreaterThan(0)
        if (ungroupedIndex >= 0) {
          expect(idx).toBeLessThan(ungroupedIndex)
        }
      }
    })

    it('excludes favorite friends from custom groups to avoid duplication', async () => {
      const friends = [makeContact({ userId: '@alice:example.com', name: 'Alice', friendStatus: 'favorite' })]

      const { loadGroups, groupFriends } = useFriendGrouping()
      await loadGroups()

      const sections = groupFriends(friends)

      const designSection = sections.find((s) => s.groupId === 'group-1')
      expect(designSection).toBeFalsy()

      expect(sections[0]?.groupId).toBe('__favorite__')
      expect(sections[0]?.friends[0]?.userId).toBe('@alice:example.com')
    })

    it('does not include empty sections', async () => {
      const friends = [makeContact({ userId: '@alice:example.com', name: 'Alice', friendStatus: 'normal' })]

      const { loadGroups, groupFriends } = useFriendGrouping()
      await loadGroups()

      const sections = groupFriends(friends)

      for (const section of sections) {
        expect(section.friends.length).toBeGreaterThan(0)
      }
    })
  })

  describe('shouldGroup', () => {
    it('returns false before groups are loaded', () => {
      const friends = ref<MatrixContact[]>([makeContact({ userId: '@alice:example.com', friendStatus: 'favorite' })])
      const { shouldGroup } = useFriendGrouping({ friends })

      expect(shouldGroup.value).toBe(false)
    })

    it('returns true when groups are loaded and there are custom groups', async () => {
      const friends = ref<MatrixContact[]>([makeContact({ userId: '@alice:example.com', friendStatus: 'normal' })])
      const { loadGroups, shouldGroup } = useFriendGrouping({ friends })
      await loadGroups()

      expect(shouldGroup.value).toBe(true)
    })

    it('returns true when groups are loaded and there are favorite friends', async () => {
      useFriendsMock.getFriendGroups.mockResolvedValue([])
      const friends = ref<MatrixContact[]>([makeContact({ userId: '@alice:example.com', friendStatus: 'favorite' })])
      const { loadGroups, shouldGroup } = useFriendGrouping({ friends })
      await loadGroups()

      expect(shouldGroup.value).toBe(true)
    })

    it('returns false when no groups and no favorites', async () => {
      useFriendsMock.getFriendGroups.mockResolvedValue([])
      const friends = ref<MatrixContact[]>([makeContact({ userId: '@alice:example.com', friendStatus: 'normal' })])
      const { loadGroups, shouldGroup } = useFriendGrouping({ friends })
      await loadGroups()

      expect(shouldGroup.value).toBe(false)
    })
  })

  describe('collapse management', () => {
    it('toggles collapsed state for a group', async () => {
      const { loadGroups, isCollapsed, toggleCollapse } = useFriendGrouping()
      await loadGroups()

      expect(isCollapsed('group-1')).toBe(false)

      toggleCollapse('group-1')
      expect(isCollapsed('group-1')).toBe(true)

      toggleCollapse('group-1')
      expect(isCollapsed('group-1')).toBe(false)
    })

    it('persists collapsed state independently per group', async () => {
      const { loadGroups, isCollapsed, toggleCollapse } = useFriendGrouping()
      await loadGroups()

      toggleCollapse('group-1')
      expect(isCollapsed('group-1')).toBe(true)
      expect(isCollapsed('group-2')).toBe(false)
    })
  })

  describe('groupedSections computed', () => {
    it('provides reactive grouped sections from a friends ref', async () => {
      const friends = ref<MatrixContact[]>([
        makeContact({ userId: '@alice:example.com', name: 'Alice', friendStatus: 'favorite' }),
        makeContact({ userId: '@bob:example.com', name: 'Bob', friendStatus: 'normal' }),
        makeContact({ userId: '@eve:example.com', name: 'Eve', friendStatus: 'normal' })
      ])

      const { loadGroups, groupedSections } = useFriendGrouping({ friends })
      await loadGroups()

      const sections = groupedSections.value
      expect(sections[0]?.groupId).toBe('__favorite__')
      expect(sections[0]?.friends[0]?.userId).toBe('@alice:example.com')

      const ungroupedSection = sections.find((s) => s.groupId === '__ungrouped__')
      expect(ungroupedSection?.friends[0]?.userId).toBe('@eve:example.com')
    })

    it('updates sections reactively when friends list changes', async () => {
      const friends = ref<MatrixContact[]>([
        makeContact({ userId: '@alice:example.com', name: 'Alice', friendStatus: 'favorite' })
      ])

      const { loadGroups, groupedSections } = useFriendGrouping({ friends })
      await loadGroups()

      expect(groupedSections.value[0]?.friends).toHaveLength(1)

      friends.value.push(makeContact({ userId: '@bob:example.com', name: 'Bob', friendStatus: 'favorite' }))
      expect(groupedSections.value[0]?.friends).toHaveLength(2)
    })
  })
})
