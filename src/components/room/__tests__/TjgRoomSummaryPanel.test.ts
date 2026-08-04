import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import TjgRoomSummaryPanel from '../TjgRoomSummaryPanel.vue'

const { loadGroupInfoMock } = vi.hoisted(() => ({
  loadGroupInfoMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/components/workbench/TjgSpaceJoinCta.vue', () => ({
  default: {
    name: 'TjgSpaceJoinCta',
    template: '<div data-test="join-cta" />'
  }
}))

const matrixClientMock = vi.hoisted(() => ({
  getClient: vi.fn(),
  getRoom: vi.fn(),
  getUserId: vi.fn()
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: matrixClientMock
}))

let groupStore: ReturnType<
  typeof reactive<{
    onlineCountMap: Record<string, number>
    loadGroupInfo: typeof loadGroupInfoMock
  }>
>

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStore
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value?: string) => value ?? ''
  }
}))

const createRoom = (overrides: Record<string, unknown> = {}) => ({
  currentState: {
    getStateEvents: vi.fn((eventType: string) => {
      if (eventType === 'm.room.tombstone') {
        return null
      }
      return null
    })
  },
  getMyMembership: vi.fn(() => 'join'),
  canInvite: vi.fn(() => true),
  canSendEvent: vi.fn(() => true),
  ...overrides
})

const mountComponent = () =>
  mount(TjgRoomSummaryPanel, {
    props: {
      roomId: '!room:example.com'
    },
    global: {
      stubs: {
        'n-spin': true,
        'n-avatar': true,
        'n-tag': true,
        'n-flex': {
          template: '<div><slot /></div>'
        },
        'n-form': {
          template: '<form><slot /></form>'
        },
        'n-form-item': {
          template: '<div><slot /></div>'
        },
        'n-input': true,
        'n-button': {
          props: ['disabled'],
          template: '<button type="button" :disabled="disabled"><slot /><slot name="icon" /></button>'
        }
      }
    }
  })

describe('TjgRoomSummaryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    groupStore = reactive({
      onlineCountMap: {},
      loadGroupInfo: loadGroupInfoMock
    })

    loadGroupInfoMock.mockResolvedValue({
      roomId: '!room:example.com',
      name: 'Demo Room',
      avatarUrl: '',
      topic: 'topic',
      memberCount: 3,
      isEncrypted: false,
      isPublic: false,
      joinRule: 'invite'
    })

    matrixClientMock.getRoom.mockReturnValue(createRoom())
    matrixClientMock.getUserId.mockReturnValue('@me:example.com')
  })

  it('shows invite UI when inviteMode prop is set', async () => {
    matrixClientMock.getRoom.mockReturnValue(
      createRoom({
        getMyMembership: vi.fn(() => 'invite')
      })
    )
    matrixClientMock.getUserId.mockReturnValue('@me:example.com')

    const wrapper = mount(TjgRoomSummaryPanel, {
      props: {
        roomId: '!room:example.com',
        inviteMode: true,
        inviteUserId: ''
      },
      global: {
        stubs: {
          'n-spin': true,
          'n-avatar': true,
          'n-tag': true,
          'n-flex': { template: '<div><slot /></div>' },
          'n-form': { template: '<form><slot /></form>' },
          'n-form-item': { template: '<div><slot /></div>' },
          'n-input': true,
          'n-button': {
            props: ['disabled'],
            template: '<button type="button" :disabled="disabled"><slot /><slot name="icon" /></button>'
          }
        }
      }
    })
    await flushPromises()

    expect(wrapper.text()).toContain('space.invite_title')
  })

  it('shows room detail when tombstoned (tombstone no longer blocks view)', async () => {
    matrixClientMock.getRoom.mockReturnValue(
      createRoom({
        currentState: {
          getStateEvents: vi.fn((eventType: string) => (eventType === 'm.room.tombstone' ? { event_id: '$t' } : null))
        }
      })
    )
    matrixClientMock.getUserId.mockReturnValue('@me:example.com')

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('Demo Room')
  })

  it('shows permission denied view when loadGroupInfo returns null', async () => {
    matrixClientMock.getRoom.mockReturnValue(
      createRoom({
        canSendEvent: vi.fn(() => false)
      })
    )
    loadGroupInfoMock.mockResolvedValue(null)
    matrixClientMock.getUserId.mockReturnValue('@me:example.com')

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('space.detail_permission_denied_title')
    expect(wrapper.text()).toContain('space.detail_permission_denied_description')
  })
})
