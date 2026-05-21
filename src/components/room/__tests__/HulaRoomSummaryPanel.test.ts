import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import HulaRoomSummaryPanel from '../HulaRoomSummaryPanel.vue'

const { getClientMock, loadGroupInfoMock } = vi.hoisted(() => ({
  getClientMock: vi.fn(),
  loadGroupInfoMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/components/workbench/HulaSpaceJoinCta.vue', () => ({
  default: {
    name: 'HulaSpaceJoinCta',
    template: '<div data-test="join-cta" />'
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: getClientMock
  }
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
  mount(HulaRoomSummaryPanel, {
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

describe('HulaRoomSummaryPanel', () => {
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

    getClientMock.mockReturnValue({
      getUserId: vi.fn(() => '@me:example.com'),
      getRoom: vi.fn(() => createRoom())
    })
  })

  it('shows invited state card and disables enter/manage actions', async () => {
    getClientMock.mockReturnValue({
      getUserId: vi.fn(() => '@me:example.com'),
      getRoom: vi.fn(() =>
        createRoom({
          getMyMembership: vi.fn(() => 'invite')
        })
      )
    })

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('room.detail.state_invited_title')
    expect(wrapper.text()).toContain('room.detail.state_invited_description')

    const buttons = wrapper.findAll('button')
    expect(buttons[0]?.attributes('disabled')).toBeDefined()
    expect(buttons[1]?.attributes('disabled')).toBeDefined()
    expect(buttons[2]?.attributes('disabled')).toBeDefined()
  })

  it('shows tombstoned state card and keeps enter action available', async () => {
    getClientMock.mockReturnValue({
      getUserId: vi.fn(() => '@me:example.com'),
      getRoom: vi.fn(() =>
        createRoom({
          currentState: {
            getStateEvents: vi.fn((eventType: string) => (eventType === 'm.room.tombstone' ? { event_id: '$t' } : null))
          }
        })
      )
    })

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('room.detail.state_tombstoned_title')
    expect(wrapper.text()).toContain('room.detail.state_tombstoned_description')

    const buttons = wrapper.findAll('button')
    expect(buttons[0]?.attributes('disabled')).toBeUndefined()
    expect(buttons[1]?.attributes('disabled')).toBeDefined()
    expect(buttons[2]?.attributes('disabled')).toBeDefined()
  })

  it('shows no-permission state card without disabling room entry', async () => {
    getClientMock.mockReturnValue({
      getUserId: vi.fn(() => '@me:example.com'),
      getRoom: vi.fn(() =>
        createRoom({
          canSendEvent: vi.fn(() => false)
        })
      )
    })

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('room.detail.state_no_permission_title')
    expect(wrapper.text()).toContain('room.detail.state_no_permission_description')

    const buttons = wrapper.findAll('button')
    expect(buttons[0]?.attributes('disabled')).toBeUndefined()
  })
})
