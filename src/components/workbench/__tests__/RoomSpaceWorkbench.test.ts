import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import RoomSpaceWorkbench from '../RoomSpaceWorkbench.vue'

const { roomSessionListScrollToIndexMock, viewportWidthMock, announceMock } = vi.hoisted(() => ({
  roomSessionListScrollToIndexMock: vi.fn(),
  viewportWidthMock: { value: 1600 },
  announceMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({
    announce: announceMock
  })
}))

vi.mock('@/composables/common/useViewport', () => ({
  useViewport: () => ({
    vw: viewportWidthMock,
    vh: { value: 900 }
  })
}))

vi.mock('../RoomSpaceToolbar.vue', () => ({
  default: defineComponent({
    name: 'RoomSpaceToolbarStub',
    props: {
      compact: { type: Boolean, default: false },
      batchMode: { type: Boolean, default: false },
      searchKeyword: { type: String, default: '' },
      sessionTypeFilter: { type: String, default: 'all' },
      sessionSort: { type: String, default: 'recent' },
      filteredCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 }
    },
    emits: ['update:searchKeyword', 'update:sessionTypeFilter', 'update:sessionSort', 'toggleBatchMode', 'createSpace'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'toolbar' }, [
          h('span', { 'data-test': 'toolbar-compact' }, String(props.compact)),
          h('span', { 'data-test': 'toolbar-batch-mode' }, String(props.batchMode)),
          h('span', { 'data-test': 'toolbar-summary' }, `${props.filteredCount}/${props.totalCount}`),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'toolbar-batch',
              onClick: () => emit('toggleBatchMode')
            },
            'batch'
          ),
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
      compact: { type: Boolean, default: false },
      narrow: { type: Boolean, default: false },
      spaces: { type: Array, default: () => [] },
      selectedSpaceId: { type: String, default: '' },
      loading: { type: Boolean, default: false },
      totalCount: { type: Number, default: 0 }
    },
    emits: ['selectSpace'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'space-list' }, [
          h('span', { 'data-test': 'space-list-compact' }, String(props.compact)),
          h('span', { 'data-test': 'space-list-narrow' }, String(props.narrow)),
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
      compact: { type: Boolean, default: false },
      breadcrumbItems: { type: Array, default: () => [] },
      spaceName: { type: String, default: '' },
      roomCount: { type: Number, default: 0 },
      sessionCount: { type: Number, default: 0 },
      canManageSpace: { type: Boolean, default: false }
    },
    emits: ['selectBreadcrumb', 'invite', 'addRoom', 'settings'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'action-bar' }, [
          h('span', { 'data-test': 'action-bar-compact' }, String(props.compact)),
          h(
            'span',
            { 'data-test': 'action-bar-breadcrumb-count' },
            String((props.breadcrumbItems as unknown[]).length)
          ),
          h(
            'span',
            { 'data-test': 'action-bar-title' },
            `${props.spaceName}:${props.roomCount}:${props.sessionCount}:${String(props.canManageSpace)}`
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'breadcrumb-select',
              onClick: () => emit('selectBreadcrumb', 'space-root')
            },
            'breadcrumb-select'
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
      onRetryNetwork: { type: Function, default: undefined },
      batchMode: { type: Boolean, default: false },
      batchSelectedIds: { type: Object, default: () => new Set() }
    },
    emits: ['batchToggle'],
    setup(props, { expose, emit }) {
      expose({
        scrollToIndex: roomSessionListScrollToIndexMock
      })

      return () =>
        h('div', { 'data-test': 'session-list' }, [
          h('span', { 'data-test': 'session-empty' }, props.emptyDescription),
          h('span', { 'data-test': 'session-count' }, String(props.sessionList.length)),
          h('span', { 'data-test': 'session-batch-mode' }, String(props.batchMode)),
          h('span', { 'data-test': 'session-batch-selected' }, String((props.batchSelectedIds as Set<string>).size)),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'session-batch-toggle',
              onClick: () => emit('batchToggle', '!alpha:server')
            },
            'batch-toggle'
          ),
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

vi.mock('../HulaSpaceTree.vue', () => ({
  default: defineComponent({
    name: 'HulaSpaceTreeStub',
    props: {
      spaceId: { type: String, default: '' },
      selectedSpaceId: { type: String, default: '' },
      loader: { type: Function, default: undefined }
    },
    emits: ['select'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'space-tree' }, [
          h('span', { 'data-test': 'space-tree-space-id' }, props.spaceId),
          h('span', { 'data-test': 'space-tree-selected' }, props.selectedSpaceId),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'space-tree-select',
              onClick: () => emit('select', { spaceId: 'space-child', name: 'Child Space', childCount: 1 })
            },
            'select-child'
          )
        ])
    }
  })
}))

vi.mock('../RoomBatchActionBar.vue', () => ({
  default: defineComponent({
    name: 'RoomBatchActionBarStub',
    props: {
      visible: { type: Boolean, default: false },
      selectedCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 }
    },
    emits: ['toggleAll', 'markRead', 'pin', 'mute', 'leave', 'close'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'batch-bar' }, [
          h('span', { 'data-test': 'batch-visible' }, String(props.visible)),
          h('span', { 'data-test': 'batch-selected-count' }, String(props.selectedCount)),
          h('span', { 'data-test': 'batch-total-count' }, String(props.totalCount)),
          h('button', { type: 'button', 'data-test': 'batch-toggle-all', onClick: () => emit('toggleAll') }, 'all'),
          h('button', { type: 'button', 'data-test': 'batch-mark-read', onClick: () => emit('markRead') }, 'read'),
          h('button', { type: 'button', 'data-test': 'batch-pin', onClick: () => emit('pin') }, 'pin'),
          h('button', { type: 'button', 'data-test': 'batch-mute', onClick: () => emit('mute') }, 'mute'),
          h('button', { type: 'button', 'data-test': 'batch-leave', onClick: () => emit('leave') }, 'leave'),
          h('button', { type: 'button', 'data-test': 'batch-close', onClick: () => emit('close') }, 'close')
        ])
    }
  })
}))

vi.mock('../WorkbenchDetailPane.vue', () => ({
  default: defineComponent({
    name: 'WorkbenchDetailPaneStub',
    props: {
      compact: { type: Boolean, default: false },
      narrow: { type: Boolean, default: false },
      drawerMode: { type: Boolean, default: false },
      drawerVisible: { type: Boolean, default: false },
      selectedSession: { type: Object, default: null },
      activeSpace: { type: Object, default: null },
      visibleSessionCount: { type: Number, default: 0 },
      totalSessionCount: { type: Number, default: 0 },
      manageMode: { type: String, default: null },
      inviteUserId: { type: String, default: '' },
      addRoomId: { type: String, default: '' },
      addRoomSuggested: { type: Boolean, default: false },
      settingsName: { type: String, default: '' },
      settingsTopic: { type: String, default: '' },
      overlayMode: { type: String, default: null },
      forwardEventId: { type: String, default: '' },
      forwardRoomId: { type: String, default: '' },
      historyRoomId: { type: String, default: '' },
      mergedMsgIds: { type: Array, default: () => [] }
    },
    emits: [
      'closeManagePane',
      'submitManagePane',
      'update:inviteUserId',
      'update:addRoomId',
      'update:addRoomSuggested',
      'update:settingsName',
      'update:settingsTopic',
      'closeDrawer',
      'closeOverlay',
      'overlayCreated',
      'overlayForwarded',
      'overlayMessageSelected',
      'overlayRoomSelected',
      'overlayUserSelected'
    ],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'detail-pane' }, [
          h('span', { 'data-test': 'detail-compact' }, String(props.compact)),
          h('span', { 'data-test': 'detail-narrow' }, String(props.narrow)),
          h('span', { 'data-test': 'detail-drawer-mode' }, String(props.drawerMode)),
          h('span', { 'data-test': 'detail-drawer-visible' }, String(props.drawerVisible)),
          h('span', { 'data-test': 'detail-visible-count' }, String(props.visibleSessionCount)),
          h('span', { 'data-test': 'detail-total-count' }, String(props.totalSessionCount)),
          h('span', { 'data-test': 'detail-session-name' }, props.selectedSession?.name ?? ''),
          h('span', { 'data-test': 'detail-space-name' }, props.activeSpace?.name ?? ''),
          h('span', { 'data-test': 'detail-manage-mode' }, props.manageMode ?? ''),
          h('span', { 'data-test': 'detail-overlay-mode' }, props.overlayMode ?? ''),
          h(
            'button',
            { type: 'button', 'data-test': 'detail-close-manage', onClick: () => emit('closeManagePane') },
            'close-manage'
          ),
          h(
            'button',
            { type: 'button', 'data-test': 'detail-submit-manage', onClick: () => emit('submitManagePane') },
            'submit-manage'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-update-invite',
              onClick: () => emit('update:inviteUserId', '@alice:server')
            },
            'invite'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-update-room',
              onClick: () => emit('update:addRoomId', '!room:server')
            },
            'room'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-update-suggested',
              onClick: () => emit('update:addRoomSuggested', true)
            },
            'suggested'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-update-name',
              onClick: () => emit('update:settingsName', 'New Space')
            },
            'name'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-update-topic',
              onClick: () => emit('update:settingsTopic', 'New Topic')
            },
            'topic'
          ),
          h(
            'button',
            { type: 'button', 'data-test': 'detail-close-drawer', onClick: () => emit('closeDrawer') },
            'close-drawer'
          ),
          h(
            'button',
            { type: 'button', 'data-test': 'detail-close-overlay', onClick: () => emit('closeOverlay') },
            'close-overlay'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-overlay-created',
              onClick: () => emit('overlayCreated', { roomId: '!new:server' })
            },
            'overlay-created'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-overlay-forwarded',
              onClick: () => emit('overlayForwarded', ['!room1:server'])
            },
            'overlay-forwarded'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-overlay-msg-selected',
              onClick: () => emit('overlayMessageSelected', '!room:server', '$event1')
            },
            'overlay-msg-selected'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-overlay-room-selected',
              onClick: () => emit('overlayRoomSelected', '!room:server')
            },
            'overlay-room-selected'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'detail-overlay-user-selected',
              onClick: () => emit('overlayUserSelected', '@user:server')
            },
            'overlay-user-selected'
          )
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
  manageMode: null,
  manageSubmitting: false,
  inviteUserId: '',
  addRoomId: '',
  addRoomSuggested: false,
  settingsName: '',
  settingsTopic: '',
  overlayMode: null,
  forwardEventId: '',
  forwardRoomId: '',
  historyRoomId: '',
  mergedMsgIds: [],
  spaceTreeLoader: undefined,
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
    viewportWidthMock.value = 1600
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
    await wrapper.get('[data-test="toolbar-batch"]').trigger('click')
    await wrapper.get('[data-test="toolbar-create"]').trigger('click')
    await wrapper.get('[data-test="space-select"]').trigger('click')

    expect(wrapper.emitted('update:searchKeyword')).toEqual([['next keyword']])
    expect(wrapper.emitted('update:sessionTypeFilter')).toEqual([['group']])
    expect(wrapper.emitted('update:sessionSort')).toEqual([['name']])
    expect(wrapper.emitted('createSpace')).toEqual([[]])
    expect(wrapper.emitted('update:selectedSpaceId')).toEqual([['space-2']])
    expect(wrapper.get('[data-test="toolbar-batch-mode"]').text()).toBe('true')
    expect(wrapper.get('[data-test="toolbar-summary"]').text()).toBe('1/3')
    expect(wrapper.get('[data-test="detail-visible-count"]').text()).toBe('1')
    expect(wrapper.get('[data-test="detail-total-count"]').text()).toBe('3')
  })

  it('renders the space tree for the selected space and forwards tree navigation', async () => {
    const wrapper = mountWorkbench({
      selectedSpaceId: 'space-1',
      activeSpace: { spaceId: 'space-1', name: 'Space One', childCount: 2 }
    })

    expect(wrapper.get('[data-test="space-tree-space-id"]').text()).toBe('space-1')
    expect(wrapper.text()).toContain('space.space_tree_label')

    await wrapper.get('[data-test="space-tree-select"]').trigger('click')
    expect(wrapper.emitted('update:selectedSpaceId')).toContainEqual(['space-child'])
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

  it('forwards breadcrumb selection from the action bar to the parent interface', async () => {
    const wrapper = mountWorkbench({
      activeSpace: { spaceId: 'space-child', name: 'Child Space', childCount: 2 },
      spaceBreadcrumbItems: [
        { spaceId: 'space-root', name: 'Root Space' },
        { spaceId: 'space-child', name: 'Child Space' }
      ]
    })

    expect(wrapper.get('[data-test="action-bar-breadcrumb-count"]').text()).toBe('2')

    await wrapper.get('[data-test="breadcrumb-select"]').trigger('click')
    expect(wrapper.emitted('update:selectedSpaceId')).toContainEqual(['space-root'])
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
      activeSpace: { spaceId: 'space-1', name: 'Space One', childCount: 2 },
      manageMode: 'settings',
      settingsName: 'Space One'
    })

    expect(wrapper.get('[data-test="detail-session-name"]').text()).toBe('Alpha')
    expect(wrapper.get('[data-test="detail-space-name"]').text()).toBe('Space One')
    expect(wrapper.get('[data-test="detail-manage-mode"]').text()).toBe('settings')
  })

  it('switches the workbench into compact and narrow layout based on viewport width', () => {
    viewportWidthMock.value = 1180

    const wrapper = mountWorkbench({
      activeSpace: { spaceId: 'space-1', name: 'Space One', childCount: 2 },
      selectedSession: { roomId: '!alpha:server', name: 'Alpha', type: 2, unreadCount: 0, activeTime: 1 } as never
    })

    expect(wrapper.classes()).toContain('room-space-workbench--compact')
    expect(wrapper.classes()).toContain('room-space-workbench--narrow')
    expect(wrapper.get('[data-test="toolbar-compact"]').text()).toBe('true')
    expect(wrapper.get('[data-test="space-list-compact"]').text()).toBe('true')
    expect(wrapper.get('[data-test="space-list-narrow"]').text()).toBe('true')
    expect(wrapper.get('[data-test="action-bar-compact"]').text()).toBe('true')
    expect(wrapper.get('[data-test="detail-compact"]').text()).toBe('true')
    expect(wrapper.get('[data-test="detail-narrow"]').text()).toBe('true')
    expect(wrapper.get('[data-test="detail-drawer-mode"]').text()).toBe('true')
    expect(wrapper.get('[data-test="detail-drawer-visible"]').text()).toBe('false')
    expect(wrapper.find('[data-test="workbench-detail-toggle"]').exists()).toBe(true)
  })

  it('opens and closes the detail drawer in narrow layout', async () => {
    const wrapper = mountWorkbench({
      layoutModeOverride: 'narrow',
      activeSpace: { spaceId: 'space-1', name: 'Space One', childCount: 2 },
      selectedSession: { roomId: '!alpha:server', name: 'Alpha', type: 2, unreadCount: 0, activeTime: 1 } as never
    })

    expect(wrapper.get('[data-test="detail-drawer-visible"]').text()).toBe('false')

    await wrapper.get('[data-test="workbench-detail-toggle"]').trigger('click')
    expect(wrapper.classes()).toContain('room-space-workbench--detail-open')
    expect(wrapper.get('[data-test="detail-drawer-visible"]').text()).toBe('true')

    await wrapper.get('[data-test="detail-close-drawer"]').trigger('click')
    expect(wrapper.get('[data-test="detail-drawer-visible"]').text()).toBe('false')
  })

  it('auto-opens the detail drawer for manage and overlay modes in narrow layout', async () => {
    const manageWrapper = mountWorkbench({
      layoutModeOverride: 'narrow',
      activeSpace: { spaceId: 'space-1', name: 'Space One', childCount: 2 },
      manageMode: 'settings'
    })

    await flushPromises()
    expect(manageWrapper.get('[data-test="detail-drawer-visible"]').text()).toBe('true')

    const overlayWrapper = mountWorkbench({
      layoutModeOverride: 'narrow',
      overlayMode: 'forward',
      forwardEventId: '$event1',
      forwardRoomId: '!room:server'
    })

    await flushPromises()
    expect(overlayWrapper.get('[data-test="detail-drawer-visible"]').text()).toBe('true')
  })

  it('passes the retry handler into the session list', async () => {
    const onRetryNetwork = vi.fn()
    const wrapper = mountWorkbench({
      onRetryNetwork
    })

    await wrapper.get('[data-test="session-retry"]').trigger('click')
    expect(onRetryNetwork).toHaveBeenCalledTimes(1)
  })

  it('forwards inline management actions from the detail pane', async () => {
    const wrapper = mountWorkbench({
      activeSpace: { spaceId: 'space-1', name: 'Space One', childCount: 2 },
      manageMode: 'invite'
    })

    await wrapper.get('[data-test="detail-close-manage"]').trigger('click')
    await wrapper.get('[data-test="detail-submit-manage"]').trigger('click')
    await wrapper.get('[data-test="detail-update-invite"]').trigger('click')
    await wrapper.get('[data-test="detail-update-room"]').trigger('click')
    await wrapper.get('[data-test="detail-update-suggested"]').trigger('click')
    await wrapper.get('[data-test="detail-update-name"]').trigger('click')
    await wrapper.get('[data-test="detail-update-topic"]').trigger('click')

    expect(wrapper.emitted('closeManagePane')).toEqual([[]])
    expect(wrapper.emitted('submitManagePane')).toEqual([[]])
    expect(wrapper.emitted('update:inviteUserId')).toEqual([['@alice:server']])
    expect(wrapper.emitted('update:addRoomId')).toEqual([['!room:server']])
    expect(wrapper.emitted('update:addRoomSuggested')).toEqual([[true]])
    expect(wrapper.emitted('update:settingsName')).toEqual([['New Space']])
    expect(wrapper.emitted('update:settingsTopic')).toEqual([['New Topic']])
  })

  it('passes overlayMode and related props to the detail pane', () => {
    const wrapper = mountWorkbench({
      overlayMode: 'create-room',
      forwardEventId: '$event1',
      forwardRoomId: '!room:server',
      historyRoomId: '!history:server',
      mergedMsgIds: ['$m1', '$m2']
    })

    expect(wrapper.get('[data-test="detail-overlay-mode"]').text()).toBe('create-room')
  })

  it('forwards overlay events from the detail pane', async () => {
    const wrapper = mountWorkbench({
      overlayMode: 'forward',
      forwardEventId: '$event1',
      forwardRoomId: '!room:server'
    })

    await wrapper.get('[data-test="detail-close-overlay"]').trigger('click')
    await wrapper.get('[data-test="detail-overlay-created"]').trigger('click')
    await wrapper.get('[data-test="detail-overlay-forwarded"]').trigger('click')
    await wrapper.get('[data-test="detail-overlay-msg-selected"]').trigger('click')
    await wrapper.get('[data-test="detail-overlay-room-selected"]').trigger('click')
    await wrapper.get('[data-test="detail-overlay-user-selected"]').trigger('click')

    expect(wrapper.emitted('closeOverlay')).toEqual([[]])
    expect(wrapper.emitted('overlayCreated')).toEqual([[{ roomId: '!new:server' }]])
    expect(wrapper.emitted('overlayForwarded')).toEqual([[['!room1:server']]])
    expect(wrapper.emitted('overlayMessageSelected')).toEqual([['!room:server', '$event1']])
    expect(wrapper.emitted('overlayRoomSelected')).toEqual([['!room:server']])
    expect(wrapper.emitted('overlayUserSelected')).toEqual([['@user:server']])
  })

  it('manages batch mode state and forwards batch actions', async () => {
    const wrapper = mountWorkbench({
      sessionList: [
        { roomId: '!alpha:server', name: 'Alpha' } as never,
        { roomId: '!beta:server', name: 'Beta' } as never
      ]
    })

    expect(wrapper.get('[data-test="batch-visible"]').text()).toBe('false')

    await wrapper.get('[data-test="toolbar-batch"]').trigger('click')
    expect(wrapper.get('[data-test="toolbar-batch-mode"]').text()).toBe('true')
    expect(wrapper.get('[data-test="batch-visible"]').text()).toBe('true')
    expect(wrapper.get('[data-test="session-batch-mode"]').text()).toBe('true')
    expect(announceMock).toHaveBeenCalledWith('room.batch.enter_announcement', 'polite')

    await wrapper.get('[data-test="session-batch-toggle"]').trigger('click')
    expect(wrapper.get('[data-test="batch-selected-count"]').text()).toBe('1')
    expect(wrapper.get('[data-test="session-batch-selected"]').text()).toBe('1')

    await wrapper.get('[data-test="batch-toggle-all"]').trigger('click')
    expect(wrapper.get('[data-test="batch-selected-count"]').text()).toBe('2')
    expect(announceMock).toHaveBeenCalledWith('room.batch.select_all_announcement', 'polite')

    await wrapper.get('[data-test="batch-mark-read"]').trigger('click')
    expect(wrapper.emitted('batchMarkRead')).toEqual([[['!alpha:server', '!beta:server']]])
    expect(wrapper.get('[data-test="batch-visible"]').text()).toBe('false')
    expect(announceMock).toHaveBeenCalledWith('room.batch.exit_announcement', 'polite')

    await wrapper.get('[data-test="toolbar-batch"]').trigger('click')
    await wrapper.get('[data-test="session-batch-toggle"]').trigger('click')
    await wrapper.get('[data-test="batch-pin"]').trigger('click')
    expect(wrapper.emitted('batchPin')).toEqual([[['!alpha:server']]])

    await wrapper.get('[data-test="toolbar-batch"]').trigger('click')
    await wrapper.get('[data-test="session-batch-toggle"]').trigger('click')
    await wrapper.get('[data-test="batch-mute"]').trigger('click')
    expect(wrapper.emitted('batchMute')).toEqual([[['!alpha:server']]])

    await wrapper.get('[data-test="toolbar-batch"]').trigger('click')
    await wrapper.get('[data-test="session-batch-toggle"]').trigger('click')
    await wrapper.get('[data-test="batch-leave"]').trigger('click')
    expect(wrapper.emitted('batchLeave')).toEqual([[['!alpha:server']]])

    await wrapper.get('[data-test="toolbar-batch"]').trigger('click')
    await wrapper.get('[data-test="session-batch-toggle"]').trigger('click')
    await wrapper.get('[data-test="batch-close"]').trigger('click')
    expect(wrapper.get('[data-test="batch-visible"]').text()).toBe('false')
    expect(wrapper.get('[data-test="batch-selected-count"]').text()).toBe('0')
    expect(announceMock).toHaveBeenLastCalledWith('room.batch.exit_announcement', 'polite')
  })

  it('announces when batch selections are cleared via toggle all', async () => {
    const wrapper = mountWorkbench({
      sessionList: [
        { roomId: '!alpha:server', name: 'Alpha' } as never,
        { roomId: '!beta:server', name: 'Beta' } as never
      ]
    })

    await wrapper.get('[data-test="toolbar-batch"]').trigger('click')
    await wrapper.get('[data-test="batch-toggle-all"]').trigger('click')
    await wrapper.get('[data-test="batch-toggle-all"]').trigger('click')

    expect(wrapper.get('[data-test="batch-selected-count"]').text()).toBe('0')
    expect(announceMock).toHaveBeenCalledWith('room.batch.clear_selection_announcement', 'polite')
  })
})
