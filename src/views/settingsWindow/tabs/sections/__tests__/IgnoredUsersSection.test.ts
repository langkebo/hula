import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IgnoredUsersSection from '../IgnoredUsersSection.vue'

/**
 * 忽略用户列表四态。
 *
 * 回归背景：读取失败曾被渲染成 `n-empty`（「无忽略用户」），
 * 用户会误以为屏蔽列表已被清空。
 */

const { getIgnoredUsersMock, setIgnoredUsersMock, showFeedbackMock } = vi.hoisted(() => ({
  getIgnoredUsersMock: vi.fn(),
  setIgnoredUsersMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))
vi.mock('@/composables/common/useWindowSessionReady', () => ({
  useWindowSessionReady: () => ({ ensureSessionReady: async () => 'ready' })
}))
vi.mock('@/composables/user/useAccount', () => ({
  useAccount: () => ({
    getIgnoredUsers: (...args: unknown[]) => getIgnoredUsersMock(...args),
    setIgnoredUsers: (...args: unknown[]) => setIgnoredUsersMock(...args)
  })
}))
vi.mock('naive-ui', () => ({
  NSpin: { name: 'NSpin', template: '<div><slot /></div>' },
  NEmpty: { name: 'NEmpty', props: ['description'], template: '<div data-testid="n-empty">{{ description }}</div>' },
  NButton: {
    name: 'NButton',
    emits: ['click'],
    template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
  }
}))

const mountSection = () => mount(IgnoredUsersSection)

describe('IgnoredUsersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setIgnoredUsersMock.mockResolvedValue(true)
  })

  it('读取成功时渲染忽略用户列表', async () => {
    getIgnoredUsersMock.mockResolvedValue(['@spam:evil.org'])

    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('.ignored-list').exists()).toBe(true)
    expect(wrapper.text()).toContain('@spam:evil.org')
    expect(wrapper.find('[data-testid="n-empty"]').exists()).toBe(false)
  })

  it('读取失败时展示错误与重试，而不是「无忽略用户」空态', async () => {
    getIgnoredUsersMock.mockRejectedValue(new Error('network down'))

    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('.ignored-error').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ignored-users-retry"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('setting.security.no_ignored_users')
  })

  it('点击重试后重新拉取并渲染列表', async () => {
    getIgnoredUsersMock.mockRejectedValueOnce(new Error('network down'))
    getIgnoredUsersMock.mockResolvedValueOnce(['@spam:evil.org'])

    const wrapper = mountSection()
    await flushPromises()
    expect(wrapper.find('.ignored-error').exists()).toBe(true)

    await wrapper.find('[data-testid="ignored-users-retry"]').trigger('click')
    await flushPromises()

    expect(getIgnoredUsersMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.ignored-error').exists()).toBe(false)
    expect(wrapper.text()).toContain('@spam:evil.org')
  })

  it('真正的空列表才渲染空态', async () => {
    getIgnoredUsersMock.mockResolvedValue([])

    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('[data-testid="n-empty"]').exists()).toBe(true)
    expect(wrapper.find('.ignored-error').exists()).toBe(false)
  })
})
