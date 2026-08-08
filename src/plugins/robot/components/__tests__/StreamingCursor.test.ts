import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import StreamingCursor from '../StreamingCursor.vue'

const mountCursor = (props: { active: boolean }) => mount(StreamingCursor, { props })

describe('StreamingCursor', () => {
  it('renders cursor element when active is true', () => {
    const wrapper = mountCursor({ active: true })
    expect(wrapper.find('[data-testid="streaming-cursor"]').exists()).toBe(true)
  })

  it('renders nothing when active is false', () => {
    const wrapper = mountCursor({ active: false })
    expect(wrapper.find('[data-testid="streaming-cursor"]').exists()).toBe(false)
  })

  it('renders an SVG element (not div-based cursor)', () => {
    const wrapper = mountCursor({ active: true })
    expect(wrapper.find('[data-testid="streaming-cursor"]').find('svg').exists()).toBe(true)
  })

  it('applies blink animation class when active', () => {
    const wrapper = mountCursor({ active: true })
    const cursor = wrapper.find('[data-testid="streaming-cursor"]')
    expect(cursor.classes()).toContain('streaming-cursor--active')
  })

  it('has aria-label for accessibility', () => {
    const wrapper = mountCursor({ active: true })
    expect(wrapper.find('[data-testid="streaming-cursor"]').attributes('aria-label')).toBeTruthy()
  })

  it('sets aria-hidden=false when active', () => {
    const wrapper = mountCursor({ active: true })
    const el = wrapper.find('[data-testid="streaming-cursor"]')
    expect(el.attributes('aria-hidden')).toBe('false')
  })

  it('does not contain hardcoded hex colors in inline styles', () => {
    const wrapper = mountCursor({ active: true })
    const html = wrapper.html()
    expect(html).not.toMatch(/style="[^"]*#[0-9a-fA-F]{3,8}/)
  })

  it('SVG uses currentColor for stroke (theme-aware)', () => {
    const wrapper = mountCursor({ active: true })
    const svg = wrapper.find('[data-testid="streaming-cursor"]').find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('stroke')).toBe('currentColor')
  })
})
