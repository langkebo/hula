import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, unref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WORKBENCH_SESSION_SORTS, WORKBENCH_SESSION_TYPE_FILTERS } from '@/router/spaceNavigation'
import { RoomTypeEnum } from '@/enums'
import RoomSpaceActionBar from '../RoomSpaceActionBar.vue'
import RoomSpaceToolbar from '../RoomSpaceToolbar.vue'
import SpaceListPane from '../SpaceListPane.vue'
import WorkbenchDetailPane from '../WorkbenchDetailPane.vue'

const { groupStoreMock, announcementStoreMock, openLinkMock, spaceRoomsMock, createWebviewWindowMock } = vi.hoisted(
  () => ({
    groupStoreMock: {
      loadGroupInfo: vi.fn(),
      loadRoomMembers: vi.fn(),
      getGroupDetailByRoomId: vi.fn(),
      getMembersByRoomId: vi.fn()
    },
    announcementStoreMock: {
      announcementContent: '',
      announList: [] as Array<{ id: string; content: string }>,
      announError: false,
      isAddAnnoun: false,
      loadGroupAnnouncements: vi.fn()
    },
    openLinkMock: vi.fn(),
    createWebviewWindowMock: vi.fn(),
    spaceRoomsMock: {
      rooms: null as { value: Array<{ roomId: string; name: string; avatarUrl?: string }> } | null,
      loading: null as { value: boolean } | null,
      error: null as { value: string | null } | null,
      load: vi.fn()
    }
  })
)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: number }) => {
      if (key === 'space.sessions_count') {
        return `${params?.count ?? 0} 个会话`
      }

      return key
    }
  })
}))

vi.mock('naive-ui', async () => {
  const passthroughStub = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NFlex: passthroughStub('NFlex'),
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: {
          type: Boolean,
          default: false
        }
      },
      emits: ['update:show'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': 'NModal' }, slots.default?.()) : null)
      }
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      props: {
        show: {
          type: Boolean,
          default: false
        }
      },
      setup(props, { slots }) {
        return () => h('div', { 'data-test': 'NSpin', 'data-show': String(props.show) }, slots.default?.())
      }
    }),
    NScrollbar: passthroughStub('NScrollbar'),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: ''
        },
        placeholder: {
          type: String,
          default: ''
        }
      },
      emits: ['update:value'],
      setup(props, { emit, slots }) {
        return () =>
          h('label', { 'data-test': 'NInput' }, [
            slots.prefix?.(),
            h('input', {
              value: props.value,
              placeholder: props.placeholder,
              onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
            })
          ])
      }
    }),
    NSelect: defineComponent({
      name: 'NSelect',
      props: {
        value: {
          type: String,
          default: ''
        },
        options: {
          type: Array,
          default: () => []
        }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h(
            'select',
            {
              'data-test': 'NSelect',
              value: props.value,
              onChange: (event: Event) => emit('update:value', (event.target as HTMLSelectElement).value)
            },
            (props.options as Array<{ label: string; value: string }>).map((option) =>
              h('option', { key: option.value, value: option.value }, option.label)
            )
          )
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: {
        disabled: {
          type: Boolean,
          default: false
        }
      },
      emits: ['click'],
      setup(props, { emit, slots }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              disabled: props.disabled,
              onClick: () => {
                if (!props.disabled) {
                  emit('click')
                }
              }
            },
            [...(slots.icon?.() ?? []), ...(slots.default?.() ?? [])]
          )
      }
    })
  }
})

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStoreMock
}))

vi.mock('@/stores/domains/chat/announcement', () => ({
  useAnnouncementStore: () => announcementStoreMock
}))

vi.mock('@/hooks/useWindow', () => ({
  createWebviewWindow: createWebviewWindowMock
}))

vi.mock('@/components/room/MemberList.vue', () => ({
  default: defineComponent({
    name: 'MemberListStub',
    props: {
      members: {
        type: Array,
        default: () => []
      }
    },
    setup(props) {
      return () =>
        h(
          'div',
          { 'data-test': 'member-list-stub' },
          (props.members as Array<{ displayName?: string; name?: string; userId: string }>).map((member) =>
            h('span', { key: member.userId }, member.displayName || member.name || member.userId)
          )
        )
    }
  })
}))

vi.mock('@/components/common/InfoPopover.vue', () => ({
  default: defineComponent({
    name: 'InfoPopoverStub',
    props: {
      uid: {
        type: String,
        default: ''
      }
    },
    setup(props) {
      return () => h('div', { 'data-test': 'info-popover-stub' }, props.uid)
    }
  })
}))

vi.mock('@/composables/space/useSpaceRooms', async () => {
  const { ref } = await import('vue')

  spaceRoomsMock.rooms ??= ref([])
  spaceRoomsMock.loading ??= ref(false)
  spaceRoomsMock.error ??= ref(null)

  return {
    useSpaceRooms: () => ({
      rooms: spaceRoomsMock.rooms,
      loading: spaceRoomsMock.loading,
      mutating: ref(false),
      error: spaceRoomsMock.error,
      load: spaceRoomsMock.load,
      addRoom: vi.fn(),
      removeRoom: vi.fn()
    })
  }
})

vi.mock('@/hooks/useLinkSegments', () => ({
  useLinkSegments: (source: string | { value?: string }) => ({
    segments: computed(() => {
      const text = String(unref(source as never) ?? '')
      if (!text) return []

      const match = text.match(/https?:\/\/\S+/)
      if (!match) {
        return [{ text, isLink: false }]
      }

      const url = match[0]
      const start = match.index ?? 0
      const segments: Array<{ text: string; isLink: boolean }> = []

      if (start > 0) {
        segments.push({ text: text.slice(0, start), isLink: false })
      }

      segments.push({ text: url, isLink: true })

      if (start + url.length < text.length) {
        segments.push({ text: text.slice(start + url.length), isLink: false })
      }

      return segments
    }),
    openLink: openLinkMock
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value?: string) => value || 'avatar.png'
  }
}))

describe('SpaceListPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders localized all sessions entry and emits space selection', async () => {
    const wrapper = mount(SpaceListPane, {
      props: {
        spaces: [
          { spaceId: 'space-1', name: 'Space One', childCount: 2 },
          { spaceId: 'space-2', name: 'Space Two', childCount: 5 }
        ],
        selectedSpaceId: 'space-2',
        loading: true,
        totalCount: 9
      }
    })

    const buttons = wrapper.findAll('button')

    expect(wrapper.text()).toContain('space.title')
    expect(wrapper.text()).toContain('space.all_sessions')
    expect(wrapper.text()).toContain('Space Two')
    expect(wrapper.get('[data-test="NSpin"]').attributes('data-show')).toBe('true')
    expect(buttons[0].classes()).not.toContain('space-item--active')
    expect(buttons[2].classes()).toContain('space-item--active')

    await buttons[0].trigger('click')
    await buttons[2].trigger('click')

    expect(wrapper.emitted('selectSpace')).toEqual([[''], ['space-2']])
  })
})

describe('RoomSpaceToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders localized placeholder and emits search/create actions', async () => {
    const wrapper = mount(RoomSpaceToolbar, {
      props: {
        searchKeyword: 'alpha',
        sessionTypeFilter: WORKBENCH_SESSION_TYPE_FILTERS.all,
        sessionSort: WORKBENCH_SESSION_SORTS.recent,
        filteredCount: 2,
        totalCount: 7
      }
    })

    const input = wrapper.get('input')
    const buttons = wrapper.findAll('button')

    expect(input.attributes('placeholder')).toBe('space.search_sessions_placeholder')
    expect(input.element.value).toBe('alpha')
    expect(wrapper.text()).toContain('space.create')
    expect(wrapper.text()).toContain('2/7')
    expect(wrapper.text()).toContain('space.filter_all')
    expect(wrapper.text()).toContain('space.sort_recent')
    expect(wrapper.text()).toContain('space.sort_summary_recent')

    await input.setValue('beta')
    await buttons[0].trigger('click')
    await wrapper.get('[data-test="session-type-group"]').trigger('click')
    await wrapper.get('[data-test="session-sort-name"]').trigger('click')

    expect(wrapper.emitted('update:searchKeyword')).toEqual([['beta']])
    expect(wrapper.emitted('update:sessionTypeFilter')).toEqual([['group']])
    expect(wrapper.emitted('update:sessionSort')).toEqual([['name']])
    expect(wrapper.emitted('createSpace')).toEqual([[]])
  })
})

describe('RoomSpaceActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders localized count summary and emits toolbar actions', async () => {
    const wrapper = mount(RoomSpaceActionBar, {
      props: {
        spaceName: 'Space One',
        roomCount: 4,
        sessionCount: 6,
        canManageSpace: true
      }
    })

    const buttons = wrapper.findAll('button')

    expect(wrapper.text()).toContain('Space One')
    expect(wrapper.text()).toContain('4 space.rooms · 6 个会话')
    expect(wrapper.text()).toContain('space.invite')
    expect(wrapper.text()).toContain('space.add_room')
    expect(wrapper.text()).toContain('space.settings')

    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')

    expect(wrapper.emitted('invite')).toEqual([[]])
    expect(wrapper.emitted('addRoom')).toEqual([[]])
    expect(wrapper.emitted('settings')).toEqual([[]])
  })

  it('disables action buttons and blocks emits without manage permission', async () => {
    const wrapper = mount(RoomSpaceActionBar, {
      props: {
        spaceName: 'Space One',
        roomCount: 4,
        sessionCount: 6,
        canManageSpace: false
      }
    })

    const buttons = wrapper.findAll('button')

    expect(buttons).toHaveLength(3)
    buttons.forEach((button) => {
      expect(button.attributes('disabled')).toBeDefined()
    })

    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')

    expect(wrapper.emitted('invite')).toBeUndefined()
    expect(wrapper.emitted('addRoom')).toBeUndefined()
    expect(wrapper.emitted('settings')).toBeUndefined()
  })
})

describe('WorkbenchDetailPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    groupStoreMock.getGroupDetailByRoomId.mockReturnValue(null)
    groupStoreMock.getMembersByRoomId.mockReturnValue([])
    groupStoreMock.loadGroupInfo.mockResolvedValue(null)
    groupStoreMock.loadRoomMembers.mockResolvedValue([])
    announcementStoreMock.announcementContent = ''
    announcementStoreMock.announList = []
    announcementStoreMock.announError = false
    announcementStoreMock.isAddAnnoun = false
    announcementStoreMock.loadGroupAnnouncements.mockResolvedValue(undefined)
    spaceRoomsMock.rooms!.value = []
    spaceRoomsMock.loading!.value = false
    spaceRoomsMock.error!.value = null
    spaceRoomsMock.load.mockResolvedValue(undefined)
  })

  it('renders empty state and selected session details', async () => {
    const emptyWrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: null,
        activeSpace: null,
        visibleSessionCount: 0,
        totalSessionCount: 7
      }
    })

    expect(emptyWrapper.text()).toContain('space.details_empty_title')
    expect(emptyWrapper.text()).toContain('space.detail_scope_all')
    expect(emptyWrapper.text()).toContain('space.detail_space_topic_empty')
    expect(emptyWrapper.text()).toContain('7')
    expect(emptyWrapper.find('[data-test="detail-group-card"]').exists()).toBe(false)

    groupStoreMock.loadGroupInfo.mockResolvedValue({
      roomId: '!alpha:server',
      topic: '群公告 https://example.com',
      memberCount: 12,
      onlineNum: 5
    })
    groupStoreMock.getGroupDetailByRoomId.mockReturnValue({
      roomId: '!alpha:server',
      topic: '群公告 https://example.com',
      memberCount: 12,
      onlineNum: 5
    })
    groupStoreMock.loadRoomMembers.mockResolvedValue([
      { userId: '@alice:server', name: 'Alice', displayName: 'Alice', avatar: 'alice.png', avatarUrl: 'alice.png' },
      { userId: '@bob:server', name: 'Bob', displayName: 'Bob', avatar: 'bob.png', avatarUrl: 'bob.png' }
    ])
    groupStoreMock.getMembersByRoomId.mockReturnValue([
      { userId: '@alice:server', name: 'Alice', displayName: 'Alice', avatar: 'alice.png', avatarUrl: 'alice.png' },
      { userId: '@bob:server', name: 'Bob', displayName: 'Bob', avatar: 'bob.png', avatarUrl: 'bob.png' }
    ])
    announcementStoreMock.announcementContent = '群公告 https://example.com'
    announcementStoreMock.announList = [{ id: 'ann-1', content: '群公告 https://example.com' }]
    spaceRoomsMock.rooms!.value = [
      { roomId: '!design:server', name: 'Design Room', avatarUrl: 'design.png' },
      { roomId: '!frontend:server', name: 'Frontend Room', avatarUrl: 'frontend.png' }
    ]

    const filledWrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: {
          roomId: '!alpha:server',
          name: 'Alpha Room',
          type: RoomTypeEnum.GROUP,
          unreadCount: 3,
          activeTime: 1,
          lastMsg: 'hello world',
          lastMsgTime: '10:00'
        },
        activeSpace: {
          spaceId: 'space-1',
          name: 'Space One',
          topic: 'Design system sync space',
          memberCount: 18,
          childCount: 4
        },
        visibleSessionCount: 2,
        totalSessionCount: 9
      }
    })

    await flushPromises()

    expect(filledWrapper.text()).toContain('Alpha Room')
    expect(filledWrapper.text()).toContain('space.detail_type_group')
    expect(filledWrapper.text()).toContain('hello world')
    expect(filledWrapper.text()).toContain('Space One')
    expect(filledWrapper.text()).toContain('Design system sync space')
    expect(filledWrapper.text()).toContain('18')
    expect(filledWrapper.text()).toContain('4')
    expect(filledWrapper.text()).toContain('9')
    expect(filledWrapper.text()).toContain('Design Room')
    expect(filledWrapper.text()).toContain('Frontend Room')
    expect(filledWrapper.text()).toContain('space.detail_group')
    expect(filledWrapper.text()).toContain('12')
    expect(filledWrapper.text()).toContain('5')
    expect(filledWrapper.text()).toContain('Alice')
    expect(filledWrapper.text()).toContain('Bob')
    expect(groupStoreMock.loadGroupInfo).toHaveBeenCalledWith('!alpha:server')
    expect(groupStoreMock.loadRoomMembers).toHaveBeenCalledWith('!alpha:server')
    expect(announcementStoreMock.loadGroupAnnouncements).toHaveBeenCalledWith('!alpha:server')
    expect(spaceRoomsMock.load).toHaveBeenCalled()

    await filledWrapper.get('.detail-announcement__link').trigger('click')
    expect(openLinkMock).toHaveBeenCalledWith('https://example.com')
  })

  it('renders space room retry state and reloads child rooms on demand', async () => {
    spaceRoomsMock.load.mockImplementationOnce(async () => {
      spaceRoomsMock.error!.value = 'space rooms failed'
      spaceRoomsMock.rooms!.value = []
    })
    spaceRoomsMock.load.mockImplementationOnce(async () => {
      spaceRoomsMock.error!.value = null
      spaceRoomsMock.rooms!.value = [{ roomId: '!recovered:server', name: 'Recovered Room', avatarUrl: 'room.png' }]
    })

    const wrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: null,
        activeSpace: {
          spaceId: 'space-retry',
          name: 'Retry Space',
          topic: 'Retry topic',
          memberCount: 3,
          childCount: 1
        },
        visibleSessionCount: 1,
        totalSessionCount: 1
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('space.detail_space_rooms_load_failed')
    expect(wrapper.text()).toContain('common.retry')

    await wrapper.get('.detail-announcement__retry').trigger('click')
    await flushPromises()

    expect(spaceRoomsMock.load).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Recovered Room')
  })

  it('renders announcement retry state and reloads announcement on demand', async () => {
    announcementStoreMock.announError = true
    announcementStoreMock.loadGroupAnnouncements.mockImplementationOnce(async () => undefined)
    announcementStoreMock.loadGroupAnnouncements.mockImplementationOnce(async () => {
      announcementStoreMock.announError = false
      announcementStoreMock.announcementContent = 'Recovered announcement'
      announcementStoreMock.announList = [{ id: 'ann-2', content: 'Recovered announcement' }]
    })

    const wrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: {
          roomId: '!retry:server',
          name: 'Retry Room',
          type: RoomTypeEnum.GROUP,
          unreadCount: 0,
          activeTime: 1
        },
        activeSpace: null,
        visibleSessionCount: 1,
        totalSessionCount: 1
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('space.detail_announcement_load_failed')
    expect(wrapper.text()).toContain('common.retry')

    await wrapper.get('.detail-announcement__retry').trigger('click')
    await flushPromises()

    expect(announcementStoreMock.loadGroupAnnouncements).toHaveBeenCalledWith('!retry:server')
    expect(wrapper.text()).toContain('Recovered announcement')
  })

  it('opens announcement list window from detail pane', async () => {
    announcementStoreMock.announcementContent = 'Announcement preview'

    const wrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: {
          roomId: '!announcement:server',
          name: 'Announcement Room',
          type: RoomTypeEnum.GROUP,
          unreadCount: 0,
          activeTime: 1
        },
        activeSpace: null,
        visibleSessionCount: 1,
        totalSessionCount: 1
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('space.detail_view_all_announcements')

    const buttons = wrapper.findAll('.detail-announcement__actions .detail-members__toggle')
    await buttons[0].trigger('click')

    expect(createWebviewWindowMock).toHaveBeenCalledWith(
      'space.detail_view_all_announcements_window',
      'announList/!announcement:server/1',
      420,
      620
    )
  })

  it('shows edit announcement action for manageable groups', async () => {
    announcementStoreMock.announcementContent = 'Editable announcement'
    announcementStoreMock.isAddAnnoun = true

    const wrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: {
          roomId: '!editable:server',
          name: 'Editable Room',
          type: RoomTypeEnum.GROUP,
          unreadCount: 0,
          activeTime: 1
        },
        activeSpace: null,
        visibleSessionCount: 1,
        totalSessionCount: 1
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('space.detail_edit_announcement')

    const buttons = wrapper.findAll('.detail-announcement__actions .detail-members__toggle')
    expect(buttons).toHaveLength(2)

    await buttons[1].trigger('click')

    expect(createWebviewWindowMock).toHaveBeenCalledWith(
      'space.detail_edit_announcement_window',
      'announList/!editable:server/0',
      420,
      620
    )
  })

  it('toggles full member directory from detail pane', async () => {
    groupStoreMock.loadRoomMembers.mockResolvedValue([
      {
        userId: '@u1:server',
        name: 'User 1',
        displayName: 'User 1',
        avatar: '',
        avatarUrl: '',
        membership: 'join',
        powerLevel: 0
      },
      {
        userId: '@u2:server',
        name: 'User 2',
        displayName: 'User 2',
        avatar: '',
        avatarUrl: '',
        membership: 'join',
        powerLevel: 0
      }
    ])

    const wrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: {
          roomId: '!directory:server',
          name: 'Directory Room',
          type: RoomTypeEnum.GROUP,
          unreadCount: 0,
          activeTime: 1
        },
        activeSpace: null,
        visibleSessionCount: 1,
        totalSessionCount: 1
      }
    })

    await flushPromises()

    expect(wrapper.find('[data-test="member-list-stub"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('space.detail_members_view_all')

    await wrapper.get('.detail-members__directory-toggle').trigger('click')

    expect(wrapper.find('[data-test="member-list-stub"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('User 1')
    expect(wrapper.text()).toContain('space.detail_members_hide_directory')

    await wrapper.get('.detail-members__directory-toggle').trigger('click')

    expect(wrapper.find('[data-test="member-list-stub"]').exists()).toBe(false)
  })

  it('opens member profile card from member preview', async () => {
    groupStoreMock.loadRoomMembers.mockResolvedValue([
      {
        userId: '@u1:server',
        uid: 'u1',
        name: 'User 1',
        displayName: 'User 1',
        avatar: '',
        avatarUrl: '',
        membership: 'join',
        powerLevel: 0
      }
    ])

    const wrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: {
          roomId: '!profile:server',
          name: 'Profile Room',
          type: RoomTypeEnum.GROUP,
          unreadCount: 0,
          activeTime: 1
        },
        activeSpace: null,
        visibleSessionCount: 1,
        totalSessionCount: 1
      }
    })

    await flushPromises()

    expect(wrapper.find('[data-test="info-popover-stub"]').exists()).toBe(false)

    await wrapper.get('.detail-member').trigger('click')

    expect(wrapper.find('[data-test="NModal"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="info-popover-stub"]').text()).toBe('u1')
  })

  it('renders member retry state and reloads members on demand', async () => {
    groupStoreMock.loadRoomMembers.mockRejectedValueOnce(new Error('members failed'))
    groupStoreMock.loadRoomMembers.mockResolvedValueOnce([
      { userId: '@carol:server', name: 'Carol', displayName: 'Carol', avatar: 'carol.png', avatarUrl: 'carol.png' }
    ])

    const wrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: {
          roomId: '!members:server',
          name: 'Members Room',
          type: RoomTypeEnum.GROUP,
          unreadCount: 0,
          activeTime: 1
        },
        activeSpace: null,
        visibleSessionCount: 1,
        totalSessionCount: 1
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('space.detail_members_load_failed')
    expect(wrapper.text()).toContain('common.retry')

    await wrapper.get('.detail-announcement__retry').trigger('click')
    await flushPromises()

    expect(groupStoreMock.loadRoomMembers).toHaveBeenLastCalledWith('!members:server', true)
    expect(wrapper.text()).toContain('Carol')
  })

  it('toggles expanded member preview when loaded members exceed preview limit', async () => {
    groupStoreMock.loadRoomMembers.mockResolvedValue([
      { userId: '@u1:server', name: 'User 1', displayName: 'User 1', avatar: '', avatarUrl: '' },
      { userId: '@u2:server', name: 'User 2', displayName: 'User 2', avatar: '', avatarUrl: '' },
      { userId: '@u3:server', name: 'User 3', displayName: 'User 3', avatar: '', avatarUrl: '' },
      { userId: '@u4:server', name: 'User 4', displayName: 'User 4', avatar: '', avatarUrl: '' },
      { userId: '@u5:server', name: 'User 5', displayName: 'User 5', avatar: '', avatarUrl: '' },
      { userId: '@u6:server', name: 'User 6', displayName: 'User 6', avatar: '', avatarUrl: '' },
      { userId: '@u7:server', name: 'User 7', displayName: 'User 7', avatar: '', avatarUrl: '' }
    ])

    const wrapper = mount(WorkbenchDetailPane, {
      props: {
        selectedSession: {
          roomId: '!expand:server',
          name: 'Expand Room',
          type: RoomTypeEnum.GROUP,
          unreadCount: 0,
          activeTime: 1
        },
        activeSpace: null,
        visibleSessionCount: 1,
        totalSessionCount: 1
      }
    })

    await flushPromises()

    expect(wrapper.text()).toContain('User 6')
    expect(wrapper.text()).not.toContain('User 7')
    expect(wrapper.text()).toContain('space.detail_members_expand')

    await wrapper.get('.detail-members__expand-toggle').trigger('click')
    expect(wrapper.text()).toContain('User 7')
    expect(wrapper.text()).toContain('space.detail_members_collapse')

    await wrapper.get('.detail-members__expand-toggle').trigger('click')
    expect(wrapper.text()).not.toContain('User 7')
  })
})
