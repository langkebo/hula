import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChatRoleBadge from '@/plugins/robot/components/ChatRoleBadge.vue'
import type { ChatRole } from '@/services/matrix/ai/ChatRoleService'

const makeRole = (overrides: Partial<ChatRole> = {}): ChatRole => ({
  id: 'role-1',
  name: '翻译官',
  avatar: '',
  category: 'default',
  sort: 0,
  description: '',
  systemMessage: '',
  publicStatus: false,
  status: 0,
  ...overrides
})

describe('ChatRoleBadge', () => {
  it('renders role name', () => {
    const wrapper = mount(ChatRoleBadge, { props: { role: makeRole() } })
    expect(wrapper.find('[data-testid="chat-role-badge-name"]').text()).toBe('翻译官')
  })

  it('marks status as available when role.status === 0', () => {
    const wrapper = mount(ChatRoleBadge, { props: { role: makeRole({ status: 0 }) } })
    const status = wrapper.find('[data-testid="chat-role-badge-status"]')
    expect(status.attributes('data-status')).toBe('available')
    expect(status.classes()).toContain('chat-role-badge__status--available')
  })

  it('marks status as unavailable when role.status !== 0', () => {
    const wrapper = mount(ChatRoleBadge, { props: { role: makeRole({ status: 1 }) } })
    const status = wrapper.find('[data-testid="chat-role-badge-status"]')
    expect(status.attributes('data-status')).toBe('unavailable')
    expect(status.classes()).toContain('chat-role-badge__status--unavailable')
  })
})
