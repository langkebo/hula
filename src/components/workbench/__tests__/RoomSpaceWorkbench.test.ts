import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomSpaceWorkbench from '../RoomSpaceWorkbench.vue'

const { roomSessionListScrollToIndexMock } = vi.hoisted(() => ({
  roomSessionListScrollToIndexMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('../RoomSpaceToolbar.vue', () => ({
  default: defineComponent({
    name: 'RoomSpaceToolbarStub',
    props: {
      searchKeyword: { type: String, default: '' },
      sessionTypeFilter: { type: String, default: 'all' },
      sessionSort: { type: String, default: 'recent' },
      filteredCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 }
    },
    emits: ['update:searchKeyword', 'update:sessionTypeFilter', 'update:sessionSort', 'createSpace'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'toolbar' }, [
          h('span', { 'data-test': 'toolbar-summary' }, `${props.filteredCount}/${props.totalCount}`),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'toolbar-search',
              onClick: () => emit('update:searchKeyword', 'next keyword')
            },
            props.searchKeyword
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'toolbar-type',
              onClick: () => emit('update:sessionTypeFilter', 'group')
            },
            props.sessionTypeFilter
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'toolbar-sort',
              onClick: () => emit('update:sessionSort', 'name')
            },
            props.sessionSort
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'toolbar-create',
              onClick: () => emit('createSpace')
            },
            'create'
          )
        ])
    }
  })
}))

vi.mock('../SpaceListPane.vue', () => ({
  default: defineComponent({
    name: 'SpaceListPaneStub',
    props: {
      spaces: { type: Array, default: () => [] },
      selectedSpaceId: { type: String, default: '' },
      loading: { type: Boolean, default: false },
      totalCount: { type: Number, default: 0 }
    },
    emits: ['selectSpace'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'space-list' }, [
          h('span', { 'data-test': 'space-list-selected' }, props.selectedSpaceId),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'space-select',
              onClick: () => emit('selectSpace', 'space-2')
            },
            String(props.totalCount)
          )
        ])
    }
  })
}))

vi.mock('../RoomSpaceActionBar.vue', () => ({
  default: defineComponent({
    name: 'RoomSpaceActionBarStub',
    props: {
      spaceName: { type: String, default: '' },
      roomCount: { type: Number, default: 0 },
      sessionCount: { type: Number, default: 0 },
      canManageSpace: { type: Boolean, default: false }
    },
    emits: ['invite', 'addRoom', 'settings'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'action-bar' }, [
          h(
            'span',
            { 'data-test': 'action-bar-title' },
            `${props.spaceName}:${props.roomCount}:${props.sessionCount}:${String(props.canManageSpace)}`
          ),
          h('button', { type: 'button', 'data-test': 'invite', onClick: () => emit('invite') }, 'invite'),
          h('button', { type: 'button', 'data-test': 'add-room', onClick: () => emit('addRoom') }, 'add-room'),
          h('button', { type: 'button', 'data-test': 'settings', onClick: () => emit('settings') }, 'settings')
        ])
    }
  })
}))

vi.mock('../RoomSessionList.vue', () => ({
  default: defineComponent({
    name: 'RoomSessionListStub',
    props: {
      sessionList: { type: Array, default: () => [] },
      emptyDescription: { type: String, default: '' },
      onRetryNetwork: { type: Function, default: undefined }
    },
    setup(props, { expose }) {
      expose({
        scrollToIndex: roomSessionListScrollToIndexMock
      })

      return () =>
        h('div', { 'data-test': 'session-list' }, [
          h('span', { 'data-test': 'session-empty' }, props.emptyDescription),
          h('span', { 'data-test': 'session-count' }, String(props.sessionList.length)),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'session-retry',
              onClick: () => props.onRetryNetwork?.()
            },
            'retry'
          )
        ])
    }
  })
}))

vi.mock('../WorkbenchDetailPane.vue', () => ({
  default: defineComponent({
    name: 'WorkbenchDetailPaneStub',
    props: {
      selectedSession: { type: Object, default: null },
      activeSpace: { type: Object, default: null },
      visibleSessionCount: { type: Number, default: 0 },
      totalSessionCount: { type: Number, default: 0 }
    },
    setup(props) {
      return () =>
        h('div', { 'data-test': 'detail-pane' }, [
          h('span', { 'data-test': 'detail-visible-count' }, String(props.visibleSessionCount)),
          h('span', { 'data-test': 'detail-total-count' }, String(props.totalSessionCount)),
          h('span', { 'data-test': 'detail-session-name' }, props.selectedSession?.name ?? ''),
          h('span', { 'data-test': 'detail-space-name' }, props.activeSpace?.name ?? '')
        ])
    }
  })
}))

type WorkbenchProps = InstanceType<typeof RoomSpaceWorkbench>['$props']

const createProps = (overrides: Partial<WorkbenchProps> = {}): WorkbenchProps => ({
  sessionList: [],
  totalCount: 3,
  spaces: [
    { spaceId: 'space-1', name: 'Space One', childCount: 2 },
    { spaceId: 'space-2', name: 'Space Two', childCount: 5 }
  ],
  spaceLoading: false,
  selectedSpaceId: '',
  searchKeyword: '',
  sessionTypeFilter: 'all',
  sessionSort: 'recent',
  activeSpace: null,
  canManageActiveSpace: false,
  selectedSession: null,
  syncLoading: false,
  sessionLoading: false,
  networkBanner: null,
  getItemClasses: () => ({}),
  visibleMenu: () => [],
  visibleSpecialMenu: () => [],
  onMsgClick: vi.fn(),
  onMsgDblclick: vi.fn(),
  onMenuShow: vi.fn(),
  onRetryNetwork: vi.fn(),
  ...overrides
})

const mountWorkbench = (overrides: Partial<WorkbenchProps> = {}) =>
  mount(RoomSpaceWorkbench, {
    props: createProps(overrides)
  })

describe('RoomSpaceWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes the correct empty description based on active filters', () => {
    const defaultWrapper = mountWorkbench()
    expect(defaultWrapper.get('[data-test="session-empty"]').text()).toBe('space.empty_sessions')

    const filteredWrapper = mountWorkbench({
      selectedSpaceId: 'space-1',
      searchKeyword: ' keyword '
    })
    expect(filteredWrapper.get('[data-test="session-empty"]').text()).toBe('space.empty_filtered_sessions')

    const typedWrapper = mountWorkbench({
      sessionTypeFilter: 'group'
    })
    expect(typedWrapper.get('[data-test="session-empty"]').text()).toBe('space.empty_filtered_sessions')
  })

  it('forwards toolbar and space list events to the parent interface', async () => {
    const wrapper = mountWorkbench({
      sessionList: [{ roomId: '!alpha:server', name: 'Alpha' } as never]
    })

    await wrapper.get('[data-test="toolbar-search"]').trigger('click')
    await wrapper.get('[data-test="toolbar-type"]').trigger('click')
    await wrapper.get('[data-test="toolbar-sort"]').trigger('click')
    await wrapper.get('[data-test="toolbar-create"]').trigger('click')
    await wrapper.get('[data-test="space-select"]').trigger('click')

    expect(wrapper.emitted('update:searchKeyword')).toEqual([['next keyword']])
    expect(wrapper.emitted('update:sessionTypeFilter')).toEqual([['group']])
    expect(wrapper.emitted('update:sessionSort')).toEqual([['name']])
    expect(wrapper.emitted('createSpace')).toEqual([[]])
    expect(wrapper.emitted('update:selectedSpaceId')).toEqual([['space-2']])
    expect(wrapper.get('[data-test="toolbar-summary"]').text()).toBe('1/3')
    expect(wrapper.get('[data-test="detail-visible-count"]').text()).toBe('1')
    expect(wrapper.get('[data-test="detail-total-count"]').text()).toBe('3')
  })

  it('shows the action bar only for an active space and forwards its actions', async () => {
    const hiddenWrapper = mountWorkbench()
    expect(hiddenWrapper.find('[data-test="action-bar"]').exists()).toBe(false)

    const wrapper = mountWorkbench({
      sessionList: [
        { roomId: '!alpha:server', name: 'Alpha' } as never,
        { roomId: '!beta:server', name: 'Beta' } as never
      ],
      activeSpace: { spaceId: 'space-1', name: 'Space One', childCount: 2 },
      canManageActiveSpace: true
    })

    expect(wrapper.get('[data-test="action-bar-title"]').text()).toBe('Space One:2:2:true')

    await wrapper.get('[data-test="invite"]').trigger('click')
    await wrapper.get('[data-test="add-room"]').trigger('click')
    await wrapper.get('[data-test="settings"]').trigger('click')

    expect(wrapper.emitted('inviteSpaceMember')).toEqual([[]])
    expect(wrapper.emitted('addSpaceRoom')).toEqual([[]])
    expect(wrapper.emitted('openSpaceSettings')).toEqual([[]])
  })

  it('exposes scrollToSessionIndex through the session list ref', async () => {
    const wrapper = mountWorkbench()

    await wrapper.vm.scrollToSessionIndex(4)
    await flushPromises()

    expect(roomSessionListScrollToIndexMock).toHaveBeenCalledWith(4)
  })

  it('passes the selected session and active space into the detail pane', () => {
    const wrapper = mountWorkbench({
      selectedSession: { roomId: '!alpha:server', name: 'Alpha', type: 2, unreadCount: 0, activeTime: 1 } as never,
      activeSpace: { spaceId: 'space-1', name: 'Space One', childCount: 2 }
    })

    expect(wrapper.get('[data-test="detail-session-name"]').text()).toBe('Alpha')
    expect(wrapper.get('[data-test="detail-space-name"]').text()).toBe('Space One')
  })

  it('passes the retry handler into the session list', async () => {
    const onRetryNetwork = vi.fn()
    const wrapper = mountWorkbench({
      onRetryNetwork
    })

    await wrapper.get('[data-test="session-retry"]').trigger('click')
    expect(onRetryNetwork).toHaveBeenCalledTimes(1)
  })
})
