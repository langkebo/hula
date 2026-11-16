import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * admin service mock 工厂：仪表盘一次挂载只读三项子资源，
 * 逐项控制 fulfilled / rejected 以覆盖 partial 计数。
 */
const { getServerStatsMock, getServerHealthMock, getServerVersionMock, showFeedbackMock, handleAdminErrorMock, state } =
  vi.hoisted(() => ({
    getServerStatsMock: vi.fn(),
    getServerHealthMock: vi.fn(),
    getServerVersionMock: vi.fn(),
    showFeedbackMock: vi.fn(),
    handleAdminErrorMock: vi.fn(),
    state: { isAdmin: true }
  }))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getServerStats: (...args: unknown[]) => getServerStatsMock(...args),
    getServerHealth: (...args: unknown[]) => getServerHealthMock(...args),
    getServerVersion: (...args: unknown[]) => getServerVersionMock(...args)
  }
}))

vi.mock('@/stores/domains/admin/admin', () => ({
  useAdminStore: () => ({ isAdmin: state.isAdmin })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('../useAdminError', () => ({
  useAdminErrorHandler: () => ({
    handleAdminError: handleAdminErrorMock,
    ADMIN_PERMISSION_DENIED: 'ADMIN_PERMISSION_DENIED'
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, props: string[] = []) =>
    defineComponent({
      name,
      props,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NSpin: defineComponent({
      name: 'NSpin',
      props: ['show'],
      setup(props, { slots }) {
        return () => h('div', { 'data-test': 'NSpin', 'data-show': String(props.show) }, slots.default?.())
      }
    }),
    NDescriptions: passthrough('NDescriptions', ['bordered', 'column', 'labelPlacement']),
    NDescriptionsItem: passthrough('NDescriptionsItem', ['label'])
  }
})

import AdminDashboard from '../AdminDashboard.vue'

const STATS = {
  userCount: 128,
  roomCount: 32,
  dailyActiveUsers: 45,
  monthlyActiveUsers: 96,
  messageCount: 2048
}

const HEALTH = { healthy: true, checks: { database: { status: 'ok', value: 100 } } }

const VERSION = { serverVersion: '1.2.3', pythonVersion: '3.11' }

const mountDashboard = () => mount(AdminDashboard)

const partialBanner = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="partial-state"]')

describe('AdminDashboard — 四态与 partial 局部失败', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.isAdmin = true
    handleAdminErrorMock.mockReturnValue('')
    getServerStatsMock.mockResolvedValue(STATS)
    getServerHealthMock.mockResolvedValue(HEALTH)
    getServerVersionMock.mockResolvedValue(VERSION)
  })

  it('非管理员挂载时不发起任何请求', async () => {
    state.isAdmin = false

    const wrapper = mountDashboard()
    await flushPromises()

    expect(getServerStatsMock).not.toHaveBeenCalled()
    expect(getServerHealthMock).not.toHaveBeenCalled()
    expect(getServerVersionMock).not.toHaveBeenCalled()
    expect(partialBanner(wrapper).exists()).toBe(false)

    wrapper.unmount()
  })

  it('加载期间 NSpin 处于展示态，完成后收起', async () => {
    let resolveStats: ((value: typeof STATS) => void) | undefined
    getServerStatsMock.mockReturnValue(
      new Promise((resolve) => {
        resolveStats = resolve
      })
    )

    const wrapper = mountDashboard()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-test="NSpin"]').attributes('data-show')).toBe('true')

    resolveStats?.(STATS)
    await flushPromises()

    expect(wrapper.find('[data-test="NSpin"]').attributes('data-show')).toBe('false')

    wrapper.unmount()
  })

  it('三项全部成功时不展示 partial，并渲染统计与版本', async () => {
    const wrapper = mountDashboard()
    await flushPromises()

    expect(getServerStatsMock).toHaveBeenCalledTimes(1)
    expect(getServerHealthMock).toHaveBeenCalledTimes(1)
    expect(getServerVersionMock).toHaveBeenCalledTimes(1)
    expect(partialBanner(wrapper).exists()).toBe(false)
    expect(wrapper.text()).toContain('128')
    expect(wrapper.text()).toContain('32')
    expect(wrapper.text()).toContain('1.2.3')
    expect(wrapper.text()).toContain('3.11')

    wrapper.unmount()
  })

  it('部分子资源失败时展示 partial，成功项照常渲染、失败项显示占位', async () => {
    getServerHealthMock.mockRejectedValue(new Error('health-fail'))
    getServerVersionMock.mockRejectedValue(new Error('version-fail'))

    const wrapper = mountDashboard()
    await flushPromises()

    expect(partialBanner(wrapper).exists()).toBe(true)
    expect(partialBanner(wrapper).text()).toContain('admin.logs.partial_failed')
    // 统计仍来自成功项，不被失败拖成空态
    expect(wrapper.text()).toContain('128')
    // 版本读取失败不再声称有值，显示占位而非旧值
    expect(wrapper.text()).toContain('-')
    expect(wrapper.text()).not.toContain('1.2.3')

    wrapper.unmount()
  })

  it('健康检查失败时健康态为 unknown，不误报 unhealthy', async () => {
    getServerHealthMock.mockRejectedValue(new Error('health-fail'))

    const wrapper = mountDashboard()
    await flushPromises()

    expect(wrapper.text()).toContain('admin.dashboard.unknown')
    expect(wrapper.text()).not.toContain('admin.dashboard.unhealthy')

    wrapper.unmount()
  })

  it('点击重试只重读三项子资源，成功后清除 partial', async () => {
    getServerHealthMock.mockRejectedValueOnce(new Error('health-fail'))

    const wrapper = mountDashboard()
    await flushPromises()

    expect(partialBanner(wrapper).exists()).toBe(true)
    expect(getServerStatsMock).toHaveBeenCalledTimes(1)

    await wrapper.find('[data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(getServerStatsMock).toHaveBeenCalledTimes(2)
    expect(getServerHealthMock).toHaveBeenCalledTimes(2)
    expect(getServerVersionMock).toHaveBeenCalledTimes(2)
    expect(partialBanner(wrapper).exists()).toBe(false)
    expect(showFeedbackMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
