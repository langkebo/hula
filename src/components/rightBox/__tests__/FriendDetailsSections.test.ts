import { flushPromises, mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18nMock, resolveMessage } from '~/tests/i18n-messages'
import FriendDetailsSections from '../FriendDetailsSections.vue'

// --- Hoisted mocks ---

const getFriendGroupsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    { group_id: 'g1', name: 'Colleagues', member_count: 3 },
    { group_id: 'g2', name: 'Family', member_count: 2 }
  ])
)
const getFriendGroupsByUserMock = vi.hoisted(() => vi.fn().mockResolvedValue([{ group_id: 'g1', name: 'Colleagues' }]))
const addFriendToGroupMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const removeFriendFromGroupMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
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
/** 本机 homeserver 域名 —— 联邦判定的对照基准 */
const getServerDomainMock = vi.hoisted(() => vi.fn().mockReturnValue('matrix.test'))

// --- Module mocks ---

/**
 * i18n 桩改为**真实语言表驱动**。
 *
 * 此前这里手写了一张 key → 英文文案映射表，而它是照着组件源码抄的：
 * 源码键名写错时桩抄的也是错键名，测试全绿、界面渲染裸 key（「自洽 stub」反模式）。
 * `createI18nMock()` 直接解析 `locales/zh-CN/*.json`，未解析到的键原样返回，
 * 断言立刻暴露。故下面的文案断言一律用 `resolveMessage()` 取真实文案，
 * 既不会漏判错键，也不会因文案微调而误报。
 */
vi.mock('vue-i18n', () => createI18nMock())

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
    addFriendToGroup: addFriendToGroupMock,
    removeFriendFromGroup: removeFriendFromGroupMock
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
    getServerDomain: getServerDomainMock
  }
}))

// --- Stubs ---

const globalStubs = {
  NSelect: {
    props: ['value', 'options', 'multiple', 'placeholder', 'disabled', 'loading', 'size'],
    emits: ['update:value'],
    template:
      '<select class="n-select-stub" :multiple="multiple" :data-loading="loading" :data-placeholder="placeholder" @change="$emit(\'update:value\', Array.from($event.target.selectedOptions).map((o) => o.value))"><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>'
  }
}

// --- Tests ---

describe('FriendDetailsSections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks 不清除实现，但用例可能改写它 —— 每个用例显式复位基准值
    getServerDomainMock.mockReturnValue('matrix.test')
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
    expect(groupSection.text()).toContain(resolveMessage('friend.detail.group_section'))
  })

  it('renders the device list section with title and loads devices', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const deviceSection = wrapper.find('.single-details__device-section')
    expect(deviceSection.exists()).toBe(true)
    expect(deviceSection.text()).toContain(resolveMessage('friend.detail.devices_section'))
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
    expect(federationSection.text()).toContain(resolveMessage('friend.detail.federation_section'))
    // @kevins:matrix.test → server name is "matrix.test", which matches local domain
    expect(federationSection.text()).toContain('matrix.test')
    expect(federationSection.text()).toContain(resolveMessage('friend.local_user'))
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
    expect(federationSection.text()).toContain(resolveMessage('friend.federated_user'))
  })

  it('联邦信息区用 MxidText 展示完整 MXID（联邦身份可见入口）', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const mxid = wrapper.find('[data-testid="mxid-text"]')
    expect(mxid.exists()).toBe(true)
    // 完整 MXID（非仅 localpart），并带 title 全量值
    expect(mxid.text()).toBe('@kevins:matrix.test')
    expect(mxid.attributes('title')).toBe('@kevins:matrix.test')
    expect(wrapper.find('.single-details__federation-section').text()).toContain(
      resolveMessage('friend.detail.matrix_id')
    )
  })

  it('联邦身份区由 UserIdentity 组合单元承载（单一事实源入口）', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const identity = wrapper.find('[data-testid="friend-identity"]')
    expect(identity.exists()).toBe(true)
    // 组合单元内部同时给出 MXID 与联邦 chip，两者必须并存
    expect(identity.find('[data-testid="mxid-text"]').exists()).toBe(true)
    expect(identity.find('[data-testid="federation-badge"]').exists()).toBe(true)
    // 不接管头像：好友详情头像由外层提供，避免重复渲染
    expect(identity.find('.tjg-avatar').exists()).toBe(false)
  })

  it('本地用户：FederationBadge 标记为 local', async () => {
    const wrapper = mountComponent('@kevins:matrix.test')
    await flushPromises()

    const badge = wrapper.find('[data-testid="federation-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.classes()).toContain('federation-badge--local')
  })

  it('跨域用户：FederationBadge 不标记 local（远端 chip）', async () => {
    const wrapper = mountComponent('@kevins:other-server.test')
    await flushPromises()

    const badge = wrapper.find('[data-testid="federation-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.classes()).not.toContain('federation-badge--local')
  })

  it('本机域名未就绪时按本地处理，不误报「联邦用户」', async () => {
    getServerDomainMock.mockReturnValue('')
    const wrapper = mountComponent('@kevins:other-server.test')
    await flushPromises()

    const badge = wrapper.find('[data-testid="federation-badge"]')
    expect(badge.classes()).toContain('federation-badge--local')
  })

  it('shows empty device hint when no devices are returned', async () => {
    getUserDevicesMock.mockResolvedValueOnce([])
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('.single-details__device-list').exists()).toBe(false)
    expect(wrapper.text()).toContain(resolveMessage('friend.detail.devices_empty'))
  })

  it('assigns the friend to a newly selected group', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    wrapper.findComponent(NSelect).vm.$emit('update:value', ['g1', 'g2'])
    await flushPromises()

    expect(addFriendToGroupMock).toHaveBeenCalledWith('g2', '@kevins:matrix.test')
    expect(removeFriendFromGroupMock).not.toHaveBeenCalled()
  })

  it('removes the friend from a deselected group', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    wrapper.findComponent(NSelect).vm.$emit('update:value', [])
    await flushPromises()

    expect(removeFriendFromGroupMock).toHaveBeenCalledWith('g1', '@kevins:matrix.test')
    expect(addFriendToGroupMock).not.toHaveBeenCalled()
  })
})
