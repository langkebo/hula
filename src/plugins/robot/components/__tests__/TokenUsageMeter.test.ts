import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'ai_assistant.robot.token_usage': 'Token Usage',
        'ai_assistant.robot.token_limit_hint': 'Token limit hint',
        'ai_assistant.robot.unlimited': 'Unlimited'
      }
      if (params) {
        return translations[key] ?? key
      }
      return translations[key] ?? key
    },
    locale: { value: 'en' }
  })
}))

import TokenUsageMeter from '../TokenUsageMeter.vue'

const mountMeter = (props: { used: number; total: number }) => mount(TokenUsageMeter, { props })

describe('TokenUsageMeter', () => {
  it('renders used and total values', () => {
    const wrapper = mountMeter({ used: 500, total: 1000 })
    const text = wrapper.find('[data-testid="token-usage-meter"]').text()
    expect(text).toContain('500')
    expect(text).toContain('1000')
  })

  it('renders a progress bar element', () => {
    const wrapper = mountMeter({ used: 500, total: 1000 })
    expect(wrapper.find('[data-testid="token-usage-meter-bar"]').exists()).toBe(true)
  })

  it('renders progress fill element', () => {
    const wrapper = mountMeter({ used: 500, total: 1000 })
    expect(wrapper.find('[data-testid="token-usage-meter-fill"]').exists()).toBe(true)
  })

  it('sets data-level to normal when usage is below 80%', () => {
    const wrapper = mountMeter({ used: 700, total: 1000 })
    expect(wrapper.find('[data-testid="token-usage-meter"]').attributes('data-level')).toBe('normal')
  })

  it('sets data-level to warning when usage is between 80% and 100%', () => {
    const wrapper = mountMeter({ used: 850, total: 1000 })
    expect(wrapper.find('[data-testid="token-usage-meter"]').attributes('data-level')).toBe('warning')
  })

  it('sets data-level to danger when usage reaches 100%', () => {
    const wrapper = mountMeter({ used: 1000, total: 1000 })
    expect(wrapper.find('[data-testid="token-usage-meter"]').attributes('data-level')).toBe('danger')
  })

  it('sets data-level to danger when usage exceeds 100%', () => {
    const wrapper = mountMeter({ used: 1200, total: 1000 })
    expect(wrapper.find('[data-testid="token-usage-meter"]').attributes('data-level')).toBe('danger')
  })

  it('handles total of 0 as unlimited', () => {
    const wrapper = mountMeter({ used: 500, total: 0 })
    expect(wrapper.find('[data-testid="token-usage-meter"]').attributes('data-level')).toBe('normal')
    expect(wrapper.find('[data-testid="token-usage-meter-fill"]').exists()).toBe(true)
  })

  it('calculates fill width as percentage of used/total', () => {
    const wrapper = mountMeter({ used: 250, total: 1000 })
    const fill = wrapper.find('[data-testid="token-usage-meter-fill"]')
    expect(fill.attributes('style')).toContain('width')
    expect(fill.attributes('style')).toContain('25%')
  })

  it('caps fill width at 100% when usage exceeds total', () => {
    const wrapper = mountMeter({ used: 1500, total: 1000 })
    const fill = wrapper.find('[data-testid="token-usage-meter-fill"]')
    expect(fill.attributes('style')).toContain('100%')
  })

  it('does not contain hardcoded hex colors in inline styles', () => {
    const wrapper = mountMeter({ used: 500, total: 1000 })
    const html = wrapper.html()
    expect(html).not.toMatch(/style="[^"]*#[0-9a-fA-F]{3,8}/)
  })

  it('renders with role="progressbar" for accessibility', () => {
    const wrapper = mountMeter({ used: 500, total: 1000 })
    expect(wrapper.find('[data-testid="token-usage-meter-bar"]').attributes('role')).toBe('progressbar')
  })

  it('sets aria-valuenow, aria-valuemin, aria-valuemax on progressbar', () => {
    const wrapper = mountMeter({ used: 500, total: 1000 })
    const bar = wrapper.find('[data-testid="token-usage-meter-bar"]')
    expect(bar.attributes('aria-valuenow')).toBe('500')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('1000')
  })
})
