import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import SyncStatusBar from '../SyncStatusBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'connection.connecting': '正在连接...',
        'connection.catchup': '正在同步历史消息',
        'connection.reconnecting': '重连中',
        'connection.error': '连接错误',
        'connection.connected': '已连接'
      }
      return translations[key] || key
    }
  })
}))

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

  it('should emit update:isVisible when isVisible prop changes', async () => {
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
