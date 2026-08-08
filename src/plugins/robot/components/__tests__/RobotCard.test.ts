import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'ai_assistant.robot.available': 'Available',
        'ai_assistant.robot.unavailable': 'Unavailable',
        'ai_assistant.robot.message_count': '{count} messages'
      }
      if (key === 'ai_assistant.robot.message_count') {
        return `${params?.count} messages`
      }
      return translations[key] ?? key
    },
    locale: { value: 'en' }
  })
}))

import RobotCard from '../RobotCard.vue'

interface RobotData {
  id: string
  name: string
  avatar?: string
  model?: string
  online?: boolean
  messageCount?: number
  time?: string
}

const sampleRobot: RobotData = {
  id: 'r1',
  name: 'GPT-4 Assistant',
  avatar: 'https://example.com/avatar.png',
  model: 'GPT-4',
  online: true,
  messageCount: 42,
  time: '12:30'
}

const mountCard = (props: Partial<{ robot: RobotData; active: boolean }> = {}) =>
  mount(RobotCard, { props: { robot: sampleRobot, ...props } })

describe('RobotCard', () => {
  it('renders robot name', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="robot-card-name"]').text()).toContain('GPT-4 Assistant')
  })

  it('renders avatar image when avatar provided', () => {
    const wrapper = mountCard()
    const img = wrapper.find('[data-testid="robot-card-avatar-img"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/avatar.png')
  })

  it('renders avatar placeholder (first letter) when no avatar', () => {
    const wrapper = mountCard({ robot: { ...sampleRobot, avatar: undefined } })
    const placeholder = wrapper.find('[data-testid="robot-card-avatar-placeholder"]')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toBe('G')
  })

  it('renders model badge when model provided', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="robot-card-model"]').text()).toContain('GPT-4')
  })

  it('hides model badge when no model', () => {
    const wrapper = mountCard({ robot: { ...sampleRobot, model: undefined } })
    expect(wrapper.find('[data-testid="robot-card-model"]').exists()).toBe(false)
  })

  it('renders online status indicator when online is true', () => {
    const wrapper = mountCard({ robot: { ...sampleRobot, online: true } })
    expect(wrapper.find('[data-testid="robot-card-status-online"]').exists()).toBe(true)
  })

  it('renders offline status indicator when online is false', () => {
    const wrapper = mountCard({ robot: { ...sampleRobot, online: false } })
    expect(wrapper.find('[data-testid="robot-card-status-offline"]').exists()).toBe(true)
  })

  it('hides status indicator when online is undefined', () => {
    const wrapper = mountCard({ robot: { ...sampleRobot, online: undefined } })
    expect(wrapper.find('[data-testid="robot-card-status-online"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="robot-card-status-offline"]').exists()).toBe(false)
  })

  it('renders message count when provided', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="robot-card-message-count"]').text()).toContain('42')
  })

  it('renders time when provided', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="robot-card-time"]').text()).toContain('12:30')
  })

  it('emits click when card is clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="robot-card"]').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('applies active class when active prop is true', () => {
    const wrapper = mountCard({ active: true })
    expect(wrapper.find('[data-testid="robot-card"]').classes()).toContain('robot-card--active')
  })

  it('does not apply active class when active prop is false', () => {
    const wrapper = mountCard({ active: false })
    expect(wrapper.find('[data-testid="robot-card"]').classes()).not.toContain('robot-card--active')
  })

  it('renders an SVG icon for the status dot (not div-based)', () => {
    const wrapper = mountCard({ robot: { ...sampleRobot, online: true } })
    const statusEl = wrapper.find('[data-testid="robot-card-status-online"]')
    expect(statusEl.find('svg').exists()).toBe(true)
  })

  it('does not contain hardcoded hex colors in inline styles', () => {
    const wrapper = mountCard()
    const html = wrapper.html()
    expect(html).not.toMatch(/style="[^"]*#[0-9a-fA-F]{3,8}/)
  })
})
