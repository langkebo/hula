import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BlockedUsersSection from '../sections/BlockedUsersSection.vue'

/**
 * 屏蔽名单的唯一数据源是账号级邀请策略 `im.hula.invite_policy` 的 `blocklist`。
 *
 * mock 用**可变 state** 而不是固定返回值：组件写回后再读一次时，断言的是
 * 「account data 里最终是什么」而不是「mock 自己返回了什么」。
 */
const { getPolicyMock, getPolicyStrictMock, setPolicyMock, invitePolicyState } = vi.hoisted(() => {
  const invitePolicyState = {
    mode: 'blocklist',
    blocklist: ['@spam:evil.org'] as string[],
    allowlist: [] as string[],
    allowStrangers: false,
    contacts: [] as string[]
  }

  return {
    invitePolicyState,
    getPolicyMock: vi.fn(),
    getPolicyStrictMock: vi.fn(),
    setPolicyMock: vi.fn()
  }
})

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getInvitePolicy: () => getPolicyMock(),
    getInvitePolicyStrict: () => getPolicyStrictMock(),
    setInvitePolicy: (...a: unknown[]) => setPolicyMock(...(a as [typeof invitePolicyState]))
  }
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

type BlockedVm = {
  blockedUsers: string[]
  newBlockedUser: string
  handleAddBlocked: () => Promise<boolean>
  handleUnblock: (id: string) => Promise<void>
}

const getBlockedVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as BlockedVm

describe('BlockedUsersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    invitePolicyState.mode = 'blocklist'
    invitePolicyState.blocklist = ['@spam:evil.org']
    invitePolicyState.allowlist = []
    invitePolicyState.allowStrangers = false
    invitePolicyState.contacts = []

    getPolicyMock.mockImplementation(async () => ({
      ...invitePolicyState,
      blocklist: [...invitePolicyState.blocklist],
      allowlist: [...invitePolicyState.allowlist]
    }))
    // 写路径走严格变体：默认与宽松变体返回同一份「账号上的最新策略」
    getPolicyStrictMock.mockImplementation(async () => ({
      ...invitePolicyState,
      blocklist: [...invitePolicyState.blocklist],
      allowlist: [...invitePolicyState.allowlist]
    }))
    setPolicyMock.mockImplementation(async (policy: typeof invitePolicyState) => {
      Object.assign(invitePolicyState, policy)
      return true
    })
  })

  it('从邀请策略读取屏蔽名单，而不是 localStorage', async () => {
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()
    expect(getPolicyMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('@spam:evil.org')
    expect(localStorage.getItem('tjg-blocked-users')).toBeNull()
  })

  it('取消屏蔽写回邀请策略', async () => {
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()
    await getBlockedVm(wrapper).handleUnblock('@spam:evil.org')
    expect(setPolicyMock).toHaveBeenCalledWith(expect.objectContaining({ blocklist: [] }))
  })

  it('添加屏蔽写回邀请策略且不改动 mode', async () => {
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()
    const vm = getBlockedVm(wrapper)
    vm.newBlockedUser = '@new:evil.org'
    await vm.handleAddBlocked()
    expect(setPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({ blocklist: ['@spam:evil.org', '@new:evil.org'] })
    )
    expect(invitePolicyState.mode).toBe('blocklist')
  })

  /**
   * Minor #8：原来的 load-failure 用例只断言 `wrapper.html()` 为真值，等于什么都没验证。
   * 这里断言真实行为：加载失败后不写回，绝不会拿 `normalizeInvitePolicy(null)` 的
   * 默认策略（mode: allow_all + 空名单）覆盖账号上已有的策略。
   */
  it('加载失败后不写回，也不把默认策略覆盖到账号', async () => {
    getPolicyMock.mockRejectedValue(new Error('offline'))
    getPolicyStrictMock.mockRejectedValue(new Error('offline'))
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()

    const vm = getBlockedVm(wrapper)
    vm.newBlockedUser = '@new:evil.org'
    await vm.handleAddBlocked()
    await flushPromises()

    expect(setPolicyMock).not.toHaveBeenCalled()
    expect(vm.blockedUsers).toEqual([])
  })

  /**
   * 评审 Important #1（同类残留）：写前重读必须用严格变体。宽松的
   * `getInvitePolicy()` 在读取失败时返回默认策略（mode: allow_all + 空名单），
   * 若拿它当基线再写回，一次读失败就会把账号上已有的策略整份删成默认值。
   */
  it('写前严格重读失败时中止写入，不拿默认策略覆盖账号', async () => {
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()

    getPolicyStrictMock.mockRejectedValue(new TypeError('read failed'))

    const vm = getBlockedVm(wrapper)
    vm.newBlockedUser = '@new:evil.org'
    await vm.handleAddBlocked()
    await flushPromises()

    expect(setPolicyMock).not.toHaveBeenCalled()
    // account data 一字未动
    expect(invitePolicyState.mode).toBe('blocklist')
    expect(invitePolicyState.blocklist).toEqual(['@spam:evil.org'])
  })

  /**
   * Important #2：`SecuritySettings` 同时挂了 `InvitePermissionPanel`，两者写同一份
   * account data。若用挂载时的快照整份写回，对方后来的改动会被静默覆盖
   * （评审给的复现：先在这里屏蔽 @A，再去面板点模式 → @A 被解除屏蔽）。
   */
  it('写回前重读最新策略，不覆盖另一编辑器的改动', async () => {
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()

    // 面板在本组件挂载之后往同一份策略里加了人
    invitePolicyState.blocklist = ['@spam:evil.org', '@other:evil.org']

    await getBlockedVm(wrapper).handleUnblock('@spam:evil.org')

    expect(setPolicyMock).toHaveBeenCalledWith(expect.objectContaining({ blocklist: ['@other:evil.org'] }))
    expect(invitePolicyState.mode).toBe('blocklist')
  })
})
