import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const globalStubs = {
  NSpin: { template: '<div class="n-spin"><slot /></div>' },
  NTag: { template: '<span class="n-tag"><slot /></span>' },
  NButton: {
    emits: ['click'],
    template: '<button class="n-button" @click="$emit(\'click\')"><slot /></button>'
  },
  NFlex: { template: '<div><slot /></div>' },
  NForm: { template: '<form><slot /></form>' },
  NFormItem: { template: '<div><slot /></div>' },
  NInput: { template: '<input />' }
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

    const text = wrapper.text()
    expect(text).toContain('4')
    const onlineSpan = wrapper.find('.info-value.online')
    expect(onlineSpan.exists()).toBe(true)
    expect(onlineSpan.text()).toBe('2')
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
