import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { DEFAULT_INVITE_POLICY, type InvitePolicy } from '@/services/matrix/user/invitePolicy'

const {
  waitForClientReadyMock,
  getFriendGroupsMock,
  getIncomingRequestsMock,
  getOutgoingRequestsMock,
  getInvitePolicyMock,
  setInvitePolicyMock
} = vi.hoisted(() => ({
  waitForClientReadyMock: vi.fn(),
  getFriendGroupsMock: vi.fn().mockResolvedValue([]),
  getIncomingRequestsMock: vi.fn().mockResolvedValue([]),
  getOutgoingRequestsMock: vi.fn().mockResolvedValue([]),
  getInvitePolicyMock: vi.fn(),
  setInvitePolicyMock: vi.fn()
}))

let resolveReady: () => void
let readyPromise: Promise<void>

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { waitForClientReady: (...args: unknown[]) => waitForClientReadyMock(...args) },
  default: { waitForClientReady: (...args: unknown[]) => waitForClientReadyMock(...args) }
}))

vi.mock('@/services/matrix/friends/MatrixFriendService', () => ({
  matrixFriendService: {
    getFriendGroups: (...args: unknown[]) => getFriendGroupsMock(...args),
    getIncomingRequests: (...args: unknown[]) => getIncomingRequestsMock(...args),
    getOutgoingRequests: (...args: unknown[]) => getOutgoingRequestsMock(...args)
  }
}))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getInvitePolicy: () => getInvitePolicyMock(),
    setInvitePolicy: (...args: unknown[]) => setInvitePolicyMock(...args)
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>' },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NForm: { name: 'NForm', template: '<form><slot /></form>' },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>' },
  NInput: { name: 'NInput', template: '<input />' },
  NModal: { name: 'NModal', template: '<div><slot /></div>' },
  NSpin: { name: 'NSpin', template: '<div><slot /></div>' },
  NSwitch: { name: 'NSwitch', template: '<div />' },
  useDialog: () => ({ warning: vi.fn() })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />' }
}))

import FriendsSettings from '../FriendsSettings.vue'

type FriendsVm = {
  allowFriendRequests: boolean
  autoAcceptFriends: boolean
  requireFriendRequestMessage: boolean
  handleToggle: () => Promise<void>
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as FriendsVm

const FRIEND_SETTINGS_KEY = 'tjg-friend-settings'

/** 完整的账号策略：mode/名单/allowStrangers 都不是 FriendsSettings 拥有的字段。 */
function accountPolicy(overrides: Partial<InvitePolicy> = {}): InvitePolicy {
  return {
    ...DEFAULT_INVITE_POLICY,
    mode: 'blocklist',
    blocklist: ['@blocked:evil.org'],
    allowlist: ['@allow:server'],
    allowStrangers: true,
    contacts: ['@friend:server'],
    ...overrides
  }
}

function primeReady() {
  readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  waitForClientReadyMock.mockReturnValue(readyPromise)
}

describe('FriendsSettings — P0-#3 客户端就绪竞态', () => {
  beforeEach(() => {
    getFriendGroupsMock.mockClear()
    getIncomingRequestsMock.mockClear()
    getOutgoingRequestsMock.mockClear()
    waitForClientReadyMock.mockClear()
    getInvitePolicyMock.mockReset()
    setInvitePolicyMock.mockReset()
    getInvitePolicyMock.mockResolvedValue(accountPolicy())
    setInvitePolicyMock.mockResolvedValue(true)
    localStorage.clear()
    primeReady()
  })

  it('onMounted 应先 await 客户端就绪，再拉取好友分组', async () => {
    const wrapper = mount(FriendsSettings)

    // 就绪前不应抢跑发请求
    expect(waitForClientReadyMock).toHaveBeenCalledTimes(1)
    expect(getFriendGroupsMock).not.toHaveBeenCalled()
    expect(getIncomingRequestsMock).not.toHaveBeenCalled()

    // 客户端就绪后，拉取才真正发生
    resolveReady()
    await flushPromises()
    await nextTick()

    expect(getFriendGroupsMock).toHaveBeenCalledTimes(1)
    expect(getIncomingRequestsMock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('客户端超时未就绪时不应让 onMounted 抛出未捕获错误', async () => {
    waitForClientReadyMock.mockRejectedValueOnce(new Error('not ready'))

    const wrapper = mount(FriendsSettings)
    await flushPromises()
    await nextTick()

    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })
})

/**
 * 好友请求三开关的归宿是账号级 `im.hula.invite_policy` account data。
 *
 * 验收限制：消费方在 synapse-rust 后端，前端无法给出「功能生效」的行为证据。
 * 本组用例只证明客户端契约：不再写旧的 localStorage key、写的是 account data、
 * 且写回不覆盖同一策略里其它编辑器拥有的字段。
 */
describe('FriendsSettings — 好友请求策略写入 InvitePolicy', () => {
  beforeEach(() => {
    getFriendGroupsMock.mockClear()
    getIncomingRequestsMock.mockClear()
    getOutgoingRequestsMock.mockClear()
    waitForClientReadyMock.mockClear()
    getInvitePolicyMock.mockReset()
    setInvitePolicyMock.mockReset()
    setInvitePolicyMock.mockResolvedValue(true)
    localStorage.clear()
    // 本组关注策略读写，直接让客户端就绪，避免 readyPromise 悬挂挡住 onMounted 后续步骤
    waitForClientReadyMock.mockResolvedValue(undefined)
  })

  it('reads the three switches from InvitePolicy and never touches tjg-friend-settings', async () => {
    getInvitePolicyMock.mockResolvedValue(
      accountPolicy({ allowFriendRequests: false, autoAcceptFriends: true, requireFriendRequestMessage: false })
    )

    const wrapper = mount(FriendsSettings)
    await flushPromises()

    expect(getInvitePolicyMock).toHaveBeenCalledTimes(1)
    const vm = getVm(wrapper)
    expect(vm.allowFriendRequests).toBe(false)
    expect(vm.autoAcceptFriends).toBe(true)
    expect(vm.requireFriendRequestMessage).toBe(false)
    expect(localStorage.getItem(FRIEND_SETTINGS_KEY)).toBeNull()

    wrapper.unmount()
  })

  it('writes the toggled flag back while preserving the fields it does not own', async () => {
    getInvitePolicyMock.mockResolvedValue(accountPolicy())
    const wrapper = mount(FriendsSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    vm.allowFriendRequests = false
    await vm.handleToggle()
    await flushPromises()

    expect(setInvitePolicyMock).toHaveBeenCalledTimes(1)
    const written = setInvitePolicyMock.mock.calls[0][0] as InvitePolicy
    expect(written.allowFriendRequests).toBe(false)
    // 本组件拥有的另外两个字段保持挂载时读到的值
    expect(written.autoAcceptFriends).toBe(false)
    expect(written.requireFriendRequestMessage).toBe(true)
    // 兄弟编辑器拥有的字段一个都不能丢
    expect(written.mode).toBe('blocklist')
    expect(written.blocklist).toEqual(['@blocked:evil.org'])
    expect(written.allowlist).toEqual(['@allow:server'])
    expect(written.allowStrangers).toBe(true)
    expect(written.contacts).toEqual(['@friend:server'])
    expect(localStorage.getItem(FRIEND_SETTINGS_KEY)).toBeNull()

    wrapper.unmount()
  })

  it('re-reads the policy before writing so a sibling editor edit is not clobbered', async () => {
    // 挂载时 blocklist 为空，写回前兄弟编辑器（BlockedUsersSection）刚加了一个人
    getInvitePolicyMock
      .mockResolvedValueOnce(accountPolicy({ blocklist: [] }))
      .mockResolvedValueOnce(accountPolicy({ blocklist: ['@added-by-sibling:server'] }))

    const wrapper = mount(FriendsSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    vm.autoAcceptFriends = true
    await vm.handleToggle()
    await flushPromises()

    expect(getInvitePolicyMock).toHaveBeenCalledTimes(2)
    const written = setInvitePolicyMock.mock.calls.at(-1)?.[0] as InvitePolicy
    expect(written.blocklist).toEqual(['@added-by-sibling:server'])
    expect(written.autoAcceptFriends).toBe(true)
    expect(localStorage.getItem(FRIEND_SETTINGS_KEY)).toBeNull()

    wrapper.unmount()
  })

  it('does not write anything when a toggle handler is not triggered', async () => {
    getInvitePolicyMock.mockResolvedValue(accountPolicy())
    const wrapper = mount(FriendsSettings)
    await flushPromises()

    expect(setInvitePolicyMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(FRIEND_SETTINGS_KEY)).toBeNull()

    wrapper.unmount()
  })
})
