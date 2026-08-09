import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import RoomDetailPane from '../RoomDetailPane.vue'

const { getGroupDetailByRoomId, getMembersByRoomId, getRoomMock, getUserIdMock } = vi.hoisted(() => ({
  getGroupDetailByRoomId: vi.fn(),
  getMembersByRoomId: vi.fn(),
  getRoomMock: vi.fn(),
  getUserIdMock: vi.fn()
}))

const { copyMock, showFeedbackMock } = vi.hoisted(() => ({
  copyMock: vi.fn().mockResolvedValue(undefined),
  showFeedbackMock: vi.fn()
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getGroupDetailByRoomId,
    getMembersByRoomId
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(),
    getRoom: getRoomMock,
    getUserId: getUserIdMock
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@vueuse/core', () => ({
  useClipboard: () => ({ copy: copyMock })
}))

// usePinnedMessage 默认 mock：返回空置顶列表，避免触发真实 SDK 调用
const { pinnedEventIdsMock } = vi.hoisted(() => ({
  pinnedEventIdsMock: [] as string[]
}))

vi.mock('@/composables/room/usePinnedMessage', () => ({
  usePinnedMessage: () => ({
    pinnedEventIds: { value: pinnedEventIdsMock },
    pinnedMessages: { value: [] },
    loading: { value: false },
    latestPinnedMessage: { value: null },
    load: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    canPin: { value: false }
  })
}))

// RoomBurnSettings 透传 useBurnAfterRead（→ matrixBurnAfterReadService → global store →
// chat store → friend services），在 RoomDetailPane 套件里会拖入重型依赖图并在模块加载期
// 调用 matrixClientService.getClient()。此处 mock useBurnAfterRead 断开依赖链；
// RoomBurnSettings 自有测试覆盖其真实行为。
vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    isRoomBurnEnabled: () => false,
    getRoomBurnDuration: () => 0,
    refreshBurnSettings: vi.fn().mockResolvedValue(undefined),
    enableBurn: vi.fn().mockResolvedValue(undefined),
    disableBurn: vi.fn().mockResolvedValue(undefined),
    getPendingBurns: vi.fn().mockResolvedValue([])
  })
}))

// RoomDetailMembers / RoomDetailLastMessage stub：暴露 props 便于断言
const RoomDetailMembersStub = defineComponent({
  name: 'RoomDetailMembersStub',
  props: {
    members: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },
  setup(props) {
    return () =>
      h('div', { 'data-test': 'room-detail-members-stub' }, [
        h('span', { 'data-test': 'room-detail-members-count' }, String(props.members.length)),
        h('span', { 'data-test': 'room-detail-members-loading' }, String(props.loading))
      ])
  }
})

const RoomDetailLastMessageStub = defineComponent({
  name: 'RoomDetailLastMessageStub',
  props: {
    lastMessage: { type: [String, null], default: null },
    senderName: { type: [String, null], default: null },
    timestamp: { type: [Number, null], default: null }
  },
  setup(props) {
    return () =>
      h('div', { 'data-test': 'room-detail-last-message-stub' }, [
        h('span', { 'data-test': 'room-detail-last-message-body' }, props.lastMessage ?? ''),
        h('span', { 'data-test': 'room-detail-last-message-sender' }, props.senderName ?? '')
      ])
  }
})

const globalStubs = {
  NSpin: { template: '<div class="n-spin"><slot /></div>' },
  NTag: { template: '<span class="n-tag"><slot /></span>' },
  NButton: {
    emits: ['click'],
    template:
      '<button class="n-button" @click="$emit(\'click\')"><slot /><template v-if="$slots.icon"><slot name="icon" /></template></button>'
  },
  NFlex: { template: '<div><slot /></div>' },
  NForm: { template: '<form><slot /></form>' },
  NFormItem: { template: '<div><slot /></div>' },
  NInput: { template: '<input />' },
  RoomParentSpaces: { template: '<div class="room-parent-spaces" />' },
  AvatarCropper: { template: '<div class="avatar-cropper" />' },
  // 重度依赖加密服务图谱（CryptoSDKAdapter→worker 桥接），挂载后会导致 forks worker 无法退出；
  // 本套件只测 power-level 接线，加密面板行为由 RoomEncryptionSettings 自有测试覆盖
  RoomEncryptionSettings: { template: '<div class="room-encryption-settings" />' },
  // RoomBurnSettings 依赖 useBurnAfterRead（pinia + matrixBurnAfterReadService），
  // 由 RoomBurnSettings 自有测试覆盖；此处 stub 避免拖入重型依赖图
  RoomBurnSettings: { template: '<div class="room-burn-settings" />' },
  InviteDialog: { template: '<div class="invite-dialog" />' },
  RoomDetailMembers: RoomDetailMembersStub,
  RoomDetailLastMessage: RoomDetailLastMessageStub
}

interface MountFakeRoom {
  canInvite: boolean
  canEdit: boolean
}

const fakeRoom = ({ canInvite, canEdit }: MountFakeRoom) => ({
  currentState: {
    maySendStateEvent: vi.fn((eventType: string) => (eventType === 'm.room.name' ? canEdit : false))
  },
  canInvite: vi.fn(() => canInvite)
})

const mountPane = async () => {
  const wrapper = mount(RoomDetailPane, {
    props: { roomId: '!alpha:matrix.test' },
    global: { stubs: globalStubs }
  })
  await flushPromises()
  await flushPromises()
  return wrapper
}

describe('RoomDetailPane.buildRoomDetail (P5 power-level wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getGroupDetailByRoomId.mockResolvedValue({
      name: 'Alpha Room',
      avatar: '',
      topic: '',
      memberCount: 2,
      isPublic: true,
      isEncrypted: false
    })
    getMembersByRoomId.mockResolvedValue([
      { userId: '@a:matrix.test', activeStatus: 1 },
      { userId: '@b:matrix.test', activeStatus: 1 },
      { userId: '@c:matrix.test', activeStatus: 0 }
    ])
    pinnedEventIdsMock.length = 0
  })

  it('renders invite button and edit overlay when user has full power level', async () => {
    getUserIdMock.mockReturnValue('@admin:matrix.test')
    getRoomMock.mockReturnValue(fakeRoom({ canInvite: true, canEdit: true }))

    const wrapper = await mountPane()

    expect(wrapper.find('.avatar-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('room.detail.invite')
  })

  it('hides edit overlay but keeps invite button for non-admin who can still invite', async () => {
    getUserIdMock.mockReturnValue('@member:matrix.test')
    getRoomMock.mockReturnValue(fakeRoom({ canInvite: true, canEdit: false }))

    const wrapper = await mountPane()

    expect(wrapper.find('.avatar-overlay').exists()).toBe(false)
    expect(wrapper.text()).toContain('room.detail.invite')
  })

  it('hides both edit overlay and invite button for read-only members', async () => {
    getUserIdMock.mockReturnValue('@guest:matrix.test')
    getRoomMock.mockReturnValue(fakeRoom({ canInvite: false, canEdit: false }))

    const wrapper = await mountPane()

    expect(wrapper.find('.avatar-overlay').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('room.detail.invite')
  })

  it('falls back to canEdit=false / canInvite=false when no Matrix client is available', async () => {
    getUserIdMock.mockReturnValue(null)
    getRoomMock.mockReturnValue(null)

    const wrapper = await mountPane()

    expect(wrapper.find('.avatar-overlay').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('room.detail.invite')
  })

  it('derives onlineCount from members with truthy activeStatus and uses max(memberCount, members.length)', async () => {
    getGroupDetailByRoomId.mockResolvedValue({
      name: 'Alpha',
      avatar: '',
      topic: '',
      memberCount: 1,
      isPublic: true,
      isEncrypted: false
    })
    getMembersByRoomId.mockResolvedValue([
      { userId: '@a:matrix.test', activeStatus: 1 },
      { userId: '@b:matrix.test', activeStatus: 1 },
      { userId: '@c:matrix.test', activeStatus: 0 },
      { userId: '@d:matrix.test', activeStatus: 0 }
    ])
    getUserIdMock.mockReturnValue('@a:matrix.test')
    getRoomMock.mockReturnValue(fakeRoom({ canInvite: false, canEdit: false }))

    const wrapper = await mountPane()

    // P1-2：统计卡片集成 — 成员卡片显示 max(memberCount, members.length)=4，在线卡片显示 2
    const memberCard = wrapper.find('[data-testid="stat-card-members"]')
    const onlineCard = wrapper.find('[data-testid="stat-card-online"]')
    expect(memberCard.exists()).toBe(true)
    expect(onlineCard.exists()).toBe(true)
    expect(memberCard.text()).toContain('4')
    expect(onlineCard.text()).toContain('2')
  })

  it('uses room.canInvite() result, not a hardcoded true', async () => {
    const room = fakeRoom({ canInvite: false, canEdit: false })
    getUserIdMock.mockReturnValue('@u:matrix.test')
    getRoomMock.mockReturnValue(room)

    await mountPane()

    expect(room.canInvite).toHaveBeenCalledWith('@u:matrix.test')
    expect(room.currentState.maySendStateEvent).toHaveBeenCalledWith('m.room.name', '@u:matrix.test')
  })

  it('uses action feedback after copying the room id', async () => {
    getUserIdMock.mockReturnValue('@admin:matrix.test')
    getRoomMock.mockReturnValue(fakeRoom({ canInvite: true, canEdit: true }))

    const wrapper = await mountPane()
    await wrapper.find('.copy-btn').trigger('click')

    expect(copyMock).toHaveBeenCalledWith('!alpha:matrix.test')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.detail.id_copied', 'success')
  })
})

describe('RoomDetailPane P1 integration (stats / last message / members / action bar)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getGroupDetailByRoomId.mockResolvedValue({
      name: 'Alpha Room',
      avatar: 'mxc://server/avatar',
      topic: 'Alpha topic',
      memberCount: 10,
      isPublic: true,
      isEncrypted: false
    })
    getMembersByRoomId.mockResolvedValue([
      { userId: '@a:matrix.test', activeStatus: 1 },
      { userId: '@b:matrix.test', activeStatus: 0 }
    ])
    getUserIdMock.mockReturnValue('@admin:matrix.test')
    getRoomMock.mockReturnValue(fakeRoom({ canInvite: true, canEdit: true }))
    pinnedEventIdsMock.length = 0
  })

  it('renders stats card with member / online / announcement counts', async () => {
    pinnedEventIdsMock.push('ev1', 'ev2', 'ev3')

    const wrapper = await mountPane()

    const statsGrid = wrapper.find('[data-testid="stat-grid"]')
    expect(statsGrid.exists()).toBe(true)
    expect(wrapper.find('[data-testid="stat-card-members"]').text()).toContain('10')
    expect(wrapper.find('[data-testid="stat-card-online"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="stat-card-announcements"]').text()).toContain('3')
  })

  it('renders zero announcement count when no pinned messages', async () => {
    const wrapper = await mountPane()

    expect(wrapper.find('[data-testid="stat-card-announcements"]').text()).toContain('0')
  })

  it('renders last message preview section with members count prop passed through', async () => {
    const wrapper = await mountPane()

    const membersStub = wrapper.find('[data-test="room-detail-members-stub"]')
    expect(membersStub.exists()).toBe(true)
    expect(membersStub.find('[data-test="room-detail-members-count"]').text()).toBe('2')
  })

  it('renders horizontal action bar with enter room and settings buttons side by side', async () => {
    const wrapper = await mountPane()

    const actionBar = wrapper.find('[data-testid="room-detail-action-bar"]')
    expect(actionBar.exists()).toBe(true)
    // 横向布局：flex-row + gap
    expect(actionBar.classes().some((c) => c.includes('flex-row') || c.includes('flex'))).toBe(true)
    // 两个按钮均存在
    expect(actionBar.find('[data-testid="room-detail-action-enter"]').exists()).toBe(true)
    expect(actionBar.find('[data-testid="room-detail-action-settings"]').exists()).toBe(true)
  })

  it('emits enterRoom when clicking enter button', async () => {
    const wrapper = await mountPane()

    await wrapper.find('[data-testid="room-detail-action-enter"]').trigger('click')
    expect(wrapper.emitted('enterRoom')).toBeTruthy()
  })

  it('emits settings when clicking settings button', async () => {
    const wrapper = await mountPane()

    await wrapper.find('[data-testid="room-detail-action-settings"]').trigger('click')
    expect(wrapper.emitted('settings')).toBeTruthy()
  })

  it('renders larger hero avatar (64x64) per P1-2 spec', async () => {
    const wrapper = await mountPane()

    const avatar = wrapper.find('.header-avatar')
    expect(avatar.exists()).toBe(true)
    // Hero 头像从 52px 升级到 64px
    const style = avatar.attributes('style') || ''
    expect(style).toContain('width: 64px')
    expect(style).toContain('height: 64px')
  })
})
