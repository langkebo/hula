import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BlockedUsersSection from '../sections/BlockedUsersSection.vue'

const { getPolicyMock, setPolicyMock } = vi.hoisted(() => ({
  getPolicyMock: vi.fn(),
  setPolicyMock: vi.fn()
}))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getInvitePolicy: () => getPolicyMock(),
    setInvitePolicy: (...a: unknown[]) => setPolicyMock(...a)
  }
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

describe('BlockedUsersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getPolicyMock.mockResolvedValue({
      mode: 'blocklist',
      blocklist: ['@spam:evil.org'],
      allowlist: [],
      allowStrangers: false,
      contacts: []
    })
    setPolicyMock.mockResolvedValue(true)
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
    await (wrapper.vm as unknown as { handleUnblock: (id: string) => Promise<void> }).handleUnblock('@spam:evil.org')
    expect(setPolicyMock).toHaveBeenCalledWith(expect.objectContaining({ blocklist: [] }))
  })

  it('加载失败不抛错', async () => {
    getPolicyMock.mockRejectedValue(new Error('offline'))
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()
    expect(wrapper.html()).toBeTruthy()
  })
})
