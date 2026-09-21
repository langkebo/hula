import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileInvitePermission from '../MobileInvitePermission.vue'

/**
 * 移动端邀请权限设置（方案 4.4）。
 *
 * 缺口背景：桌面 `InvitePermissionPanel.vue` 已有三模式邀请权限（allow_all /
 * blocklist / allowlist，存 `im.hula.invite_blocklist` account data），移动端完全没有。
 *
 * 注意：方案文档写的是「所有人/仅联系人/nobody」三档，但代码实际实现是名单模型，
 * 这里以代码为准，避免在同一个 account data 上造出第二套并行配置。
 */

const { showToastMock, getConfigMock, setConfigMock } = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  getConfigMock: vi.fn(),
  setConfigMock: vi.fn()
}))

vi.mock('vant', () => ({ showToast: (...args: any[]) => showToastMock(...args) }))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getInvitePolicy: () => getConfigMock(),
    setInvitePolicy: (...args: any[]) => setConfigMock(...args)
  }
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

/** 见 MobilePushSettings.test.ts 的说明：Vant 具名插槽必须靠显式 stub 才能渲染。 */
const vantStubs = (() => {
  const names = ['VanCellGroup', 'VanCell', 'VanField', 'VanRadioGroup', 'VanRadio', 'VanButton', 'VanLoading']
  const stubs: Record<string, { name: string; template: string }> = {}
  for (const name of names) {
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    stubs[name] = {
      name,
      template:
        '<div v-bind="$attrs"><slot name="icon" /><slot name="title" /><slot name="label" /><slot /><slot name="value" /><slot name="right-icon" /></div>'
    }
    stubs[kebab] = stubs[name]
  }
  return stubs
})()

function mountPage() {
  return mount(MobileInvitePermission, { global: { stubs: vantStubs } })
}

describe('MobileInvitePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getConfigMock.mockResolvedValue({
      mode: 'allow_all',
      blocklist: [],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    setConfigMock.mockResolvedValue(true)
  })

  it('renders correctly', () => {
    expect(mountPage().html()).toBeTruthy()
  })

  it('loads the config on mount', async () => {
    mountPage()
    await flushPromises()
    expect(getConfigMock).toHaveBeenCalled()
  })

  it('defaults to allow_all with both lists empty', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    expect(vm.mode).toBe('allow_all')
    expect(vm.blocklist).toEqual([])
    expect(vm.allowlist).toEqual([])
  })

  it('applies a loaded blocklist config', async () => {
    getConfigMock.mockResolvedValue({
      mode: 'blocklist',
      blocklist: ['@spam:evil.org'],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    expect(vm.mode).toBe('blocklist')
    expect(vm.activeList).toEqual(['@spam:evil.org'])
  })

  it('shows the blocklist as the active list in blocklist mode', async () => {
    getConfigMock.mockResolvedValue({
      mode: 'blocklist',
      blocklist: ['@a:b'],
      allowlist: ['@c:d'],
      allowStrangers: true,
      contacts: []
    })
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).activeList).toEqual(['@a:b'])
  })

  it('shows the allowlist as the active list in allowlist mode', async () => {
    getConfigMock.mockResolvedValue({
      mode: 'allowlist',
      blocklist: ['@a:b'],
      allowlist: ['@c:d'],
      allowStrangers: true,
      contacts: []
    })
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).activeList).toEqual(['@c:d'])
  })

  it('hides the list editor in allow_all mode', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).mode).toBe('allow_all')
    expect(wrapper.find('[data-testid="invite-user-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="invite-empty"]').exists()).toBe(false)
  })

  it('renders the list editor once a list mode is selected', async () => {
    getConfigMock.mockResolvedValue({
      mode: 'blocklist',
      blocklist: [],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('[data-testid="invite-user-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="invite-empty"]').exists()).toBe(true)
  })

  it('persists a mode change', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await (wrapper.vm as any).handleModeChange('blocklist')
    expect(setConfigMock).toHaveBeenCalledWith({
      mode: 'blocklist',
      blocklist: [],
      allowlist: [],
      allowStrangers: true,
      // 本页不拥有的好友请求字段必须原样带过去，不能被重置
      allowFriendRequests: true,
      autoAcceptFriends: false,
      requireFriendRequestMessage: true,
      contacts: []
    })
  })

  it('ignores a mode change to the same mode', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await (wrapper.vm as any).handleModeChange('allow_all')
    expect(setConfigMock).not.toHaveBeenCalled()
  })

  it('ignores an unknown mode', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await (wrapper.vm as any).handleModeChange('nobody')
    expect(setConfigMock).not.toHaveBeenCalled()
    expect((wrapper.vm as any).mode).toBe('allow_all')
  })

  it('adds a trimmed user id to the blocklist and clears the input', async () => {
    getConfigMock.mockResolvedValue({
      mode: 'blocklist',
      blocklist: [],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.newUserId = '  @spam:evil.org  '
    await vm.handleAdd()
    expect(vm.blocklist).toEqual(['@spam:evil.org'])
    expect(vm.newUserId).toBe('')
    expect(setConfigMock).toHaveBeenCalledWith({
      mode: 'blocklist',
      blocklist: ['@spam:evil.org'],
      allowlist: [],
      allowStrangers: true,
      allowFriendRequests: true,
      autoAcceptFriends: false,
      requireFriendRequestMessage: true,
      contacts: []
    })
  })

  it('adds to the allowlist when in allowlist mode', async () => {
    getConfigMock.mockResolvedValue({
      mode: 'allowlist',
      blocklist: [],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.newUserId = '@friend:server'
    await vm.handleAdd()
    expect(vm.allowlist).toEqual(['@friend:server'])
    expect(vm.blocklist).toEqual([])
  })

  it('rejects an empty user id', async () => {
    getConfigMock.mockResolvedValue({
      mode: 'blocklist',
      blocklist: [],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.newUserId = '   '
    await vm.handleAdd()
    expect(setConfigMock).not.toHaveBeenCalled()
  })

  it('refuses duplicates', async () => {
    getConfigMock.mockResolvedValue({
      mode: 'blocklist',
      blocklist: ['@a:b'],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.newUserId = '@a:b'
    await vm.handleAdd()
    expect(vm.blocklist).toEqual(['@a:b'])
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('removes a user from the active list', async () => {
    getConfigMock.mockResolvedValue({
      mode: 'blocklist',
      blocklist: ['@a:b', '@c:d'],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    const wrapper = mountPage()
    await flushPromises()
    await (wrapper.vm as any).handleRemove('@a:b')
    expect((wrapper.vm as any).blocklist).toEqual(['@c:d'])
    expect(setConfigMock).toHaveBeenCalled()
  })

  describe('private-chat toggles', () => {
    it('defaults to allowing strangers and encrypting new DMs', async () => {
      localStorage.clear()
      const wrapper = mountPage()
      await flushPromises()
      const vm = wrapper.vm as any
      expect(vm.allowStrangers).toBe(true)
      expect(vm.encryptByDefault).toBe(true)
    })

    it('restores a disabled stranger setting from the policy', async () => {
      getConfigMock.mockResolvedValue({
        mode: 'allow_all',
        blocklist: [],
        allowlist: [],
        allowStrangers: false,
        contacts: ['@friend:server']
      })
      const wrapper = mountPage()
      await flushPromises()
      expect((wrapper.vm as any).allowStrangers).toBe(false)
    })

    it('persists the stranger toggle together with the rest of the policy', async () => {
      const wrapper = mountPage()
      await flushPromises()
      await (wrapper.vm as any).handleAllowStrangersChange(false)
      expect(setConfigMock).toHaveBeenCalledWith(expect.objectContaining({ allowStrangers: false, mode: 'allow_all' }))
    })

    it('keeps the contact snapshot when persisting the stranger toggle', async () => {
      // contacts 不能在这里被清空，否则关闭"非联系人私聊"后好友也会被拒
      getConfigMock.mockResolvedValue({
        mode: 'allow_all',
        blocklist: [],
        allowlist: [],
        allowStrangers: true,
        contacts: ['@friend:server']
      })
      const wrapper = mountPage()
      await flushPromises()
      await (wrapper.vm as any).handleAllowStrangersChange(false)
      expect(setConfigMock).toHaveBeenCalledWith(expect.objectContaining({ contacts: ['@friend:server'] }))
    })

    it('keeps the stranger switch usable in blocklist mode', async () => {
      // blocklist 模式下 allowStrangers 决定"非名单用户"是否放行，开关必须是活的
      getConfigMock.mockResolvedValue({
        mode: 'blocklist',
        blocklist: [],
        allowlist: [],
        allowStrangers: true,
        contacts: []
      })
      const wrapper = mountPage()
      await flushPromises()
      expect(wrapper.find('[data-testid="allow-strangers"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="allow-strangers-note"]').exists()).toBe(false)
    })

    it('disables the stranger switch in allowlist mode', async () => {
      getConfigMock.mockResolvedValue({
        mode: 'allowlist',
        blocklist: [],
        allowlist: [],
        allowStrangers: true,
        contacts: []
      })
      const wrapper = mountPage()
      await flushPromises()
      expect(wrapper.find('[data-testid="allow-strangers"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="allow-strangers-note"]').exists()).toBe(true)
    })

    it('hides the inactive note in allow_all mode', async () => {
      const wrapper = mountPage()
      await flushPromises()
      expect(wrapper.find('[data-testid="allow-strangers-note"]').exists()).toBe(false)
    })

    it('persists the DM encryption default locally without touching account data', async () => {
      const wrapper = mountPage()
      await flushPromises()
      ;(wrapper.vm as any).handleEncryptByDefaultChange(false)
      expect(localStorage.getItem('tjg-dm-privacy-preferences')).toBe('{"encryptByDefault":false}')
      expect(setConfigMock).not.toHaveBeenCalled()
    })

    it('restores the DM encryption default from local storage', async () => {
      localStorage.setItem('tjg-dm-privacy-preferences', '{"encryptByDefault":false}')
      const wrapper = mountPage()
      await flushPromises()
      expect((wrapper.vm as any).encryptByDefault).toBe(false)
    })
  })

  it('surfaces a toast when saving fails', async () => {
    setConfigMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    await (wrapper.vm as any).handleModeChange('blocklist')
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('surfaces a toast when loading fails', async () => {
    getConfigMock.mockRejectedValue(new Error('boom'))
    const _wrapper = mountPage()
    await flushPromises()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('stops loading even when the config load fails', async () => {
    getConfigMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).loading).toBe(false)
  })
})
