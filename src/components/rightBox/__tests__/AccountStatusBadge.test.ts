import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18nMock, resolveMessage } from '~/tests/i18n-messages'
import AccountStatusBadge from '../AccountStatusBadge.vue'

const capabilityState = vi.hoisted(() => ({ available: true }))
const getAccountStatusesMock = vi.hoisted(() => vi.fn())

vi.mock('vue-i18n', () => createI18nMock())

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  useServerCapability: () => ({
    isCapabilityAvailable: (capability: string) => capabilityState.available && capability === 'account-status'
  })
}))

vi.mock('@/services/matrix/user/MatrixAccountStatusService', () => ({
  matrixAccountStatusService: {
    getAccountStatuses: getAccountStatusesMock
  }
}))

const mountBadge = (props: { userId: string; status?: 'normal' | 'locked' | 'suspended' | 'unknown' }) =>
  mount(AccountStatusBadge, { props })

describe('AccountStatusBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capabilityState.available = true
    getAccountStatusesMock.mockResolvedValue({})
  })

  it('能力不可用时完全不渲染，也不发起请求', async () => {
    capabilityState.available = false
    const wrapper = mountBadge({ userId: '@alice:matrix.test', status: 'normal' })
    await flushPromises()

    expect(wrapper.find('[data-testid="account-status-badge"]').exists()).toBe(false)
    expect(getAccountStatusesMock).not.toHaveBeenCalled()
  })

  it.each([
    ['normal', 'friend.detail.account_status_normal'],
    ['locked', 'friend.detail.account_status_locked'],
    ['suspended', 'friend.detail.account_status_suspended'],
    ['unknown', 'friend.detail.account_status_unknown']
  ] as const)('渲染 %s 态与对应文案', (status, key) => {
    const wrapper = mountBadge({ userId: '@alice:matrix.test', status })

    const badge = wrapper.find('[data-testid="account-status-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-status')).toBe(status)
    expect(badge.text()).toContain(resolveMessage(key))
    expect(badge.find('svg').exists()).toBe(true)
  })

  it('上游直接传入状态时不请求服务', async () => {
    mountBadge({ userId: '@alice:matrix.test', status: 'locked' })
    await flushPromises()

    expect(getAccountStatusesMock).not.toHaveBeenCalled()
  })

  it('自行拉取：locked 优先于 suspended', async () => {
    getAccountStatusesMock.mockResolvedValue({
      '@alice:matrix.test': { locked: true, suspended: true }
    })
    const wrapper = mountBadge({ userId: '@alice:matrix.test' })
    await flushPromises()

    expect(getAccountStatusesMock).toHaveBeenCalledWith(['@alice:matrix.test'])
    expect(wrapper.find('[data-testid="account-status-badge"]').attributes('data-status')).toBe('locked')
  })

  it('自行拉取：无状态记录时回退为未知态', async () => {
    const wrapper = mountBadge({ userId: '@alice:matrix.test' })
    await flushPromises()

    expect(wrapper.find('[data-testid="account-status-badge"]').attributes('data-status')).toBe('unknown')
  })

  it('自行拉取：普通状态映射为 normal', async () => {
    getAccountStatusesMock.mockResolvedValue({
      '@alice:matrix.test': { locked: false, suspended: false }
    })
    const wrapper = mountBadge({ userId: '@alice:matrix.test' })
    await flushPromises()

    expect(wrapper.find('[data-testid="account-status-badge"]').attributes('data-status')).toBe('normal')
  })
})
