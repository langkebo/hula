import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomCapabilitiesPanel from '../RoomCapabilitiesPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const fetchCapabilitiesMock = vi.fn()
const getPermissionsMock = vi.fn()

vi.mock('@/services/matrix/room/RoomCapabilitiesService', () => ({
  roomCapabilitiesService: {
    fetch: (...args: unknown[]) => fetchCapabilitiesMock(...args)
  }
}))

vi.mock('@/services/matrix/room/MetadataService', () => ({
  matrixRoomMetadataService: {
    getRoomPermissions: (...args: unknown[]) => getPermissionsMock(...args)
  }
}))

const naiveStubs = {
  Card: {
    template:
      '<div class="n-card"><div class="n-card-header">{{ title }}</div><div class="n-card-body"><slot /></div></div>',
    props: ['title', 'size', 'bordered']
  },
  Spin: { template: '<div class="n-spin"><slot /></div>', props: ['size', 'show'] },
  Descriptions: {
    template: '<div class="n-descriptions"><slot /></div>',
    props: ['bordered', 'column', 'labelPlacement', 'size']
  },
  DescriptionsItem: {
    template:
      '<div class="n-descriptions-item"><span class="n-descriptions-label">{{ label }}</span><span class="n-descriptions-content"><slot /></span></div>',
    props: ['label']
  },
  Tag: { template: '<span class="n-tag"><slot /></span>', props: ['type', 'size', 'round'] },
  Empty: { template: '<div class="n-empty">{{ description }}</div>', props: ['description', 'size'] }
}

const sampleCapabilities = {
  room_id: '!room:hs',
  room_version: '11',
  capabilities: {
    knock: { enabled: false },
    threading: { enabled: true },
    read_receipts: { enabled: true }
  },
  features: {
    encryption: { enabled: true },
    federation: { enabled: false },
    guest_access: { enabled: false }
  },
  join_rule: 'invite'
}

const samplePermissions = {
  users_default: 0,
  events_default: 0,
  state_default: 50,
  ban: 50,
  kick: 50,
  invite: 50,
  redact: 50
}

describe('RoomCapabilitiesPanel — P2-2 房间能力/权限面板', () => {
  beforeEach(() => {
    fetchCapabilitiesMock.mockReset()
    getPermissionsMock.mockReset()
  })

  const mountPanel = (props: Record<string, unknown> = {}) =>
    mount(RoomCapabilitiesPanel, {
      props: { roomId: '!room:hs', ...props },
      global: { stubs: naiveStubs }
    })

  it('挂载时加载房间能力和权限', async () => {
    fetchCapabilitiesMock.mockResolvedValue(sampleCapabilities)
    getPermissionsMock.mockResolvedValue(samplePermissions)

    const wrapper = mountPanel()
    await flushPromises()

    expect(fetchCapabilitiesMock).toHaveBeenCalledWith('!room:hs')
    expect(getPermissionsMock).toHaveBeenCalledWith('!room:hs')
    expect(wrapper.find('[data-testid="room-capabilities-panel"]').exists()).toBe(true)
  })

  it('显示房间版本和加入规则', async () => {
    fetchCapabilitiesMock.mockResolvedValue(sampleCapabilities)
    getPermissionsMock.mockResolvedValue(samplePermissions)

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('11')
    expect(wrapper.text()).toContain('invite')
  })

  it('能力数据为空时显示空状态', async () => {
    fetchCapabilitiesMock.mockResolvedValue(null)
    getPermissionsMock.mockResolvedValue({})

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  it('加载失败时降级显示空状态', async () => {
    fetchCapabilitiesMock.mockRejectedValue(new Error('boom'))
    getPermissionsMock.mockRejectedValue(new Error('boom'))

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })
})
