import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StreamingCursor from '@/plugins/robot/components/StreamingCursor.vue'

describe('StreamingCursor', () => {
  it('renders blinking cursor when active', () => {
    const wrapper = mount(StreamingCursor, { props: { active: true } })
    const cursor = wrapper.find('[data-testid="streaming-cursor"]')
    expect(cursor.exists()).toBe(true)
    expect(cursor.classes()).toContain('streaming-cursor--active')
    expect(cursor.attributes('role')).toBe('status')
    expect(cursor.attributes('aria-label')).toBe('ai_assistant.robot.ai_thinking')
    expect(cursor.find('svg').exists()).toBe(true)
  })

  it('renders nothing when inactive', () => {
    const wrapper = mount(StreamingCursor, { props: { active: false } })
    expect(wrapper.find('[data-testid="streaming-cursor"]').exists()).toBe(false)
  })
})
