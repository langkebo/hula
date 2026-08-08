import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'ai_assistant.robot.available': 'Available',
        'ai_assistant.robot.unavailable': 'Unavailable'
      }
      return translations[key] ?? key
    },
    locale: { value: 'en' }
  })
}))

import type { ChatRole } from '@/services/matrix/ai/ChatRoleService'
import ChatRoleBadge from '../ChatRoleBadge.vue'

const sampleRole: ChatRole = {
  id: 'role1',
  name: 'General Assistant',
  avatar: 'https://example.com/avatar.png',
  category: 'AI助手',
  sort: 1,
  description: 'A general AI assistant',
  systemMessage: 'You are a helpful assistant',
  publicStatus: true,
  status: 0
}

const mountBadge = (props: Partial<{ role: ChatRole }> = {}) =>
  mount(ChatRoleBadge, { props: { role: sampleRole, ...props } })

describe('ChatRoleBadge', () => {
  it('renders role name', () => {
    const wrapper = mountBadge()
    expect(wrapper.find('[data-testid="chat-role-badge"]').text()).toContain('General Assistant')
  })

  it('renders available status when status is 0', () => {
    const wrapper = mountBadge({ role: { ...sampleRole, status: 0 } })
    expect(wrapper.find('[data-testid="chat-role-badge-status"]').text()).toContain('Available')
  })

  it('renders unavailable status when status is not 0', () => {
    const wrapper = mountBadge({ role: { ...sampleRole, status: 1 } })
    expect(wrapper.find('[data-testid="chat-role-badge-status"]').text()).toContain('Unavailable')
  })

  it('renders an SVG dot icon (not div-based)', () => {
    const wrapper = mountBadge()
    const statusEl = wrapper.find('[data-testid="chat-role-badge-status"]')
    expect(statusEl.find('svg').exists()).toBe(true)
    expect(statusEl.find('circle').exists()).toBe(true)
  })

  it('sets data-status attribute for styling', () => {
    const wrapper = mountBadge({ role: { ...sampleRole, status: 0 } })
    expect(wrapper.find('[data-testid="chat-role-badge-status"]').attributes('data-status')).toBe('available')
  })

  it('sets data-status to unavailable when status is not 0', () => {
    const wrapper = mountBadge({ role: { ...sampleRole, status: 1 } })
    expect(wrapper.find('[data-testid="chat-role-badge-status"]').attributes('data-status')).toBe('unavailable')
  })

  it('does not contain hardcoded hex colors in inline styles', () => {
    const wrapper = mountBadge()
    const html = wrapper.html()
    expect(html).not.toMatch(/style="[^"]*#[0-9a-fA-F]{3,8}/)
  })

  it('renders role name with truncation class', () => {
    const wrapper = mountBadge()
    const nameEl = wrapper.find('[data-testid="chat-role-badge-name"]')
    expect(nameEl.exists()).toBe(true)
    expect(nameEl.classes()).toContain('chat-role-badge__name')
  })
})
