import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18nMock } from '~/tests/i18n-messages'
import SyncStatusBar from '../SyncStatusBar.vue'

// 真实语言表驱动，而非手写文案 stub —— 见 `~/tests/i18n-messages`。
// 本文件原先手写了一张 key → 中文映射表（含当时源码里错误的
// `connection.*` 键名，实际应为 `chat.connection.*`），源码写错键名时测试依然全绿。
vi.mock('vue-i18n', () => createI18nMock())

describe('SyncStatusBar', () => {
  const createWrapper = (props = {}) => {
    return mount(SyncStatusBar, {
      props: {
        connectionState: 'CONNECTED',
        ...props
      }
    })
  }

  it('should render CONNECTING state with spinner icon', async () => {
    const wrapper = createWrapper({ connectionState: 'CONNECTING' })
    await nextTick()

    const bar = wrapper.find('.sync-status-bar')
    expect(bar.exists()).toBe(true)
    expect(bar.find('.sync-status-bar__label').text()).toBe('正在连接...')
    expect(bar.find('.status-icon--connecting svg').exists()).toBe(true)
    // 通过 DOM 属性检查
    expect(bar.element.outerHTML).toContain('role="status"')
    expect(bar.element.outerHTML).toContain('aria-label')
  })

  it('should render CATCHUP state with sync icon and progress', async () => {
    const wrapper = createWrapper({ connectionState: 'CATCHUP', syncProgress: 45 })
    await nextTick()

    expect(wrapper.find('.sync-status-bar__label').text()).toBe('正在同步历史消息')
    expect(wrapper.find('.status-icon--catchup svg').exists()).toBe(true)
    expect(wrapper.find('.sync-status-bar__detail').text()).toContain('45%')
  })

  it('should render RECONNECTING state with refresh icon and count', async () => {
    const wrapper = createWrapper({ connectionState: 'RECONNECTING', reconnectCount: 3 })
    await nextTick()

    expect(wrapper.find('.sync-status-bar__label').text()).toBe('重连中')
    expect(wrapper.find('.status-icon--reconnecting svg').exists()).toBe(true)
    expect(wrapper.find('.sync-status-bar__detail').text()).toContain('第 3 次')
  })

  it('should render ERROR state with alert icon and retry button', async () => {
    const wrapper = createWrapper({ connectionState: 'ERROR' })
    await nextTick()

    expect(wrapper.find('.sync-status-bar__label').text()).toBe('连接错误')
    expect(wrapper.find('.status-icon--error svg').exists()).toBe(true)
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('button').text()).toBe('重试')
  })

  it('should emit retry event when retry button is clicked', async () => {
    const wrapper = createWrapper({ connectionState: 'ERROR' })
    await nextTick()

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('should render CONNECTED state with check icon', async () => {
    const wrapper = createWrapper({ connectionState: 'CONNECTED' })
    await nextTick()

    expect(wrapper.find('.sync-status-bar__label').text()).toBe('已连接')
    expect(wrapper.find('.status-icon--connected svg').exists()).toBe(true)
  })

  it('should not render when isVisible is false', async () => {
    const wrapper = createWrapper({ isVisible: false })
    await nextTick()

    expect(wrapper.find('.sync-status-bar').exists()).toBe(false)
  })

  it('should render with custom data-testid', async () => {
    const wrapper = createWrapper({ dataTestId: 'custom-sync-status' })
    await nextTick()

    const bar = wrapper.find('.sync-status-bar')
    expect(bar.element.outerHTML).toContain('data-testid="custom-sync-status"')
  })

  it('should hide when isVisible prop turns false', async () => {
    const wrapper = createWrapper({ isVisible: true })
    await nextTick()

    expect(wrapper.find('.sync-status-bar').exists()).toBe(true)

    await wrapper.setProps({ isVisible: false })
    await nextTick()

    expect(wrapper.find('.sync-status-bar').exists()).toBe(false)
  })

  it('should show aria-label with reconnect count', async () => {
    const wrapper = createWrapper({ connectionState: 'RECONNECTING', reconnectCount: 2 })
    await nextTick()

    const bar = wrapper.find('.sync-status-bar')
    expect(bar.element.outerHTML).toContain('第 2 次')
  })

  it('should show aria-label with sync progress', async () => {
    const wrapper = createWrapper({ connectionState: 'CATCHUP', syncProgress: 78 })
    await nextTick()

    const bar = wrapper.find('.sync-status-bar')
    expect(bar.element.outerHTML).toContain('78%')
  })
})

/**
 * CONNECTED 自动收起 + 重试加锁
 *
 * 回归背景：本组件原先声明了 `autoHideTimer` 却从未赋值，
 * 注释承诺的「CONNECTED 延迟 2 秒自动隐藏」实际未实现 ——
 * 「已连接」横幅会永久驻留；`isRetrying` 同样恒为 false，
 * 重试按钮可被连续点击并反复触发父组件重连。
 */
describe('SyncStatusBar - 自动收起与重试加锁', () => {
  const createWrapper = (props = {}) =>
    mount(SyncStatusBar, {
      props: {
        connectionState: 'CONNECTED',
        ...props
      }
    })

  const AUTO_HIDE_DELAY = 2000
  const RETRY_LOCK_TIMEOUT = 8000

  it('CONNECTED 状态应在 2 秒后自动收起', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = createWrapper({ connectionState: 'CONNECTED' })
      expect(wrapper.find('.sync-status-bar').exists()).toBe(true)

      vi.advanceTimersByTime(AUTO_HIDE_DELAY - 1)
      await nextTick()
      expect(wrapper.find('.sync-status-bar').exists(), '未到期不应提前收起').toBe(true)

      vi.advanceTimersByTime(1)
      await nextTick()
      expect(wrapper.find('.sync-status-bar').exists(), '到期后应自动收起').toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('非 CONNECTED 状态不应自动收起', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = createWrapper({ connectionState: 'CATCHUP' })
      vi.advanceTimersByTime(30_000)
      await nextTick()

      expect(wrapper.find('.sync-status-bar').exists()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('自动收起后状态再变化应重新显示', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = createWrapper({ connectionState: 'CONNECTED' })
      vi.advanceTimersByTime(AUTO_HIDE_DELAY)
      await nextTick()
      expect(wrapper.find('.sync-status-bar').exists()).toBe(false)

      await wrapper.setProps({ connectionState: 'RECONNECTING' })
      await nextTick()

      expect(wrapper.find('.sync-status-bar').exists(), '新状态应重新露出').toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('重试按钮应加锁：同一 tick 内连点只触发一次 retry', async () => {
    const wrapper = createWrapper({ connectionState: 'ERROR' })
    const button = wrapper.find('button')

    // 关键：同一 tick 内连续派发点击。此刻 `:disabled` 尚未渲染到 DOM，
    // 去重**只能**依赖组件内的加锁守卫，而非 DOM 的 disabled 属性。
    // （若改用 await trigger()，第一次点击后 disabled 已生效，
    //   守卫即使被删除用例也会通过 —— 那是假绿。）
    button.element.dispatchEvent(new Event('click'))
    button.element.dispatchEvent(new Event('click'))
    button.element.dispatchEvent(new Event('click'))
    await nextTick()

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('加锁后按钮应呈禁用态（第二道防线）', async () => {
    const wrapper = createWrapper({ connectionState: 'ERROR' })
    const button = wrapper.find('button')

    await button.trigger('click')
    await nextTick()

    expect(button.attributes('disabled')).toBeDefined()
  })

  it('父组件未响应时，重试锁定应在保护超时后自动解除', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = createWrapper({ connectionState: 'ERROR' })
      const button = wrapper.find('button')

      await button.trigger('click')
      expect(wrapper.emitted('retry')).toHaveLength(1)

      vi.advanceTimersByTime(RETRY_LOCK_TIMEOUT)
      await nextTick()

      await button.trigger('click')
      expect(wrapper.emitted('retry'), '超时后应恢复可重试').toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('状态离开 ERROR 后应解除重试锁定', async () => {
    const wrapper = createWrapper({ connectionState: 'ERROR' })
    await wrapper.find('button').trigger('click')

    await wrapper.setProps({ connectionState: 'CONNECTING' })
    await nextTick()
    await wrapper.setProps({ connectionState: 'ERROR' })
    await nextTick()

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(2)
  })
})
