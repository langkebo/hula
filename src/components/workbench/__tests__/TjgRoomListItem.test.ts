import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import TjgRoomListItem from '../TjgRoomListItem.vue'

const { globalStoreMock, roomStoreMock, sessionStoreMock, groupStoreMock, settingStoreMock } = vi.hoisted(() => ({
  globalStoreMock: {
    unreadReady: true,
    currentSessionRoomId: '!room:example.com'
  },
  roomStoreMock: {
    getTagsForRoom: vi.fn(() => ({}))
  },
  sessionStoreMock: {
    getUnreadDetail: vi.fn<(roomId: string) => { total: number; highlight: number; silent: boolean } | null>(() => null)
  },
  groupStoreMock: {
    getUserInfo: vi.fn(() => null)
  },
  settingStoreMock: {
    themeContent: 'light'
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/components/common/ContextMenu.vue', () => ({
  default: {
    name: 'ContextMenu',
    props: ['content'],
    template: '<div data-test="context-menu"><slot /></div>'
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStoreMock
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => roomStoreMock
}))

vi.mock('@/stores/domains/chat/chat/session', () => ({
  useSessionStore: () => sessionStoreMock
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStoreMock
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => settingStoreMock
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: vi.fn(() => '')
  }
}))

vi.mock('@/composables/workbench/useSessionListState', () => ({
  useSessionLastMsg: () => ({ lastMessage: { value: '' } })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NTag = defineComponent({
    name: 'NTag',
    setup(_, { slots }) {
      return () => h('span', { 'data-test': 'NTag' }, slots.default?.())
    }
  })

  const NCheckbox = defineComponent({
    name: 'NCheckbox',
    props: {
      checked: {
        type: Boolean,
        default: false
      }
    },
    emits: ['update:checked', 'click'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          'data-test': 'NCheckbox',
          type: 'checkbox',
          checked: props.checked,
          onClick: (event: Event) => emit('click', event),
          onChange: (event: Event) => emit('update:checked', (event.target as HTMLInputElement).checked)
        })
    }
  })

  const NBadge = defineComponent({
    name: 'NBadge',
    props: {
      value: {
        type: Number,
        default: 0
      },
      show: {
        type: Boolean,
        default: false
      }
    },
    setup(props) {
      return () =>
        h('div', { 'data-test': 'NBadge', 'data-value': String(props.value), 'data-show': String(props.show) })
    }
  })

  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NAvatar: passthrough('NAvatar'),
    NBadge,
    NButton: passthrough('NButton'),
    NCheckbox,
    NFlex: passthrough('NFlex'),
    NIcon: passthrough('NIcon'),
    NTag,
    NTooltip: passthrough('NTooltip')
  }
})

const createProps = (overrides: Record<string, unknown> = {}) => ({
  item: {
    roomId: '!room:example.com',
    name: '产品群',
    avatar: '',
    type: RoomTypeEnum.GROUP,
    unreadCount: 1,
    activeTime: Date.now(),
    notificationCount: 1,
    highlightCount: 0,
    lastMsg: 'hello',
    lastMsgTime: '10:00',
    ...overrides
  },
  displayName: '产品群',
  avatarSrc: '',
  timeText: '10:00',
  lastMessageText: 'hello',
  typingText: '',
  badgeCount: 1,
  hasMention: false,
  hasFavoriteTag: false,
  hasLowPriorityTag: false,
  isFavorite: false,
  isMuted: false,
  isShielded: false,
  isEncrypted: false,
  isBurnAfterRead: false,
  isInvite: false,
  isTop: false,
  isDm: false,
  selected: false,
  classes: {},
  menu: [],
  specialMenu: []
})

describe('TjgRoomListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalStoreMock.unreadReady = true
    roomStoreMock.getTagsForRoom.mockReturnValue({})
    sessionStoreMock.getUnreadDetail.mockReturnValue(null)
    groupStoreMock.getUserInfo.mockReturnValue(null)
    settingStoreMock.themeContent = 'light'
  })

  it('renders favorite and low-priority tags from room tags', () => {
    roomStoreMock.getTagsForRoom.mockReturnValue({
      'm.favourite': { order: 0 },
      'm.lowpriority': { order: 1 }
    })

    const wrapper = mount(TjgRoomListItem, {
      props: createProps()
    })

    expect(wrapper.text()).toContain('message.message_list.favorite_tag')
    expect(wrapper.text()).toContain('message.message_list.low_priority_tag')
  })

  it('prefers unread detail for mention state and badge count', () => {
    sessionStoreMock.getUnreadDetail.mockReturnValue({
      total: 5,
      highlight: 2,
      silent: false
    })

    const wrapper = mount(TjgRoomListItem, {
      props: createProps({
        notificationCount: 1,
        highlightCount: 0
      })
    })
    const badges = wrapper.findAll('[data-test="NBadge"]')
    const unreadBadge = badges.at(-1)

    expect(wrapper.text()).toContain('message.message_list.mention_tag')
    expect(unreadBadge?.attributes('data-value')).toBe('5')
    expect(unreadBadge?.attributes('data-show')).toBe('true')
  })

  it('toggles batch selection instead of opening the room when batch mode is active', async () => {
    const wrapper = mount(TjgRoomListItem, {
      props: {
        ...createProps(),
        batchMode: true,
        batchSelected: true
      }
    })

    await wrapper.get('.tjg-room-list-item').trigger('click')

    expect(wrapper.emitted('batch-toggle')).toEqual([['!room:example.com']])
    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.find('[data-test="NCheckbox"]').element).toBeTruthy()
  })

  it('supports keyboard activation and exposes selection aria state', async () => {
    const wrapper = mount(TjgRoomListItem, {
      props: {
        ...createProps(),
        batchMode: true,
        batchSelected: true,
        classes: { selected: true }
      }
    })

    const item = wrapper.get('.tjg-room-list-item')
    expect(item.attributes('tabindex')).toBe('0')
    expect(item.attributes('aria-current')).toBe('true')
    expect(item.attributes('aria-pressed')).toBe('true')

    await item.trigger('keydown.enter')
    expect(wrapper.emitted('batch-toggle')).toEqual([['!room:example.com']])
  })
})
