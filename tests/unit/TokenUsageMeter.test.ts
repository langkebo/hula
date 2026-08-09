import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TokenUsageMeter from '@/plugins/robot/components/TokenUsageMeter.vue'

describe('TokenUsageMeter', () => {
  it('renders used / total numbers and progressbar aria attrs', () => {
    const wrapper = mount(TokenUsageMeter, { props: { used: 250, total: 1000 } })
    const bar = wrapper.find('[data-testid="token-usage-meter-bar"]')
    expect(bar.attributes('role')).toBe('progressbar')
    expect(bar.attributes('aria-valuenow')).toBe('250')
    expect(bar.attributes('aria-valuemax')).toBe('1000')
    expect(wrapper.find('.token-usage-meter__used').text()).toBe('250')
    expect(wrapper.find('.token-usage-meter__total').text()).toBe('1000')
  })

  it('computes fill width percentage and clamps to [0, 100]', () => {
    const half = mount(TokenUsageMeter, { props: { used: 500, total: 1000 } })
    expect(half.find('[data-testid="token-usage-meter-fill"]').attributes('style')).toContain('width: 50%')

    const over = mount(TokenUsageMeter, { props: { used: 1500, total: 1000 } })
    expect(over.find('[data-testid="token-usage-meter-fill"]').attributes('style')).toContain('width: 100%')
  })

  it('marks level normal / warning / danger by usage ratio', () => {
    const normal = mount(TokenUsageMeter, { props: { used: 100, total: 1000 } })
    expect(normal.find('[data-testid="token-usage-meter"]').attributes('data-level')).toBe('normal')

    const warning = mount(TokenUsageMeter, { props: { used: 850, total: 1000 } })
    expect(warning.find('[data-testid="token-usage-meter"]').attributes('data-level')).toBe('warning')

    const danger = mount(TokenUsageMeter, { props: { used: 1000, total: 1000 } })
    expect(danger.find('[data-testid="token-usage-meter"]').attributes('data-level')).toBe('danger')
  })

  it('shows unlimited text and zero fill when total <= 0', () => {
    const wrapper = mount(TokenUsageMeter, { props: { used: 42, total: 0 } })
    expect(wrapper.find('.token-usage-meter__total').text()).toBe('ai_assistant.robot.unlimited')
    expect(wrapper.find('[data-testid="token-usage-meter-fill"]').attributes('style')).toContain('width: 0%')
    expect(wrapper.find('[data-testid="token-usage-meter"]').attributes('data-level')).toBe('normal')
  })
})
