import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AdminStatCard from '../AdminStatCard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'admin.common.trendUp' && params) return `+${params.value}`
      if (key === 'admin.common.trendDown' && params) return `-${params.value}`
      return key
    }
  })
}))

describe('AdminStatCard', () => {
  const baseProps = {
    label: '总用户数',
    value: 1280,
    icon: 'M12 4.354a4 4 0 110 5.292'
  }

  it('renders label, value and icon', () => {
    const wrapper = mount(AdminStatCard, { props: baseProps })
    expect(wrapper.find('.admin-stat-card__label').text()).toBe('总用户数')
    expect(wrapper.find('.admin-stat-card__value').text()).toBe('1280')
    expect(wrapper.find('.admin-stat-card__icon path').attributes('d')).toBe(baseProps.icon)
  })

  it('renders string values verbatim', () => {
    const wrapper = mount(AdminStatCard, { props: { ...baseProps, value: '1.2k' } })
    expect(wrapper.find('.admin-stat-card__value').text()).toBe('1.2k')
  })

  it('applies default icon background token when no color provided', () => {
    const wrapper = mount(AdminStatCard, { props: baseProps })
    const iconWrap = wrapper.find('.admin-stat-card__icon')
    expect(iconWrap.attributes('style') ?? '').toContain('--tjg-color-primary-500')
  })

  it('applies custom color var when color prop provided', () => {
    const wrapper = mount(AdminStatCard, { props: { ...baseProps, color: 'var(--tjg-color-info-500)' } })
    const iconWrap = wrapper.find('.admin-stat-card__icon')
    expect(iconWrap.attributes('style') ?? '').toContain('var(--tjg-color-info-500)')
  })

  it('uses 1.5px stroke width for icon svg', () => {
    const wrapper = mount(AdminStatCard, { props: baseProps })
    expect(wrapper.find('.admin-stat-card__icon svg').attributes('stroke-width')).toBe('1.5')
  })

  it('does not render trend block when trend is undefined', () => {
    const wrapper = mount(AdminStatCard, { props: baseProps })
    expect(wrapper.find('.admin-stat-card__trend').exists()).toBe(false)
  })

  it('renders up trend with upward modifier', () => {
    const wrapper = mount(AdminStatCard, {
      props: { ...baseProps, trend: { value: '12%', direction: 'up' } }
    })
    const trend = wrapper.find('.admin-stat-card__trend')
    expect(trend.exists()).toBe(true)
    expect(trend.classes()).toContain('admin-stat-card__trend--up')
    expect(trend.text()).toContain('12%')
  })

  it('renders down trend with downward modifier', () => {
    const wrapper = mount(AdminStatCard, {
      props: { ...baseProps, trend: { value: '5%', direction: 'down' } }
    })
    const trend = wrapper.find('.admin-stat-card__trend')
    expect(trend.classes()).toContain('admin-stat-card__trend--down')
  })

  it('renders neutral trend without up/down modifier', () => {
    const wrapper = mount(AdminStatCard, {
      props: { ...baseProps, trend: { value: '0%', direction: 'neutral' } }
    })
    const trend = wrapper.find('.admin-stat-card__trend')
    expect(trend.classes()).not.toContain('admin-stat-card__trend--up')
    expect(trend.classes()).not.toContain('admin-stat-card__trend--down')
  })

  it('renders trend label when provided', () => {
    const wrapper = mount(AdminStatCard, {
      props: { ...baseProps, trend: { value: '12%', direction: 'up', label: '较昨日' } }
    })
    expect(wrapper.find('.admin-stat-card__trend').text()).toContain('较昨日')
  })
})
