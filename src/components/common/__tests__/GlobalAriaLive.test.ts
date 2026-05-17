import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAriaLive } from '@/composables/common/useAriaLive'
import GlobalAriaLive from '../GlobalAriaLive.vue'

describe('GlobalAriaLive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAriaLive().clearAnnouncements()
  })

  afterEach(() => {
    useAriaLive().clearAnnouncements()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('renders polite and assertive announcements in separate live regions', async () => {
    const wrapper = mount(GlobalAriaLive)
    const { announce } = useAriaLive()

    announce('筛选条件已更新', 'polite')
    announce('空间加入失败', 'assertive')
    await wrapper.vm.$nextTick()

    const statusNode = wrapper.find('[role="status"]')
    const alertNode = wrapper.find('[role="alert"]')

    expect(statusNode.exists()).toBe(true)
    expect(statusNode.text()).toContain('筛选条件已更新')
    expect(alertNode.exists()).toBe(true)
    expect(alertNode.text()).toContain('空间加入失败')
  })

  it('clears announcements after the timeout so repeated messages can be replayed', async () => {
    const wrapper = mount(GlobalAriaLive)
    const { announce } = useAriaLive()

    announce('同步已恢复', 'polite')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)

    vi.advanceTimersByTime(1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
