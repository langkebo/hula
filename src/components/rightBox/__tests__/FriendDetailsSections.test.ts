import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FriendDetailsSections from '../FriendDetailsSections.vue'

// --- Hoisted mocks ---

const getFriendGroupsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    { group_id: 'g1', name: 'Colleagues', member_count: 3 },
    { group_id: 'g2', name: 'Family', member_count: 2 }
  ])
)
const getFriendGroupsByUserMock = vi.hoisted(() => vi.fn().mockResolvedValue([{ group_id: 'g1', name: 'Colleagues' }]))
const getUserDevicesMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    {
      device_id: 'DEV1',
      display_name: 'MacBook Pro',
      last_seen_ts: 1700000000000,
      last_seen_ip: '127.0.0.1',
      verified: true
    },
    {
      device_id: 'DEV2',
      display_name: 'iPhone',
      last_seen_ts: 1700000000001,
      last_seen_ip: '127.0.0.2',
      verified: false
    }
  ])
)

// --- Module mocks ---

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        'friend.detail.group_section': 'Group Assignment',
        'friend.detail.group_placeholder': 'Select group',
        'friend.detail.group_load_error': 'Failed to load groups',
        'friend.detail.group_assign_success': 'Assigned to group',
        'friend.detail.group_assign_error': 'Failed to assign group',
        'friend.detail.group_remove_success': 'Removed from group',
        'friend.detail.group_remove_error': 'Failed to remove from group',
        'friend.detail.devices_section': 'Devices',
        'friend.detail.devices_loading': 'Loading devices...',
        'friend.detail.devices_empty': 'No devices',
        'friend.detail.devices_load_error': 'Failed to load devices',
        'friend.detail.device_verified': 'Verified',
        'friend.detail.device_unverified': 'Unverified',
        'friend.detail.device_last_seen': 'Last seen',
        'friend.detail.device_unknown': 'Unknown device',
        'friend.detail.federation_section': 'Federation',
        'friend.detail.server_address': 'Server',
        'friend.detail.federated_user': 'Federated',
        'friend.detail.local_user': 'Local',
        'friend.detail.just_now': 'just now',
        'friend.detail.minutes_ago': '{count}m ago',
        'friend.detail.hours_ago': '{count}h ago',
        'friend.detail.days_ago': '{count}d ago'
      }
      return map[key] ?? key
    }
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn()
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  })
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: {
    getFriendGroups: getFriendGroupsMock,
    getFriendGroupsByUser: getFriendGroupsByUserMock,
    addFriendToGroup: vi.fn().mockResolvedValue(undefined),
    removeFriendFromGroup: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/services/matrix/user/MatrixDeviceService', () => ({
  matrixDeviceService: {
    getUserDevices: getUserDevicesMock
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: {
    getClient: () => ({
      getDomain: () => 'matrix.test',
      getHomeserverUrl: () => 'https://matrix.test'
    }),
    getServerDomain: () => 'matrix.test'
  }
}))

// --- Stubs ---

const globalStubs = {
  NSelect: {
    props: ['value', 'options', 'multiple', 'placeholder', 'disabled', 'loading', 'size'],
    emits: ['update:value'],
    template:
      '<select class="n-select-stub" :multiple="multiple" :data-loading="loading" :data-placeholder="placeholder"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>'
  }
}

// --- Tests ---

describe('FriendDetailsSections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mountComponent = (userId = '@kevins:matrix.test') =>
    mount(FriendDetailsSections, {
      props: { userId },
      global: { stubs: globalStubs }
    })

  it('renders the group section with title', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const groupSection = wrapper.find('.single-details__group-section')
    expect(groupSection.exists()).toBe(true)
    expect(groupSection.text()).toContain('Group Assignment')
  })

  it('renders the device list section with title and loads devices', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const deviceSection = wrapper.find('.single-details__device-section')
    expect(deviceSection.exists()).toBe(true)
    expect(deviceSection.text()).toContain('Devices')
    expect(getUserDevicesMock).toHaveBeenCalledWith('@kevins:matrix.test')

    const items = wrapper.findAll('.single-details__device-item')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('MacBook Pro')
    expect(wrapper.text()).toContain('iPhone')
  })

  it('renders the federation section with server address', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const federationSection = wrapper.find('.single-details__federation-section')
    expect(federationSection.exists()).toBe(true)
    expect(federationSection.text()).toContain('Federation')
    // @kevins:matrix.test → server name is "matrix.test", which matches local domain
    expect(federationSection.text()).toContain('matrix.test')
    expect(federationSection.text()).toContain('Local')
  })

  it('renders all three management sections', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const sections = wrapper.findAll('.management-section')
    expect(sections).toHaveLength(3)
  })

  it('shows federated badge when user is from a different server', async () => {
    const wrapper = mountComponent('@kevins:other-server.test')
    await flushPromises()

    const federationSection = wrapper.find('.single-details__federation-section')
    expect(federationSection.exists()).toBe(true)
    expect(federationSection.text()).toContain('other-server.test')
    expect(federationSection.text()).toContain('Federated')
  })

  it('shows empty device hint when no devices are returned', async () => {
    getUserDevicesMock.mockResolvedValueOnce([])
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('.single-details__device-list').exists()).toBe(false)
    expect(wrapper.text()).toContain('No devices')
  })
})
