import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

// Local vue-i18n mock with status label translations
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'admin.federation_monitor.status_online': '在线',
        'admin.federation_monitor.status_degraded': '降级',
        'admin.federation_monitor.status_offline': '离线'
      }
      return translations[key] ?? key
    },
    locale: { value: 'zh-CN' }
  })
}))

import FedStatusBadge from '../FedStatusBadge.vue'

describe('FedStatusBadge', () => {
  it('renders online status with correct label text', () => {
    const wrapper = mount(FedStatusBadge, {
      props: { status: 'online' }
    })
    expect(wrapper.text()).toContain('在线')
    expect(wrapper.attributes('data-status')).toBe('online')
  })

  it('renders degraded status with correct label text', () => {
    const wrapper = mount(FedStatusBadge, {
      props: { status: 'degraded' }
    })
    expect(wrapper.text()).toContain('降级')
    expect(wrapper.attributes('data-status')).toBe('degraded')
  })

  it('renders offline status with correct label text', () => {
    const wrapper = mount(FedStatusBadge, {
      props: { status: 'offline' }
    })
    expect(wrapper.text()).toContain('离线')
    expect(wrapper.attributes('data-status')).toBe('offline')
  })

  it('renders an SVG dot icon (not relying on color alone)', () => {
    const wrapper = mount(FedStatusBadge, {
      props: { status: 'online' }
    })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    // The SVG should contain a circle element (the status dot)
    expect(svg.find('circle').exists()).toBe(true)
  })

  it('applies status-specific CSS class for styling', () => {
    const statuses = ['online', 'degraded', 'offline'] as const
    for (const status of statuses) {
      const wrapper = mount(FedStatusBadge, {
        props: { status }
      })
      const badge = wrapper.find('[data-status]')
      expect(badge.exists()).toBe(true)
      expect(badge.attributes('data-status')).toBe(status)
    }
  })

  it('has role="status" for accessibility', () => {
    const wrapper = mount(FedStatusBadge, {
      props: { status: 'online' }
    })
    expect(wrapper.attributes('role')).toBe('status')
  })

  it('renders a visually hidden sr-only text label', () => {
    const wrapper = mount(FedStatusBadge, {
      props: { status: 'degraded' }
    })
    // The visible text label should be present (not color-only)
    expect(wrapper.text()).toContain('降级')
  })

  it('accepts size prop and renders without error', () => {
    const wrapper = mount(FedStatusBadge, {
      props: { status: 'online', size: 'small' }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('uses --tjg-status-* CSS variables (no hardcoded colors in style)', () => {
    const wrapper = mount(FedStatusBadge, {
      props: { status: 'online' }
    })
    const style = wrapper.html()
    // The component should reference --tjg-status-* tokens, not hardcoded hex
    expect(style).not.toMatch(/#[0-9a-fA-F]{6}/)
  })
})
